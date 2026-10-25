// Mubarak Act I real-Phaser gameplay and visual regression. Requires Playwright + Chrome.
// node tests/mubarak-browser.cjs <absolute screenshot output directory>
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
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://mubarak.test/**',serve);
  for(const renderer of ['canvas','webgl'])for(const entranceDirection of [1,-1]){
   await page.goto('http://mubarak.test/?'+renderer);
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0]&&testGame.scene.scenes[0].alienManager&&testGame.scene.scenes[0].alienManager.aliens.countActive(true)===24);
   const report=await page.evaluate(entranceDirection=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],m=s.alienManager;
    const {MubarakSettings:C,MubarakAssets,MubarakEncounter,mubarakEntranceDirection,mubarakTexture,premiumHitDuration}=load('src/interface/mubarak');
    const check=(ok,label)=>{if(!ok)throw Error(label);},near=(a,b,label,tol=1e-6)=>check(Math.abs(a-b)<tol,label+': '+a+' != '+b);
    const drain=()=>{const q=s.pendingCleanup;s.pendingCleanup=[];q.forEach(f=>f());};
    let seed=0,leftCount=0;while(mubarakEntranceDirection(seed,1)!==entranceDirection)seed++;
    const D=load('src/interface/wave-director'),plans=JSON.stringify([D.getWavePlan(1,seed),D.getWavePlan(14,seed)]);
    for(let i=0;i<10000;i++){
     const direction=mubarakEntranceDirection(i,1);if(direction===1)leftCount++;
     check(direction===mubarakEntranceDirection(i,1),'seeded replay');
     check(direction===(D.randomForWave(i^0x4d554241,1)()<.5?1:-1),'exact 50/50 threshold');
    }
    check(leftCount>4700&&leftCount<5300,'approximately equal sides in sample');
    check(plans===JSON.stringify([D.getWavePlan(1,seed),D.getWavePlan(14,seed)]),'independent planning stream');
    s.waveSeed=seed;s.restart();
    check(C.testSpawn.enabled&&C.testSpawn.afterWave===1,'test after Wave 1');
    check(s.wave===1&&s.state==='playing'&&!s.mubarak,'ordinary Wave 1');
    s._startMubarak();check(!s.mubarak,'living-enemy gate');
    m.stopMovement();s.firingTimer=Infinity;
    m.aliens.getChildren().slice().forEach(a=>{
     const b=s.assetManager.bullets.get();b.enableBody(true,a.x,a.y,true,true);s._bulletHitAliens(b,a);drain();
    });
    check(s.state==='waveTransition'&&!m.hasAliveAliens,'clear every invader');
    check(s.scoreManager.score===1240&&s.invadersKilled===24,'rewards unchanged');
    s.assetManager.bullets.clear(true,true);s.time.now=s.nextWaveReadyAt-1;s._startNextWave();check(!s.mubarak,'1500ms gate');
    const trailing=s.assetManager.bullets.get();trailing.enableBody(true,400,400,true,true);
    s.time.now++;s._startNextWave();check(!s.mubarak,'trailing shots gate');trailing.destroy();s._startNextWave();
    const p=s.mubarak,root=p.sprite;
    check(p.direction===entranceDirection&&root.texture.key===mubarakTexture(1,entranceDirection),'entrance facing');
    check(s.state==='mubarakEncounter'&&s.wave===1&&s.firingTimer===Infinity&&!s.playerShootingEnabled,'isolated encounter');
    check(root.y+root.displayHeight/2<0,'outside upper edge');
    check(entranceDirection>0?root.x+root.displayWidth/2<0:root.x-root.displayWidth/2>800,'outside correct side');
    check(!p.hit()&&!p.collides({x:-1000,y:-1000,width:3000,height:3000}),'no entrance damage');
    s._startMubarak();s._startNextWave();check(p.sprite===root,'single spawn');
    const dimensions=[root.displayWidth,root.displayHeight],scale=root.scaleX;
    check(MubarakAssets.length===14,'fourteen dedicated character assets');
    check(s.input.keyboard.listenerCount('keydown-F6')===0,'production F6 unavailable');
    MubarakAssets.forEach(a=>{
     const im=s.textures.get(a.key).getSourceImage(),source=s.textures.get(a.key+'-source').getSourceImage();
     check(im.width===C.canvasWidth&&im.height===C.canvasHeight,'registered canvas');
     check(a.x>=0&&a.y>=0&&a.x+source.width*a.scale<=C.canvasWidth&&a.y+source.height*a.scale<=C.canvasHeight,'no source crop');
    });
    const paused={x:root.x,y:root.y};s.sys.pause();testGame.scene.update(100,5000);near(root.x,paused.x,'pause x');near(root.y,paused.y,'pause y');s.sys.resume();
    const entrance=[];let last={x:root.x,y:root.y};
    for(let i=0;i<119;i++){
     p.update(30);check((root.x-last.x)*entranceDirection>=0&&root.y>=last.y,'diagonal inward');
     last={x:root.x,y:root.y};if(i%30===0)entrance.push(last);
    }
    p.update(29);const before={x:root.x,y:root.y};p.update(1);const join={x:root.x,y:root.y};
    check(p.phase==='cruise'&&s.playerShootingEnabled,'cruise entry');near(root.y,190,'entry Y');
    near(root.x,400-entranceDirection*196/Math.sqrt(2),'entry X');p.update(1);
    near(join.x-before.x,root.x-join.x,'continuous horizontal velocity',.0002);
    near(join.y-before.y,root.y-join.y,'continuous vertical velocity',.0002);
    // Long frames retain entrance overflow and match split delta motion.
    const one=new MubarakEncounter(s),split=new MubarakEncounter(s);one.start(seed,1);split.start(seed,1);
    one.update(C.entranceMs+5000);for(let t=0;t<C.entranceMs+5000;t+=100)split.update(100);
    near(one.sprite.x,split.sprite.x,'partition x');near(one.sprite.y,split.sprite.y,'partition y');check(one.direction===split.direction,'partition facing');one.clear();split.clear();
    let minX=800,maxX=0,reversals=0;last={x:root.x,y:root.y};let previousDirection=p.direction;
    for(let i=0;i<2800;i++){
     p.update(10);const b=root.getBounds();check(b.left>=24-1e-5&&b.right<=776+1e-5&&b.top>40&&b.bottom<340,'safe cruise bounds');
     const dx=root.x-last.x;
     if(p.direction===previousDirection&&Math.abs(dx)>.001)check(p.direction===(dx>0?1:-1),'facing follows actual travel');
     check(root.texture.key===mubarakTexture(1,p.direction)&&!root.flipX,'dedicated art, no flip');
     if(p.direction!==previousDirection)reversals++;
     previousDirection=p.direction;last={x:root.x,y:root.y};minX=Math.min(minX,root.x);maxX=Math.max(maxX,root.x);
    }
    check(reversals===4,'two full cruise cycles');near(minX,204,'left limit',.001);near(maxX,596,'right limit',.001);
    const x=root.x,y=root.y;p.update(-100);near(root.x,x,'negative delta');near(root.y,y,'negative delta y');
    const world=(x,y)=>({x:root.x-root.displayWidth/2+(p.direction<0?C.canvasWidth-x:x)*scale,y:root.y-root.displayHeight/2+y*scale});
    const shot=(point,rapid=false)=>{
     const q=world(...point),b=s.assetManager.bullets.get();b.enableBody(true,q.x,q.y,true,true);b.shoot(q.x,q.y,rapid);
     b.body.preUpdate(false,0);s.update(undefined,0);return b;
    };
    for(const point of [[520,200],[300,600],[910,1150],[160,980],[1510,980]]){const b=shot(point);check(b.active&&p.hits===0,'head/body/carpet/tassel miss');b.destroy();}
    const frames=[],pulses=[];
    for(let hit=1;hit<=4;hit++){
     // Place the next successful hit 10ms before a real turning point.
     let turn=5250;while(turn<=p.cruiseElapsed+10)turn+=7000;p.update(turn-p.cruiseElapsed-10);
     const before={x:root.x,y:root.y,direction:p.direction};
     if(p.barrels)p.barrels.flights.slice().forEach(f=>p.barrels.removeFlight(f));
     const weak=p.weakPointBounds(),b=s.assetManager.bullets.get();
     b.enableBody(true,weak.x+weak.width/2,weak.y+weak.height-1,true,true);b.shoot(weak.x+weak.width/2,weak.y+weak.height-1,hit%2===0);b.body.preUpdate(false,0);s.update(undefined,0);
     const expectedFrame=hit===4?5:hit+1;
     check(!b.active&&p.hits===hit&&p.frame===expectedFrame,'one hit advances damage; final hit starts Frame 6');
     check(root.texture.key===mubarakTexture(expectedFrame,p.direction),'damage artwork');
     near(root.x,before.x,'hit position x');near(root.y,before.y,'hit position y');
     near(root.displayWidth,dimensions[0],'stable width');near(root.displayHeight,dimensions[1],'stable height');near(root.scaleX,scale,'stable scale');
     check(root.originX===.5&&root.originY===.5&&!root.flipX,'stable origin / dedicated art');
     frames.push(root.texture.key);
     if(hit===4){
      check(p.phase==='clearing'&&p.frame===5&&!p.hit()&&!s.playerShootingEnabled&&!p.explosion,'immediate freeze / cleanup');p.update(0);
      check(p.explosion&&p.explosion.texture.key==='mubarak-act1-explosion-1','immediate overlay');
      check(root.visible&&root.tintTopLeft===0xffffff&&p.explosion.depth>root.depth,'Frame 6 untinted underneath');
      break;
     }
     const reds=[];
     for(let tick=0;tick<8;tick++){
      reds.push(root.tintTopLeft!==0xffffff);const blocked=shot([930,600]);check(!blocked.active&&p.hits===hit,'immune contact consumed');
      p.update(tick===7?99:100);
      check(root.texture.key===mubarakTexture(hit+1,p.direction),'facing preserves damage frame');
      if(tick===0&&hit<4)check(p.direction===-before.direction&&p.invulnerable,'reversal during immunity preserves stage');
     }
     check(reds.filter(Boolean).length===4&&reds.every((v,i)=>v===(i%2===0)),'four Premium flashes');
     check(p.invulnerable&&!p.hit(),'799ms immunity');p.update(1);check(!p.invulnerable&&root.tintTopLeft===0xffffff,'800ms expiry clears tint');pulses.push(reds);
     if(hit===4)check(p.phase==='final'&&!p.hit()&&!s.playerShootingEnabled,'Frame 5 immediately final');
    }
    check(s.state==='mubarakEncounter'&&s.wave===1&&p.finalElapsed===0,'sequence blocks Wave 2');
    s.assetManager.explosions.clear(true,true);testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
    return {seed,entranceDirection,leftCount,entrance,join,dimensions,frames,pulses,reversals,duration:premiumHitDuration()};
   },entranceDirection);
   const label=renderer+(entranceDirection>0?'-from-left':'-from-right');
   await page.screenshot({path:path.join(output,label+'-final.png')});
   // Quarter-millisecond boundary checks preserve fractional durations exactly.
   report.explosionStages=[];
   for(const stage of [1,2,3,4,5]){
    const stageReport=await page.evaluate(stage=>{
     const s=testGame.scene.scenes[0],p=s.mubarak,r=p.sprite,o=p.explosion;
     const check=(v,l)=>{if(!v)throw Error(l);};
     const before={x:r.x,y:r.y,key:r.texture.key,hits:p.hits,clock:p.finalElapsed,width:r.displayWidth,height:r.displayHeight,direction:p.direction};
     const blocked=s.assetManager.bullets.get(),points=p.diamondPolygon();
     blocked.enableBody(true,points[1].x,points[1].y+40,true,true);blocked.body.preUpdate(false,0);s.update(undefined,0);
     blocked.destroy();check(!p.hit()&&p.hits===before.hits&&p.finalElapsed===before.clock,'repeat final hit consumed without restarting');
     if(stage>1)p.update(.25);
     check(o===p.explosion&&o.texture.key==='mubarak-act1-explosion-'+stage,'reuse overlay / exact frame boundary');
     const {mubarakTexture}=load('src/interface/mubarak');
     const expectedPose=mubarakTexture(stage<3?6:1,p.direction,stage<3?1:2);
     check(r.x===before.x&&r.y===before.y&&r.visible&&r.active&&p.direction===before.direction,'same visible character frozen underneath');
     check(r.texture.key===expectedPose,'scream for stages 1/2, angry for stages 3/4/5');
     check(r.texture.key===before.key||(stage===3&&p.finalElapsed===135),'pose switches exactly at start of stage 3');
     check(r.displayWidth===before.width&&r.displayHeight===before.height&&r.originX===.5&&r.originY===.5,'no pose alignment/scale jump');
     check(o.depth>r.depth,'explosion stays above both character poses');
     check(o.alpha===1&&o.tintTopLeft===0xffffff&&!o.flipX&&!o.isCropped,'native overlay, no blend/flip/crop');
     check(Math.abs(o.displayWidth/o.displayHeight-1.5)<1e-6,'preserved 3:2 aspect ratio');
     const expectedX=r.x+(p.direction<0?-78:78)*r.scaleX,expectedY=r.y+52*r.scaleY;
     check(Math.abs(o.x-expectedX)<1e-6&&Math.abs(o.y-expectedY)<1e-6,'diamond anchor follows facing');
     if(stage===3){
      const a=o.getBounds(),b=r.getBounds();check(a.left<=b.left&&a.right>=b.right&&a.top<=b.top&&a.bottom>=b.bottom,'climax covers boss canvas');
      const elapsed=p.finalElapsed;s.sys.pause();testGame.scene.update(9999,3000);s.sys.resume();check(p.finalElapsed===elapsed,'pause freezes final sequence');
     }
     testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
     return {stage,elapsed:p.finalElapsed,overlay:o.texture.key,pose:r.texture.key,width:o.displayWidth,height:o.displayHeight};
    },stage);
    report.explosionStages.push(stageReport);
    await page.screenshot({path:path.join(output,label+'-explosion'+stage+'.png')});
    await page.evaluate(stage=>{
     const p=testGame.scene.scenes[0].mubarak;p.update([67.5,67.5,131.25,131.25,131.25][stage-1]-.25);
     if(p.explosion.texture.key!=='mubarak-act1-explosion-'+stage)throw Error('stage ended early');
    },stage);
   }
   await page.evaluate(()=>{
    const s=testGame.scene.scenes[0],p=s.mubarak,root=p.sprite,check=(v,l)=>{if(!v)throw Error(l)};
    const overlay=p.explosion,score=s.scoreManager.score,kills=s.invadersKilled,pose=root.texture.key;
    s.update(undefined,.25);
    check(p.phase==='act2'&&p.finalElapsed===528.75&&root.active&&root.visible&&p.sprite===root&&!overlay.active&&!p.explosion,'528.75ms removes only overlay');
    check(root.texture.key===pose&&pose.indexOf('mubarak-act2-1-')===0,'angry pose persists without reverting or recreating sprite');
    s.assetManager.bullets.clear(true,true);s._startNextWave();s.update(undefined,0);
    check(!s.completedMubarak&&s.wave===1&&s.state==='mubarakEncounter'&&s.alienManager.aliens.countActive(true)===0,'Act II combat keeps encounter on screen');
    check(p.sprite===root&&root.visible&&root.active&&root.texture.key===pose&&!p.explosion&&!p.hit()&&s.playerShootingEnabled&&p.act2Health===3&&p.barrels.flights.length===0,'no flicker; direct immunity and three-hit combat start only after cinematic');
    testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
    check(s.scoreManager.score===score&&s.invadersKilled===kills,'no new score/reward/kill from cinematic');
    check(!s.premiumProgress.eligible('wojak',100),'no Premium unlock');
    window.act2Screenshot=testGame.canvas.toDataURL('image/png');
    const C=load('src/interface/mubarak').MubarakSettings;C.testSpawn.enabled=false;s.restart();
    s.alienManager.aliens.clear(true,true);s.state='waveTransition';s.nextWaveReadyAt=0;s._startNextWave();check(s.wave===2&&s.state==='playing','disable switch');C.testSpawn.enabled=true;
    for(const phase of ['entrance','cruise','final1','final2','final3','final4','final5','act2'])for(const reason of ['restart','gameOver']){
     s.restart();s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();const p=s.mubarak,root=p.sprite;
     if(phase!=='entrance')p.update(C.entranceMs);
     if(phase.indexOf('final')===0||phase==='act2'){
      for(let h=0;h<4;h++){p.hit();if(h<3)p.update(800);}
      p.update(0);p.update({final1:0,final2:67.5,final3:135,final4:266.25,final5:397.5,act2:528.75}[phase]);
     }
     const overlay=p.explosion;
     if(reason==='restart')s.restart();else s._gameOver();
     check(!p.explosion&&(!overlay||!overlay.active),'overlay cleanup '+reason);
     check(!root.active&&!p.sprite&&p.phase==='removed'&&!p.update(100000),'cleanup '+phase+'/'+reason);
     if(reason==='restart')check(!s.completedMubarak&&s.wave===1,'restart gate');
    }
    for(const wave of [10,30]){
     s.restart();s.wave=wave;s.alienManager.aliens.clear(true,true);s.state='waveTransition';s.nextWaveReadyAt=0;s._startNextWave();check(s.state==='bossEncounter'&&s.wojak.sprite&&!s.mubarak.sprite,'normal milestone');
    }
    s.restart();s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();s.mubarak.update(C.entranceMs);s.mubarak.hit();
    const owner=s.mubarak,sprite=owner.sprite;testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();check(!sprite.active&&!owner.sprite&&!owner.update(100000),'shutdown');
   });
   const persistentImage=await page.evaluate(()=>window.act2Screenshot);
   fs.writeFileSync(path.join(output,label+'-act2-persistent.png'),Buffer.from(persistentImage.split(',')[1],'base64'));
   reports.push({renderer,...report});
   await page.goto('http://mubarak.test/?'+renderer+'&development');
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0]&&testGame.scene.scenes[0].alienManager);
   await page.evaluate(()=>{testGame.loop.stop();});
   await page.keyboard.press('F6');
   await page.evaluate(()=>{
    const s=testGame.scene.scenes[0];
    s.mubarak.update(0);if(!s.mubarak||s.mubarak.phase!=='final'||!s.mubarak.explosion)throw Error('real F6 keyboard preview');
    s.restart();
   });
   await page.evaluate(()=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],check=(v,l)=>{if(!v)throw Error(l)};
    check(s.input.keyboard.listenerCount('keydown-F6')===1,'development F6 registered once');
    s.input.keyboard.emit('keydown-F6',{repeat:true});check(!s.mubarak||s.mubarak.phase==='removed','ignore repeated keydown');
    s.input.keyboard.emit('keydown-F6',{repeat:false});s.mubarak.update(0);const p=s.mubarak,root=p.sprite,overlay=p.explosion;
    check(p.phase==='final'&&p.hits===4&&p.frame===6&&p.finalElapsed===0,'F6 uses real final-hit path');
    check(root.x===400&&root.y===190,'centered preview');
    s.input.keyboard.emit('keydown-F6',{repeat:false});s.mubarak.update(0);check(!root.active&&!overlay.active&&s.mubarak.finalElapsed===0,'F6 resets old preview safely');
    const active=s.mubarak.explosion,angrySprite=s.mubarak.sprite;s.update(undefined,528.75);
    check(s.mubarak.phase==='act2'&&!s.completedMubarak&&!active.active&&angrySprite.active&&s.mubarak.act2Visible,'exact cinematic duration starts Act II directly');
    s.update(undefined,0);check(s.wave===1&&s.state==='mubarakEncounter'&&angrySprite.texture.key.indexOf('mubarak-act2-1-')===0,'preview retains angry Act II combat pose');
    s.input.keyboard.emit('keydown-F6',{repeat:false});s.mubarak.update(0);s.mubarak.update(397.5);const finalSprite=s.mubarak.sprite,finalOverlay=s.mubarak.explosion;
    testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();
    check(!finalSprite.active&&!finalOverlay.active&&s.input.keyboard.listenerCount('keydown-F6')===0,'final-stage shutdown clears overlay and shortcut');
   });
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL both seeded diagonal entrances, continuous join velocity, fourteen dedicated registered poses, actual-travel facing and mirrored diamond, four damaging hits, normal-hit four flashes/800ms immunity; Frame 6 to Act II at 135ms; five 67.5/67.5/131.25/131.25/131.25ms overlays; Act II combat starts after 528.75ms; dev-only F6, normal bosses and lifecycle.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
