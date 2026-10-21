// Real Phaser Snake: uppermost surviving original row triggers synchronized descent.
// node tests/snake-browser.cjs <absolute screenshot output directory>
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
    'load("src/interface/wave-director").WaveDirectorConfig.premiumInvaders.testMode.enabled=false;load("src/game");</script>';
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
 try{
  const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('http://wojak.test/**',serve);await page.route('https://www.googletagmanager.com/**',r=>r.abort());
  for(const renderer of ['webgl','canvas']){
   await page.goto('http://wojak.test/?waveSeed=0'+(renderer==='canvas'?'&canvas':''));await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
   const report=await page.evaluate(()=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],m=s.alienManager,d=load('src/interface/wave-director');
    const check=(ok,label)=>{if(!ok)throw Error(label);},near=(a,b,label)=>check(Math.abs(a-b)<1e-5,label+': '+a+' != '+b);
    check(JSON.stringify(d.WaveDirectorConfig.formation.choices)===JSON.stringify(['grid','diamond','TWIN_SQUADS','SNAKE']),'four production choices');
    const seedFor=(direction,wave=1)=>{let seed=0;while(d.getWavePlan(wave,seed).formation!=='SNAKE'||d.getWavePlan(wave,seed).initialDirection!==direction)seed++;return seed;};
    const reset=(seed,wave=1)=>{m.seed=seed;s.restart();if(wave!==1){s.wave=wave;s.scoreManager.setWave(wave);m.reset(wave);}return m.rows;};
    const live=()=>m.aliens.getChildren().filter(a=>a.active),safe=()=>{
     const roots=live();roots.forEach((a,i)=>{const b=a.getBounds();check(Math.min(b.left,a.body.left)>=-1e-5&&Math.max(b.right,a.body.right)<=800+1e-5,'whole row artwork/body inside world');const r=m.rows.findIndex(g=>g.aliens.includes(a));near(a.y,100+r*74+m.descentCount*25,'synchronized row level');roots.slice(i+1).forEach(o=>{const c=o.getBounds();check(b.right<=c.left+1e-5||b.left>=c.right-1e-5||b.bottom<=c.top+1e-5||b.top>=c.bottom-1e-5,'no row or cross-row overlap');});});
    };
    const snapshot=()=>m.rows.map(g=>({direction:g.direction,bounces:g.bounceCount,positions:g.aliens.map(a=>[a.x,a.y])}));
    const starts=[];
    for(const direction of [1,-1]){
     const seed=seedFor(direction),rows=reset(seed);check(live().length===24&&rows.length===4,'four rows / 24 slots');
     rows.forEach((g,r)=>{check(g.aliens.length===6&&g.initialDirection===(r%2?-direction:direction),'six members / alternating starting sign');g.aliens.forEach((a,c)=>{near(a.x,158+r%2*44+c*88,'half-column stagger, centered overall');near(a.y,100+r*74,'fixed four vertical levels');near(a.displayWidth,87.36,'original sprite width');check(a.direction===g.direction,'row shares facing');});});
     safe();let descents=0;const hook=m.onDescent;m.onDescent=()=>descents++;
     const before=rows.map(g=>g.aliens.map(a=>[a.x,a.y])),rng=Phaser.Math.RND.state();m.update(100,10000);
     rows.forEach((g,r)=>g.aliens.forEach((a,c)=>{near(a.x-before[r][c][0],g.initialDirection*10,'alternating row motion');near(a.y,before[r][c][1],'no vertical movement');}));
     for(let frame=0;frame<100;frame++)m.update(100,10000);safe();
     rows.forEach((g,r)=>{check(g.bounceCount>0&&g.descentCount===0,'row contacts never own vertical descent');g.aliens.forEach((a,c)=>{near(a.y,before[r][c][1]+m.descentCount*25,'all rows descend together');if(c)near(a.x-g.aliens[c-1].x,88,'row spacing preserved');});});
     check(descents>0&&m.descentCount===descents,'one ally hook per reference descent');check(Phaser.Math.RND.state()===rng,'movement has no live RNG draws');m.onDescent=hook;
     reset(seed);m.update(10000,10000);const long=snapshot();reset(seed);for(let i=0;i<100;i++)m.update(100,10000);
     snapshot().forEach((g,r)=>{check(g.direction===long[r].direction&&g.bounces===long[r].bounces,'long/split frame reflections');g.positions.forEach((p,c)=>{near(p[0],long[r].positions[c][0],'long-frame x');near(p[1],long[r].positions[c][1],'long-frame y');});});safe();
     starts.push({configuration:direction===1?'A':'B',seed});
    }
    // A non-trigger row can bounce without moving any row down.
    reset(seedFor(1));m._move(m.rows[1].aliens,-148.32,0);m.update(101,10000);
    check(m.rows[1].bounceCount===1&&m.rows[0].bounceCount===0&&m.descentCount===0,'non-trigger contact never descends');safe();
    const distance=m._groupBounds(m.rows[0].aliens).right;
    const otherSigns=m.rows.map(g=>g.direction);m.update((800-distance)/100*1000+1e-5,10000);
    check(m.descentCount===1&&m.rows[0].bounceCount===1,'original row 1 triggers 25-pixel descent');safe();
    check(m.rows[1].direction===otherSigns[1],'descent never synchronizes sibling directions');
    // Casualties change one row's next contact; other rows reverse independently.
    let rows=reset(seedFor(1));rows[0].aliens.forEach((a,c)=>{if(c===0||c===5)a.disableBody(true,true);});
    m.update(1600,10000);check(rows[0].bounceCount===0&&rows.slice(1).every(g=>g.bounceCount===1),'one row does not reverse siblings');safe();
    // Existing survivor formula per six-root row; changes never reposition survivors.
    for(let count=6;count>=1;count--){rows=reset(seedFor(1));rows[0].aliens.forEach((a,c)=>{if(c>=count)a.disableBody(true,true);});const positions=live().map(a=>[a,a.x,a.y]);m.update(0,10000);positions.forEach(([a,x,y])=>{near(a.x,x,'count change is not a teleport');near(a.y,y,'count change keeps height');});const x=rows[0].aliens[0].x,other=rows[1].aliens[0].x;m.update(1,10000);near(rows[0].aliens[0].x-x,.1*(1+.5*(6-count)/5),'original survivor formula per row');near(rows[1].aliens[0].x-other,-.1,'sibling speed unaffected');}
    for(const wave of [1,2,5,6,14,100,1000]){rows=reset(seedFor(1,wave),wave);const x=rows[0].aliens[0].x;m.update(1,10000);near(rows[0].aliens[0].x-x,d.getWavePlan(wave,m.seed).movementSpeed*.001,'wave speed progression');safe();}
    // Intact timing is visibly row-driven, and differs between staggered openings.
    const timing=[];
    for(const wave of [1,5,10,20])for(const direction of [1,-1]){
     reset(seedFor(direction,wave),wave);const g=m.rows[0],bounds=m._groupBounds(g.aliens),speed=m.configuration.movementSpeed;
     const first=(direction>0?800-bounds.right:bounds.left)/speed;
     m.update(first*1000-1e-4,10000);check(m.descentCount===0,'no descent before trigger edge');
     m.update(2e-4,10000);check(m.descentCount===1&&g.bounceCount===1,'trigger descends at either edge');safe();
     const period=(800-(bounds.right-bounds.left))/speed;
     m.update(period*1000,10000);check(m.descentCount===2&&g.bounceCount===2,'trigger reverses and descends at next exterior edge');safe();
     timing.push({wave,direction,firstSeconds:first,intervalSeconds:period});
    }
    // Trigger transfer preserves row phase and uses logical identity, never current Y.
    for(const triggerIndex of [1,3]){
     reset(seedFor(1));m.update(600,10000);
     m.rows.slice(0,triggerIndex).forEach(g=>g.aliens.slice().forEach(a=>a.destroy()));
     const g=m.rows[triggerIndex],before=g.aliens.map(a=>[a.x,a.y]),sign=g.direction;
     m.update(0,10000);g.aliens.forEach((a,i)=>{near(a.x,before[i][0],'trigger transfer preserves x');near(a.y,before[i][1],'trigger transfer preserves y');});check(g.direction===sign,'trigger transfer preserves direction');
     const bounds=m._groupBounds(g.aliens),distance=sign>0?800-bounds.right:bounds.left;
     m.update(distance/100*1000+1e-5,10000);check(m.descentCount===1&&g.direction===-sign,'uppermost living logical row takes over');safe();
    }
    reset(seedFor(1));m._move(m.rows[0].aliens,0,150);m._move(m.rows[1].aliens,-148.32,0);m.update(101,10000);
    check(m.rows[1].bounceCount===1&&m.descentCount===0,'screen Y never changes trigger identity');
    // A long fatal frame stops all rows at the trigger contact with synchronized bodies.
    reset(seedFor(1));const line=Math.max(...live().map(a=>a.body.bottom))+24.999;
    const bodyY=live().map(a=>a.body.y),hook=m.onDescent;let fatalHooks=0;m.onDescent=()=>fatalHooks++;
    check(m.update(10000,line),'trigger descent causes invasion');check(m.descentCount===1&&fatalHooks===0,'fatal descent stops before ally callback');live().forEach((a,i)=>near(a.body.y,bodyY[i]+25,'physics follows fatal descent'));const fatal=snapshot();m.update(10000,10000);check(JSON.stringify(snapshot())===JSON.stringify(fatal),'fatal movement stays stopped');m.onDescent=hook;
    reset(seedFor(1));m.update(1583.2+1e-7,10000);snapshot().forEach((g,r)=>g.positions.forEach((p,c)=>{near(p[0],fatal[r].positions[c][0],'fatal frame stops horizontal travel at trigger contact');near(p[1],fatal[r].positions[c][1],'fatal frame stops vertical travel');}));
    reset(seedFor(1));m.update(700,10000);const paused=JSON.stringify(snapshot());
    s.sys.pause();testGame.scene.update(999999,5000);check(JSON.stringify(snapshot())===paused,'scene pause preserves row phase');s.sys.resume();
    const phase=m.rows[0].aliens[0].x;m.update(100,10000);near(m.rows[0].aliens[0].x-phase,10,'resume consumes gameplay delta without wall-clock catchup');
    m.reset(1);check(m.rows.every(g=>g.bounceCount===0&&g.direction===g.initialDirection)&&m.descentCount===0,'new wave resets all row state');
    check(!('classicReference' in m),'unused invisible Classic reference removed');
    // Explicit owner-approved Premium exclusion, including otherwise successful and debug rolls.
    rows=reset(seedFor(1,14),14);s.premiumProgress.recordDefeat('wojak',10);m.reset(14);check(s.premiumProgress.eligible('wojak',14)&&m.premiumPlan.premiums.length===0&&live().length===24,'eligible Snake stays all regular without clearing unlock');
    d.WaveDirectorConfig.premiumInvaders.testMode.enabled=true;m.reset(14);check(m.premiumPlan.premiums.length===0&&live().length===24,'forced Premium cannot cross independently moving rows');
    check(d.WaveDirectorConfig.premiumInvaders.types[0].spawnProbability===.1,'compatible Premium probability unchanged');d.WaveDirectorConfig.premiumInvaders.testMode.enabled=false;
    // One global scheduler and 15-threat cap, followed by actual Arcade wave completion.
    rows=reset(seedFor(1));m.stopMovement();const group=s.assetManager.enemyBullets;
    let permissions=0;const fire=s._enemyFires;s._enemyFires=function(){permissions++;return fire.call(this);};s.time.now=s.firingTimer+.01;s.update(undefined,0);check(permissions===1&&group.countActive(true)===1,'one permission for all four rows');s.update(undefined,0);check(permissions===1,'no row-specific firing timer');s._enemyFires=fire;
    while(group.countActive(true)<15)group.get().setPosition(50,50);s._enemyFires();check(group.countActive(true)===15,'shared 15 threat cap');near(s.firingTimer-s.time.now,250,'same retry cadence');
    const shot=a=>{const b=s.assetManager.bullets.get();b.enableBody(true,a.body.center.x,a.body.center.y,true,true);b.body.preUpdate(false,0);check(s.physics.overlap([b],[a],s._bulletHitAliens,null,s),'actual Arcade collision');const q=s.pendingCleanup;s.pendingCleanup=[];q.forEach(f=>f());};
    rows.slice(0,3).forEach(g=>g.aliens.slice().forEach(shot));check(live().length===6&&s.state==='playing'&&m.hasAliveAliens,'remaining fourth row keeps wave alive');rows[3].aliens.slice().forEach(shot);check(!m.hasAliveAliens&&s.state==='waveTransition'&&s.invadersKilled===24,'all rows defeated completes wave');near(s.scoreManager.score,1240,'unchanged score / clear bonus');
    s.time.now=s.nextWaveReadyAt;s._startNextWave();check(s.wave===2&&s.state==='playing'&&live().length===24,'next wave starts once');
    reset(seedFor(1));m.update(2000,10000);m.stopMovement();const stopped=snapshot();m.update(1000,10000);check(JSON.stringify(stopped)===JSON.stringify(snapshot()),'stop applies to every row');s._gameOver();s.restart();check(m.rows.every(g=>g.bounceCount===0&&g.descentCount===0&&g.direction===g.initialDirection)&&m.descentCount===0,'restart resets all row state');
    return {renderer:testGame.renderer.type,starts,rows:4,slots:24,stagger:44,descent:25,timing};
   });
   reports.push(report);
   for(const start of report.starts){await page.evaluate(seed=>{const s=testGame.scene.scenes[0];s.alienManager.seed=seed;s.restart();s.alienManager.stopMovement();s.sys.displayList.depthSort();testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();},start.seed);await page.screenshot({path:path.join(output,renderer+'-snake-'+start.configuration+'.png')});}
   await page.evaluate(()=>{const s=testGame.scene.scenes[0],roots=s.alienManager.aliens.getChildren().slice();testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();if(roots.some(a=>a.active))throw Error('Snake shutdown leaves live row roots');});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'snake-browser.json'),JSON.stringify(reports,null,2));console.log('PASS: Snake Canvas/WebGL geometry, independent rows, visible trigger-row descent at Waves 1/5/10/20, trigger handoff after casualties, frame partitioning, invasion, pause/reset, Premium exclusion and gameplay regressions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
