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
    // Start with production defaults, then explicitly enable debug combat fixtures.
    'load("src/interface/mubarak").MubarakSettings.testSpawn.enabled=false;load("src/game");</script>';
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
    testGame.loop.stop();installActiveWaveFixture(testGame.scene.scenes[0]);const s=testGame.scene.scenes[0],m=s.alienManager;
    const d=load('src/interface/wave-director'),A=load('src/interface/assets').AssetType;
    const check=(ok,label)=>{if(!ok)throw Error(label);},near=(a,b,label)=>check(Math.abs(a-b)<1e-5,label+': '+a+' != '+b);
    const owner=()=>m.aliens.getChildren().find(a=>a.premium).premium;
    const drain=()=>{const q=s.pendingCleanup;s.pendingCleanup=[];q.forEach(f=>f());};
    const shot=alien=>{const bullet=s.assetManager.bullets.get();bullet.enableBody(true,alien.body.center.x,alien.body.center.y,true,true);bullet.body.preUpdate(false,0);check(s.physics.overlap([bullet],[alien],s._bulletHitAliens,null,s),'real Arcade hit registration');return bullet;};
    const stages=[];
    check(d.WaveDirectorConfig.premiumInvaders.testMode.enabled===false,'production test mode OFF');
    for(let wave=1;wave<=10;wave++){
     m.reset(wave);check(m.aliens.getChildren().length===24&&m.premiumPlan.premiums.length===0,'locked early wave '+wave);
    }
    // Entering, losing, or reaching REKT without finishing the cinematic cannot unlock.
    for(const incomplete of ['entrance','defeatSequence']){
     s.restart();s.wave=10;s._startWojak();
     check(!s.premiumProgress.eligible('wojak',100),'boss entrance does not unlock');
     if(incomplete==='defeatSequence'){
      s.wojak.update(1500);for(let hit=0;hit<150;hit++)check(s.wojak.hit(),'full boss hit');
      check(!s.premiumProgress.eligible('wojak',100),'REKT alone does not unlock');
     }
     s._gameOver();check(!s.premiumProgress.eligible('wojak',100),'failed encounter cannot unlock');
    }
    s.restart();s.wave=10;s._startWojak();s.wojak.update(1500);
    for(let hit=0;hit<150;hit++)check(s.wojak.hit(),'full boss successful run');
    s.update(undefined,10000);
    check(s.state==='waveTransition'&&s.completedBossWave===10,'full defeat sequence completed');
    check(s.premiumProgress.eligible('wojak',14),'completed full boss unlocks wave 14');
    s._startNextWave();
    const clearWave=()=>{
     m.aliens.clear(true,true);s.assetManager.bullets.clear(true,true);
     s.state='waveTransition';s.nextWaveReadyAt=0;s._startNextWave();
    };
    for(const wave of [11,12,13]){
     check(s.wave===wave&&s.state==='playing','correct waiting-wave transition');
     check(m.premiumPlan.premiums.length===0&&m.aliens.getChildren().length===24,'waiting wave has 24 regulars');
     check(!s.premiumProgress.eligible('wojak',wave),'three complete regular waves must pass');clearWave();
    }
    check(s.wave===14&&s.state==='playing','first eligible wave is 14');
    const planner=load('src/interface/premium-spawn').planPremiumFormation;
    let hitSeed,missSeed;
    for(let seed=0;seed<100&&(hitSeed===undefined||missSeed===undefined);seed++){
     const spawned=planner(d.getWavePlan(14,seed),s.premiumProgress).premiums.length;
     if(spawned)hitSeed=seed;else missSeed=seed;
    }
    check(hitSeed!==undefined&&missSeed!==undefined,'both normal roll outcomes exist');
    m.seed=hitSeed;m.reset(14);check(m.aliens.getChildren().length===21&&m.premiumPlan.regulars.length===20,'normal successful roll spawns 20 plus one');
    const footprint=JSON.stringify(m.premiumPlan);m.reset(14);check(JSON.stringify(m.premiumPlan)===footprint,'normal seeded position reproducible');
    m.seed=missSeed;m.reset(14);check(m.aliens.getChildren().length===24&&m.premiumPlan.premiums.length===0,'normal failed roll preserves 24 regulars');
    m.reset(19);check(s.premiumProgress.eligible('wojak',14),'unlock survives later regular waves');
    s.wave=20;s._startWojak();check(s.premiumProgress.eligible('wojak',14),'unlock survives later boss entrance');
    s.wojak.update(1500);for(let hit=0;hit<150;hit++)s.wojak.hit();s.update(undefined,10000);
    check(s.premiumProgress.eligible('wojak',14),'later win does not restart first-defeat wait');
    s.restart();check(!s.premiumProgress.eligible('wojak',100)&&m.aliens.getChildren().length===24,'new run resets unlock');
    m.seed=12345;
    d.WaveDirectorConfig.premiumInvaders.testMode.enabled=true;
    const footprintCoverage=[];
    for(const formation of ['grid','diamond']){
     const seen=new Set(),target=(formation==='diamond'?4:15)*2;
     for(let seed=0;seed<10000&&seen.size<target;seed++){
      const base=d.getWavePlan(14,seed);if(base.formation!==formation)continue;
      const footprint=planner(base,s.premiumProgress).premiums[0],key=footprint.row+':'+footprint.column+':'+base.initialDirection;
      if(seen.has(key))continue;seen.add(key);m.seed=seed;m.reset(14);
      const roots=m.aliens.getChildren(),p=owner(),direction=base.initialDirection;
      const noOverlap=()=>roots.forEach((a,i)=>{const b=a.getBounds();roots.slice(i+1).forEach(other=>{const o=other.getBounds();check(b.right<=o.left+1e-5||b.left>=o.right-1e-5||b.bottom<=o.top+1e-5||b.top>=o.bottom-1e-5,'Premium cannot overlap regulars in '+formation);});});
      noOverlap();check(roots.length===21&&m.premiumPlan.regulars.length===20,'24 logical cells / 21 entities');
      near(p.sprite.displayWidth,175.36,'unchanged Premium size');near(p.sprite.displayHeight,175.36*1024/1536,'unchanged Premium aspect');
      const positions=roots.map(a=>({x:a.x,y:a.y}));
      const left=Math.min(...roots.map(a=>a.getBounds().left)),right=Math.max(...roots.map(a=>a.getBounds().right));
      const distance=direction>0?800-right:left;
      m.update(distance/base.movementSpeed*1000+1e-7,10000);
      check(m.direction===-direction&&m.descentCount===1,'actual occupied Premium formation edge bounces once');
      roots.forEach((a,i)=>{near(a.x-positions[i].x,direction*distance,'all entities move together');near(a.y-positions[i].y,25,'all entities descend together');check(a.getBounds().left>=-1e-5&&a.getBounds().right<=800+1e-5,'actual frame remains inside bounds');});
      check(roots.every(a=>(a.premium||a).direction===-direction),'all entities face bounce direction');noOverlap();
     }
     check(seen.size===target,'all valid '+formation+' footprints in both directions');
     footprintCoverage.push({formation,positions:seen.size/2,directions:2});
    }
    for(const formation of ['grid','diamond']){
     let seed=0;while(d.getWavePlan(1,seed).formation!==formation)seed++;
     m.seed=seed;s.restart();m.stopMovement();const p=owner(),score=s.scoreManager.score;
     m.aliens.getChildren().filter(a=>!a.premium).slice().forEach(a=>{shot(a);drain();});
     check(m.hasAliveAliens&&s.state==='playing'&&m.aliens.countActive(true)===1,'last Premium blocks '+formation+' wave completion');
     for(let hit=0;hit<5;hit++){shot(p.sprite);drain();if(hit<4)p.update(800);}
     near(s.scoreManager.score-score,1210,'unchanged regular/Premium rewards and wave bonus');
     check(s.invadersKilled===21&&s.state==='waveTransition'&&!m.hasAliveAliens,'Premium final kill completes '+formation+' wave');
     check(!s.premiumProgress.eligible('wojak',100),'Premium kill never unlocks full boss');
    }
    m.seed=12345;
    // The established shared-direction combat fixtures exercise Classic/Diamond.
    // Actual Twin combat, group ownership and progression are in twin-squads-browser.cjs.
    d.WaveDirectorConfig.formation.choices=['grid','diamond'];
    s.restart();
    for(const wave of [1,2,3,6,7,10,11,14,20,100]){
     s.restart();m.reset(wave);const roots=m.aliens.getChildren(),p=owner(),f=m.premiumPlan.premiums[0];
     check(roots.length===21&&m.premiumPlan.regulars.length===20,'21 entities / 24 occupied slots');
     check(m.configuration.movementSpeed===d.getWavePlan(wave,12345).movementSpeed,'unchanged starting speed');
     near(p.sprite.x,f.x,'premium footprint center x');near(p.sprite.y,f.y,'premium footprint center y');
     check(p.sprite.displayWidth<=f.width+1e-5&&p.sprite.displayHeight<=f.height+1e-5,'fits reserved area');
     roots.forEach((a,i)=>{const b=a.getBounds();roots.slice(i+1).forEach(other=>{const o=other.getBounds();check(b.right<=o.left+1e-5||b.left>=o.right-1e-5||b.bottom<=o.top+1e-5||b.top>=o.bottom-1e-5,'no artwork overlap');});});
     check(roots.every(a=>(a.premium||a).direction===m.configuration.initialDirection),'regular and Premium roots share initial direction');
     const start=p.sprite.x;m.update(100,10000);near(p.sprite.x-start,m.configuration.initialDirection*m.configuration.movementSpeed*.1,'survivor starts 1x');
     near(p.foreground.x,p.sprite.x,'layers follow movement');
     for(let i=0;i<40;i++)m.update(100,10000);
     roots.forEach(a=>check(a.getBounds().left>=-1e-5&&a.getBounds().right<=800+1e-5,'edge reversal respects bounds'));
     for(let i=0;i<100;i++)check(!m.getRandomAliveEnemy().premium,'premium excluded from regular selection');
     roots.filter(a=>!a.premium).forEach(a=>a.disableBody(true,true));
     p.sprite.setPosition(400,120);p.syncBody();const x=p.sprite.x;m.direction=1;m.update(100,10000);
     near(p.sprite.x-x,m.configuration.movementSpeed*.15,'final survivor 1.5x');
     check(m.hasAliveAliens,'premium keeps wave alive');check(m.getRandomAliveEnemy()===undefined,'no regular emitter left');
    }
    s.restart();m.stopMovement();s.firingTimer=Infinity;
    let p=owner();check(p.portfolio===50&&p.percentage.text==='+50%','spawn stage');
    const expected=[25,0,-30,-70],poses=[A.WojakCharacter25Right,A.WojakCharacter0Right,A.WojakCharacterMinus30Right,A.WojakCharacterMinus70Right];
    for(let i=0;i<4;i++){
     const root=p.sprite,bullet=shot(root);check(!bullet.active,'accepted projectile consumed');
     s._bulletHitAliens(bullet,root);check(p.stage===i+1,'same projectile cannot hit twice');
     check(p.portfolio===expected[i],'one exact stage per hit');check(p.character.texture.key===poses[i],'art matches stage');
     check(p.percentage.text===(expected[i]>0?'+25%':expected[i]===0?'0%':'−'+Math.abs(expected[i])+'%'),'percentage matches stage');
     check(p.charts.history.shown===p.charts.history.candles.length&&p.charts.history.formation===1,'charts immediately reflect current stage');
     check(p.lighting.texture.key===(expected[i]>0?A.WojakLightsGreenRight:A.WojakLightsRedRight),'lights match stage');
     const colors=[];
     for(let tick=0;tick<8;tick++){
      colors.push(root.tintTopLeft);const blocked=shot(root);check(!blocked.active&&p.stage===i+1,'immune projectile consumed without damage');
      check(p.pendingFlashes===0,'no queued flashes');p.update(tick===7?99:100);
     }
     check(colors.filter(color=>color!==0xffffff).length===4,'exactly four red pulses: '+JSON.stringify(colors));
     check(p.invulnerable&&!p.hit(),'still protected at 799ms');p.update(1);check(!p.invulnerable,'vulnerable at 800ms');
     stages.push({stage:p.stage,portfolio:p.portfolio,display:p.percentage.text});drain();
    }
    p.setFormationDirection(-1);check(p.character.texture.key===A.WojakCharacterMinus70Left,'left-facing art');
    const geometry=p.weaponGeometry();check(geometry.candles.left>=p.sprite.getBounds().left&&geometry.candles.right<=p.sprite.getBounds().right,'scaled candle emitter');
    p.setFormationDirection(1);
    // Autonomous clocks run with normal scheduler disabled and all 15 normal threats occupied.
    const normal=s.assetManager.enemyBullets;for(let i=0;i<15;i++)normal.get().setPosition(30,30);
    p.sprite.setPosition(400,120);p.syncBody();p.candles.random=()=>0;
    const deadline=s.firingTimer;
    for(let i=0;i<10;i++)m.updatePremiums(250,s.player,()=>{throw Error('unexpected player hit');});
    check(p.candles.flights.length>0,'autonomous candles while cap full');check(p.tears.flights.length===6,'autonomous three-tear spreads');
    check(normal.countActive(true)===15&&s.firingTimer===deadline,'premium does not consume regular budget or permissions');
    normal.getChildren()[0].destroy();s._enemyFires();
    check(normal.countActive(true)===15,'premium flights do not block available regular threat slot');
    near(s.firingTimer-s.time.now,d.firingIntervalForWave(1),'regular cadence unchanged with premium active');s.firingTimer=Infinity;
    const pending=p.candles.pending,flights=p.candles.flights.map(f=>f.sprite).concat(p.tears.flights),layers=[p.character,p.foreground,p.lighting,p.percentage];
    const originalPlay=s.sound.play,sounds=[];s.sound.play=function(key,config){sounds.push(key);return originalPlay.call(this,key,config);};
    const root=p.sprite;shot(root);
    check(p.stage===5&&p.defeated&&p.percentage.text==='REKT','fifth accepted hit REKT');
    check(!root.active&&s.state==='playing','normal removal leaves regular wave running');
    const explosion=s.assetManager.explosions.getChildren().find(e=>e.active);
    check(explosion&&explosion.scaleX===2&&explosion.anims.currentAnim.key==='kaboom','enlarged regular explosion');
    check(sounds.length===1&&sounds[0]==='invaderKilled','existing regular kill audio exactly once');s.sound.play=originalPlay;
    check(!p.godCandle&&!p.pumpCharacter,'no cinematic');
    check(p.candles.flights.length===0&&p.tears.flights.length===0&&p.candles.pending.length===0,'death clears weapons');
    check(flights.every(f=>!f.active),'all projectile sprites destroyed');drain();check(layers.every(l=>!l.active),'all presentation layers destroyed');
    // Each autonomous weapon stage uses the Premium-only cadence.
    for(const fixture of [{hits:1,candle:1000},{hits:2,candle:800},{hits:3,candle:1000/1.5,tear:3500/1.5,count:1},{hits:4,candle:400,tear:1250,count:3}]){
     s.restart();m.stopMovement();p=owner();p.sprite.setPosition(400,120);p.syncBody();p.candles.random=()=>0;
     for(let hit=0;hit<fixture.hits;hit++){
      check(p.hit(),'interval fixture stage');p.update(800);
      p.updateWeapons(0,s.player,()=>{});
      check(p.candles.elapsed===0&&p.tears.elapsed===0,'stage transition resets both cooldowns');
      // Leave stale progress greater than the next stage's interval. Its next
      // update must discard it, without advancing or clearing live projectiles.
      if(hit+1<fixture.hits){p.candles.elapsed=9999;p.tears.elapsed=9999;}
     }
     const advance=ms=>{while(ms>0){const dt=Math.min(100,ms);p.updateWeapons(dt,s.player,()=>{});ms-=dt;}};
     advance(fixture.candle-.01);check(p.candles.flights.length===0,'no early candle');
     advance(.02);check(p.candles.flights.length===1,'precise Premium candle interval');
     if(fixture.tear){
      p.stopWeapons();p.updateWeapons(0,s.player,()=>{});
      advance(fixture.tear-.01);check(p.tears.flights.length===0,'no early tear');
      advance(.02);check(p.tears.flights.length===fixture.count,'precise Premium tear interval');
     }
    }
    for(const fixture of [{hits:0,ms:2500,candles:0,tears:0},{hits:1,ms:1000,candles:1,tears:0},{hits:2,ms:800,candles:1,tears:0},{hits:3,ms:3500/1.5,candles:3,tears:1},{hits:4,ms:2500,candles:6,tears:6}]){
     s.restart();m.stopMovement();s.firingTimer=Infinity;p=owner();p.sprite.setPosition(400,120);p.syncBody();p.candles.random=()=>0;
     for(let i=0;i<fixture.hits;i++){check(p.hit(),'cadence fixture hit');p.update(800);}
     for(let elapsed=0;elapsed<fixture.ms;){const dt=Math.min(50,fixture.ms-elapsed);m.updatePremiums(dt,s.player,()=>{});elapsed+=dt;}
     check(p.candles.flights.length===fixture.candles,'stage candle cadence '+fixture.hits);
     check(p.tears.flights.length===fixture.tears,'stage tear cadence '+fixture.hits);
    }
    // A hit accepted during MainScene.update receives its full protection window.
    s.restart();m.stopMovement();s.firingTimer=Infinity;p=owner();
    const contact=s.assetManager.bullets.get();contact.enableBody(true,p.sprite.body.center.x,p.sprite.body.center.y,true,true);contact.body.preUpdate(false,0);
    s.update(undefined,16);check(p.stage===1&&p.flashElapsed===0,'hit frame does not consume immunity');
    s.update(undefined,799);check(p.invulnerable&&!p.hit(),'full 799ms protected');s.update(undefined,1);check(!p.invulnerable,'MainScene 800ms expiry');
    // Premium last: five hits complete the wave normally, including scheduled boss milestone.
    for(const wave of [1,10]){
     s.restart();s.wave=wave;m.reset(wave);m.stopMovement();p=owner();
     m.aliens.getChildren().filter(a=>!a.premium).forEach(a=>a.destroy());
     for(let hit=0;hit<5;hit++){shot(p.sprite);if(hit<4){check(s.state==='playing','wait for surviving premium');p.update(800);}drain();}
     check(s.state==='waveTransition','premium-last wave completion');s.time.now=s.nextWaveReadyAt+1;s.assetManager.bullets.clear(true,true);s._startNextWave();
     check(s.state===(wave===10?'bossEncounter':'playing'),'unchanged next wave / scheduled boss');
     if(wave===10){s.wojak.update(1500);for(let hit=0;hit<150;hit++)check(s.wojak.hit(),'original boss 150 accepted hits');s.update(undefined,10000);check(s.premiumProgress.eligible('wojak',14),'real boss completion unlocks premium');}
    }
    // Owner projectiles cannot survive game-over, restart, or a new formation.
    for(const reason of ['gameOver','restart','wave']){
     s.restart();m.stopMovement();p=owner();p.hit();p.update(800);p.candles.random=()=>0;
     for(let i=0;i<6;i++)m.updatePremiums(250,s.player,()=>{});
     check(p.candles.flights.length>0,'cleanup fixture has live weapons');
     const shots=p.candles.flights.map(f=>f.sprite);
     if(reason==='gameOver')s._gameOver();else if(reason==='restart')s.restart();else m.reset(2);
     check(shots.every(f=>!f.active)&&p.candles.flights.length===0&&p.candles.pending.length===0,'cleanup '+reason);
    }
    s.restart();m.stopMovement();s.firingTimer=Infinity;
    testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
    return {renderer:testGame.renderer.type,stages,footprintCoverage,regularThreatCap:15,actualEntities:21,logicalSlots:24};
   });
   await page.screenshot({path:path.join(output,renderer+'-premium-wave-1.png')});reports.push(report);
   await page.evaluate(()=>{
    const s=testGame.scene.scenes[0],p=s.alienManager.aliens.getChildren().find(a=>a.premium).premium;
    for(let i=0;i<4;i++){p.hit();p.update(800);}p.setFormationDirection(-1);
    testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
   });
   await page.screenshot({path:path.join(output,renderer+'-premium-minus70-left.png')});
   await page.evaluate(()=>{
    const s=testGame.scene.scenes[0],p=s.alienManager.aliens.getChildren().find(a=>a.premium).premium;
    for(let i=0;i<10;i++)s.alienManager.updatePremiums(250,s.player,()=>{});
    const flights=p.candles.flights.map(f=>f.sprite).concat(p.tears.flights),layers=[p.sprite,p.character,p.foreground,p.percentage,p.lighting];
    if(!flights.length)throw Error('shutdown fixture has projectiles');
    testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();
    if(flights.concat(layers).some(f=>f.active))throw Error('shutdown leaves owner effects');
   });
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'premium-wojak-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL all 15 classic / 4 upper-diamond Premium positions in both directions, no overlaps/bounds escape; final-Premium scoring/completion, normal progression and original combat/cleanup/boss regressions.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

