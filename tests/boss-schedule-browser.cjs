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
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('http://mubarak.test/**',serve);
  for(const renderer of ['canvas','webgl']){
   await page.goto('http://mubarak.test/?'+renderer);
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0]&&testGame.scene.scenes[0].alienManager);
   await page.evaluate(() => {
    window.movementEvents = [];
    window.addEventListener('keydown', event => movementEvents.push([event.code, event.defaultPrevented]));
   });
   for (const [keys, x, y] of [
    [['w'], 0, -200], [['a'], -200, 0], [['s'], 0, 200], [['d'], 200, 0],
    [['ArrowUp'], 0, -200], [['ArrowLeft'], -200, 0],
    [['ArrowDown'], 0, 200], [['ArrowRight'], 200, 0],
    [['w', 'ArrowUp', 'd', 'ArrowRight'], 200 * Math.SQRT1_2, -200 * Math.SQRT1_2],
    [['a', 'ArrowRight', 'w'], 0, -200],
    [['w', 'ArrowDown', 'd'], 200, 0],
    [['a', 'd', 'ArrowLeft', 'ArrowRight', 'w', 's'], 0, 0]
   ]) {
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForFunction(([x, y]) => {
     const scene = testGame.scene.scenes[0];
     const velocity = scene.player.body.velocity;
     return Math.abs(velocity.x - x) < .01 && Math.abs(velocity.y - y) < .01;
    }, [x, y]);
    for (const key of keys) await page.keyboard.up(key);
   }
   const movementEvents = await page.evaluate(() => window.movementEvents);
   assert(movementEvents.length > 0 && movementEvents.every(([, captured]) => captured),
    'Phaser prevents browser defaults for movement keys');
   await page.evaluate(() => testGame.scene.scenes[0].restart());
   await page.evaluate(() => {
    const s = testGame.scene.scenes[0];
    s.firingTimer = s.time.now + 4000;
    s.rapidFire.activate();
    const bullet = s.assetManager.enemyBullets.get();
    bullet.enableBody(true, 40, 300, true, true);
    bullet.setVelocityY(30);
    window.pauseSnapshot = () => ({
     time: s.time.now, wave: s.wave, state: s.state, firingDeadline: s.firingTimer,
     shotDeadline: s.bulletTime, buffElapsed: s.rapidFire.timer.getElapsed(),
     starfieldY: s.starfield.tilePositionY, player: [s.player.x, s.player.y, s.player.texture.key],
     enemyShotY: bullet.y, playerShots: s.assetManager.bullets.getChildren()
      .filter(b => b.active).map(b => [b.y, b.frame.name]),
     invaderY: s.alienManager.aliens.getChildren()[0].y
    });
   });
   await page.keyboard.down('a');
   await page.keyboard.down('Space');
   await page.waitForFunction(() => testGame.scene.scenes[0].assetManager.bullets.countActive(true) > 0);
   await page.keyboard.down('Enter');
   const paused = await page.evaluate(() => {
    const s = testGame.scene.scenes[0];
    if (!s.sys.isPaused() || !s.pauseMessage.visible || s.pauseMessage.x !== 400 || s.pauseMessage.y !== 300 ||
        s.pauseMessage.texture.key !== 'nfd-pause-instruction') throw Error('centered NFD pause message');
    return pauseSnapshot();
   });
   await page.keyboard.up('a');
   await page.keyboard.press('ArrowRight');
   await page.keyboard.up('Space');
   await page.keyboard.down('Enter'); // A held Enter generates a repeat keydown.
   await page.waitForTimeout(650);
   assert.deepEqual(await page.evaluate(() => pauseSnapshot()), paused);
   await page.keyboard.up('Enter');
   await page.keyboard.press('Enter');
   await page.waitForFunction(y => pauseSnapshot().enemyShotY > y, paused.enemyShotY);
   const resumed = await page.evaluate(() => {
    const s = testGame.scene.scenes[0];
    if (s.sys.isPaused() || s.pauseMessage.visible || s.wasd.left.isDown || s.cursors.right.isDown || s.fireKey.isDown) {
     throw Error('resume clears the overlay and honors key releases during pause');
    }
    return pauseSnapshot();
   });
   assert(resumed.time - paused.time < 500, 'pause duration must not advance absolute gameplay timers');
   assert.equal(resumed.firingDeadline, paused.firingDeadline, 'regular firing deadline survives pause');
   assert(resumed.buffElapsed > paused.buffElapsed && resumed.buffElapsed - paused.buffElapsed < 500,
    'Phaser timer resumes without catching up');
   await page.evaluate(() => testGame.scene.scenes[0].restart());
   const startY = await page.evaluate(() => testGame.scene.scenes[0].player.y);
   await page.keyboard.down('w');
   await page.keyboard.down('Space');
   await page.waitForFunction(y => {
    const scene = testGame.scene.scenes[0];
    return scene.player.y < y - 10 && scene.assetManager.bullets.countActive(true) > 0;
   }, startY);
   await page.keyboard.up('Space');
   await page.keyboard.up('w');
   await page.keyboard.down('ArrowDown');
   await page.waitForFunction(y => Math.abs(testGame.scene.scenes[0].player.y - y) < 1, startY);
   await page.keyboard.up('ArrowDown');
   // Isolate the upper bound so the invasion check cannot end this movement trial.
   await page.evaluate(() => testGame.scene.scenes[0].alienManager.stopMovement());
   await page.keyboard.down('ArrowUp');
   await page.waitForFunction(() => Math.abs(testGame.scene.scenes[0].player.getBounds().top - 94) < .01);
   await page.keyboard.up('ArrowUp');
   await page.evaluate(() => {
    const s = testGame.scene.scenes[0];
    const livesBottom = Math.max(...s.scoreManager.lives.getChildren().map(life => life.getBounds().bottom));
    if (s.player.getBounds().top <= livesBottom) throw Error('player overlaps HUD');
    s.assetManager.bullets.clear(true, true);
   });
   await page.keyboard.down('Space');
   await page.waitForFunction(() => testGame.scene.scenes[0].assetManager.bullets.countActive(true) > 0);
   await page.keyboard.up('Space');
   await page.evaluate(() => testGame.scene.scenes[0].restart());
   await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'helpers/active-wave-fixture.js'),'utf8')});
   reports.push(await page.evaluate(renderer=>{
    testGame.loop.stop();installActiveWaveFixture(testGame.scene.scenes[0]);const s=testGame.scene.scenes[0],D=load('src/interface/wave-director'),M=load('src/interface/mubarak'),W=load('src/interface/wojak-boss'),A=load('src/interface/assets').AssetType;
    const check=(v,l)=>{if(!v)throw Error(l);};
    check(!M.MubarakSettings.testSpawn.enabled,'early Mubarak override disabled by default');
    check(s.wave===1&&s.state==='playing'&&!s.mubarak,'Wave 1 starts normally');
    for(let wave=1;wave<=10000;wave++)check(D.bossForWave(wave)===(wave%10?undefined:wave%20?'wojak':'mubarak'),'unbounded parity schedule '+wave);
    check(D.bossForWave(0)===undefined,'no wave0 boss');
    const checkpoint=wave=>{s.wave=wave;s.alienManager.aliens.clear(true,true);s.assetManager.bullets.clear(true,true);s.state='waveTransition';s.nextWaveReadyAt=s.time.now;s._startNextWave();};
    const shoot=(x,y)=>{const b=s.assetManager.bullets.get();b.enableBody(true,x,y,true,true);b.shoot(x,y);b.body.preUpdate(false,0);s.update(undefined,0);return b;};
    const enter = (repeat = false) => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat }));
    for (const name of D.WaveDirectorConfig.formation.choices) {
     s.restart();
     let seed = 0;
     while(D.formationFromRoll(D.randomForWave(seed ^ 0x464f524d, 1)()) !== name) seed++;
     s.alienManager.reset(1, seed);
     const alien = s.alienManager.aliens.getChildren()[0];
     const body = s.player.body;
     body.reset(400, 160);
     body.preUpdate(false, 0);
     const invaderBody = alien.body;
     invaderBody.reset(alien.x, body.top - (invaderBody.bottom - alien.y) + .001);
     invaderBody.preUpdate(false, 0);
     s.update(undefined, 0);
     check(s.state === 'gameOver' && s.scoreManager.lives.countActive(true) === 3,
      'instant invasion loss at the raised player line for ' + name);
     s.cursors.right.isDown = s.wasd.up.isDown = true;
     s.update(undefined, 16);
     check(body.velocity.x === 0 && body.velocity.y === 0, 'movement input is ignored at Game Over');
     s.cursors.right.isDown = s.wasd.up.isDown = false;
     enter();
     check(!s.sys.isPaused() && !s.pauseMessage.visible, 'pause does not intercept Game Over');
    }
    for(const wave of [1,2,9,11,19,21,29,31,39,41,49,51,59,61]){
     s.restart();checkpoint(wave);check(s.state==='playing'&&s.wave===wave+1&&(!s.wojak||!s.wojak.sprite)&&(!s.mubarak||!s.mubarak.sprite),'ordinary wave no boss '+wave);
    }
    s.restart();s.wave=10;s.alienManager.reset(10);
    const drain=()=>{const q=s.pendingCleanup;s.pendingCleanup=[];q.forEach(f=>f());};
    for(const alien of s.alienManager.aliens.getChildren().slice()){
     const b=s.assetManager.bullets.get();b.enableBody(true,alien.x,alien.y,true,true);s._bulletHitAliens(b,alien);drain();
    }
    check(s.state==='waveTransition'&&s.scoreManager.score===1240&&s.invadersKilled===24,'normal wave10 scoring/clear path preserved');
    s._startNextWave();check(s.state==='waveTransition'&&!s.wojak,'1500ms delay retained');
    s.nextWaveReadyAt=s.time.now;const trailing=s.assetManager.bullets.get();trailing.enableBody(true,20,400,true,true);s._startNextWave();check(s.state==='waveTransition','trailing player bullet gate retained');trailing.destroy();
    const sequence=[];
    for(const wave of [10,20,30,40,50,60]){
     if(wave===20){
      s.wave=20;s.alienManager.reset(20);
      for(const alien of s.alienManager.aliens.getChildren().slice()){
       const b=s.assetManager.bullets.get();b.enableBody(true,alien.x,alien.y,true,true);s._bulletHitAliens(b,alien);drain();
      }
      check(s.state==='waveTransition'&&s.wave===20,'real Wave 20 completion');
      enter();testGame.scene.update(performance.now(), 5000);
      check(s.sys.isPaused() && s.state==='waveTransition' && s.wave===20,'pause freezes pending transition');
      enter();
      s._startNextWave();check(s.state==='waveTransition'&&(!s.mubarak||!s.mubarak.sprite),'Wave 20 retains transition delay');
      s.nextWaveReadyAt=s.time.now;s.assetManager.bullets.clear(true,true);s._startNextWave();
     }else checkpoint(wave);
     const kind=D.bossForWave(wave),expected=kind==='wojak'?'bossEncounter':'mubarakEncounter';
     check(s.state===expected&&s.wave===wave,'correct encounter '+wave);
     const boss=kind==='wojak'?s.wojak:s.mubarak,root=boss.sprite;
     s._startNextWave();if(kind==='wojak')s._startWojak();else s._startMubarak();
     check(boss.sprite===root,'no duplicate start '+wave);
     const score=s.scoreManager.score,kills=s.invadersKilled;
     s.scoreManager.lives.getLast(true).setActive(false).setVisible(false);check(s.scoreManager.lives.countActive(true)===2,'two lives before victory');
     if(kind==='wojak'){
      check([A.WojakShipLeft,A.WojakShipRight].includes(root.texture.key),'real Wojak ship art');
      boss.update(W.WojakSettings.entranceDuration);check(boss.shootingEnabled&&boss.portfolio===50,'original Wojak patrol');
      for(let i=0;i<150;i++)check(boss.hit(),'original Wojak damage '+i);
      check(boss.portfolio===W.WojakSettings.prototypeEndPortfolio&&!boss.shootingEnabled,'original REKT completion condition');
      s.update(undefined,7299);check(s.state===expected,'full Wojak cinematic remains pending');s.update(undefined,1);
     }else{
      check(root.texture.key.indexOf('mubarak-act1-1-')===0,'real Mubarak entrance art');
      if (wave===20) {
       const initial = [root.x, root.y, boss.entranceElapsed, s.time.now];
       enter();testGame.scene.update(performance.now(), 1000);enter(true);
       check(s.sys.isPaused() && s.pauseMessage.visible &&
        JSON.stringify(initial)===JSON.stringify([root.x, root.y, boss.entranceElapsed, s.time.now]),
        'Mubarak and clock freeze, and the Enter repeat is ignored');
       enter();
       s.update(undefined, 10);
       check(!s.sys.isPaused() && !s.pauseMessage.visible && boss.entranceElapsed === 10,
        'Mubarak resumes at the same point in the entrance');
      }
      boss.update(M.MubarakSettings.entranceMs);
      for(let i=0;i<4;i++){check(boss.hit(),'original diamond damage');if(i<3)boss.update(800);}
      check(boss.phase==='clearing'&&boss.frame===5&&!s.playerShootingEnabled,'V1 freeze preserved');boss.update(0);boss.update(135);
      check(boss.explosion.texture.key==='mubarak-act1-explosion-3'&&root.texture.key.indexOf('mubarak-act2-1-')===0,'V1 climax and angry art');
      boss.update(M.mubarakFinalDuration()-135);check(boss.phase==='act2'&&boss.shrapnel.emitted===100&&s.playerShootingEnabled,'V1 Act II and100-diamond event preserved');
      boss.shrapnel.clear(); // Simulate cleared diamonds; the existing position gate unlocks normally.
      const health=boss.act2Health;check(health===3,'Act II starts with three health');shoot(root.x,root.y);check(boss.act2Health===health,'V1 direct laser immunity');
      const random=boss.barrels.random;boss.barrels.random=()=>.05;
      for(let i=0;i<3;i++){
       boss.barrels.spawn();const f=boss.barrels.flights[boss.barrels.flights.length-1];check(f.shootable&&f.sprite.texture.key==='mubarak-barel-yellow'&&!f.sprite.isTinted,'original-color yellow explosive branch');f.sprite.setPosition(root.x,root.y+50);
       const r=boss.barrels.bounds(f.sprite);check(!shoot(r.x+r.width/2,r.y+r.height/2).active&&boss.act2Health===2-i,'existing yellow-barrel indirect damage');
       check(boss.phase===(i<2?'act2':'act3Entry'),'exactly three accepted hits trigger Act III');
       if(i<2)s.update(undefined,800);
      }
      check(boss.phase==='act3Entry'&&boss.barrels.flights.length===0,'three-hit Act II completion');boss.barrels.random=random;
      s.update(undefined,799);check(s.state===expected,'full800ms V1 defeat flash');s.update(undefined,1);
      check(boss.phase==='act3'&&boss.cz&&s.state===expected&&s.completedBossWave!==wave,'CZ encounter precedes victory');
      boss.sprite.x=204;boss.cz.x=600;
      for(let i=0;i<2;i++){boss.sprite.x=204;boss.cz.x=600;const r=boss.czBounds();shoot(r.x+r.width/2,r.y+r.height/2);if(!i)boss.update(M.MubarakAct3Settings.czInvulnerabilityMs);}
      check(boss.phase==='escape'&&boss.czHits===2,'two exposed CZ hits');
      for(let i=0;i<500&&s.state===expected;i++)s.update(undefined,10);
     }
     check(s.state==='waveTransition'&&s.completedBossWave===wave&&!root.active,'checkpoint victory recorded once '+wave);
     check(s.scoreManager.score===score&&s.invadersKilled===kills&&s.scoreManager.lives.countActive(true)===2,'boss adds no invented score/life reward');
     check(!s._bossPending()&&!s._mubarakPending(),'completed checkpoint cannot retrigger');
     s._startNextWave();s._startNextWave();check(s.state==='playing'&&s.wave===wave+1&&s.alienManager.hasAliveAliens&&s.playerShootingEnabled,'next regular wave once '+wave);
     check(s.scoreManager.lives.countActive(true)===3,'existing capped next-wave life recovery');sequence.push([wave,kind,s.wave]);
    }
    check(s.premiumProgress.eligible('wojak',14)&&!s.premiumProgress.eligible('wojak',13),'first Wojak victory unlock timing unchanged by later wins');
    check(!s.premiumProgress.eligible('mubarak',1000),'no invented Mubarak Premium unlock');
    for(const wave of [10,20,30,40]){
     s.restart();checkpoint(wave);const boss=wave%20?s.wojak:s.mubarak,root=boss.sprite;
     if(wave%20===0)boss.update(M.MubarakSettings.entranceMs);
     for(let i=0;i<3;i++)s._damagePlayer();
     check(s.state==='gameOver'&&!s.player.active&&!boss.sprite&&!root.active&&s.completedBossWave===0,'normal boss game over cleanup '+wave);
     s._startNextWave();check(s.wave===wave&&s.state==='gameOver','no next wave after loss');
     s.restart();check(s.wave===1&&s.completedBossWave===0&&!s.completedMubarak,'restart resets checkpoint bookkeeping');checkpoint(wave);check((wave%20?s.wojak:s.mubarak).sprite.active,'boss playable after restart');
    }
    s.restart();testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue();
    return {renderer,sequence};
   },renderer));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'boss-schedule-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL WASD, arrows, mixed diagonals, opposite-key cancellation and scroll capture; normal wave, transition and Mubarak pause/resume; HUD boundary and shooting; all four formation invasion losses; Wave20->Mubarak->21.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
