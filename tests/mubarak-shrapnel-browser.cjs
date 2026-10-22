// Mubarak Act II oil-barrel integration and lifecycle regression. Requires Playwright + Chrome.
// node tests/mubarak-barrels-browser.cjs <absolute screenshot output directory>
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
load('src/interface/mubarak').MubarakSettings.testSpawn.enabled=true;
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
 try {
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('http://mubarak.test/**',serve);
  for(const renderer of ['canvas','webgl'])for(const seed of [3,0]){
   await page.goto('http://mubarak.test/?'+renderer);
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0]&&testGame.scene.scenes[0].alienManager);
   const report=await page.evaluate(({seed,renderer})=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],M=load('src/interface/mubarak'),D=load('src/interface/mubarak-shrapnel'),W=load('src/interface/wave-director');
    const check=(v,l)=>{if(!v)throw Error(l);},near=(a,b,l)=>check(Math.abs(a-b)<1e-6,l+': '+a+' / '+b);
    const enter=()=>{s.restart();s.waveSeed=seed;s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();const p=s.mubarak;p.update(3600);for(let i=0;i<4;i++){p.hit();if(i<3)p.update(800);}check(p.phase==='clearing'&&p.frame===5&&!p.shrapnel,'frame5 freeze before event');p.update(0);return p;};
    const shoot=(x,y)=>{const b=s.assetManager.bullets.get();b.enableBody(true,x,y,true,true);b.shoot(x,y);b.body.preUpdate(false,0);s.update(undefined,0);return b;};
    let p=enter();p.update(134.999);check(!p.shrapnel,'no fragments before climax');p.update(.001);
    let owner=p.shrapnel;check(owner&&owner.emitted===1&&p.explosion.texture.key==='mubarak-act1-explosion-3','release begins inside climax');
    const root=p.sprite;check(root.texture.key===M.mubarakTexture(1,p.direction,2),'angry pose unchanged at climax');
    p.update(60);check(owner.emitted>1&&owner.emitted<100,'gradual release');p.update(185);check(owner.emitted===100,'all100 released');
    const counts={gold:0,black:0,red:0};owner.flights.forEach(f=>counts[f.kind]++);
    check(JSON.stringify(counts)===JSON.stringify({gold:70,black:15,red:15}),'exact fixed distribution');
    owner.flights.forEach(f=>{
     near(f.sprite.displayWidth,39,'all diamond types enlarged1.5x');
     near(f.sprite.scaleX,f.sprite.scaleY,'artwork proportions preserved');
     const body=owner.bounds(f);near(body.width,31.2,'hitbox width enlarged1.5x');
     near(body.height,f.sprite.displayHeight*.8,'hitbox height follows rendered size');
    });
    const probe=new D.MubarakShrapnel(s,W.randomForWave(999,1),()=>{});probe.begin(400,200);
    const falling=probe.flights[0];falling.vx=0;falling.vy=D.MubarakShrapnelSettings.fallSpeed;
    const startY=falling.sprite.y;probe.step(100);
    near(D.MubarakShrapnelSettings.fallSpeed,84,'fall speed reduced30%');
    near(falling.sprite.y-startY,8.4,'actual downward travel reduced30%');probe.clear();
    check(new Set(owner.flights.map(f=>f.vx.toFixed(3))).size>40&&owner.flights.some(f=>f.vx<0)&&owner.flights.some(f=>f.vx>0)&&owner.flights.some(f=>f.vy<0),'varied outward burst');
    p.update(M.mubarakFinalDuration()-p.finalElapsed);check(p.phase==='act2'&&p.shrapnel===owner&&owner.flights.length===100&&s.playerShootingEnabled,'event persists through Act II start');
    owner.step(800);check(owner.flights.every(f=>f.vy>0),'all fragments settle into falling');
    check(owner.flights.every(f=>f.sprite.x>=13&&f.sprite.x<=787),'fragments contained horizontally');
    const xs=owner.flights.map(f=>f.sprite.x),ys=owner.flights.map(f=>f.sprite.y),bins=Array(8).fill(0);
    xs.forEach(x=>bins[Math.min(7,Math.floor(x/100))]++);
    check(Math.max(...xs)-Math.min(...xs)>720,'covers90% of playable width');
    check(Math.max(...ys)-Math.min(...ys)>390,'covers most playable height');
    check(bins.every(n=>n>=4),'no empty screen-wide horizontal zones');
    const colors=owner.flights.map(f=>f.kind).join(',');check(!colors.startsWith(Array(40).fill('gold').join(',')),'shuffled fixed order');
    testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();window.shrapnelPreview=testGame.canvas.toDataURL('image/png');
    const park=()=>owner.flights.forEach((f,i)=>{f.sprite.setPosition(40+i*4,60);f.vx=f.vy=0;});
    const populate=()=>{owner.begin(400,200);owner.step(D.MubarakShrapnelSettings.releaseWindowMs+D.MubarakShrapnelSettings.stepMs);park();};
    park();let gold=owner.flights.find(f=>f.kind==='gold');gold.sprite.setPosition(500,350);let score=s.scoreManager.score;
    check(!shoot(500,350).active&&!gold.sprite.active&&s.scoreManager.score===score+200,'gold laser hit gives200');
    const repeat=shoot(500,350);check(repeat.active&&s.scoreManager.score===score+200,'no duplicate gold score');repeat.destroy();
    let black=owner.flights.find(f=>f.kind==='black');black.sprite.setPosition(500,350);const blackShot=shoot(500,350);check(blackShot.active&&black.sprite.active,'black immune to player laser');blackShot.destroy();
    const reds=owner.flights.filter(f=>f.kind==='red'),golds=owner.flights.filter(f=>f.kind==='gold'),blacks=owner.flights.filter(f=>f.kind==='black');
    reds[0].sprite.setPosition(200,400);reds[1].sprite.setPosition(330,400);reds[2].sprite.setPosition(460,400);
    golds[0].sprite.setPosition(230,410);golds[1].sprite.setPosition(475,410);golds[2].sprite.setPosition(700,400);
    blacks[0].sprite.setPosition(360,400);blacks[1].sprite.setPosition(480,400);
    p.barrels.spawn();const barrel=p.barrels.flights[0];barrel.sprite.setPosition(210,400);
    score=s.scoreManager.score;const hp=p.act2Health,lives=s.scoreManager.lives.countActive(true);
    check(!shoot(200,400).active,'red shot consumed');
    check(owner.effects.length===3&&reds.slice(0,3).every(f=>!f.sprite.active),'iterative three-red chain');
    check(!golds[0].sprite.active&&!golds[1].sprite.active&&golds[2].sprite.active&&s.scoreManager.score===score+400,'chain scores only nearby gold once');
    check(!blacks[0].sprite.active&&!blacks[1].sprite.active&&owner.impacts.blasts.length===0,'black safely removed by red');
    check(barrel.sprite.active&&p.act2Health===hp&&s.scoreManager.lives.countActive(true)===lives,'red blast affects only diamonds');
    const blast=owner.effects[0];near(blast.sprite.displayWidth,D.MubarakShrapnelSettings.redBlastRadius*2*128/96,'large art matches140px radius');
    check(blast.sprite.anims.currentAnim.key==='ponke-explosion'&&blast.sprite.scaleX>1.6875,'reuse larger existing yellow effect');
    owner.step(100);check(s.scoreManager.score===score+400,'live effect cannot score again');
    // Dense fifteen-red chain must score all70 gold exactly once and safely remove15 black.
    populate();const first=owner.flights.find(f=>f.kind==='red');owner.flights.forEach(f=>f.sprite.setPosition(420,400));first.sprite.setPosition(350,400);
    score=s.scoreManager.score;shoot(350,400);check(owner.flights.length===0&&owner.effects.length===15&&s.scoreManager.score===score+14000,'fifteen-red dense chain completes once');
    owner.step(1000,s.player,()=>{throw Error('red effect damaged player');});check(owner.effects.length===0&&s.scoreManager.score===score+14000,'red visual cleanup and no duplicate scoring');
    // Landing and direct overlap share the actual banana handler, including one-hit protection.
    populate();black=owner.flights.find(f=>f.kind==='black');black.sprite.setPosition(s.player.body.center.x,s.player.y-.1);black.vy=120;
    let damage=0;owner.step(D.MubarakShrapnelSettings.stepMs,s.player,()=>damage++);
    check(!black.sprite.active&&damage===1&&owner.impacts.blasts.length===1,'black landing uses banana damage');
    const impact=owner.impacts.blasts[0];near(impact.sprite.scaleX,1.6875,'banana size');check(impact.sprite.anims.currentAnim.key==='ponke-explosion','banana artwork');
    owner.step(50,s.player,()=>damage++);check(damage===1,'one landing cannot damage twice');
    populate();black=owner.flights.find(f=>f.kind==='black');black.sprite.setPosition(s.player.body.center.x,s.player.body.top+8);black.vy=0;damage=0;
    owner.step(10,s.player,()=>damage++);check(!black.sprite.active&&damage===1,'direct black overlap uses same single-hit handler');
    populate();black=owner.flights.find(f=>f.kind==='black');black.sprite.setPosition(20,s.player.y);damage=0;owner.step(10,s.player,()=>damage++);check(!black.sprite.active&&damage===0,'distant landing misses player');
    populate();black=owner.flights.find(f=>f.kind==='black');black.sprite.setPosition(s.player.body.center.x,s.player.y);s.player.setActive(false);owner.step(10,s.player,()=>damage++);check(damage===0,'inactive player protected');s.player.setActive(true);
    populate();gold=owner.flights.find(f=>f.kind==='gold');const red=owner.flights.find(f=>f.kind==='red');gold.sprite.y=red.sprite.y=700;score=s.scoreManager.score;owner.step(10);check(!gold.sprite.active&&!red.sprite.active&&s.scoreManager.score===score&&owner.effects.length===0,'offscreen gold no score and red no detonation');
    // Fixed-step burst replay and complete offscreen cleanup without a player reference.
    const replay=chunks=>{const q=new D.MubarakShrapnel(s,W.randomForWave(123,1),()=>{});q.begin(400,200);chunks.forEach(dt=>q.step(dt));const snapshot=q.flights.map(f=>({kind:f.kind,x:f.sprite.x,y:f.sprite.y,vx:f.vx,vy:f.vy}));q.step(15000);check(q.flights.length===0,'all fragments eventually cleaned');q.clear();return snapshot;};
    const one=replay([1000]),split=replay(Array(60).fill(1000/60));check(one.length===100&&split.length===100,'replay exact100');one.forEach((f,i)=>{check(f.kind===split[i].kind,'seeded order');for(const key of ['x','y','vx','vy'])near(f[key],split[i][key],'partition '+key);});
    populate();const before=JSON.stringify(owner.flights.map(f=>[f.sprite.x,f.sprite.y]));s.sys.pause();testGame.scene.update(9999,3000);s.sys.resume();check(before===JSON.stringify(owner.flights.map(f=>[f.sprite.x,f.sprite.y])),'scene pause freezes event');
    // Playable bounds, rather than canvas/window dimensions, control spread and gate.
    const world=s.physics.world;s.physics.world.setBounds(100,80,600,420);
    const shifted=new D.MubarakShrapnel(s,W.randomForWave(321,1),()=>{});shifted.begin(500,190);
    shifted.remove(shifted.flights[0]);check(!shifted.readyForBarrels,'pending releases keep gate closed even with no live fragments');
    shifted.step(1200);check(shifted.flights.every(f=>f.sprite.x>=113&&f.sprite.x<=687),'spread respects shifted bounds');
    shifted.flights.forEach(f=>f.sprite.y=360);check(shifted.readyForBarrels,'shifted world bottom-third threshold');
    shifted.flights[0].sprite.y=359.9;check(!shifted.readyForBarrels,'last survivor above shifted threshold blocks');
    shifted.clear();check(shifted.readyForBarrels,'all removed cannot deadlock');world.setBounds(0,0,800,600);
    // Gate automatic barrel drops, not the boss patrol or the moving diamonds.
    p=enter();p.update(M.mubarakFinalDuration());owner=p.shrapnel;
    const beforeX=p.sprite.x,beforeY=owner.flights[0].sprite.y;p.update(700);
    check(p.barrels.flights.length===0&&p.barrels.spawnElapsed===0&&!p.act2BarrelsUnlocked,'no early barrels or banked spawn time');
    check(p.sprite.x!==beforeX&&owner.flights[0].sprite.y!==beforeY,'boss and diamonds continue moving');
    const threshold=s.physics.world.bounds.top+s.physics.world.bounds.height*2/3;
    owner.flights.forEach(f=>{f.sprite.y=threshold+10;f.vx=f.vy=0;});
    owner.flights[0].sprite.y=threshold-50;p.update(100);
    check(p.barrels.flights.length===0&&!p.act2BarrelsUnlocked,'last high diamond still blocks barrels');
    owner.flights[0].sprite.y=threshold+1;p.update(549);check(p.act2BarrelsUnlocked&&p.barrels.flights.length===0,'unlocked but normal interval not elapsed');
    p.update(1);check(p.barrels.flights.length===1,'V1.1 barrel interval resumes at550ms tick');
    owner.flights[0].sprite.y=200;p.update(550);check(p.barrels.flights.length===2,'gate remains unlocked once satisfied');
    p=enter();p.update(M.mubarakFinalDuration());owner=p.shrapnel;owner.clear();p.update(550);
    check(p.act2BarrelsUnlocked&&p.barrels.flights.length===1,'destroying all diamonds unlocks without deadlock');
    for(const reason of ['restart','gameOver','shutdown']){
     p=enter();p.update(M.mubarakFinalDuration());owner=p.shrapnel;check(owner&&owner.emitted===100&&p.phase==='act2','large delta cannot skip event');
     park();const red=owner.flights.find(f=>f.kind==='red');red.sprite.setPosition(500,300);owner.detonate(red);
     black=owner.flights.find(f=>f.kind==='black');black.sprite.setPosition(20,s.player.y);owner.step(10,s.player,()=>{});
     const sprites=owner.flights.map(f=>f.sprite).concat(owner.effects.map(e=>e.sprite),owner.impacts.blasts.map(b=>b.sprite));
     if(reason==='restart')s.restart();else if(reason==='gameOver')s._gameOver();else{testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();}
     check(!p.act2BarrelsUnlocked&&!p.shrapnel&&owner.flights.length===0&&owner.effects.length===0&&owner.queue.length===0&&sprites.every(q=>!q.active),'event cleanup '+reason);
    }
    return {renderer,seed,counts,redRadius:D.MubarakShrapnelSettings.redBlastRadius,releaseWindow:D.MubarakShrapnelSettings.releaseWindowMs,bins,preview:window.shrapnelPreview};
   },{seed,renderer});
   fs.writeFileSync(path.join(output,renderer+'-'+seed+'-shrapnel.png'),Buffer.from(report.preview.split(',')[1],'base64'));delete report.preview;reports.push(report);
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-shrapnel-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL both directions: climax release, exact70/15/15, burst/fall and fixed-step replay; gold+200, black immunity/banana impacts; red radial destruction and fifteen-bomb chains, no duplicate score/damage; full-screen coverage, delayed barrel gate, unchanged Act II entry, boss/barrel isolation, pause and lifecycle cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
