// Focused real Phaser Twin Squads movement, membership, combat and lifecycle checks.
// node tests/twin-squads-browser.cjs <absolute screenshot output directory>
// NODE_PATH may point to a separately installed Playwright package directory.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2]);
fs.mkdirSync(output, { recursive: true });

// Compile the real source modules in memory. Production sources and the built
// game stay untouched; only this test page exposes the scene for inspection.
const modules = {};
function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(file);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            modules[path.relative(root, file).replace(/\\/g, '/').replace(/\.ts$/, '')] =
                ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
                    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015
                } }).outputText;
        }
    }
}
collect(path.join(root, 'src'));
modules['src/game'] = modules['src/game'].replace('const game =', 'window.testGame =');
const bootstrap = '<script src="/phaser.js"></script><script>' +
    'const modules=' + JSON.stringify(modules).replace(/</g, '\\u003c') + ',cache={};' +
    'function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};' +
    'new Function("module","exports","require",modules[id])(m,m.exports,name=>{' +
    'if(name==="phaser")return Phaser;const p=id.split("/");p.pop();' +
    'name.split("/").forEach(v=>{if(v==="..")p.pop();else if(v!==".")p.push(v)});return load(p.join("/"))});return m.exports;}' +
    // This suite checks the normal WD1 path; Premium progression/combat has its own suite.
    'load("src/interface/wave-director").WaveDirectorConfig.premiumInvaders.testMode.enabled=false;load("src/interface/mubarak").MubarakSettings.testSpawn.enabled=false;load("src/game");</script>';
const html = fs.readFileSync(path.join(root,'dist/index.html'),'utf8')
    .replace('<script src="game.js"></script>', bootstrap);
