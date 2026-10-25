// Regular-wave entrances, shootable arrival, and run-seed lifecycle.
// node tests/wave-entrance-browser.cjs <absolute screenshot output directory>
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
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#202428}canvas{display:block}</style>
<script src="/phaser.js"></script><script>
const __NFD_DEV__ = location.search.includes('development');
const modules = ${JSON.stringify(modules).replace(/</g, '\\u003c')}, cache = {};
function load(id) {
    if(cache[id]) return cache[id].exports;
    const module = cache[id] = {exports:{}};
    new Function('module','exports','require',modules[id])(module,module.exports, name => {
        const parts = id.split('/'); parts.pop();
        name.split('/').forEach(p => {if(p==='..')parts.pop();else if(p!=='.')parts.push(p)});
        return load(parts.join('/'));
    });
    return module.exports;
}
// Isolate original boss presentation; Premium has its own default-on suite.
load('src/interface/wave-director').WaveDirectorConfig.premiumInvaders.testMode.enabled=false;
// Explicit early-boss override for isolated combat fixtures only.
load('src/interface/mubarak').MubarakSettings.testSpawn.enabled=false;
window.testGame = new Phaser.Game({type:location.search.includes('canvas')?Phaser.CANVAS:Phaser.WEBGL,
    width:800,height:600,backgroundColor:'rgb(47,52,55)',
    audio:{noAudio:true},physics:{default:'arcade'},scene:load('src/scenes/main').MainScene});
