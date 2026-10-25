// Mubarak Act III real-Phaser integration regression. Requires Playwright + Chrome.
// node tests/mubarak-act3-browser.cjs <absolute screenshot output directory>
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

(async () => {
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('http://mubarak.test/**',serve);
  for(const renderer of ['canvas','webgl'])for(const seed of [0,3]){
   await page.goto('http://mubarak.test/?'+renderer);
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0]&&testGame.scene.scenes[0].alienManager);
   const report=await page.evaluate(({renderer,seed})=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],M=load('src/interface/mubarak'),C=M.MubarakAct3Settings;
    // Isolate the existing movement regression; pumping has its own integration suite.
    C.bnbPumpIntervalMs=Infinity;
    const check=(v,l)=>{if(!v)throw Error(l)},near=(a,b,l)=>check(Math.abs(a-b)<1e-6,l+': '+a+' / '+b);
    const shoot=(x,y,rapid=false,previousY)=>{
     const b=s.assetManager.bullets.get();b.enableBody(true,x,y,true,true);b.shoot(x,y,rapid);b.body.preUpdate(false,0);
     if(previousY!==undefined)b.body.prev.y=previousY;
     s.update(undefined,0);return b;
    };
    const enter=()=>{
     s.restart();s.waveSeed=seed;s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();
     const p=s.mubarak;p.update(M.MubarakSettings.entranceMs);
     for(let i=0;i<4;i++){check(p.hit(),'Act I diamond damage');if(i<3)p.update(800)}
     p.update(0);p.update(M.mubarakFinalDuration());check(p.phase==='act2'&&p.act2Health===3,'real Act II entry');
     p.shrapnel.clear();
     for(let i=0;i<3;i++){
      p.barrels.random=()=>0;p.barrels.spawn();const f=p.barrels.flights[p.barrels.flights.length-1];
      f.sprite.setPosition(p.sprite.x,p.sprite.y);check(p.tryHitBarrel(p.barrels.bounds(f.sprite)),'real barrel hit');
      check(p.act2Health===2-i,'three valid barrel hits');if(i<2)p.update(800);
     }
     check(p.phase==='act3Entry'&&!p.cz&&!s.completedMubarak,'lethal flash precedes Act III');
     s.update(undefined,799);check(!p.cz&&p.phase==='act3Entry','full transition flash');s.update(undefined,1);
     check(p.phase==='act3'&&!s.completedMubarak&&s.state==='mubarakEncounter','Act III replaces early victory');return p;
    };
    let p=enter(),root=p.sprite,cz=p.cz;
    check(M.MubarakCZAssets.length===6&&M.MubarakCZAssets.every(a=>s.textures.exists(a.key)),'six original loaded PNGs');
    check(cz.texture.key===M.mubarakCZTexture(1,p.czDirection)&&p.czDirection===-p.direction,'arrival and opposite direction');
    near(root.y,C.mubarakLaneY,'lower lane');near(cz.y,C.czLaneY,'upper lane');near(cz.displayWidth,130,'CZ half width');
    near(cz.scaleX,cz.scaleY,'uniform scale');near(cz.displayWidth/cz.displayHeight,1.5,'source aspect ratio');
    check(cz.getBounds().bottom<p.bodyBounds().y,'visible art does not overlap at base scale');
    check(!p.barrels&&!p.shrapnel&&!p.ricochets.length&&p.invulnerable&&!p.hit(),'no old hazards / invulnerable Mubarak');
    const start={lower:root.x,upper:cz.x,direction:p.direction,upperDirection:p.czDirection};p.update(100);
    near(root.x-start.lower,start.direction*C.mubarakSpeed*.1,'Mubarak speed');near(cz.x-start.upper,start.upperDirection*C.czSpeed*.1,'independent CZ speed');
    const saved={x:root.x,czX:cz.x};s.sys.pause();testGame.scene.update(999,5000);s.sys.resume();near(root.x,saved.x,'pause lower');near(cz.x,saved.czX,'pause upper');
    let shielded=0,exposed=0,lowerTurns=0,upperTurns=0;
    for(let i=0;i<3000;i++){
     const ld=p.direction,ud=p.czDirection;p.update(10);
     if(ld!==p.direction)lowerTurns++;if(ud!==p.czDirection)upperTurns++;
     const a=root.getBounds(),b=cz.getBounds();
     check(a.left>=24-1e-6&&a.right<=776+1e-6&&a.bottom<600&&b.left>=24-1e-6&&b.right<=776+1e-6&&b.top>=0&&b.bottom<p.bodyBounds().y,'safe separated visible lanes');
     check(root.texture.key===M.mubarakTexture(1,p.direction,2)&&cz.texture.key===M.mubarakCZTexture(1,p.czDirection)&&!cz.flipX&&!root.flipX,'directional source art');
     const r=p.bodyBounds(),c=p.czBounds(),cx=c.x+c.width/2;
     if(cx>=r.x&&cx<=r.x+r.width)shielded++;else exposed++;
    }
    check(shielded>0&&exposed>0&&lowerTurns>1&&upperTurns>1,'natural repeated shielding and exposure');
    // Actual scene bullet path: lower contact consumes both weapon variants without damage.
    root.x=400;cz.x=400;
    for(const rapid of [false,true]){
     const r=p.bodyBounds(),b=shoot(root.x,root.y,rapid);
     check(!b.active&&p.czHits===0&&p.act2Health===0,'lower shield absorbs shot');
     const c=p.czBounds();check(!shoot(400,c.y+c.height/2,rapid,r.y+r.height+20).active&&p.czHits===0,'swept lower contact wins over CZ');
    }
    // Exposure uses the same unmodified player beam, without a vulnerability timer.
    root.x=204;cz.x=600;let c=p.czBounds(),x=c.x+c.width/2,y=c.y+c.height/2;
    const before={x:cz.x,y:cz.y,direction:p.czDirection};check(!shoot(x,y).active&&p.czHits===1,'first exposed hit');
    check(cz.texture.key===M.mubarakCZTexture(2,p.czDirection)&&p.phase==='act3','second artwork, patrol remains active');
    near(cz.x,before.x,'first hit keeps x');near(cz.y,before.y,'first hit keeps y');check(p.czDirection===before.direction,'first hit keeps direction');
    cz.x=600;p.czDirection=-1;p.update(0);check(cz.texture.key==='mubarak-cz-2-left','damaged left pose');
    p.czDirection=1;p.update(0);check(cz.texture.key==='mubarak-cz-2-right','damaged right pose');
    p.update(C.czInvulnerabilityMs);
    p.czDirection=seed===0?1:-1;p.update(0);c=p.czBounds();x=c.x+c.width/2;y=c.y+c.height/2;
    check(!shoot(x,y,true).active&&p.czHits===2&&p.phase==='escape','second hit escapes immediately');
    check(cz.texture.key===M.mubarakCZTexture(3,p.czDirection)&&!s.completedMubarak,'escape art before victory');
    const extra=shoot(x,y);check(!extra.active&&p.czHits===2,'opaque escape contact consumes laser without another hit');
    const dx=p.czDirection,speed=C.escapeInitialSpeed,initialX=cz.x;p.update(100);
    near(cz.x-initialX,dx*(speed*.1+C.escapeAcceleration*.01/2),'accelerating escape');
    let last=cz.x,elapsed=0;
    while(cz.active&&elapsed<5000){
     const fullyOutside=dx>0?cz.x-cz.displayWidth/2>800:cz.x+cz.displayWidth/2<0;
     check(!fullyOutside&&!s.completedMubarak,'no victory while visible');s.update(undefined,10);elapsed+=10;
     if(cz.active){check((cz.x-last)*dx>0&&cz.texture.key===M.mubarakCZTexture(3,dx),'escape never bounces');last=cz.x}
    }
    check(!cz.active&&root.active&&!p.cz&&p.phase==='collapse'&&!s.completedMubarak,'full exit starts collapse');
    const remainingCollapse=C.collapseDurationMs-p.collapseElapsed;
    s.update(undefined,remainingCollapse-.001);check(root.active&&!s.completedMubarak,'no completion before shrink finishes');s.update(undefined,.001);
    check(!root.active&&!p.sprite&&p.phase==='complete'&&s.completedMubarak&&s.state==='waveTransition','completion after collapse');
    s.assetManager.bullets.clear(true,true);s._startNextWave();check(s.wave===2&&s.state==='playing','existing next-wave flow');
    for(const phase of ['act3','escape'])for(const reason of ['restart','gameOver']){
     p=enter();const a=p.sprite,b=p.cz;if(phase==='escape'){for(let i=0;i<2;i++){p.sprite.x=204;p.cz.x=600;const r=p.czBounds();shoot(r.x+r.width/2,r.y+r.height/2);if(!i)p.update(C.czInvulnerabilityMs)}}
     if(reason==='restart')s.restart();else if(reason==='gameOver')s._gameOver();else {s.events.emit('shutdown');}
     check(!a.active&&!b.active&&!p.sprite&&!p.cz&&!p.update(100000),'lifecycle '+phase+'/'+reason);
    }
    p=enter();const finalCZ=p.cz,finalBoss=p.sprite;testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();
    check(!finalCZ.active&&!finalBoss.active&&!p.cz&&!p.sprite,'scene shutdown clears Act III');
    return {renderer,seed,shielded,exposed,lowerTurns,upperTurns,escapeMs:elapsed,start};
   },{renderer,seed});
   reports.push(report);
   // Render a real encounter for visual inspection after restoring its normal lifecycle.
   await page.goto('http://mubarak.test/?'+renderer);await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0]&&testGame.scene.scenes[0].alienManager);
   await page.evaluate(()=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0];s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();
    const p=s.mubarak;p.update(3600);for(let i=0;i<4;i++){p.hit();if(i<3)p.update(800)}p.update(0);p.update(528.75);p.shrapnel.clear();
    for(let i=0;i<3;i++){p.barrels.random=()=>0;p.barrels.spawn();const f=p.barrels.flights[p.barrels.flights.length-1];f.sprite.setPosition(p.sprite.x,p.sprite.y);p.tryHitBarrel(p.barrels.bounds(f.sprite));p.update(800)}
    p.update(1000);testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
   });
   await page.screenshot({path:path.join(output,`act3-${renderer}-${seed}.png`)});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-act3-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL, both directions; real Acts I/II -> III, independent lanes/facing/exposure, shield and swept beams, two hits, accelerating escape both edges, next wave and all lifecycle cleanup.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