async function serve(route) {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
        let body = html;
        if (url.searchParams.has('reference')) body = body.replace('const factor = 2', 'const factor = 4');
        if (url.searchParams.has('canvas')) body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS');
        if (url.searchParams.has('limited')) body = body.replace('load("src/game");',
            'const getParameter=WebGLRenderingContext.prototype.getParameter;' +
            'WebGLRenderingContext.prototype.getParameter=function(p){' +
            'if(p===this.MAX_VIEWPORT_DIMS)return new Int32Array([1024,1024]);' +
            'if(p===this.MAX_RENDERBUFFER_SIZE)return 1024;return getParameter.call(this,p);};load("src/game");');
        await route.fulfill({ contentType: 'text/html', body }); return;
    }
    let file = url.pathname === '/phaser.js' ? path.join(root, 'node_modules/phaser/dist/phaser.js') :
        path.resolve(root, 'dist', '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) { await route.fulfill({ status: 403 }); return; }
    if (!fs.existsSync(file)) { await route.fulfill({ status: 404 }); return; }
    await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' :
        file.endsWith('.png') ? 'image/png' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
}

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://wojak.test/**',serve);
  await page.route('https://www.googletagmanager.com/**',r=>r.abort());
  for(const renderer of ['webgl','canvas']){
   await page.goto('http://wojak.test/?waveSeed=0'+(renderer==='canvas'?'&canvas':''));
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
   await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'helpers/active-wave-fixture.js'),'utf8')});
   const report=await page.evaluate(()=>{
    testGame.loop.stop();installActiveWaveFixture(testGame.scene.scenes[0]);const s=testGame.scene.scenes[0],m=s.alienManager,d=load('src/interface/wave-director'),planner=load('src/interface/premium-spawn').planPremiumFormation;
    const check=(ok,label)=>{if(!ok)throw Error(label);},near=(a,b,label)=>check(Math.abs(a-b)<1e-5,label+': '+a+' != '+b);
    const seedFor=(direction,wave=1)=>{let seed=0;while(d.getWavePlan(wave,seed).formation!=='TWIN_SQUADS'||d.getWavePlan(wave,seed).initialDirection!==direction)seed++;return seed;};
    const reset=(seed=seedFor(1),wave=1,premium=false)=>{d.WaveDirectorConfig.premiumInvaders.testMode.enabled=premium;m.seed=seed;s.restart();if(wave!==1){s.wave=wave;s.scoreManager.setWave(wave);m.reset(wave);}return m.rows;};
    const alive=g=>g.aliens.filter(a=>a.active),roots=()=>m.aliens.getChildren().filter(a=>a.active);
    const safe=()=>{const all=roots();all.forEach((a,i)=>{const b=m._twinBounds(a);check(b.left>=-1e-5&&b.right<=800+1e-5,'exterior clearance');all.slice(i+1).forEach(o=>{const c=m._twinBounds(o);check(b.right<=c.left+1e-5||c.right<=b.left+1e-5||b.bottom<=c.top+1e-5||c.bottom<=b.top+1e-5,'no sprite/hitbox overlap');});});all.forEach(a=>{near(a.y,m.twinSpawnY.get(a)+m.twinVerticalOffset,'authoritative shared Y');const body=a.body;near(body.y,a.y+a.scaleY*(body.offset.y-a.displayOriginY),'synchronized body Y');});m.rows.forEach(g=>check(!('descentCount' in g)&&!('pendingDescents' in g),'obsolete row descent state removed'));};
    const snapshot=()=>m.rows.map(g=>({direction:g.direction,bounces:g.bounceCount,positions:alive(g).map(a=>[a.x,a.y])}));
    const compare=(expected,label)=>snapshot().forEach((g,r)=>{check(g.direction===expected[r].direction&&g.bounces===expected[r].bounces,label+' states');g.positions.forEach((p,i)=>{near(p[0],expected[r].positions[i][0],label+' x');near(p[1],expected[r].positions[i][1],label+' y');});});
    const face=(g,sign)=>{g.direction=sign;alive(g).forEach(a=>a.setDirection(sign));};
    const isolate=indices=>{const rows=reset();rows.forEach((g,i)=>g.aliens.forEach((a,c)=>{if(!indices.includes(i)||c>0)a.disableBody(true,true);}));return indices.map(i=>rows[i]);};
    const place=(g,x,y)=>{const a=alive(g)[0];if(a.y!==y)alive(g).forEach(root=>m.twinSpawnY.set(root,y));m._move(alive(g),x-a.x,0);};
    const starts=[];
    for(const direction of [-1,1]){
     const seed=seedFor(direction),rows=reset(seed);check(rows.length===6&&roots().length===24,'six rows / 24 slots');
     rows.forEach((g,i)=>{check(g.squad===(i<3?'left':'right')&&g.row===i%3&&g.aliens.length===4,'stable squad/logical row identity');check(g.initialDirection===(i<3?direction:-direction)&&g.initialEntityCount===4,'mirrored direction and fixed row N');check(g.bounds.left===0&&g.bounds.right===800,'full-world row bounds');g.aliens.forEach((a,c)=>{near(a.x,68+(i<3?0:400)+88*c,'original square columns');near(a.y,100+74*(i%3),'original square rows');near(a.displayWidth,87.36,'original sprite size');});});safe();
     const rng=Phaser.Math.RND.state(),before=snapshot();m.update(100,10000);rows.forEach((g,r)=>alive(g).forEach((a,c)=>{near(a.x-before[r].positions[c][0],g.initialDirection*10,'squares initially move together');near(a.y,before[r].positions[c][1],'no early descent');}));
     for(let frame=0;frame<500;frame++){m.update(10,10000);safe();}check(Phaser.Math.RND.state()===rng,'movement uses no live RNG');
     reset(seed);m.update(10000,10000);const long=snapshot();reset(seed);for(let frame=0;frame<1000;frame++)m.update(10,10000);compare(long,'long/split');safe();
     starts.push({state:direction<0?'outward':'inward',seed});
    }
    // Bring ONLY the top pair closer. Other rows retain direction, travel and counters.
    let rows=reset();m._move(rows[0].aliens,10,0);m._move(rows[3].aliens,-10,0);const before=snapshot();
    m.update(143.2+1e-6,10000);check(rows[0].bounceCount===1&&rows[3].bounceCount===1,'top pair contact');
    for(const i of [1,2,4,5]){check(rows[i].bounceCount===0&&rows[i].direction===before[i].direction,'unrelated row never reverses');near(rows[i].aliens[0].x-before[i].positions[0][0],before[i].direction*14.3200001,'unrelated row keeps moving');}safe();
    // Killing the outer cell makes only its row narrower/faster and delays its collision.
    rows=reset();rows[0].aliens[3].disableBody(true,true);m.update(244,10000);
    check(rows[0].bounceCount===0&&rows[3].bounceCount===0&&rows[1].bounceCount===1&&rows[4].bounceCount===1,'live widths produce different contact times');safe();
    // Exterior bounces remain row-local and never trigger descent.
    rows=reset(seedFor(-1));m._move(rows[2].aliens,-20,0);m.update(43.2+1e-6,10000);
    check(rows[2].bounceCount===1&&rows.filter((g,i)=>i!==2).every(g=>g.bounceCount===0),'only bottom wall owner reverses/counts');near(rows[2].aliens[0].y,248,'wall never descends');near(rows[1].aliens[0].y,174,'other row height unchanged');safe();
    // Row collision counts are horizontal diagnostics only, never vertical events.
    let [a,b]=isolate([0,3]);place(a,350,100);place(b,450,100);
    const gap=m._twinBounds(alive(b)[0]).left-m._twinBounds(alive(a)[0]).right;m.update(gap/300*1000+1e-5,10000);
    check(a.bounceCount===1&&b.bounceCount===1&&m.descentCount===0,'contact never descends');near(alive(a)[0].y,100,'first row retains height');near(alive(b)[0].y,100,'second row retains height');safe();
    const counts=[a.bounceCount,b.bounceCount];m.update(10,10000);check(a.bounceCount===counts[0]&&b.bounceCount===counts[1],'separating pair never retriggers');safe();
    // Current hitboxes/visual clearance, not original index/squad, determine eligible pairs.
    for(const indices of [[0,5],[0,1]]){
     [a,b]=isolate(indices);place(a,350,100);place(b,450,100);face(a,1);face(b,-1);
     m.update(gap/300*1000-1e-5,10000);check(a.bounceCount===0&&b.bounceCount===0,'no early contact');m.update(2e-5,10000);
     check(a.bounceCount===1&&b.bounceCount===1,'different original levels or same original squad can collide');safe();
    }
    [a,b]=isolate([0,5]);place(a,300,100);place(b,500,400);m.update(1000,10000);
    check(a.bounceCount===0&&b.bounceCount===0&&alive(a)[0].x>alive(b)[0].x,'vertically separate rows pass through center');safe();
    // Eliminating a row never accelerates, reverses or resets unrelated row state.
    rows=reset();rows[0].aliens.forEach(a=>a.disableBody(true,true));const x=rows[1].aliens[0].x;m.update(100,10000);near(rows[1].aliens[0].x-x,10,'sibling elimination preserves row speed');check(rows[1].bounceCount===0,'no sibling reset/contact');safe();
    for(let count=4;count>=1;count--){rows=reset();rows[0].aliens.slice(count).forEach(a=>a.disableBody(true,true));const x=rows[0].aliens[0].x;m.update(1,10000);near(rows[0].aliens[0].x-x,.1*(1+.5*(4-count)/3),'row survivor formula');}
    // Entire-square elimination leaves surviving rows patrolling full width.
    rows=reset();rows.slice(3).forEach(g=>g.aliens.forEach(a=>a.disableBody(true,true)));m.update(4243.2+1e-6,10000);
    check(rows.slice(0,3).every(g=>g.bounceCount===1)&&m.hasAliveAliens&&s.state==='playing','surviving original squad reaches far exterior without early completion');safe();
    // Shared timer: first 25 at 4s, then 50 at 8s, never on earlier collisions/walls.
    for(const direction of [1,-1]){
     rows=reset(seedFor(direction));const spawn=new Map(roots().map(a=>[a,a.y])),events=[],hook=m.onDescent;
     m.onDescent=count=>{events.push(count);roots().forEach(a=>near(a.y,spawn.get(a)+25*count,'all survivors synchronized before hook'));};
     m.update(3999.999,10000);check(m.descentCount===0&&m.twinVerticalOffset===0,'no descent before 4 seconds');check(rows.some(g=>g.bounceCount>1),'many horizontal events without descent');safe();
     const signs=rows.map(g=>g.direction);m.update(.001,10000);check(m.descentCount===1&&m.twinVerticalOffset===25,'exact 4-second event');rows.forEach((g,i)=>check(g.direction===signs[i],'timer never synchronizes direction'));safe();
     m.update(3999.999,10000);check(m.descentCount===1,'no second descent before 8s');m.update(.001,10000);check(m.descentCount===2&&m.twinVerticalOffset===50&&JSON.stringify(events)==='[1,2]','8 seconds gives exactly 50');safe();m.onDescent=hook;
    }
    // A single 12.5s frame consumes three timed descents and retains its .5s remainder.
    reset();m.update(12500,10000);const timedLong=snapshot();check(m.descentCount===3&&m.twinVerticalOffset===75,'large frame has exactly 3 events');near(m.twinDescentElapsedMs,500,'large-frame remainder');
    reset();for(let i=0;i<1250;i++)m.update(10,10000);compare(timedLong,'timed long/split');safe();
    for(const fps of [30,60,144]){reset();for(let i=0;i<fps*8;i++)m.update(1000/fps,10000);check(m.descentCount===2&&m.twinVerticalOffset===50,'fixed timer at '+fps+' FPS');safe();}
    for(const wave of [1,5,10,20]){rows=reset(seedFor(1,wave),wave);rows[0].aliens.slice(1).forEach(a=>a.disableBody(true,true));rows.slice(3).forEach(g=>g.aliens.forEach(a=>a.disableBody(true,true)));m.update(3999,10000);check(m.descentCount===0,'wave/casualties cannot accelerate timer');m.update(1,10000);check(m.descentCount===1,'fixed interval after row/squad elimination');safe();}
    // Y is derived from spawn+shared offset, not accumulated from individual positions.
    reset();m.update(3900,10000);const drifted=roots()[7];drifted.y+=7;m.update(100,10000);near(drifted.y,m.twinSpawnY.get(drifted)+25,'authoritative position repairs drift');safe();
    // Complete Phaser updates and actual scene pause do not add or consume extra time.
    reset();s.firingTimer=Infinity;for(let frame=0;frame<180;frame++)s.sys.step(100000+frame*1000/60,1000/60);check(m.descentCount===0,'full scene still before 4s');
    const paused=snapshot(),elapsed=m.twinDescentElapsedMs;s.sys.pause();testGame.scene.update(200000,10000);compare(paused,'pause');near(m.twinDescentElapsedMs,elapsed,'pause freezes timer');s.sys.resume();
    for(let frame=0;frame<60;frame++)s.sys.step(200000+frame*1000/60,1000/60);check(m.descentCount===1,'resume completes only one gameplay second');safe();
    // Fatal descent stops at the FIRST timer event, before subsequent long-frame motion.
    reset();const line=Math.max(...roots().map(a=>a.body.bottom))+24.999;let fatalHooks=0;const hook=m.onDescent;m.onDescent=()=>fatalHooks++;
    check(m.update(12000,line),'timed descent invokes invasion');check(m.descentCount===1&&m.twinVerticalOffset===25&&fatalHooks===0,'fatal first event prevents later events/hooks');const fatal=snapshot();m.update(12000,10000);compare(fatal,'fatal stop');m.onDescent=hook;
    reset();m.update(4000,10000);compare(fatal,'fatal contact time');safe();
    // High-speed swept contacts and clearance must match split frames.
    const fast=seedFor(1,1000);reset(fast,1000);m.update(5000,10000);const fastState=snapshot();safe();reset(fast,1000);for(let i=0;i<5000;i++){m.update(1,10000);safe();}compare(fastState,'Wave1000 long/split');
    // Every Premium anchor keeps one complete root in exactly its upper owner row.
    const coverage=new Set();d.WaveDirectorConfig.premiumInvaders.testMode.enabled=true;
    for(let seed=0;seed<10000&&coverage.size<24;seed++){
     const plan=d.getWavePlan(1,seed);if(plan.formation!=='TWIN_SQUADS')continue;const f=planner(plan,s.premiumProgress).premiums[0],key=f.squad+':'+f.row+':'+f.column+':'+plan.initialDirection;if(coverage.has(key))continue;coverage.add(key);
     rows=reset(seed,1,true);const owner=rows.find(g=>g.squad===f.squad&&g.row===f.row),p=owner.aliens.find(a=>a.premium).premium;
     check(rows.length===6&&roots().length===21&&rows.filter(g=>g.aliens.includes(p.sprite)).length===1,'one intact Premium root / six movement groups');check(owner.initialEntityCount===3&&rows.find(g=>g.squad===f.squad&&g.row===f.row+1).initialEntityCount===2,'Premium row N3 / lower row N2');near(p.sprite.displayWidth,175.36,'Premium size preserved');safe();
     for(let i=0;i<200;i++){m.update(20,10000);safe();}
    }
    check(coverage.size===24,'12 Premium anchors in both opening states');
    // Deterministic stress includes six-way contacts, independent Y, casualties and Premiums.
    let sample=0x574433;const random=()=>{sample^=sample<<13;sample^=sample>>>17;sample^=sample<<5;return(sample>>>0)/4294967296;};
    const move=m._move;let calls=0;m._move=function(...args){if(++calls>3000)throw Error('zero-time contact loop');return move.apply(this,args);};
    try{for(let trial=0;trial<40;trial++){rows=reset(seedFor(trial%2?1:-1),1,trial%3===0);for(let frame=0;frame<100;frame++){if(frame%5===0)rows.forEach(g=>{if(alive(g).length>1&&random()<.5){const all=alive(g);all[Math.floor(random()*all.length)].disableBody(true,true);}});calls=0;try{m.update(20+random()*480,10000);safe();}catch(e){throw Error('stress '+trial+'/'+frame+': '+e.message+' '+JSON.stringify(snapshot()));}}}}finally{m._move=move;}
    // One firing scheduler/cap and real collision kills still span all six row groups.
    rows=reset();m.update(2750,10000);m.stopMovement();let permissions=0;const fire=s._enemyFires;s._enemyFires=function(){permissions++;return fire.call(this);};s.time.now=s.firingTimer+.01;s.update(undefined,0);s.update(undefined,0);check(permissions===1,'one shared firing scheduler');s._enemyFires=fire;
    const bullets=s.assetManager.enemyBullets;while(bullets.countActive(true)<15)bullets.get().setPosition(50,50);s._enemyFires();check(bullets.countActive(true)===15,'shared threat cap15');near(s.firingTimer-s.time.now,250,'same retry');
    const shot=a=>{const bullet=s.assetManager.bullets.get();bullet.enableBody(true,a.body.center.x,a.body.center.y,true,true);bullet.body.preUpdate(false,0);check(s.physics.overlap([bullet],[a],s._bulletHitAliens,null,s),'real Arcade hit');const q=s.pendingCleanup;s.pendingCleanup=[];q.forEach(f=>f());};
    rows.slice(0,3).forEach(g=>g.aliens.slice().forEach(shot));check(m.hasAliveAliens&&s.state==='playing'&&s.invadersKilled===12,'whole original squad elimination never completes wave');near(s.scoreManager.score,120,'regular rewards');rows.slice(3).forEach(g=>g.aliens.slice().forEach(shot));check(!m.hasAliveAliens&&s.state==='waveTransition'&&s.invadersKilled===24,'all rows complete wave');near(s.scoreManager.score,1240,'same clear reward');const frozen=m.twinDescentElapsedMs;s.update(undefined,10000);near(m.twinDescentElapsedMs,frozen,'wave transition freezes timer');s.time.now=s.nextWaveReadyAt;s._startNextWave();check(m.twinDescentElapsedMs===0&&m.twinVerticalOffset===0,'wave transition resets timer and offset');check(s.wave===2&&s.state==='playing'&&roots().length===24,'ordinary next wave');
    rows=reset(seedFor(-1),1,true);const p=roots().find(a=>a.premium).premium;m.stopMovement();p.sprite.setPosition(p.footprint.squad==='left'?200:600,120);p.syncBody();shot(p.sprite);check(p.stage===1,'Premium accepted hit');shot(p.sprite);check(p.stage===1,'800ms immunity');for(let i=0;i<8;i++){p.update(250);p.updateWeapons(250,s.player,()=>{});}check(p.candles.flights.length>0,'Premium attacks unchanged');roots().filter(a=>!a.premium).slice().forEach(shot);check(s.state==='playing','last Premium keeps wave alive');for(let hit=1;hit<5;hit++){p.update(800);shot(p.sprite);}check(s.state==='waveTransition'&&s.invadersKilled===21,'fifth hit completes Premium wave');near(s.scoreManager.score,1210,'same Premium rewards');
    reset(seedFor(-1));s.premiumProgress.recordDefeat('wojak',10);let eligibleSeed=0;while(d.getWavePlan(14,eligibleSeed).formation!=='TWIN_SQUADS'||!planner(d.getWavePlan(14,eligibleSeed),s.premiumProgress).premiums.length)eligibleSeed++;m.seed=eligibleSeed;m.reset(13);check(m.premiumPlan.premiums.length===0,'normal wait');m.reset(14);check(m.premiumPlan.premiums.length===1,'normal eligible 10% roll');s.restart();check(!s.premiumProgress.eligible('wojak',100),'run unlock reset');
    for(let i=0;i<6;i++){rows=reset();check(m.update(0,rows[i].aliens[0].body.bottom),'any row invasion');check(m.movementStopped,'fatal invasion stops all');}
    rows=reset();m.update(1000,10000);m.stopMovement();const stopped=snapshot();m.update(10000,10000);compare(stopped,'stop');s._gameOver();s.restart();check(m.rows.length===6&&m.rows.every(g=>g.bounceCount===0&&g.direction===g.initialDirection)&&m.twinDescentElapsedMs===0&&m.twinVerticalOffset===0,'restart resets all row state');safe();
    reset(seedFor(1,2),2);check(m.rows.every(g=>g.bounceCount===0)&&m.twinDescentElapsedMs===0&&m.twinVerticalOffset===0,'next wave resets row counters');
    return{renderer:testGame.renderer.type,starts,premiumAnchors:coverage.size/2,movementGroups:6,groupSlots:[4,4,4,4,4,4],normalEligibleSeed:eligibleSeed};
   });
   reports.push(report);
   for(const start of report.starts){
    await page.evaluate(seed=>{const s=testGame.scene.scenes[0];s.alienManager.seed=seed;s.restart();s.alienManager.stopMovement();s.sys.displayList.depthSort();testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();},start.seed);
    await page.screenshot({path:path.join(output,renderer+'-'+start.state+'.png')});
   }
   await page.evaluate(seed=>{
    const s=testGame.scene.scenes[0],d=load('src/interface/wave-director');d.WaveDirectorConfig.premiumInvaders.testMode.enabled=true;s.alienManager.seed=seed;s.restart();
    const roots=s.alienManager.aliens.getChildren().slice(),p=roots.find(a=>a.premium).premium;
    p.sprite.setPosition(p.footprint.squad==='left'?200:600,120);p.syncBody();p.hit();
    for(let i=0;i<8;i++){p.update(250);p.updateWeapons(250,s.player,()=>{});}
    if(!p.candles.flights.length)throw Error('Twin shutdown fixture needs active Premium weapons');
    const owned=roots.concat([p.character,p.foreground,p.percentage,p.lighting],p.candles.flights.map(f=>f.sprite),p.tears.flights);
    testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();if(owned.some(a=>a.active))throw Error('Twin shutdown leaves active roots/layers/weapons');
   },report.starts[0].seed);
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'twin-squads-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Twin Squads Canvas/WebGL six independent rows, pair-local swept visual/hitbox contacts, shared 4-second/25-pixel descent, all Premium anchors with one owner row, high-speed/stress, gameplay and lifecycle regressions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
