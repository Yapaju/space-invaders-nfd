// Regular-wave entrances, shootable arrival, and run-seed lifecycle.
// node tests/wave-entrance-attacks-browser.cjs <absolute screenshot output directory>
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
    testGame.loop.stop();const s=testGame.scene.scenes[0],m=s.alienManager,D=load('src/interface/wave-director'),C=D.WaveDirectorConfig,P=load('src/interface/premium-invader');
    const check=(v,l)=>{if(!v)throw Error(l)},near=(a,b,l)=>check(Math.abs(a-b)<1e-5,l+': '+a+' / '+b),roots=()=>m.aliens.getChildren().filter(a=>a.active);
    const reset=(seed,wave=3,premium=false)=>{const url=new URL(location.href);url.searchParams.set('waveSeed',seed);history.replaceState({},'',url);C.premiumInvaders.testMode.enabled=premium;s.restart();s.wave=wave;if(wave!==1)m.reset(wave,seed);};
    const summaries=[];
    for(const formation of C.formation.choices){
     let seed=0;while(D.getWavePlan(3,seed).formation!==formation)seed++;reset(seed);const all=roots();
     check(!m.getRandomAliveEnemy()&&all.every(a=>!m.canAttack(a)),'no fully offscreen attackers '+formation);s.firingTimer=0;s._enemyFires();near(s.firingTimer,s.time.now+250,'existing no-visible retry');check(s.assetManager.enemyBullets.countActive(true)===0&&s.bananaBombs.activeThreatCount===0,'no hidden shots');
     const lowest=all.reduce((a,b)=>a.getBounds().bottom>b.getBounds().bottom?a:b),step=(s.physics.world.bounds.top-lowest.getBounds().bottom+.1)/180*1000;
     m.update(step,550);check(lowest.y<0&&lowest.getBounds().bottom>0&&m.canAttack(lowest),'partial sprite eligible before its center');check(m.isEntering&&m.descentCount===0&&m.rows.every(r=>r.bounceCount===0),'attacks do not enable normal movement');
     const eligible=all.filter(a=>m.canAttack(a)),pick=Phaser.Math.RND.integerInRange;let selections=0;
     try{for(let i=0;i<eligible.length;i++){Phaser.Math.RND.integerInRange=(min,max)=>{check(min===0&&max===eligible.length-1,'uniform visible-only pool');selections++;return i};check(m.getRandomAliveEnemy()===eligible[i],'every visible emitter selectable')}}finally{Phaser.Math.RND.integerInRange=pick}
     check(selections===eligible.length,'eligible selection unchanged');
     // Use a deterministic existing Pepe weapon to measure cadence independent of type rolls.
     all.forEach(a=>a.configure('pepe',a.direction));s.firingTimer=s.time.now;s.time.now+=1;s.update(undefined,0);check(s.assetManager.enemyBullets.countActive(true)===1,'one event during partial entry');const flight=s.assetManager.enemyBullets.getChildren().find(b=>b.active);check(flight.y<0,'partially visible sprite may emit from existing origin');
     const firedBy=eligible.find(a=>Math.abs(a.x-flight.x)<1e-5);check(firedBy,'shot belongs to eligible visible pool');const deadline=s.firingTimer;
     const x=all.map(a=>a.x),y=all.map(a=>a.y);s.update(undefined,100);all.forEach((a,i)=>{near(a.x,x[i],'no horizontal attack movement');near(a.y-y[i],18,'entry continues while firing')});
     // Destroy all potential visible emitters: dead roots cannot be selected.
     eligible.forEach(a=>a.disableBody(true,true));check(!m.getRandomAliveEnemy(),'destroyed first shooters excluded while next rows hidden');eligible.forEach(a=>{a.enableBody(true,a.x,a.y,true,true);a.body.preUpdate(false,0)});
     const remain=m.entranceRemaining;s.update(undefined,remain/180*1000+1e-5);check(!m.isEntering&&flight.active,'entry completes with live projectile');near(s.firingTimer,deadline,'no arrival timer reset');s.update(undefined,0);check(s.assetManager.enemyBullets.countActive(true)===1,'no transition burst');
     s.time.now=deadline;s.update(undefined,0);check(s.assetManager.enemyBullets.countActive(true)===1,'strict existing deadline boundary');s.time.now++;s.update(undefined,0);check(s.assetManager.enemyBullets.countActive(true)===2,'one due shot after entry');near(s.firingTimer,s.time.now+D.firingIntervalForWave(3),'same interval before and after');
     // Existing cap/retry path works during entry, without queued shots.
     reset(seed);m.update(100,550);all.length=0;roots().forEach(a=>a.configure('pepe',1));for(let i=0;i<15;i++)s.assetManager.enemyBullets.get().setPosition(400,200);s._enemyFires();check(s.assetManager.enemyBullets.countActive(true)===15,'entry cap15');near(s.firingTimer,s.time.now+250,'entry cap retry');
     summaries.push({formation,seed,visibleAtBoundary:eligible.length});
    }
    // Premium controllers are excluded from the global pool and use existing autonomous rates.
    let seed=0;while(D.getWavePlan(14,seed).formation==='SNAKE')seed++;reset(seed,14,true);const root=roots().find(a=>P.premiumInvaderOf(a)),p=P.premiumInvaderOf(root);check(p,'Premium fixture');p.hit();p.update(800);p.candles.random=()=>0;
    m.updatePremiums(250,s.player,()=>{});check(p.candles.flights.length===0&&p.candles.elapsed===0,'hidden Premium clock has no shot backlog');
    while(!m.canAttack(root))m.update(1,550);check(m.isEntering&&root.y<0&&root.getBounds().bottom>0,'partial Premium eligible');
    for(let i=0;i<3;i++)m.updatePremiums(250,s.player,()=>{throw Error('unexpected damage')});check(p.candles.flights.length===0,'unchanged Premium1000ms interval not early');m.updatePremiums(250,s.player,()=>{throw Error('unexpected damage')});check(p.candles.flights.length===1,'existing Premium candle during entry');
    m.updatePremiums(250,s.player,()=>{});const elapsed=p.candles.elapsed,projectile=p.candles.flights[0].sprite,deadline=s.firingTimer;m.update(m.entranceRemaining/180*1000+1e-5,550);near(p.candles.elapsed,elapsed,'Premium timer unchanged by arrival');near(s.firingTimer,deadline,'global timer unchanged');check(projectile.active,'Premium projectile survives arrival');
    m.updatePremiums(250,s.player,()=>{});near(p.candles.elapsed,elapsed+250,'Premium continues existing clock');check(!roots().filter(a=>P.premiumInvaderOf(a)).some(a=>m.getRandomAliveEnemy()===a),'Premium excluded from normal emitter pool');
    s._gameOver();check(!m.isEntering&&s.firingTimer===Infinity,'death cancels attacks');s.restart();check(m.isEntering&&!s.assetManager.enemyBullets.countActive(true),'restart clears shots without duplicate timer');
    return {renderer,summaries};
   },{renderer}));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'wave-entrance-attacks-browser.json'),JSON.stringify(reports,null,2));console.log('PASS: Canvas/WebGL all4 formations; fully hidden exclusion, partial sprite/center-negative eligibility, uniform visible emitter pool,180px/s movement while firing, no-visible retry, dead shooters, continuous regular/Premium clocks and flights across arrival, no burst, cap15, real Premium1000ms candle attack during entry, death/restart.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
