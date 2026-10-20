// Real Phaser popcorn combat, registration, timing and production asset regression.
// node tests/popcat-weapons-browser.cjs <absolute screenshot output directory>
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
    'load("src/game");</script>';
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

(async () => {
    const browser=await chromium.launch({channel:'chrome',headless:true});
    try {
        const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[],reports=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.route('http://wojak.test/**',serve);
        await page.route('https://www.googletagmanager.com/**',r=>r.abort());
        for(const renderer of ['webgl','canvas']) {
            await page.goto('http://wojak.test/'+(renderer==='canvas'?'?canvas':''));
            await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
            const report=await page.evaluate(()=>{
                testGame.loop.stop();window.s=testGame.scene.scenes[0];s.restart();
                const w=load('src/interface/popcat-weapons'),settings=w.PopcornSettings;
                const check=(ok,message)=>{if(!ok)throw Error(message);};
                const near=(a,b,label)=>check(Math.abs(a-b)<0.001,`${label}: ${a} != ${b}`);
                let now=s.time.now;
                window.stepCorn=()=>{now+=1000/60;s.sys.step(now,1000/60);};
                window.drawCorn=()=>{testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();};
                const group=s.assetManager.enemyBullets,shooter=s.alienManager.aliens.getChildren()[0];
                s.alienManager.stopMovement();s.firingTimer=Infinity;
                s.alienManager.aliens.getChildren().slice(1).forEach(a=>a.setVisible(false));
                shooter.setPosition(400,140);shooter.body.preUpdate(false,0);
                s.alienManager.getRandomAliveEnemy=()=>shooter;
                const originalFrac=Phaser.Math.RND.frac,originalRotation=Phaser.Math.RND.realInRange;
                const clear=()=>group.clear(true,true);
                const fire=values=>{let i=0;Phaser.Math.RND.frac=()=>values[Math.min(i++,values.length-1)];
                    Phaser.Math.RND.realInRange=()=>0;
                    try{s._enemyFires();}finally{Phaser.Math.RND.frac=originalFrac;Phaser.Math.RND.realInRange=originalRotation;}
                    window.lastFireDelay=s.firingTimer-s.time.now;
                    s.firingTimer=Infinity;};
                w.PopcornAssets.forEach(pose=>{
                    check(s.textures.exists(pose.asset+'-source')&&s.textures.exists(pose.asset),'production asset '+pose.path);
                    near(s.textures.get(pose.asset).getSourceImage().width,128,'runtime canvas');
                });
                s.player.x=760;s.player.body.preUpdate(false,0);
                const flights=[];
                for(const direction of [-1,1]) {
                    clear();shooter.configure('popcat',direction);
                    fire([0.79,0.1,0.9,0.1,0.9,0.1]);
                    // Snapshot: Phaser removes destroyed entries from the live group array.
                    const shots=group.getChildren().slice();check(shots.length===5,'exactly five');
                    check(new Set(shots.map(v=>v.texture.key)).size===2,'both variants');
                    const mouth=w.popcatMouthPosition(shooter);
                    shots.forEach((v,i)=>{
                        near(v.x,mouth.x,'mouth x');near(v.y,mouth.y,'mouth y');
                        near(v.body.width,12,'regular body');near(v.displayWidth,18,'regular visual');
                        near(v.body.velocity.x,direction*settings.fanVelocities[i],'mirrored vx');
                        near(v.body.velocity.y,-220,'launch vy');near(v.body.acceleration.y,620,'gravity');
                        check(!v.body.allowGravity,'independent of world gravity');
                    });
                    check(shooter.texture.key===`popcat-open-${direction<0?'left':'right'}`,'actual firing mouth');
                    let previousSpan=0,arrival=0,minY=mouth.y,previousVy=-220;
                    const trace=[];
                    for(let frame=0;frame<300;frame++) {
                        stepCorn();
                        check(shots.every(v=>v.active),'projectile survives to player row');
                        const span=Math.abs(shots[4].x-shots[0].x);
                        check(span>=previousSpan,'progressive spread');previousSpan=span;
                        const vy=shots[0].body.velocity.y;
                        check(vy>=previousVy-0.001&&vy<=140.001,'smooth bend / slower terminal descent');
                        check(vy-previousVy<11,'no velocity snap');previousVy=vy;
                        minY=Math.min(minY,shots[0].y);
                        if(frame===5)shots.forEach(v=>check(v.y<mouth.y&&v.body.velocity.y<0,'fast initial rise'));
                        shots.forEach(v=>check(direction*(v.x-mouth.x)>0&&v.y>9,'forward travel / top clearance'));
                        if(frame%12===0)trace.push({frame,x:shots[0].x,y:shots[0].y,vy,span});
                        if(shots[0].y>=520){arrival=(frame+1)/60;break;}
                    }
                    check(arrival>0&&arrival<4.5,'timely player-row arrival');
                    check(previousSpan>200&&previousSpan<320,'visible shotgun fan');
                    check(mouth.y-minY>30&&mouth.y-minY<45,'short upward flight');
                    flights.push({direction,arrivalSeconds:arrival,rise:mouth.y-minY,span:previousSpan,trace});
                }
                // Physics-derived clearance, parity and cadence, with no RNG roll on rejection.
                clear();
                for(const direction of [-1,1]) {
                    shooter.configure('popcat',direction);shooter.setPosition(direction>0?770:30,140);
                    fire([0.79]);check(group.getLength()===0,'blocked edge creates no attack');near(lastFireDelay,250,'retry delay');
                    check(shooter.texture.key===`popcat-${direction>0?'right':'left'}`,'blocked mouth stays closed');
                    check(s.firingTimer===Infinity,'test firing override');
                    // Inspect the actual scene retry deadline without the test fire helper override.
                    const oldFrac=Phaser.Math.RND.frac;
                    Phaser.Math.RND.frac=()=>{throw Error('blocked attack consumed RNG');};
                    try{s._enemyFires();}finally{Phaser.Math.RND.frac=oldFrac;}
                    near(s.firingTimer-s.time.now,250,'bounded retry');s.firingTimer=Infinity;
                    shooter.setPosition(400,140);fire([0.79]);
                    check(group.getLength()===5,'one volley after becoming eligible');near(lastFireDelay,2000,'normal cooldown');clear();
                }
                let allowed=0,total=0;
                for(const direction of [-1,1])for(let x=44;x<=756;x+=4){
                    shooter.configure('popcat',direction);shooter.setPosition(x,100);
                    total++;if(w.canPopcatFire(shooter,s.physics.world.bounds))allowed++;
                }
                check(allowed/total>0.85,'broad firing opportunity');
                shooter.configure('popcat',1);shooter.setPosition(400,140);fire([0.79]);
                for(let frame=0;frame<50;frame++)stepCorn();
                window.fireCorn=fire;window.shooter=shooter;
                drawCorn();
                return {renderer:testGame.renderer.type,shotgun:5,variants:2,flights,eligibleFraction:allowed/total};
            });
            await page.screenshot({path:path.join(output,`${renderer}-shotgun.png`)});
            const special=await page.evaluate(()=>{
                const w=load('src/interface/popcat-weapons'),group=s.assetManager.enemyBullets;
                const check=(ok,message)=>{if(!ok)throw Error(message);};
                const near=(a,b,message)=>check(Math.abs(a-b)<0.001,message+': '+a+' != '+b);
                group.clear(true,true);s.player.x=400;s.player.body.preUpdate(false,0);
                fireCorn([0.8]);
                check(group.getLength()===1,'one special');
                const kernel=group.getChildren()[0],mouth=w.popcatMouthPosition(shooter);
                const reference=load('src/interface/wave-config').FORMATION_LOWEST_START_Y;
                near(reference,322,'formation reference');
                const startingLowest=Math.max(...s.alienManager.aliens.getChildren().map(v=>v.y));
                near(startingLowest,322,'actual starting layout');
                check(kernel.texture.key==='popcat-popcorn-kernel','kernel source');
                near(kernel.body.width,6,'kernel body');near(kernel.displayWidth,10,'kernel visual');
                near(kernel.body.velocity.x,48,'kernel forward');near(kernel.body.velocity.y,-220,'kernel upward');
                s.player.x=760;s.player.body.preUpdate(false,0);
                // Moving the formation cannot move the transformation line.
                s.alienManager.aliens.getChildren().slice(1).forEach(a=>{a.y+=100;a.body.preUpdate(false,0);});
                let frames=0,previousY=kernel.y;
                while(!kernel.transformed&&frames++<300){
                    previousY=kernel.y;stepCorn();
                    if(kernel.body.velocity.y<=0)check(!kernel.transformed,'never transforms ascending');
                }
                check(kernel.transformed,'transform occurs');
                check(kernel.body.velocity.y>0&&kernel.y>=reference&&kernel.y-reference<5,'descending reference crossing');
                near(kernel.displayWidth,18,'initial POP size');near(kernel.body.width,6,'warning body');
                near(kernel.body.center.x,kernel.x,'body anchor x');near(kernel.body.center.y,kernel.y,'body anchor y');
                window.kernel=kernel;window.savedVelocity={x:kernel.body.velocity.x,y:kernel.body.velocity.y};
                drawCorn();
                return {transformY:reference,observedY:kernel.y,frames};
            });
            await page.screenshot({path:path.join(output,`${renderer}-kernel-pop.png`)});
            await page.evaluate(()=>{
                for(let i=0;i<10;i++)stepCorn();
                if(Math.abs(kernel.body.width-6)>0.001||Math.abs(kernel.displayWidth-83.2)>0.001)throw Error('140ms growth / 180ms warning');
                stepCorn();
                if(Math.abs(kernel.body.width-62.4)>0.001)throw Error('expanded giant body');
                if(Math.abs(kernel.body.center.x-kernel.x)>0.001||Math.abs(kernel.body.center.y-kernel.y)>0.001)throw Error('body alignment after growth');
                if(kernel.body.velocity.x!==savedVelocity.x||kernel.body.velocity.y<savedVelocity.y||kernel.body.velocity.y>140.001)throw Error('smooth continued descent');
                if(kernel.texture.key!=='popcat-popcorn-giant')throw Error('giant texture');
                drawCorn();
            });
            await page.screenshot({path:path.join(output,`${renderer}-giant.png`)});
            await page.evaluate(()=>{
                const w=load('src/interface/popcat-weapons'),group=s.assetManager.enemyBullets;
                const near=(a,b,label)=>{if(Math.abs(a-b)>0.001)throw Error(label+': '+a+' != '+b);};
                // The grown circle must hit through the existing damage callback,
                // be consumed once, and leave the player's geometry unchanged.
                const live=s.scoreManager.lives.countActive(true);
                const body=s.player.body,geometry=[body.width,body.height,body.offset.x,body.offset.y];
                kernel.body.reset(s.player.x,s.player.y);kernel.body.preUpdate(false,0);
                s.physics.overlap(group,s.player,s._enemyBulletHitPlayer,null,s);
                if(kernel.active||s.scoreManager.lives.countActive(true)!==live-2)throw Error('one giant collision damage');
                s.physics.overlap(group,s.player,s._enemyBulletHitPlayer,null,s);
                if(s.scoreManager.lives.countActive(true)!==live-2)throw Error('duplicate damage');
                const cleanup=s.pendingCleanup;s.pendingCleanup=[];cleanup.forEach(fn=>fn());
                if(JSON.stringify(geometry)!==JSON.stringify([body.width,body.height,body.offset.x,body.offset.y]))throw Error('player geometry changed');
                // Late-wave emitters below Y=322 must rise above that same line
                // before crossing it on descent, with both mirrored kernel arcs.
                for(const direction of [-1,1]) {
                    group.clear(true,true);shooter.configure('popcat',direction);shooter.setPosition(400,450);
                    fireCorn([0.8]);const low=group.getChildren()[0];
                    const mouth=w.popcatMouthPosition(shooter);
                    near(low.body.velocity.x,direction*48,'mirrored low kernel');
                    near(low.body.velocity.y,-w.popcatKernelUpwardSpeed(mouth.y),'extra low-row lift');
                    let above=false,frames=0;
                    while(!low.transformed&&frames++<180){
                        stepCorn();if(low.y<322)above=true;
                        if(low.body.velocity.y<=0&&low.y>=322&&low.transformed)throw Error('early low-row POP');
                    }
                    if(!above||!low.transformed||low.body.velocity.y<=0||low.y<322||low.y>327)throw Error('low-row descending reference crossing');
                }
                group.clear(true,true);shooter.configure('popcat',1);shooter.setPosition(400,140);
                // Existing state/activity protection, single-use consumption and
                // clamped lethality for one/two lives, including every ordinary kind.
                const flush=()=>{const cleanup=s.pendingCleanup;s.pendingCleanup=[];cleanup.forEach(fn=>fn());};
                const collide=(texture,giant=false)=>{
                    const shot=new w.PopcornProjectile(s);s.add.existing(shot);group.add(shot);
                    shot.launch(s.player.x,s.player.y,0,0,texture);
                    if(giant){shot.transformed=true;shot.setTexture(w.PopcornAssets[2].asset);}
                    s._enemyBulletHitPlayer(s.player,shot);s._enemyBulletHitPlayer(s.player,shot);
                    flush();return shot;
                };
                for(const texture of [w.PopcornAssets[0].asset,w.PopcornAssets[1].asset,w.PopcornAssets[3].asset]){
                    s.scoreManager.resetLives();const shot=collide(texture);
                    if(shot.damage!==1||s.scoreManager.lives.countActive(true)!==2)throw Error('regular/kernel single damage');
                }
                for(const state of ['waveTransition','bossEncounter','gameOver']){
                    s.scoreManager.resetLives();s.state=state;collide(w.PopcornAssets[2].asset,true);
                    if(s.scoreManager.lives.countActive(true)!==3)throw Error('protected state');
                    group.clear(true,true);
                }
                s.state='playing';s.player.setActive(false);s.scoreManager.resetLives();
                collide(w.PopcornAssets[2].asset,true);
                if(s.scoreManager.lives.countActive(true)!==3)throw Error('inactive player protected');
                s.player.setActive(true);group.clear(true,true);
                for(const lives of [2,1]){
                    s.scoreManager.resetLives();
                    while(s.scoreManager.lives.countActive(true)>lives)s.scoreManager.lives.getFirstAlive().setActive(false);
                    const shot=collide(w.PopcornAssets[2].asset,true);
                    if(shot.damage!==2||s.scoreManager.lives.countActive(true)!==0||s.state!=='gameOver'||s.player.active)throw Error('giant lethal clamp');
                    s.restart();s.alienManager.stopMovement();
                }
                // restart replaced the shooter; use the current formation below.
                s.alienManager.getRandomAliveEnemy=()=>s.alienManager.aliens.getChildren()[0];
                // Real automatic four-edge cleanup uses display bounds, not the
                // 128px canvas or much larger original PNG dimensions.
                for(const [x,y]of[[-50,200],[850,200],[400,-50],[400,650]]){
                    const p=new w.PopcornProjectile(s);s.add.existing(p);group.add(p);
                    p.launch(x,y,0,135,w.PopcornAssets[0].asset);p.update();
                    if(p.active||p.scene)throw Error('offscreen cleanup');
                }
                fireCorn([0.9]);const restartShot=group.getChildren()[0];s.restart();
                if(restartShot.scene||group.getLength())throw Error('restart cleanup');
                s.alienManager.stopMovement();s.alienManager.getRandomAliveEnemy=()=>s.alienManager.aliens.getChildren()[0];
                fireCorn([0.9]);const transitionShot=group.getChildren()[0];
                // Explicit boss entry also clears the shared projectile group.
                s._startWojak();if(transitionShot.scene||group.getLength())throw Error('boss cleanup');s.restart();
                fireCorn([0.9]);const waveShot=group.getChildren()[0];
                s.alienManager.aliens.getChildren().forEach(a=>a.disableBody(true,true));
                s._bulletHitAliens({active:true,disableBody(){},destroy(){}}, {active:true,kill(){},destroy(){}});
                const waveCleanup=s.pendingCleanup;s.pendingCleanup=[];waveCleanup.forEach(fn=>fn());
                if(waveShot.scene||group.getLength()||s.state!=='waveTransition')throw Error('wave clear cleanup');
                s.restart();fireCorn([0.9]);const deathShot=group.getChildren()[0];
                s._gameOver();s.assetManager.gameOver();
                if(deathShot.scene||group.getLength())throw Error('game over cleanup');
                s.restart();fireCorn([0.9]);const shutdownShot=group.getChildren()[0];
                s.scene.stop();testGame.scene.processQueue();if(shutdownShot.scene)throw Error('shutdown cleanup');
            });
            reports.push({...report,...special});
        }
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(output,'popcorn-measurements.json'),JSON.stringify(reports,null,2));
        console.log(JSON.stringify(reports.map(({flights,...v})=>({...v,flights:flights.map(({trace,...f})=>f)}))));
        console.log('PASS: Canvas/WebGL production assets, five-shot fan/two variants/both mouths, exclusive special, mirrored upward arcs/slower descent, edge eligibility/retry, fixed Y=322 descending transform, 140ms growth/180ms warning, aligned expanding hitbox, giant 2 damage / regular and kernel 1, protected states / lethal clamp / damage once, edge/restart/wave/boss/death/shutdown cleanup.');
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
