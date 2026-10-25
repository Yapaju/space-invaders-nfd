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
   reports.push(await page.evaluate(({seed,renderer})=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0];
    const M=load('src/interface/mubarak'),B=load('src/interface/mubarak-barrels'),A=load('src/interface/banana-bomb');
    const check=(v,l)=>{if(!v)throw Error(l);},near=(a,b,l)=>check(Math.abs(a-b)<1e-6,l+': '+a+' / '+b);
    const enter=()=>{s.restart();s.waveSeed=seed;s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();s.mubarak.update(3600);return s.mubarak;};
    const shoot=(x,y,rapid=false)=>{const b=s.assetManager.bullets.get();b.enableBody(true,x,y,true,true);b.shoot(x,y,rapid);b.body.preUpdate(false,0);s.update(undefined,0);return b;};
    const tip=p=>{const r=p.weakPointBounds();return shoot(r.x+r.width/2,r.y+r.height-1,true);};
    let p=enter();p.update(10000);check(!p.barrels,'no pre-hit barrels');
    const origin=p.sprite.x;
    for(let i=0;i<300;i++){
     const polygon=p.diamondPolygon(),x=polygon.reduce((n,q)=>n+q.x,0)/polygon.length,y=polygon.reduce((n,q)=>n+q.y,0)/polygon.length;
     const rapid=i%2===0;check(!shoot(x,y,rapid).active,'original invalid laser consumed');
     const reflected=p.ricochets[p.ricochets.length-1].sprite;
     const Assets=load('src/interface/assets').AssetType;
     check(reflected.texture.key===(rapid?Assets.RapidLaser:Assets.Bullet),'same original laser texture');
     near(reflected.scaleX,rapid?40/128:1,'same original laser scale');
     if(rapid)check(reflected.anims.currentAnim.key==='rapid-electric-laser'&&reflected.anims.isPlaying,'rapid effects preserved');
    }
    const custom=s.assetManager.bullets.get();custom.enableBody(true,p.sprite.x,p.sprite.y,true,true);custom.shoot(p.sprite.x,p.sprite.y,true);custom.setTint(0xff8844,0x55aaff,0xabcdef,0x123456).setAlpha(.7);custom.body.preUpdate(false,0);
    p.receiveLaser({x:p.sprite.x,y:p.sprite.y,width:6,height:36},custom,s.player.y);const copy=p.ricochets.pop().sprite;
    check(copy.tintTopLeft===custom.tintTopLeft&&copy.tintTopRight===custom.tintTopRight&&copy.tintBottomLeft===custom.tintBottomLeft&&copy.tintBottomRight===custom.tintBottomRight&&copy.alpha===custom.alpha,'original colors and effects copied exactly');check(copy.frame.name===custom.frame.name,'animation frame preserved');copy.destroy();custom.destroy();
    check(p.hits===0&&p.ricochets.length===300,'every invalid contact reflects without cap');
    const angles=p.ricochets.map(r=>Math.atan2(r.vx,r.vy)*180/Math.PI);
    check(p.ricochets.every(r=>r.vy>0),'all shots downward');
    p.ricochets.forEach(r=>{
     near(Math.hypot(r.vx,r.vy),400,'incoming speed preserved');
     near(Math.sin(r.sprite.rotation),Math.sin(Math.atan2(r.vy,r.vx)+Math.PI/2),'sprite follows travel');
     const x=r.sprite.x+r.vx*(s.player.y-r.sprite.y)/r.vy;check(x>0&&x<800,'live reflection crosses player line inside screen');
    });
    check(Math.max(...angles)-Math.min(...angles)>0.1,'small destination variation');
    // Shifted/non-default worlds, both edge positions, multiple laser speeds.
    for(const world of [{left:0,right:800},{left:100,right:740}])for(const center of [world.left+55,(world.left+world.right)/2,world.right-55]){
     const polygon=[{x:center-50,y:140},{x:center+50,y:140},{x:center,y:240}];
     for(const offset of [-35,0,35])for(const roll of [0,.5,.999999])for(const velocity of [{x:0,y:-400},{x:120,y:-160}]){
      const impact={x:center+offset,y:180},line=563;
      const r=M.reflectDiamondLaser(polygon,impact,velocity,line,world,()=>roll,19);
      check(r.vy>0,'downward at either edge');near(Math.hypot(r.vx,r.vy),Math.hypot(velocity.x,velocity.y),'unchanged arbitrary speed');
      const crossing=impact.x+r.vx*(line-impact.y)/r.vy;
      near(crossing,r.targetX,'exact line intersection');check(crossing>=world.left+19&&crossing<=world.right-19,'intersection inside shifted playable bounds');
      if(offset<0)check(r.vx<0&&r.targetX<=center,'left side goes down-left');
      if(offset>0)check(r.vx>0&&r.targetX>=center,'right side goes down-right');
      if(offset===0)check(Math.abs(r.vx/r.vy)<.02,'central impact nearly vertical');
     }
    }
    // Reflected ownership never re-enters the boss collision path and still hits DOGE.
    const ownedShot=p.ricochets[0],count=p.ricochets.length;p.update(0,s.player,()=>{throw Error('unexpected early player hit');});check(p.ricochets.length===count&&p.hits===0,'no diamond re-hit while overlapping');
    ownedShot.sprite.setPosition(s.player.body.center.x-ownedShot.offsetX-ownedShot.width/2,s.player.body.center.y-ownedShot.offsetY-ownedShot.height/2);
    let reflectedDamage=0;p.update(0,s.player,()=>reflectedDamage++);check(reflectedDamage===1&&!ownedShot.sprite.active,'reflected laser damages player');
    const ric=p.ricochets[0],rx=ric.sprite.x,ry=ric.sprite.y;
    const velocity={x:ric.vx,y:ric.vy};const savedX=s.player.x;s.player.x=savedX+200;
    p.update(0,s.player,()=>{throw Error('player did not dodge');});near(ric.vx,velocity.x,'no horizontal player tracking');near(ric.vy,velocity.y,'no vertical player tracking');s.player.x=savedX;
p.update(100);near(ric.sprite.x-rx,ric.vx*.1,'ricochet linear x');near(ric.sprite.y-ry,ric.vy*.1,'ricochet downward y');
    p.update(15000);check(p.ricochets.length===0,'normal offscreen cleanup');
    p=enter();
    // All four damage stages in both facings, using measured source tip positions.
    const geometry=[];
    for(let hit=0;hit<3;hit++){
     for(const direction of [-1,1]){p.direction=direction;p.syncArtwork();const r=p.weakPointBounds();geometry.push({frame:p.frame,direction,...r});near(r.width,96*360/1664,'tip width');near(r.height,64*360/1664,'tip height');}
     if(p.barrels)p.barrels.flights.slice().forEach(f=>p.barrels.removeFlight(f));p.update(0);check(!tip(p).active&&p.hits===hit+1,'tip laser damages once at stage '+hit);
     check(p.sprite.tintTopLeft!==0xffffff,'existing red hit feedback');
     const owner=p.barrels;owner.clear();owner.enabled=true;owner.spawnElapsed=0;
     const frequency=.3*(1+hit*.25);p.update(1);near(owner.spawnElapsed,frequency,'live Act I reduced frequency');owner.spawnElapsed=0;owner.step(450/frequency-.01,undefined,undefined,frequency);check(owner.flights.length===0,'fractional interval not early');
     owner.step(.01,undefined,undefined,frequency);check(owner.flights.length===1,'fractional interval exact');
     const f=owner.flights[0],x=f.sprite.x,y=f.sprite.y;const carpet=M.MubarakSettings.carpet;check(x>=p.sprite.x+(carpet.left-832)*p.sprite.scaleX&&x<=p.sprite.x+(carpet.right-832)*p.sprite.scaleX,'beneath carpet width');check(y>p.sprite.y+100,'beneath carpet y');
     owner.step(100,undefined,undefined,0);near(f.sprite.x,x,'barrel vertical');near(f.sprite.y-y,12,'constant 120px/s');
     const r=owner.bounds(f.sprite),hp=p.hits;check(!f.shootable&&!owner.tryShoot(r)&&f.sprite.active&&owner.blasts.length===0&&p.hits===hp,'Act I black barrel not shootable');
     f.sprite.setPosition(60,400);const shot=shoot(60,400);check(shot.active&&f.sprite.active&&owner.blasts.length===0,'Act I laser passes through black barrel');shot.destroy();owner.removeFlight(f);
     p.update(800);
    }
    // Uniform carpet coverage follows the boss position and stays within the world.
    p.barrels.flights.slice().forEach(f=>p.barrels.removeFlight(f));const samples=[];
    for(const bossX of [204,400,596]){
     p.sprite.x=bossX;
     for(let i=0;i<60;i++){p.barrels.spawn();const f=p.barrels.flights[0],r=f.sprite.getBounds();samples.push((f.sprite.x-bossX)/p.sprite.scaleX);check(r.left>=0&&r.right<=800,'screen bounds');p.barrels.removeFlight(f);}
    }
    check(Math.min(...samples)<-400&&Math.max(...samples)>400&&samples.some(x=>Math.abs(x)<100),'left center right carpet coverage');p.update(0);
    const owned=p.barrels;p.barrels.spawn();const barrel=p.barrels.flights[0].sprite;p.barrels.flights.forEach(f=>f.sprite.y=450);
    const poly=p.diamondPolygon();p.receiveLaser({x:poly[1].x,y:poly[1].y,width:1,height:1},undefined,s.player.y);const shots=p.ricochets.map(r=>r.sprite);
    const unrelated=s.add.image(10,10,'mubarak-act1-explosion-1'),laser=s.assetManager.bullets.get();laser.enableBody(true,20,400,true,true);
    check(!tip(p).active&&p.hits===4&&p.phase==='clearing'&&p.frame===5,'final hit freezes frame5');
    check(!s.playerShootingEnabled&&!p.explosion&&!p.barrels&&owned.flights.length===0&&!barrel.active&&shots.every(q=>!q.active)&&!p.ricochets.length,'immediate deterministic hazard cleanup before explosion');
    check(unrelated.active&&laser.active,'unrelated visual and player projectile preserved');
    const position={x:p.sprite.x,y:p.sprite.y,direction:p.direction};p.update(0);
    const durations=[67.5,67.5,131.25,131.25,131.25];
    for(let stage=1;stage<=5;stage++){
     check(p.phase==='final'&&p.explosion.texture.key==='mubarak-act1-explosion-'+stage,'ordered explosion stage '+stage);
     check(p.sprite.texture.key===M.mubarakTexture(stage<3?6:1,position.direction,stage<3?1:2),'underlying pose stage '+stage);
     near(p.sprite.x,position.x,'frozen x');near(p.sprite.y,position.y,'frozen y');check(p.direction===position.direction&&!s.playerShootingEnabled&&p.explosion.depth>p.sprite.depth,'frozen facing, shooting, layering');
     p.update(durations[stage-1]-.001);check(p.phase==='final','stage full duration');p.update(.001);
    }
    check(p.phase==='act2'&&s.playerShootingEnabled&&!p.explosion&&p.barrels&&!p.ricochets.length,'Act II starts clean');
    p.shrapnel.clear(); // Isolate barrel regression after the Big Bang is removed.
    const phase=p.act2HorizontalPhase;p.update(1000);near(p.sprite.x,400+196*Math.sin(phase+1000*Math.PI*2/14000*2),'Act II +100% movement');
    // V1.1 adjusts each color rate through the shared timer and normalized color probability.
    const rate=1000/B.MubarakBarrelSettings.spawnIntervalMs*B.MubarakBarrelSettings.act2FrequencyMultiplier,probability=B.MubarakBarrelSettings.act2ShootableProbability;
    near(rate,1.84,'Act II combined rate');near(rate*(1-probability),1.8*.9,'black spawn rate reduced10%');near(rate*probability,.2*1.1,'red spawn rate increased10%');
    const barrelOwner=p.barrels;barrelOwner.flights.slice().forEach(f=>barrelOwner.removeFlight(f));
    const rng=barrelOwner.random;
    for(const roll of [probability-.000001,probability,.9]){
     barrelOwner.random=()=>roll;barrelOwner.spawn();const f=barrelOwner.flights[0];
     check(f.shootable===(roll<probability),'V1.1 weighted probability boundary');
     check(f.sprite.texture.key===(f.shootable?B.MubarakExplosiveBarrelAsset.key:B.MubarakBarrelAsset.key),'yellow explosive vs original black artwork');
     check(!f.sprite.isTinted&&f.sprite.tintTopLeft===0xffffff,'original artwork colors without tint');
     near(f.sprite.scaleX,48/1237,'unchanged barrel scale');
     const bounds=barrelOwner.bounds(f.sprite);near(bounds.width,742*48/1237,'unchanged barrel hitbox width');near(bounds.height,48,'unchanged barrel hitbox height');
     if(!f.shootable){const before=p.act2Health,count=barrelOwner.blasts.length;f.sprite.setPosition(60,400);const r=barrelOwner.bounds(f.sprite),shot=shoot(r.x+r.width/2,r.y+r.height/2);check(shot.active&&f.sprite.active&&p.act2Health===before&&barrelOwner.blasts.length===count,'black barrel laser pass-through');shot.destroy();}
     barrelOwner.removeFlight(f);
    }
    barrelOwner.random=rng;barrelOwner.spawnElapsed=0;p.update(549);check(barrelOwner.flights.length===0,'no early Act II spawn');p.update(1);check(barrelOwner.flights.length===1,'Act II first spawn at550ms simulation tick');const falling=barrelOwner.flights[0],fy=falling.sprite.y;p.update(100);near(falling.sprite.y-fy,12,'Act II falling speed unchanged');
    let redCount=0;barrelOwner.flights.slice().forEach(f=>barrelOwner.removeFlight(f));
    for(let i=0;i<1000;i++){barrelOwner.spawn();const f=barrelOwner.flights[0];if(f.shootable)redCount++;barrelOwner.removeFlight(f);}
    check(redCount>80&&redCount<160,'random red distribution around11.96%');
    const hp=p.act2Health;check(hp===3,'Act II starts with exactly three health');check(!shoot(p.sprite.x,p.sprite.y).active&&p.act2Health===hp,'direct Act II immunity');
    const detonate=()=>{p.barrels.random=()=>0;p.barrels.spawn();p.barrels.random=rng;const f=p.barrels.flights[p.barrels.flights.length-1];check(f.shootable&&f.sprite.texture.key===B.MubarakExplosiveBarrelAsset.key&&!f.sprite.isTinted,'real untinted yellow barrel');f.sprite.setPosition(p.sprite.x,p.sprite.y);check(p.tryHitBarrel(p.barrels.bounds(f.sprite)),'shoot Act II barrel');return p.barrels.blasts[p.barrels.blasts.length-1];};
    let blast=detonate();check(blast.sprite.anims.currentAnim.key==='ponke-explosion','actual banana animation');near(blast.sprite.scaleX,A.BananaSettings.visualScale,'banana scale');near(blast.radius,81,'small matching radius');
    check(blast.hit&&p.act2Health===hp-1,'nearby barrel hurts boss');p.barrels.step(100);check(p.act2Health===hp-1,'same blast never hits twice');
    p.update(799);check(p.invulnerable,'preserved flash immunity at799');p.update(1);check(!p.invulnerable,'flash duration800');
    for(let expected=1;expected>=0;expected--){const b=detonate();check(b.hit&&p.act2Health===expected,'accepted next barrel explosion');check(p.phase===(expected>0?'act2':'act3Entry'),'Act III transition begins on exactly the third valid hit');if(expected>0)p.update(800);}
    check(p.phase==='act3Entry'&&p.barrels.flights.length===0,'lethal barrel stops attacks');p.update(799);check(p.phase==='act3Entry','full lethal flash');p.update(1);check(p.phase==='act3'&&p.sprite&&p.cz&&!p.barrels,'Act III starts with previous hazards cleared');
    // Same real BananaBombs impacts in both acts: distant landing misses, nearby lands hit.
    for(const act of [1,2]){
     p=enter();tip(p);if(act===2){for(let i=0;i<3;i++){p.update(800);p.hit();}p.update(0);p.update(528.75);}
     const owner=p.barrels,player=s.player;let damage=0;
     const land=x=>{owner.spawn();const f=owner.flights[owner.flights.length-1];f.sprite.setPosition(x,player.y-.12);owner.step(1,player,()=>damage++,0);check(!f.sprite.active,'landing removes barrel');};
     land(player.x+200);check(damage===0,'distant landing misses player');land(player.x);check(damage===1,'banana radius hits player');owner.step(1,player,()=>damage++,0);check(damage===1,'one impact hits once');
     check(owner.impacts.blasts.every(b=>b.sprite.anims.currentAnim.key==='ponke-explosion'),'yellow landing animation');
     owner.spawn();const f=owner.flights[owner.flights.length-1];f.sprite.setPosition(player.x,player.y-20);owner.step(1,player,()=>damage++,0);check(f.sprite.active&&damage===1,'no midflight direct collision');
     player.setActive(false);f.sprite.y=player.y;owner.step(0,player,()=>damage++,0);check(damage===1,'inactive-player protection');player.setActive(true);
    }
    // The scene callback also permits Act I hazards and performs normal last-life cleanup.
    p=enter();tip(p);const owner=p.barrels;for(let i=0;i<3;i++){owner.spawn();const f=owner.flights[owner.flights.length-1];f.sprite.setPosition(s.player.x,s.player.y);s.update(undefined,0);}
    check(s.state==='gameOver'&&!p.sprite&&!p.barrels,'Act I damage follows normal game over');
    for(const reason of ['restart','gameOver','shutdown']){p=enter();tip(p);p.barrels.spawn();const poly=p.diamondPolygon();p.receiveLaser({x:poly[1].x,y:poly[1].y,width:1,height:1},undefined,s.player.y);const sprites=p.barrels.flights.map(f=>f.sprite).concat(p.ricochets.map(r=>r.sprite));if(reason==='restart')s.restart();else if(reason==='gameOver')s._gameOver();else{testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();}check(!p.sprite&&!p.barrels&&p.ricochets.length===0&&sprites.every(q=>!q.active),'lifecycle '+reason);}
    return {renderer,seed,angles:[Math.min(...angles),Math.max(...angles)],geometry,redCount,rates:[300/450,375/450,450/450]};
   },{seed,renderer}));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-barrels-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL, both directions: tip damage, uncapped in-bounds player-line ricochets at original speed, precise progressive rates, vertical barrels, shared banana landings, small Act II blasts, final cleanup/frame5 then five exact overlays, Act II speed/immunity and lifecycle.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});