</script>`;
async function serve(route) {
    const url = new URL(route.request().url());
    if (url.pathname === '/') { await route.fulfill({ contentType: 'text/html', body: html }); return; }
    const file = url.pathname === '/phaser.js' ? path.join(root, 'node_modules/phaser/dist/phaser.js') :
        path.resolve(root, 'dist', '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) { await route.fulfill({ status: 403 }); return; }
    if (!fs.existsSync(file)) { await route.fulfill({ status: 404 }); return; }
    await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' :
        file.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
}

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],reports=[];page.on('pageerror',e=>errors.push(e.message));await page.route('http://mubarak.test/**',serve);
  for(const renderer of ['canvas','webgl']){
   await page.goto('http://mubarak.test/?'+renderer+'&waveSeed=42');await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0]&&testGame.scene.scenes[0].alienManager);
   reports.push(await page.evaluate(({renderer})=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],m=s.alienManager,D=load('src/interface/wave-director'),C=D.WaveDirectorConfig,P=load('src/interface/premium-invader'),M=load('src/interface/mubarak');
    const check=(v,l)=>{if(!v)throw Error(l)},near=(a,b,l)=>check(Math.abs(a-b)<1e-5,l+': '+a+' / '+b),roots=()=>m.aliens.getChildren().filter(a=>a.active);
    const setSeed=seed=>{const url=new URL(location.href);url.searchParams.set('waveSeed',seed);history.replaceState({},'',url)};
    const reset=(seed,wave=1,premium=false)=>{setSeed(seed);C.premiumInvaders.testMode.enabled=premium;s.restart();s.wave=wave;if(wave!==1)m.reset(wave,seed);return roots()};
    const shoot=(alien)=>{const b=s.assetManager.bullets.get();b.enableBody(true,alien.body.center.x,alien.body.center.y,true,true);b.body.preUpdate(false,0);s.physics.overlap([b],[alien],s._bulletHitAliens,null,s);const q=s.pendingCleanup;s.pendingCleanup=[];q.forEach(f=>f());return b};
    const summaries=[];
    for(const formation of C.formation.choices)for(const direction of [-1,1]){
     let seed=0;while(D.getWavePlan(3,seed).formation!==formation||D.getWavePlan(3,seed).initialDirection!==direction)seed++;
     const initial=reset(seed,3),goals=new Map(initial.map(a=>[a,{x:a.x,y:a.y+m.entranceRemaining}])),distance=m.entranceRemaining;
     check(m.isEntering&&initial.length===24,'regular wave enters '+formation);check(initial.every(a=>a.getBounds().bottom<=-1+1e-5&&a.body.bottom<0),'entire sprite and body above top');
     const x=initial.map(a=>a.x),y=initial.map(a=>a.y);m.update(500,550);initial.forEach((a,i)=>{near(a.x,x[i],'no horizontal entry');near(a.y-y[i],90,'180px/s synchronized entry')});
     s.children.depthSort();testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();window.entryPreviews=window.entryPreviews||{};window.entryPreviews[formation]=testGame.canvas.toDataURL('image/png');
     check(m.descentCount===0&&m.rows.every(r=>r.bounceCount===0)&&m.twinDescentElapsedMs===0,'normal descent clocks suspended');
     check(m.canAttack(m.getRandomAliveEnemy()),'visible regular emitter during entry');s.firingTimer=-1;s._enemyFires();check(s.assetManager.enemyBullets.countActive(true)+s.bananaBombs.activeThreatCount===1,'one existing attack during entry');near(s.firingTimer,s.time.now+D.firingIntervalForWave(3),'entry attack uses existing interval');
     // Offscreen projectile contact cannot consume the beam.
     const hidden=initial.find(a=>a.body.bottom<0);check(hidden,'hidden fixture');const hiddenShot=shoot(hidden);check(hiddenShot.active&&hidden.active,'no offscreen collision consumption');hiddenShot.destroy();
     // Bring the top row's body into view, keeping the remaining formation entering.
     let target;while(m.isEntering&&!(target=roots().find(a=>a.body.top>=2&&a.body.bottom<140)))m.update(10,550);
     check(target&&m.isEntering&&s.playerShootingEnabled,'shootable while entrance active');const score=s.scoreManager.score,kills=s.invadersKilled,count=roots().length;
     const dead=target;shoot(target);check(!dead.active&&roots().length===count-1&&s.invadersKilled===kills+1&&s.scoreManager.score>score,'entry kill scores once');
     const survivors=roots(),before=survivors.map(a=>({x:a.x,y:a.y}));m.update(100,550);survivors.forEach((a,i)=>{near(a.x,before[i].x,'survivor X');near(a.y-before[i].y,18,'survivor shared translation')});
     const remainder=m.entranceRemaining;m.update(remainder/180*1000+1e-6,550);check(!m.isEntering&&roots().length===count-1&&!dead.active,'entry ends without resurrection');
     roots().forEach(a=>{near(a.x,goals.get(a).x,'destination X');near(a.y,goals.get(a).y,'destination Y')});check(m.descentCount===0&&m.twinDescentElapsedMs===0,'no extra descent at activation');
     const activeX=roots().map(a=>a.x),oldY=roots().map(a=>a.y);m.update(1,550);check(roots().some((a,i)=>a.x!==activeX[i]),'normal patrol starts');roots().forEach((a,i)=>near(a.y,oldY[i],'no immediate bounce/descent'));
     summaries.push({formation,direction,seed,distance,durationMs:distance/180*1000});
    }
    // The existing wave-created deadline stays continuous through arrival.
    reset(42);const createdDeadline=s.firingTimer,bulletCount=s.assetManager.bullets.countActive(true);near(createdDeadline,s.time.now+D.firingIntervalForWave(1),'creation initializes timer');s.bulletTime=-1;s._fireBullet();check(s.assetManager.bullets.countActive(true)===bulletCount+1,'player shooting active');s.assetManager.bullets.clear(true,true);
    s.firingTimer=0;s.update(undefined,100);check(s.assetManager.enemyBullets.countActive(true)===1,'visible entry attacker');const deadline=s.firingTimer,flight=s.assetManager.enemyBullets.getChildren().find(b=>b.active),remaining=m.entranceRemaining;s.update(undefined,remaining/180*1000+1e-5);near(s.firingTimer,deadline,'arrival preserves timer');check(flight.active&&s.assetManager.enemyBullets.countActive(true)===1,'existing projectile survives arrival');s.update(undefined,0);check(s.assetManager.enemyBullets.countActive(true)===1,'no arrival burst');s.time.now=deadline+1;s.update(undefined,1);check(s.assetManager.enemyBullets.countActive(true)===2,'next scheduled active shot');near(s.firingTimer,s.time.now+D.firingIntervalForWave(1),'same active cadence');
    // Premium visuals/body enter together, take normal staged hits, and retain attacks while immunity advances.
    let premiumSeed=0;while(D.getWavePlan(14,premiumSeed).formation==='SNAKE')premiumSeed++;
    reset(premiumSeed,14,true);let root=roots().find(a=>P.premiumInvaderOf(a));check(root,'forced compatible Premium');const owner=P.premiumInvaderOf(root);let weaponCalls=0;const updateWeapons=owner.updateWeapons;owner.updateWeapons=()=>weaponCalls++;
    while(root.body.top<2&&m.isEntering)m.update(10,550);check(m.isEntering&&root.body.top>=2,'Premium visible during entry');
    shoot(root);check(root.active&&owner.stage===1&&owner.invulnerable,'Premium health retained');shoot(root);check(owner.stage===1,'Premium immunity');m.updatePremiums(800,s.player,()=>{});check(!owner.invulnerable&&weaponCalls===1,'immunity expires while visible weapons update');
    for(let i=1;i<5;i++){shoot(root);if(i<4)m.updatePremiums(800,s.player,()=>{})}check(!root.active&&P.premiumInvaderOf(root).defeated&&weaponCalls===4,'Premium destroyed during entry');owner.updateWeapons=updateWeapons;
    // Every enemy can die during entry: existing completion owns cancellation and next-wave gates.
    reset(42);m.update(m.entranceRemaining/180*1000-100,550);check(m.isEntering,'near-end fixture');for(const a of roots())shoot(a);check(s.state==='waveTransition'&&!m.hasAliveAliens&&!m.isEntering,'all killed cancels entry');s.time.now=s.nextWaveReadyAt;s._startNextWave();check(s.wave===2&&m.isEntering&&m.hasAliveAliens,'next wave enters once');
    reset(42);s._gameOver();check(!m.isEntering&&s.state==='gameOver','death cancels entry');s.restart();check(m.isEntering&&m.configuration.seed===42,'restart creates one fresh controlled entrance');
    // Run seed lifecycle uses injected entropy; no probabilistic short-run assertions.
    const fromSearch=D.waveSeedFromSearch,url=new URL(location.href);url.searchParams.delete('waveSeed');history.replaceState({},'',url);let calls=0;D.waveSeedFromSearch=search=>fromSearch(search,()=>[101,202][calls++]);s.restart();const first=s.waveSeed,firstPlan=JSON.stringify(m.configuration);s.restart();check(first===101&&s.waveSeed===202&&m.configuration.seed===202&&firstPlan!==JSON.stringify(m.configuration),'fresh seed propagated on restart');setSeed(7);s.restart();const plan=JSON.stringify(m.configuration);s.restart();check(s.waveSeed===7&&JSON.stringify(m.configuration)===plan&&calls===2,'explicit replay seed stable');D.waveSeedFromSearch=fromSearch;
    // Existing boss streams vary with run seed, and remain reproducible for controlled replay.
    const attacks=seed=>{s.restart();s.alienManager.aliens.clear(true,true);s.state='waveTransition';M.MubarakSettings.testSpawn.enabled=true;s._startMubarak();const p=s.mubarak;p.clear();p.start(seed,1);const result={ricochets:Array.from({length:20},()=>p.ricochetRandom()),entrance:M.mubarakEntranceDirection(seed,1)};p.update(M.MubarakSettings.entranceMs);p.beginAct2();result.barrels=[];for(let i=0;i<8;i++){p.barrels.spawn();const f=p.barrels.flights[p.barrels.flights.length-1];result.barrels.push([f.sprite.x,f.shootable])}p.beginAct3();result.diamonds=[];for(let i=0;i<20;i++){p.act3Diamonds.fireBlack(400,400,M.MubarakAct3Settings.blackDiamondAnglesDegrees);const f=p.act3Diamonds.flights[i];result.diamonds.push([f.vx,f.vy])}return result};
    const a=attacks(101),b=attacks(202),again=attacks(101);check(JSON.stringify(a)===JSON.stringify(again)&&JSON.stringify(a)!==JSON.stringify(b),'boss random streams fresh and reproducible');check(s.mubarak.phase==='act3'&&!m.isEntering&&!m.hasAliveAliens,'boss uses own controller without regular invaders');
    s.mubarak.clear();s.restart();testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();check(!m.isEntering,'shutdown cancels entry');
    return {renderer,summaries};
   },{renderer}));
   const previews=await page.evaluate(()=>window.entryPreviews);for(const [formation,url]of Object.entries(previews))fs.writeFileSync(path.join(output,formation+'-'+renderer+'.png'),Buffer.from(url.split(',')[1],'base64'));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'wave-entrance-browser.json'),JSON.stringify(reports,null,2));console.log('PASS: Canvas/WebGL all formations/directions, above-screen geometry,180px/s entry, partial/all kills and scoring, Premium health/immunity/death and visible weapons, exact destinations/normal movement clocks, continuous firing, restart/run seed injection/replay, boss isolation, death/shutdown cleanup.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
