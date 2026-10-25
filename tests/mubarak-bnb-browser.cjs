// Real Phaser BNB pump/dump integration. Requires Playwright + Chrome.
// node tests/mubarak-bnb-browser.cjs <absolute screenshot output directory>
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
   reports.push(await page.evaluate(({renderer,seed})=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],M=load('src/interface/mubarak'),C=M.MubarakAct3Settings;
    const check=(v,l)=>{if(!v)throw Error(l)},near=(a,b,l,tol=1e-6)=>check(Math.abs(a-b)<tol,l+': '+a+' / '+b);
    const shoot=(x,y,rapid=false,previousY)=>{
     const b=s.assetManager.bullets.get();b.enableBody(true,x,y,true,true);b.shoot(x,y,rapid);b.body.preUpdate(false,0);
     if(previousY!==undefined)b.body.prev.y=previousY;s.update(undefined,0);return b;
    };
    const enter=()=>{
     s.restart();s.waveSeed=seed;s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();
     const p=s.mubarak;p.update(M.MubarakSettings.entranceMs);
     for(let i=0;i<4;i++){check(p.hit(),'Act I hit');if(i<3)p.update(800)}p.update(0);p.update(M.mubarakFinalDuration());
     check(p.phase==='act2'&&p.act2Health===3,'Act II remains playable');p.shrapnel.clear();
     for(let i=0;i<3;i++){p.barrels.random=()=>0;p.barrels.spawn();const f=p.barrels.flights[p.barrels.flights.length-1];f.sprite.setPosition(p.sprite.x,p.sprite.y);p.tryHitBarrel(p.barrels.bounds(f.sprite));p.update(800)}
     check(p.phase==='act3'&&p.cz&&!p.bnbCoins.length&&p.act3Pumps===0,'clean Act III entry');return p;
    };
    const feed=p=>{
     p.clearCoins();p.launchBNB();const coin=p.bnbCoins[0],body=p.bodyBounds();
     coin.sprite.setPosition(p.sprite.x,body.y-coin.sprite.displayHeight/2-.1);coin.vx=0;coin.vy=C.bnbCoinSpeed;
     const count=p.act3Pumps;p.update(10);check(!coin.sprite.active&&p.act3Pumps===count+1,'coin feeds exactly once');return coin;
    };
    const expose=p=>{p.sprite.x=24+p.sprite.displayWidth/2;p.cz.x=600;p.czDirection=1;p.update(0);const r=p.czBounds();return {x:r.x+r.width/2,y:r.y+r.height/2}};
    let p=enter(),root=p.sprite,base=root.scaleX,bottom=root.getBounds().bottom;
    const source=s.textures.get(M.MubarakBNBAsset.key).getSourceImage();check(source.width===1254&&source.height===1254,'actual approved asset');
    p.update(2999);check(p.bnbCoins.length===0,'no early launch');p.update(1);check(p.bnbCoins.length===1,'launch at 3000ms');
    let coin=p.bnbCoins[0];near(coin.sprite.displayWidth,28,'coin size');near(coin.sprite.scaleX,coin.sprite.scaleY,'coin aspect');near(Math.hypot(coin.vx,coin.vy),180,'coin speed');
    const ox=p.czDirection<0?p.cz.width-C.czPumpOrigin.x:C.czPumpOrigin.x;
    near(coin.sprite.x,p.cz.x+(ox-p.cz.width/2)*p.cz.scaleX,'cockpit X');near(coin.sprite.y,p.cz.y+(C.czPumpOrigin.y-p.cz.height/2)*p.cz.scaleY,'cockpit Y');
    const velocity={x:coin.vx,y:coin.vy},start={x:coin.sprite.x,y:coin.sprite.y};root.x=400;p.update(100);
    near(coin.vx,velocity.x,'no homing X');near(coin.vy,velocity.y,'no homing Y');near(coin.sprite.x-start.x,velocity.x*.1,'visible linear travel X');near(coin.sprite.y-start.y,velocity.y*.1,'visible linear travel Y');
    p.clearCoins();for(let i=0;i<4;i++)p.launchBNB();check(p.bnbCoins.length===3,'three-coin cap');
    const capped=p.bnbCoins.slice();p.pumpElapsed=2999;p.update(1);check(p.bnbCoins.length===3,'scheduled launch obeys cap');p.clearCoins();check(capped.every(c=>!c.sprite.active),'cap fixture cleanup');
    const score=s.scoreManager.score;
    // One swept beam crossing a coin and CZ consumes only the nearer coin.
    root.x=204;p.cz.x=600;p.launchBNB();coin=p.bnbCoins[0];coin.sprite.setPosition(650,250);
    check(!shoot(650,90,true,400).active&&!coin.sprite.active&&p.czHits===0&&p.bnbCoins.length===0,'interception precedes CZ');
    p.update(250);near(root.scaleX,base,'interception prevents growth');check(p.act3Pumps===0&&s.scoreManager.score===score,'no pump or score from intercepted coin');
    root.x=400;p.cz.x=400;p.launchBNB();coin=p.bnbCoins[0];coin.sprite.setPosition(400,120);
    check(!shoot(400,90,false,450).active&&coin.sprite.active&&p.czHits===0,'Mubarak blocks coin/CZ behind him');p.clearCoins();
    // Aimed coins can miss the moving boss and are removed after leaving the world.
    p.launchBNB();coin=p.bnbCoins[0];coin.sprite.setPosition(-30,250);coin.vx=-180;coin.vy=0;p.update(1);check(!coin.sprite.active&&p.act3Pumps===0,'miss cleanup');
    feed(p);check(root.scaleX>base&&root.scaleX<base*1.08,'smooth growth begins');
    p.update(90);check(root.scaleX>base&&root.scaleX<base*1.08,'growth remains animated at100ms');p.update(110);near(root.scaleX/base,1.08,'first pump +8 points');
    for(let i=2;i<=8;i++){
     root.x=800-24-root.displayWidth/2-1;p.direction=1;feed(p);
     let last=root.x;
     for(let t=0;t<200;t++){p.update(1);const b=root.getBounds();check(b.left>=24-1e-6&&b.right<=776+1e-6,'growth respects current width');check(Math.abs(root.x-last)<1,'no growth teleport/jitter');near(b.bottom,bottom,'bottom anchor');last=root.x;}
     near(root.scaleX/base,Math.min(1+i*.08,1.48),'additive growth and cap');
    }
    const body=p.bodyBounds();near(body.width,M.MubarakAct2Settings.visibleBody.width*root.scaleX,'scaled blocking width');near(body.height,M.MubarakAct2Settings.visibleBody.height*root.scaleY,'scaled blocking height');
    check(root.y<C.mubarakLaneY&&root.getBounds().bottom<500&&p.invulnerable&&!p.hit(),'upward growth and invulnerability');
    let exposed=0;
    for(let i=0;i<3000;i++){p.update(10);const a=p.bodyBounds(),b=p.czBounds();if(b.x<a.x||b.x+b.width>a.x+a.width)exposed++;check(root.getBounds().left>=24-1e-6&&root.getBounds().right<=776+1e-6,'max scale patrol bounds')}
    check(exposed>0,'CZ remains reachable at approved148% cap');near(root.scaleX/base,1.48,'extra natural pumps cannot exceed cap');
    p.clearCoins();let target=expose(p);const pumps=p.act3Pumps;check(!shoot(target.x,target.y).active&&p.czHits===1,'exposed CZ first hit at max growth');
    check(p.cz.texture.key==='mubarak-cz-2-right'&&p.act3Pumps===pumps,'Frame2 preserves accumulated growth');
    p.pumpElapsed=2999;p.update(1);check(p.bnbCoins.length===1&&p.phase==='act3','pumping continues in Frame2');
    p.update(C.czInvulnerabilityMs);const active=p.bnbCoins.map(c=>c.sprite);target=expose(p);shoot(target.x,target.y,true);
    check(p.phase==='escape'&&p.czHits===2&&p.cz.texture.key==='mubarak-cz-3-right','unchanged second hit');check(p.bnbCoins.length===0&&active.every(c=>!c.active),'escape clears active coins');
    const pumpCount=p.act3Pumps;p.update(100);check(!p.bnbCoins.length&&p.act3Pumps===pumpCount,'no escape pumps');
    while(p.phase==='escape')p.update(10);check(p.phase==='collapse'&&root.active&&!p.cz,'exit starts dump');
    // Collapse is measured independently at zero, three, and maximum pumps.
    const collapses=[];
    for(const count of [0,3,6]){
     p=enter();root=p.sprite;for(let i=0;i<count;i++){feed(p);p.update(200)}
     if(count===3){
      root.x=400;p.cz.x=700;p.launchBNB();p.update(100);
      testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
      window.bnbPreview=testGame.canvas.toDataURL('image/png');
      p.clearCoins(); // Preview coin must not turn the three-pump collapse into four.
     }
     target=expose(p);shoot(target.x,target.y);p.update(C.czInvulnerabilityMs);target=expose(p);shoot(target.x,target.y,true);
     const escapedCZ=p.cz;while(p.phase==='escape')p.update(10);
     check(p.phase==='collapse'&&!escapedCZ.active&&!p.cz&&root.active&&!s.completedMubarak,'collapse precedes completion');
     const center={x:root.x,y:root.y},scale=p.collapseScale;
     near(scale/(360/1664),Math.min(1+count*.08,1.48),'exact collapse pump count');
     check(!p.collides({x:0,y:0,width:800,height:600})&&!s.playerShootingEnabled,'collapse disables collisions and firing');
     p.launchBNB();check(!p.bnbCoins.length,'late pump ignored');
     p.update(1000-p.collapseElapsed);near(root.scaleX,scale*.5,'smooth midpoint');near(root.x,center.x,'center X fixed');near(root.y,center.y,'center Y fixed');
     p.receiveLaser({x:root.x,y:root.y,width:6,height:36},undefined,s.player.y);check(p.czHits===2,'late damage ignored');
     const remainder=2000-p.collapseElapsed;s.update(undefined,remainder-.001);check(root.active&&p.phase==='collapse'&&!s.completedMubarak,'full2-second shrink');
     s.update(undefined,.001);check(p.phase==='complete'&&!root.active&&!p.sprite&&s.completedMubarak&&s.state==='waveTransition','completion after shrink');check(!p.update(10000),'completion reported only once');
     collapses.push({pumps:count,startScale:scale,center});
    }
    // Restart/death during coin flight, growth, escape, and collapse clear every owner.
    for(const phase of ['coin','growth','escape','collapse'])for(const reason of ['restart','gameOver']){
     p=enter();if(phase==='growth')feed(p);p.launchBNB();
     if(phase==='escape'||phase==='collapse'){target=expose(p);shoot(target.x,target.y);p.update(C.czInvulnerabilityMs);target=expose(p);shoot(target.x,target.y);if(phase==='collapse')while(p.phase==='escape')p.update(10)}
     const sprites=p.bnbCoins.map(c=>c.sprite).concat([p.sprite,p.cz].filter(Boolean));
     if(reason==='restart')s.restart();else s._gameOver();
     check(sprites.every(q=>!q.active)&&!p.bnbCoins.length&&!p.sprite&&!p.cz&&!p.update(10000),'cleanup '+phase+'/'+reason);
    }
    p=enter();p.launchBNB();const owned=p.bnbCoins.map(c=>c.sprite).concat([p.sprite,p.cz]);testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();check(owned.every(q=>!q.active)&&!p.bnbCoins.length,'shutdown cleanup');
    return {renderer,seed,exposedAtMax:exposed,collapses};
   },{renderer,seed}));
   const preview=await page.evaluate(()=>window.bnbPreview);
   fs.writeFileSync(path.join(output,`bnb-${renderer}-${seed}.png`),Buffer.from(preview.split(',')[1],'base64'));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-bnb-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL both directions;3s aimed coins/cap/speed, interception and first-contact shield ordering, additive smooth bottom-anchored growth/cap/bounds, max-scale exposure, two CZ hits/coin cleanup, centered2s collapse0/3/6 pumps, exactly-once next-wave completion and lifecycle.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

