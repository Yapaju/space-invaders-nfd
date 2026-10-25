// Act III invader-explosion reuse and constant-speed random single diamond.
// node tests/mubarak-act3-polish-browser.cjs <absolute screenshot output directory>
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
    const D=load('src/interface/mubarak-shrapnel'),A=load('src/interface/assets'),K=load('src/interface/factory/animation-factory'),B=load('src/interface/mubarak-barrels');
    const gain=load('src/interface/audio-balance').AudioBalance.gains[A.SoundType.InvaderKilled];
    const check=(v,l)=>{if(!v)throw Error(l)},near=(a,b,l,tol=1e-6)=>check(Math.abs(a-b)<tol,l+': '+a+' / '+b);
    const shoot=(x,y,rapid=false)=>{
     const b=s.assetManager.bullets.get();b.enableBody(true,x,y,true,true);b.shoot(x,y,rapid);b.body.preUpdate(false,0);s.update(undefined,0);return b;
    };
    const enter=()=>{
     s.restart();s.waveSeed=seed;s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();
     const p=s.mubarak;p.update(M.MubarakSettings.entranceMs);for(let i=0;i<4;i++){check(p.hit(),'Act I hit');if(i<3)p.update(800)}
     p.update(0);p.update(M.mubarakFinalDuration());check(p.phase==='act2','Act II entry');p.shrapnel.clear();
     for(let i=0;i<3;i++){p.barrels.random=()=>0;p.barrels.spawn();const f=p.barrels.flights[p.barrels.flights.length-1];f.sprite.setPosition(p.sprite.x,p.sprite.y);p.tryHitBarrel(p.barrels.bounds(f.sprite));p.update(800)}
     check(p.phase==='act3'&&!p.czHitExplosions.length,'Act III clean entry');return p;
    };
    const expose=p=>{p.sprite.x=24+p.sprite.displayWidth/2;p.cz.x=650;p.czDirection=seed===0?1:-1;p.update(0);const r=p.czBounds();return {x:r.x+r.width/2,y:r.y+r.height/2}};
    const finishAnimation=effect=>{for(let time=0;time<850&&effect.active;time+=20)effect.preUpdate(time,20)};
    const render=property=>{testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();window[property]=testGame.canvas.toDataURL('image/png')};
    let p=enter();const cz=p.cz,normal=s.assetManager.explosions.get(),normalSize={width:normal.displayWidth,height:normal.displayHeight,scale:normal.scaleX};normal.destroy();
    const originalPlay=s.sound.play,sounds=[];s.sound.play=function(key,config){sounds.push({key,config});return originalPlay.call(this,key,config)};
    let target=expose(p);const start={x:cz.x,y:cz.y},expectedX=cz.x+((p.czDirection<0?1536-650:650)-768)*cz.scaleX,expectedY=cz.y+(400-512)*cz.scaleY;
    check(!shoot(target.x,target.y).active&&p.czHits===1&&p.czHitExplosions.length===1,'one accepted hit one explosion');
    let effect=p.czHitExplosions[0];
    check(effect.texture.key===A.AssetType.Kaboom&&effect.anims.currentAnim.key===K.AnimationType.Kaboom,'same invader asset and animation');
    near(effect.displayWidth,normalSize.width*1.5,'150% normal displayed width');near(effect.displayHeight,normalSize.height*1.5,'150% normal displayed height');near(effect.scaleX,normalSize.scale*M.CZ_HIT_EXPLOSION_SCALE_MULTIPLIER,'relative display scale');
    near(effect.x,expectedX,'directional cockpit X');near(effect.y,expectedY,'cockpit Y');near(cz.x,start.x,'no hit reposition X');near(cz.y,start.y,'no hit reposition Y');
    check(effect.depth===13&&effect.depth>p.sprite.depth&&cz.depth<p.sprite.depth&&effect.active&&effect.visible&&!effect.body,'frontmost pure visual without body');
    check(cz.texture.key===M.mubarakCZTexture(2,p.czDirection)&&cz.tintTopLeft!==0xffffff&&p.czInvulnerable,'Frame2 and existing red flash underneath');
    const hitSounds=()=>sounds.filter(a=>a.key===A.SoundType.InvaderKilled);
    check(hitSounds().length===1&&hitSounds()[0].config.volume===gain,'one ordinary invader sound at shared gain');
    shoot(target.x,target.y,true);check(p.czHits===1&&p.czHitExplosions.length===1&&hitSounds().length===1,'rejected hit creates no effect or sound');
    const anchor={x:effect.x,y:effect.y};p.pumpElapsed=2999;p.update(1);check(p.bnbCoins.length===1,'hit preserves BNB schedule');p.update(99);
    check(cz.x!==start.x&&p.phase==='act3','normal independent movement continues');near(effect.x,anchor.x,'effect fixed in world X');near(effect.y,anchor.y,'effect fixed in world Y');
    effect.preUpdate(100,100);render('firstHitPreview');
    let completed=0;effect.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE,()=>completed++);finishAnimation(effect);
    check(!effect.active&&!p.czHitExplosions.length&&completed===1,'sprite animation completion destroys effect and releases ownership');
    p.update(700);check(!p.czInvulnerable,'original800ms immunity expires');target=expose(p);const secondStart={x:cz.x,y:cz.y};shoot(target.x,target.y,true);
    check(p.phase==='escape'&&p.czHits===2&&p.czHitExplosions.length===1&&hitSounds().length===2,'second accepted hit immediate explosion and escape');
    effect=p.czHitExplosions[0];const secondAnchor={x:effect.x,y:effect.y};check(cz.texture.key===M.mubarakCZTexture(3,p.czDirection)&&cz.tintTopLeft!==0xffffff,'Frame3 red underneath explosion');
    near(cz.x,secondStart.x,'second explosion before escape movement');p.update(50);check(cz.x!==secondStart.x&&cz.visible,'escape not delayed');near(effect.x,secondAnchor.x,'second effect remains at hit position');
    shoot(target.x,target.y);check(p.czHits===2&&p.czHitExplosions.length===1&&hitSounds().length===2,'escape hits cannot retrigger effect');
    while(p.phase==='escape')p.update(10);p.update(2000);check(p.phase==='complete'&&!effect.active&&!p.czHitExplosions.length&&!p.update(10000),'completion cleans any unfinished visual once');
    s.sound.play=originalPlay;

    const tiers=[];
    check(JSON.stringify(C.blackDiamondAnglesDegrees)==='[-40,-20,0,20,40]','five allowed angles');
    for(const [pumps,interval] of [[0,2500],[1,2500],[2,2000],[3,2000],[4,1500],[5,1500],[6,1000],[9,1000]]){
     p=enter();p.act3Pumps=pumps;p.launchBNB=()=>{};const owner=p.act3Diamonds;
     let draws=0;owner.random=()=>{draws++;return .1};
     p.update(interval-1);check(!owner.flights.length&&draws===0,'no early shot or random draw '+pumps);p.update(1);
     check(owner.flights.length===1&&owner.emitted===1&&draws===1,'exactly one diamond and one draw per timer event');
     const f=owner.flights[0],originY=p.sprite.y+(C.blackDiamondOrigin.y-608)*p.sprite.scaleY;
     near(f.sprite.x,p.sprite.x,'unchanged carpet emitter X');near(f.sprite.y,originY,'unchanged carpet emitter Y');
     near(f.sprite.displayWidth,39,'unchanged displayed size');check(f.kind==='black'&&f.sprite.texture.key==='mubarak-diamond-black'&&f.linear,'existing artwork and linear trajectory');
     check(!B.rectsOverlap(owner.bounds(f),s.player.body),'no spawn inside player');check(!owner.tryShoot(owner.bounds(f)),'black laser immunity');
     const position={x:f.sprite.x,y:f.sprite.y},velocity={x:f.vx,y:f.vy};
     owner.step(500);near(f.sprite.x-position.x,velocity.x*.5,'constant diagonal X');near(f.sprite.y-position.y,velocity.y*.5,'constant diagonal Y');near(f.vx,velocity.x,'no drag');near(f.vy,velocity.y,'no acceleration');
     if(pumps===0)render('singleShotPreview');
     p.update(interval-1);check(owner.emitted===1&&draws===1,'wait for next scheduled attack');p.update(1);check(owner.emitted===2&&draws===2,'one shot on second event');
     tiers.push({pumps,interval});
    }
    // Nonsequential draws include repeats and every bin edge: selection is with replacement.
    p=enter();let draws=0;const rolls=[.999999,0,.4,.4,.2,.8,.6],indices=[4,0,2,2,1,4,3],ownerRandom=p.act3Diamonds;
    ownerRandom.random=()=>rolls[draws++];
    for(let i=0;i<rolls.length;i++){
     p.diamondElapsed=2499;p.update(1);check(ownerRandom.emitted===i+1&&draws===i+1,'one independent draw per scheduled event');
     const f=ownerRandom.flights[ownerRandom.flights.length-1],angle=C.blackDiamondAnglesDegrees[indices[i]]*Math.PI/180;
     near(f.vx,Math.sin(angle)*84,'selected direction VX');near(f.vy,Math.cos(angle)*84,'selected direction VY');near(Math.hypot(f.vx,f.vy),84,'normalized overall speed');
    }
    // Real encounter RNG varies directions and remains reproducible for the same seed.
    const sequence=()=>{const q=enter(),angles=[];for(let i=0;i<20;i++){q.diamondElapsed=2499;q.update(1);const f=q.act3Diamonds.flights[q.act3Diamonds.flights.length-1];angles.push(Math.round(Math.atan2(f.vx,f.vy)*180/Math.PI))}return angles};
    const directions=sequence();check(new Set(directions).size>1&&directions.every(a=>C.blackDiamondAnglesDegrees.includes(a)),'real RNG selects allowed varying directions');check(JSON.stringify(directions)===JSON.stringify(sequence()),'seeded replay');
    // Elapsed attack progress carries across a growth tier change.
    p=enter();p.update(1999);p.act3Pumps=2;p.update(1);check(p.act3Diamonds.emitted===1,'growth preserves elapsed attack clock');
    // Facing-independent direction and the same growth-adjusted emitter.
    for(const multiplier of [1,1.24,1.48])for(const direction of [-1,1]){
     p=enter();p.growthFrom=p.growthTo=multiplier;p.growthElapsed=200;p.update(0);p.sprite.x=400;p.direction=direction;p.syncArtwork();p.act3Diamonds.random=()=>.9;
     p.diamondElapsed=2499;p.update(1);const shots=p.act3Diamonds.flights;
     check(shots.length===1,'single shot at each scale/facing');near(shots[0].sprite.y,p.sprite.y+492*p.sprite.scaleY,'scaled carpet origin');near(shots[0].sprite.x,p.sprite.x,'unchanged carpet X');near(shots[0].vx,Math.sin(40*Math.PI/180)*84,'facing-independent angle');
    }
    // Diagonal offscreen cleanup never reverses the trajectory.
    p=enter();let owner=p.act3Diamonds;owner.fireBlack(400,400,[-40]);let shots=owner.flights.slice(),diagonal=shots[0];
    diagonal.sprite.x=-diagonal.sprite.displayWidth/2+1;const vx=diagonal.vx;owner.step(100);
    check(!owner.flights.length&&shots.every(f=>!f.sprite.active)&&diagonal.vx===vx,'side exits clean up without bouncing');
    // Diagonal hits use the real existing player-damage callback and impact owner.
    p=enter();owner=p.act3Diamonds;owner.fireBlack(400,400,[-40]);shots=owner.flights.slice();diagonal=shots[0];
    diagonal.sprite.setPosition(s.player.x,s.player.y-1);const lives=s.scoreManager.lives.countActive(true);
    s.update(undefined,20);check(!diagonal.sprite.active&&s.scoreManager.lives.countActive(true)===lives-1,'same one-life diagonal impact');const remaining=s.scoreManager.lives.countActive(true);s.update(undefined,20);check(s.scoreManager.lives.countActive(true)===remaining,'impact does not duplicate damage');
    // Remove normal and escaping hit effects plus diamond projectiles on every exit.
    for(const phase of ['act3','escape'])for(const reason of ['restart','gameOver']){
     p=enter();target=expose(p);shoot(target.x,target.y);if(phase==='escape'){p.update(800);target=expose(p);shoot(target.x,target.y)}
     p.act3Diamonds.fireBlack(400,400,[-40]);const owned=p.czHitExplosions.concat(p.act3Diamonds.flights.map(f=>f.sprite));
     if(reason==='restart')s.restart();else s._gameOver();check(owned.every(q=>!q.active)&&!p.czHitExplosions.length&&!p.act3Diamonds&&!p.sprite&&!p.cz,'cleanup '+phase+'/'+reason);
    }
    p=enter();target=expose(p);shoot(target.x,target.y);p.act3Diamonds.fireBlack(400,400,[-40]);const owned=p.czHitExplosions.concat(p.act3Diamonds.flights.map(f=>f.sprite));
    testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();check(owned.every(q=>!q.active)&&!p.czHitExplosions.length&&!p.act3Diamonds,'shutdown cleanup');
    return {renderer,seed,normalExplosion:normalSize,tiers};
   },{renderer,seed}));
   for(const [name,property] of [['cz-hit','firstHitPreview'],['single-shot','singleShotPreview']]){
    const preview=await page.evaluate(property=>window[property],property);fs.writeFileSync(path.join(output,`${name}-${renderer}-${seed}.png`),Buffer.from(preview.split(',')[1],'base64'));
   }
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-act3-polish-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL both directions;ordinary invader explosion at150% normal display scale, fixed cockpit anchor/depth/animation cleanup/audio once per accepted hit, unchanged flash/BNB/escape;one independently selected normalized84px/s diamond per event, all growth intervals and emitters, diagonal damage/offscreen cleanup, lifecycle.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

