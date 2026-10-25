// Wave Director plans, real Phaser formations, threat budgets and boss transitions.
// node tests/wave-director-browser.cjs <absolute screenshot output directory>
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
  for(const renderer of ['webgl','canvas']) {
   await page.goto('http://wojak.test/?waveSeed=12345'+(renderer==='canvas'?'&canvas':''));
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
   await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'helpers/active-wave-fixture.js'),'utf8')});
   const report=await page.evaluate(()=>{
    testGame.loop.stop();installActiveWaveFixture(testGame.scene.scenes[0]);const s=testGame.scene.scenes[0];
    if(!(s.firingTimer>s.time.now&&s.firingTimer-s.time.now<=1610))throw Error('initial wave waits for configured timer');
    s.restart();
    const d=load('src/interface/wave-director'),check=(ok,label)=>{if(!ok)throw Error(label);};
    const near=(a,b,label)=>check(Math.abs(a-b)<1e-6,label+': '+a+' != '+b);
    for(const wave of [2,3,4,5,6,7,8,9,10,11,15,20,50,100]){
     s.restart();s.wave=wave-1;s.completedBossWave=wave-1;
     s.state='waveTransition';s.nextWaveReadyAt=0;s._startNextWave();
     check(s.wave===wave&&s.state==='playing','regular wave timer reset');
     const deadline=s.firingTimer;
     near(deadline-s.time.now,1610*Math.pow(.98,Math.floor((wave-1)/5))*[1,.9,.75,.6,.5][(wave-1)%5],'new-wave formula');
     s._startNextWave();near(s.firingTimer,deadline,'duplicate transition cannot shorten timer');
    }
    s.restart();s.alienManager.stopMovement();
    const actualFire=s._enemyFires;let permissions=0;
    s._enemyFires=function(){permissions++;return actualFire.call(this);};
    const deadline=s.firingTimer;
    s.time.now=deadline;s.update(undefined,0);check(permissions===0,'wait for timer expiration');
    s.time.now=deadline+.01;s.update(undefined,0);check(permissions===1,'one global firing opportunity');
    near(s.firingTimer-s.time.now,1610,'successful attack re-arms shared timer');
    s.update(undefined,0);check(permissions===1,'same frame/time cannot fire twice');
    s._gameOver();check(s.firingTimer===Infinity,'game over invalidates deadline');
    s.update(undefined,0);check(permissions===1,'game over suppresses firing');
    s._enemyFires=actualFire;s.restart();near(s.firingTimer-s.time.now,1610,'restart uses first-cycle timer');
    // Restart must discard a previous direction/stop/descent, for either Wave 1 choice.
    for(const direction of [-1,1]){
     let seed=0;while(d.getWavePlan(1,seed).initialDirection!==direction||d.getWavePlan(1,seed).squads||d.getWavePlan(1,seed).rowGroups)seed++;
     const m=s.alienManager;m.seed=seed;m.reset(20);m.direction=-direction;m.descentCount=9;m.stopMovement();
     s.restart();
     check(s.wave===1&&m.direction===direction&&!m.movementStopped&&m.descentCount===0,'restart initializes chosen Wave 1 direction');
     const aliens=m.aliens.getChildren(),positions=aliens.map(a=>({x:a.x,y:a.y}));
     check(aliens.every(a=>a.direction===direction),'restart shares facing across formation');
     const rng=Phaser.Math.RND.state();m.update(100,10000);
     check(Phaser.Math.RND.state()===rng,'horizontal movement does not draw live RNG');
     aliens.forEach((a,i)=>{near(a.x-positions[i].x,direction*10,'Wave 1 movement sign');near(a.y,positions[i].y,'no initial descent');});
     const resetRng=Phaser.Math.RND.state();m.reset();check(Phaser.Math.RND.state()===resetRng,'wave direction initialization does not draw live RNG');
    }
    s.alienManager.seed=12345;s.restart();
    const plans=[];
    for(const wave of [...Array.from({length:20},(_,i)=>i+1),21,30,50,100]) {
     s.alienManager.reset(wave);
     s.alienManager.reset(wave); // Repeated reset derives speed from RS, never the last speed.
     const plan=s.alienManager.configuration,aliens=s.alienManager.aliens.getChildren();
     check(plan.seed===12345,'runtime query seed');
     check(JSON.stringify(plan)===JSON.stringify(d.getWavePlan(wave,12345)),'actual spawn uses seeded plan');
     check(aliens.length===24,'standard count');
     check(['grid','diamond','TWIN_SQUADS','SNAKE'].includes(plan.formation),'regular wave selects supported layout');
     near(plan.movementSpeed,100*Math.pow(1.02,Math.floor((wave-1)/5))*[1,1.1,1.25,1.4,1.5][(wave-1)%5],'specified compounded speed');
     aliens.forEach((alien,i)=>{check(alien.enemyType===plan.enemies[i],'actual enemy type');
      near(alien.x,plan.slots[i].x,'slot x');near(alien.y,plan.slots[i].y,'slot y');
      if(plan.formation==='grid'){
       near(alien.x,180+(i%6)*88,'original column position');
       near(alien.y,100+Math.floor(i/6)*74,'original row position');
      }
      const a=alien.getBounds();check(a.left>=0&&a.right<=800&&a.top>=0&&a.bottom<600,'formation inside playfield');
      aliens.slice(i+1).forEach(other=>{const b=other.getBounds();
       check(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom,'visible frames do not overlap');});
     });
     const frames=aliens.map(alien=>alien.getBounds());
     near(Math.max(...frames.map(b=>b.right))-Math.min(...frames.map(b=>b.left)),plan.squads?751.36:plan.rowGroups?571.36:527.36,'selected overall width');
     near(Math.max(...frames.map(b=>b.bottom))-Math.min(...frames.map(b=>b.top)),(plan.formation==='diamond'?370:plan.squads?148:222)+87.36*282/337,'selected overall height');
     check(s.alienManager.direction===plan.initialDirection,'formation starts in planned direction');
     check(aliens.every((a,i)=>a.direction===((plan.squads||plan.rowGroups)?(plan.squads||plan.rowGroups).find(g=>g.slots.includes(i)).initialDirection:plan.initialDirection)),'each movement group shares starting direction');
     const x=aliens[0].x;s.alienManager.update(100,10000);near(aliens[0].x-x,plan.initialDirection*plan.movementSpeed*.1,'compounded RS cycle');
     for(let frame=0;frame<120;frame++)s.alienManager.update(16,10000);
     aliens.forEach(a=>check(a.getBounds().left>=-1e-6&&a.getBounds().right<=800+1e-6,'boundary reversals'));
     plans.push({wave,formation:plan.formation,types:plan.composition,speed:plan.movementSpeed,interval:plan.firingIntervalMs});
    }
    const layouts=[];
    for(const formation of ['grid','diamond'])for(const direction of [-1,1]){
     const m=s.alienManager;let seed=0;
     while(d.getWavePlan(1,seed).formation!==formation||d.getWavePlan(1,seed).initialDirection!==direction)seed++;
     m.seed=seed;s.restart();const roots=m.aliens.getChildren();
     const box=()=>({left:Math.min(...m.aliens.getChildren().filter(a=>a.active).map(a=>a.getBounds().left)),right:Math.max(...m.aliens.getChildren().filter(a=>a.active).map(a=>a.getBounds().right))});
     check(!m.update(0,s.player.body.top),'layout spawns above actual player defensive line');
     const rows=[...new Set(roots.map(a=>a.y))];
     check(JSON.stringify(rows.map(y=>roots.filter(a=>a.y===y).length))===JSON.stringify(formation==='diamond'?[2,4,6,6,4,2]:[6,6,6,6]),'actual row counts');
     rows.forEach(y=>near(roots.filter(a=>a.y===y).reduce((sum,a)=>sum+a.x,0)/roots.filter(a=>a.y===y).length,400,'each row centered'));
     const before=roots.map(a=>({x:a.x,y:a.y}));m.update(100,10000);
     roots.forEach((a,i)=>{near(a.x-before[i].x,direction*10,'coordinated initial motion');near(a.y,before[i].y,'no spontaneous descent');});
     const travel=direction>0?800-box().right:box().left;
     m.update(travel/100*1000+1e-7,10000);
     check(m.direction===-direction&&m.descentCount===1,'first edge reverses and descends once');
     roots.forEach((a,i)=>near(a.y,before[i].y+25,'first descent'));
     near(direction>0?box().right:box().left,direction>0?800:0,'actual first boundary');
     m.update((800-(box().right-box().left))/100*1000+1e-7,10000);
     check(m.direction===direction&&m.descentCount===2,'opposite edge reverses and descends once');
     roots.forEach((a,i)=>near(a.y,before[i].y+50,'second descent'));
     // Remove the occupied extremes: the next edge uses living artwork, not a 6x4 envelope.
     m.reset();const full=box();m.aliens.getChildren().forEach(a=>{if(Math.abs(a.getBounds().left-full.left)<1e-6||Math.abs(a.getBounds().right-full.right)<1e-6)a.disableBody(true,true);});
     check(box().right-box().left<full.right-full.left,'sparse bounds shrink');
     const alive=m.aliens.countActive(true),speed=100*(1+.5*(24-alive)/23),sparseTravel=direction>0?800-box().right:box().left;
     m.update(sparseTravel/speed*1000+1e-7,10000);
     near(direction>0?box().right:box().left,direction>0?800:0,'sparse formation reaches occupied boundary');
     check(m.direction===-direction&&m.descentCount===1,'sparse edge bounces once');
     // Existing scheduler, scoring and complete-wave path on each actual layout.
     s.restart();m.stopMovement();s._enemyFires();
     check(s.assetManager.enemyBullets.countActive(true)===1,'one original Pepe attack');
     const oldScore=s.scoreManager.score;
     m.aliens.getChildren().slice().forEach(a=>{const bullet=s.assetManager.bullets.get();bullet.enableBody(true,a.body.center.x,a.body.center.y,true,true);bullet.body.preUpdate(false,0);check(s.physics.overlap([bullet],[a],s._bulletHitAliens,null,s),'actual Arcade regular kill');const cleanup=s.pendingCleanup;s.pendingCleanup=[];cleanup.forEach(f=>f());});
     near(s.scoreManager.score-oldScore,1240,'24 regular rewards plus unchanged clear bonus');
     check(s.invadersKilled===24&&s.state==='waveTransition'&&!m.hasAliveAliens,'normal wave completion');
     s.time.now=s.nextWaveReadyAt;s._startNextWave();check(s.wave===2&&s.state==='playing'&&m.aliens.countActive(true)===24,'next regular wave spawns once');
     layouts.push({formation,direction,seed,rows:rows.length});
    }
    s.alienManager.seed=12345;
    s.restart();s.wave=100;s.alienManager.stopMovement();
    const group=s.assetManager.enemyBullets,shooter=s.alienManager.aliens.getChildren()[0];
    shooter.configure('popcat',1);shooter.setPosition(400,140);shooter.body.preUpdate(false,0);
    s.alienManager.getRandomAliveEnemy=()=>shooter;
    const fill=n=>{for(let i=0;i<n;i++)group.get().setPosition(50,50);};
    const oldFrac=Phaser.Math.RND.frac;Phaser.Math.RND.frac=()=>.1;
    try {
     fill(11);s._enemyFires();check(group.countActive(true)===11,'cannot launch partial shotgun');
     check(shooter.texture.key==='popcat-right','budget refusal leaves mouth closed');
     near(s.firingTimer-s.time.now,250,'cap retry');
     group.clear(true,true);fill(10);s._enemyFires();check(group.countActive(true)===15,'full shotgun fits exact cap');
     near(s.firingTimer-s.time.now,d.firingIntervalForWave(100),'late bounded firing interval');
     group.clear(true,true);
     for(let i=0;i<11;i++)s.bananaBombs.launch(400,140,400,550);
     s._enemyFires();check(group.countActive(true)===0,'flying bananas count against Popcat budget');
     s.bananaBombs.clear();s._enemyFires();check(group.countActive(true)===5,'cleanup releases permission');
     group.clear(true,true);fill(15);group.getChildren().forEach(shot=>shot.disableBody(true,true));
     s._enemyFires();check(group.countActive(true)===5,'inactive pooled shots do not block attacks');
     group.clear(true,true);shooter.configure('ponke',1);fill(14);
     s._enemyFires();check(s.bananaBombs.activeThreatCount===1,'PONKE fills final threat slot');
     s._enemyFires();check(s.bananaBombs.activeThreatCount===1,'PONKE cannot bypass cap');
    } finally {Phaser.Math.RND.frac=oldFrac;}
    const bosses=[];
    // Odd checkpoints use Wojak; Mubarak parity is covered by boss-schedule.
    for(const wave of [10,30,50]) {
     s.restart();s.wave=wave;s.state='waveTransition';s.nextWaveReadyAt=0;s.firingTimer=Infinity;
     s._startNextWave();check(s.state==='bossEncounter'&&s.wave===wave,'boss separate from regular number');
     check(s.firingTimer===Infinity,'regular firing disabled throughout boss');
     const boss=s.wojak.sprite;s._startNextWave();s._startWojak();check(s.wojak.sprite===boss,'one boss per milestone');
     s.wojak.update(1500);for(let hit=0;hit<150;hit++)check(s.wojak.hit(),'unchanged boss health');
     s.update(undefined,10000);check(s.state==='waveTransition'&&s.wave===wave,'defeat completes once');
     s._startWojak();check(!s.wojak.sprite,'completed milestone does not respawn');
     s._startNextWave();s._startNextWave();check(s.wave===wave+1&&s.state==='playing','next regular wave exactly once');
     near(s.firingTimer-s.time.now,d.firingIntervalForWave(wave+1),'boss exit resets regular firing timer');
     bosses.push({after:wave,next:s.wave});
    }
    s.restart();s.wave=4;s.scoreManager.setWave(4);s.alienManager.reset(4);s.alienManager.stopMovement();s.firingTimer=Infinity;
    testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
    return {renderer:testGame.renderer.type,plans,layouts,bosses,threatCap:15};
   });
   for(const formation of ['grid','diamond','TWIN_SQUADS','SNAKE']){
    await page.evaluate(formation=>{const s=testGame.scene.scenes[0],d=load('src/interface/wave-director');let seed=0;while(d.getWavePlan(1,seed).formation!==formation)seed++;s.alienManager.seed=seed;s.restart();s.alienManager.stopMovement();testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();},formation);
    await page.screenshot({path:path.join(output,renderer+'-'+formation+'.png')});
   }
   reports.push(report);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'wave-director-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL both layouts/directions, exact centered rows, occupied/sparse boundary bouncing/descent, real Arcade kills/scoring/firing/completion; original budgets, speed and repeated boss regressions.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
