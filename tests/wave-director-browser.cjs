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
    // This suite checks the normal WD1 path; Premium progression/combat has its own suite.
    'load("src/interface/wave-director").WaveDirectorConfig.premiumInvaders.testMode.enabled=false;load("src/game");</script>';
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
   const report=await page.evaluate(()=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0];
    if(!(s.firingTimer>s.time.now&&s.firingTimer-s.time.now<=1610))throw Error('initial wave waits for configured timer');
    s.restart();
    const d=load('src/interface/wave-director'),check=(ok,label)=>{if(!ok)throw Error(label);};
    const near=(a,b,label)=>check(Math.abs(a-b)<1e-6,label+': '+a+' != '+b);
    for(const wave of [2,3,4,5,6,7,8,9,10,11,15,20,50,100]){
     s.restart();s.wave=wave-1;s.completedBossWave=wave-1;
     s.state='waveTransition';s.nextWaveReadyAt=0;s._startNextWave();
     check(s.wave===wave&&s.state==='playing','regular wave timer reset');
     const deadline=s.firingTimer;
     near(deadline-s.time.now,1610*Math.pow(.98,Math.floor((wave-1)/5))*[1,.9,.75,.6,.5][(wave-1)%5],'new-wave formula');
     s._startNextWave();near(s.firingTimer,deadline,'duplicate transition cannot shorten timer');
    }
    s.restart();s.alienManager.stopMovement();
    const actualFire=s._enemyFires;let permissions=0;
    s._enemyFires=function(){permissions++;return actualFire.call(this);};
    const deadline=s.firingTimer;
    s.time.now=deadline;s.update(undefined,0);check(permissions===0,'wait for timer expiration');
    s.time.now=deadline+.01;s.update(undefined,0);check(permissions===1,'one global firing opportunity');
    near(s.firingTimer-s.time.now,1610,'successful attack re-arms shared timer');
    s.update(undefined,0);check(permissions===1,'same frame/time cannot fire twice');
    s._gameOver();check(s.firingTimer===Infinity,'game over invalidates deadline');
    s.update(undefined,0);check(permissions===1,'game over suppresses firing');
    s._enemyFires=actualFire;s.restart();near(s.firingTimer-s.time.now,1610,'restart uses first-cycle timer');
    const plans=[];
    for(const wave of [...Array.from({length:20},(_,i)=>i+1),21,30,50,100]) {
     s.alienManager.reset(wave);
     s.alienManager.reset(wave); // Repeated reset derives speed from RS, never the last speed.
     const plan=s.alienManager.configuration,aliens=s.alienManager.aliens.getChildren();
     check(plan.seed===12345,'runtime query seed');
     check(JSON.stringify(plan)===JSON.stringify(d.getWavePlan(wave,12345)),'actual spawn uses seeded plan');
     check(aliens.length===24,'standard count');
     check(plan.formation==='grid','all waves use original rectangular formation');
     near(plan.movementSpeed,100*Math.pow(1.02,Math.floor((wave-1)/5))*[1,1.1,1.25,1.4,1.5][(wave-1)%5],'specified compounded speed');
     aliens.forEach((alien,i)=>{check(alien.enemyType===plan.enemies[i],'actual enemy type');
      near(alien.x,plan.slots[i].x,'slot x');near(alien.y,plan.slots[i].y,'slot y');
      near(alien.x,180+(i%6)*88,'original column position');
      near(alien.y,100+Math.floor(i/6)*74,'original row position');
      const a=alien.getBounds();check(a.left>=0&&a.right<=800&&a.top>=0&&a.bottom<600,'formation inside playfield');
      aliens.slice(i+1).forEach(other=>{const b=other.getBounds();
       check(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom,'visible frames do not overlap');});
     });
     const frames=aliens.map(alien=>alien.getBounds());
     near(Math.max(...frames.map(b=>b.right))-Math.min(...frames.map(b=>b.left)),527.36,'original overall width');
     near(Math.max(...frames.map(b=>b.bottom))-Math.min(...frames.map(b=>b.top)),222+87.36*282/337,'original overall height');
     const x=aliens[0].x;s.alienManager.update(100,10000);near(aliens[0].x-x,plan.movementSpeed*.1,'compounded RS cycle');
     for(let frame=0;frame<120;frame++)s.alienManager.update(16,10000);
     aliens.forEach(a=>check(a.getBounds().left>=-1e-6&&a.getBounds().right<=800+1e-6,'boundary reversals'));
     plans.push({wave,formation:plan.formation,types:plan.composition,speed:plan.movementSpeed,interval:plan.firingIntervalMs});
    }
    s.restart();s.wave=100;s.alienManager.stopMovement();
    const group=s.assetManager.enemyBullets,shooter=s.alienManager.aliens.getChildren()[0];
    shooter.configure('popcat',1);shooter.setPosition(400,140);shooter.body.preUpdate(false,0);
    s.alienManager.getRandomAliveEnemy=()=>shooter;
    const fill=n=>{for(let i=0;i<n;i++)group.get().setPosition(50,50);};
    const oldFrac=Phaser.Math.RND.frac;Phaser.Math.RND.frac=()=>.1;
    try {
     fill(11);s._enemyFires();check(group.countActive(true)===11,'cannot launch partial shotgun');
     check(shooter.texture.key==='popcat-right','budget refusal leaves mouth closed');
     near(s.firingTimer-s.time.now,250,'cap retry');
     group.clear(true,true);fill(10);s._enemyFires();check(group.countActive(true)===15,'full shotgun fits exact cap');
     near(s.firingTimer-s.time.now,d.firingIntervalForWave(100),'late bounded firing interval');
     group.clear(true,true);
     for(let i=0;i<11;i++)s.bananaBombs.launch(400,140,400,550);
     s._enemyFires();check(group.countActive(true)===0,'flying bananas count against Popcat budget');
     s.bananaBombs.clear();s._enemyFires();check(group.countActive(true)===5,'cleanup releases permission');
     group.clear(true,true);fill(15);group.getChildren().forEach(shot=>shot.disableBody(true,true));
     s._enemyFires();check(group.countActive(true)===5,'inactive pooled shots do not block attacks');
     group.clear(true,true);shooter.configure('ponke',1);fill(14);
     s._enemyFires();check(s.bananaBombs.activeThreatCount===1,'PONKE fills final threat slot');
     s._enemyFires();check(s.bananaBombs.activeThreatCount===1,'PONKE cannot bypass cap');
    } finally {Phaser.Math.RND.frac=oldFrac;}
    const bosses=[];
    for(const wave of [10,20,30]) {
     s.restart();s.wave=wave;s.state='waveTransition';s.nextWaveReadyAt=0;s.firingTimer=Infinity;
     s._startNextWave();check(s.state==='bossEncounter'&&s.wave===wave,'boss separate from regular number');
     check(s.firingTimer===Infinity,'regular firing disabled throughout boss');
     const boss=s.wojak.sprite;s._startNextWave();s._startWojak();check(s.wojak.sprite===boss,'one boss per milestone');
     s.wojak.update(1500);for(let hit=0;hit<150;hit++)check(s.wojak.hit(),'unchanged boss health');
     s.update(undefined,10000);check(s.state==='waveTransition'&&s.wave===wave,'defeat completes once');
     s._startWojak();check(!s.wojak.sprite,'completed milestone does not respawn');
     s._startNextWave();s._startNextWave();check(s.wave===wave+1&&s.state==='playing','next regular wave exactly once');
     near(s.firingTimer-s.time.now,d.firingIntervalForWave(wave+1),'boss exit resets regular firing timer');
     bosses.push({after:wave,next:s.wave});
    }
    s.restart();s.wave=4;s.scoreManager.setWave(4);s.alienManager.reset(4);s.alienManager.stopMovement();s.firingTimer=Infinity;
    testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
    return {renderer:testGame.renderer.type,plans,bosses,threatCap:15};
   });
   await page.screenshot({path:path.join(output,renderer+'-wave-4.png')});reports.push(report);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'wave-director-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: real Phaser Canvas/WebGL seeded plans and safe formations through wave 100; compounded cycle speed, bullet/banana threat cap, whole shotguns, inactive cleanup, repeated bosses after 10/20/30 and exact next-wave numbering.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
