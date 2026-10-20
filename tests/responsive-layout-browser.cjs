// Responsive page regression using the real page, stylesheet and game configuration. Requires Playwright + Chrome.
// node tests/responsive-layout-browser.cjs <absolute screenshot output directory>
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
    // This suite checks the normal WD1 path; Premium has its own default-on integration suite.
    'load("src/interface/wave-director").WaveDirectorConfig.premiumInvaders.testMode.enabled=false;load("src/game");</script>';
const html = fs.readFileSync(path.join(root,'dist/index.html'),'utf8')
    .replace('<script src="game.js"></script>', bootstrap);
async function serve(route) {
    const url = new URL(route.request().url());
    if (url.pathname === '/') { await route.fulfill({ contentType: 'text/html', body: html }); return; }
    const file = url.pathname === '/phaser.js' ? path.join(root, 'node_modules/phaser/dist/phaser.js') :
        path.resolve(root, 'dist', '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) { await route.fulfill({ status: 403 }); return; }
    if (!fs.existsSync(file)) { await route.fulfill({ status: 404 }); return; }
    await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' :
        file.endsWith('.png') ? 'image/png' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('http://wojak.test/**', serve);
        await page.route('https://www.googletagmanager.com/**', route => route.abort());
        await page.goto('http://wojak.test/');
        await page.waitForFunction(() => window.testGame && testGame.scene.scenes[0].player);
        await page.evaluate(() => {
            testGame.loop.stop(); window.s = testGame.scene.scenes[0];
            window.snapshot = () => JSON.stringify(s.children.list.filter(v => v.active).map(v =>
                [v.x, v.y, v.scaleX, v.scaleY, v.texture && v.texture.key]).sort((a,b) =>
                    JSON.stringify(a).localeCompare(JSON.stringify(b))));
            window.original = snapshot();
        });
        assert.equal(await page.locator('.social-wrapper, .social-button, .social-btn, iframe').count(), 0);
        assert(!/Angular Jira Clone|Angular Tetris|Buy me a beer|ghbtns.com/.test(await page.content()));
        for (const [width, height] of [[1920,1080],[1366,768],[640,480],[480,800],[1024,400],[800,600],[1920,1080]]) {
            await page.setViewportSize({ width, height });
            await page.waitForFunction(({ width, height }) => {
                // The game loop is paused so geometry can be compared exactly.
                testGame.scale.step(0, 16);
                const r = testGame.canvas.getBoundingClientRect(), k = Math.min(width/800,height/600);
                return Math.abs(r.width-800*k)<1 && Math.abs(r.height-600*k)<1;
            }, { width, height });
            await page.evaluate(({ width, height }) => {
                const check = (ok, message) => { if (!ok) throw Error(message); };
                const g = testGame, r = g.canvas.getBoundingClientRect();
                check(g.canvas.width===1600 && g.canvas.height===1200, 'default backing buffer');
                check(g.scale.gameSize.width===800 && g.scale.gameSize.height===600, 'logical game resized');
                check(s.physics.world.bounds.width===800 && s.physics.world.bounds.height===600, 'world resized');
                check(s.cameras.main.width===800 && s.cameras.main.height===600, 'camera resized');
                check(snapshot()===original, 'resize moved/scaled scene objects');
                check(Math.abs(r.width/r.height-4/3)<0.001, 'aspect ratio');
                check(Math.abs(r.left-(width-r.width)/2)<1.1 && Math.abs(r.top-(height-r.height)/2)<1.1, 'centering');
                check(r.left>=0 && r.top>=0 && r.right<=width+1 && r.bottom<=height+1, 'canvas cropped');
                check(document.documentElement.scrollWidth===width && document.documentElement.scrollHeight===height, 'page scrollbars');
                check(getComputedStyle(document.body).margin==='0px', 'body margin');
                check(!document.fullscreenElement, 'native fullscreen requested');
                g.input.transformPointer(g.input.activePointer, r.left+r.width*0.25, r.top+r.height*0.75, false);
                check(Math.abs(g.input.activePointer.x-200)<1 && Math.abs(g.input.activePointer.y-450)<1, 'pointer mapping');
                for(const v of [s.scoreManager.scoreLabel,s.scoreManager.livesLabel,...s.scoreManager.lives.getChildren()]) {
                    const b=v.getBounds(); check(b.left>=0 && b.right<=800 && b.top>=0 && b.bottom<=600, 'HUD clipped');
                }
                g.renderer.preRender(); s.sys.render(g.renderer); g.renderer.postRender();
            }, { width, height });
            await page.screenshot({ path: path.join(output, `${width}x${height}.png`) });
        }
        await page.keyboard.down('ArrowRight');
        await page.evaluate(() => { s._shipKeyboardHandler(); if(s.player.body.velocity.x!==200) throw Error('right movement'); });
        await page.keyboard.up('ArrowRight');
        await page.keyboard.down('ArrowLeft');
        await page.evaluate(() => { s._shipKeyboardHandler(); if(s.player.body.velocity.x!==-200) throw Error('left movement'); });
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.down('Space');
        await page.evaluate(() => {
            s.bulletTime=-1; s._shipKeyboardHandler();
            const shots=s.assetManager.bullets.getChildren().filter(v=>v.active);
            if(!shots.length || shots[0].body.velocity.y!==-400) throw Error('keyboard shooting');
        });
        await page.keyboard.up('Space');
        // Read real held keyboard state while shots are suppressed by cooldown.
        // Every transition must retain the normalized frame and Arcade geometry.
        const poseGeometry = await page.evaluate(() => {
            s.bulletTime=Infinity;
            window.playerGeometry=()=>{
                const p=s.player,b=p.body;
                return [p.x,p.y,p.width,p.height,p.scaleX,p.scaleY,p.originX,p.originY,
                    b.left,b.top,b.width,b.height,b.offset.x,b.offset.y];
            };
            s.player.body.preUpdate(false,0);
            return {geometry:playerGeometry(),shots:s.assetManager.bullets.getChildren().filter(v=>v.active).length};
        });
        let held=new Set();
        async function poseStep(keys, expected) {
            const next=new Set(keys);
            for(const key of held) if(!next.has(key)) await page.keyboard.up(key);
            for(const key of next) if(!held.has(key)) await page.keyboard.down(key);
            held=next;
            const actual=await page.evaluate(()=>{
                s.time.now+=40;s._shipKeyboardHandler();s.player.body.preUpdate(false,0);
                return {key:s.player.texture.key,geometry:playerGeometry(),
                    shots:s.assetManager.bullets.getChildren().filter(v=>v.active).length};
            });
            assert.equal(actual.key,expected);
            assert.deepEqual(actual.geometry,poseGeometry.geometry,'pose switch changed player geometry');
            assert.equal(actual.shots,poseGeometry.shots,'pose selection must not spawn shots');
        }
        await poseStep([],'ship');
        await poseStep(['ArrowLeft'],'ship-left');
        await poseStep(['ArrowRight'],'ship-turn-right');
        await poseStep(['ArrowRight'],'ship-right');
        await poseStep([],'ship');
        await poseStep(['Space'],'ship-shooting');
        for(let i=0;i<10;i++) await poseStep(['Space'],'ship-shooting');
        await poseStep(['ArrowLeft','Space'],'ship-left-shooting');
        await poseStep(['ArrowRight','Space'],'ship-right-shooting');
        await poseStep(['Space'],'ship-shooting');
        await poseStep([],'ship');
        await poseStep(['ArrowLeft','Space'],'ship-left-shooting');
        await poseStep(['ArrowLeft'],'ship-left');
        await poseStep(['ArrowRight','Space'],'ship-right-shooting');
        await poseStep(['ArrowRight'],'ship-right');
        await poseStep([],'ship');
        await poseStep(['Space'],'ship-shooting');
        await page.evaluate(()=>{s.state='waveTransition';});
        await poseStep(['Space'],'ship');
        await poseStep(['ArrowLeft','Space'],'ship-left');
        await poseStep(['ArrowRight','Space'],'ship-turn-right');
        await poseStep(['ArrowRight','Space'],'ship-right');
        await page.evaluate(()=>{s.state='playing';});
        await poseStep(['ArrowRight','Space'],'ship-right-shooting');
        await page.evaluate(()=>{s._startWojak();});
        await poseStep(['Space'],'ship');
        await page.evaluate(()=>{s.wojak.update(1499);});
        await poseStep(['Space'],'ship');
        await page.evaluate(()=>{s.wojak.update(1);});
        await poseStep(['Space'],'ship-shooting');
        await page.evaluate(()=>{for(let i=0;i<150;i++)s.wojak.hit();});
        await poseStep(['Space'],'ship');
        await page.evaluate(()=>{s.wojak.update(7300);s.state='playing';});
        await poseStep(['Space'],'ship-shooting');
        // Pause/resume handlers must refresh even while the scene loop is stopped.
        const pauseState=await page.evaluate(()=>{
            const b=s.player.body,velocity=[b.velocity.x,b.velocity.y];
            s.sys.pause();
            const paused=s.player.texture.key;
            if(!s.sys.isPaused() || s.playerShootingEnabled)throw Error('pause eligibility');
            s.sys.resume();
            if(s.sys.isPaused() || !s.playerShootingEnabled)throw Error('resume eligibility');
            return {paused,resumed:s.player.texture.key,geometry:playerGeometry(),velocity,
                afterVelocity:[b.velocity.x,b.velocity.y],shots:s.assetManager.bullets.getChildren().filter(v=>v.active).length};
        });
        assert.equal(pauseState.paused,'ship');
        assert.equal(pauseState.resumed,'ship-shooting');
        assert.deepEqual(pauseState.geometry,poseGeometry.geometry);
        assert.deepEqual(pauseState.afterVelocity,pauseState.velocity);
        assert.equal(pauseState.shots,poseGeometry.shots,'pause/resume must not fire a shot');
        await poseStep([],'ship');
        console.log('PASS: eligibility-gated poses through wave transitions, actual boss entrance/completion, combat re-enable with held Space, native Phaser pause/resume, no extra shots or movement.');
        await page.evaluate(()=>{
            for(const key of ['ship-shooting','ship-left-shooting','ship-right-shooting']) {
                const t=s.textures.get(key);
                if(t.source[0].width!==335 || t.source[0].height!==320) throw Error('shooting frame dimensions');
                s.textures.remove(key);
            }
        });
        await poseStep(['Space'],'ship');
        await poseStep(['ArrowLeft','Space'],'ship-left');
        await poseStep(['ArrowRight','Space'],'ship-turn-right');
        await poseStep(['ArrowRight','Space'],'ship-right');
        await poseStep([],'ship');
        console.log('PASS: all six real-keyboard player poses, held Space between shots, immediate release/direction/stop transitions, unchanged frame/scale/origin/position/Arcade body, reversal and missing-texture fallback.');
        await page.evaluate(() => {
            s.restart(); s._startWojak(); const b=s.wojak; b.update(1500);
            for(let i=0;i<150;i++) b.hit(); b.update(2900); window.original=snapshot();
        });
        for(const [width,height] of [[1366,768],[480,800],[1920,1080]]) {
            await page.setViewportSize({width,height});
            await page.waitForFunction(({width,height}) => {
                testGame.scale.step(0, 16);
                return Math.abs(testGame.canvas.getBoundingClientRect().height-600*Math.min(width/800,height/600))<1;
            },{width,height});
            await page.evaluate(() => {
                if(snapshot()!==original)throw Error('resize changed defeat presentation');
                const b=s.wojak,c=b.pumpCharacter,p=b.pumpBubble;
                if(Math.abs(c.getBounds().left-16)>0.001 || p.getBounds().bottom>=c.y)throw Error('PUMP IT layout');
                testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
            });
            await page.screenshot({path:path.join(output,`pump-${width}x${height}.png`)});
        }
        await page.evaluate(() => {
            const b=s.wojak,ship=b.sprite;
            if(b.character.texture.key.indexOf('rekt')<0)throw Error('REKT pose');
            b.update(1200); if(!b.godCandle)throw Error('candle launch');
            b.update(1200); if(Math.abs(b.godCandle.y+134*b.godCandle.scaleY-b.weaponGeometry().candles.y)>0.001)throw Error('candle contact');
            if(b.update(1999))throw Error('premature cleanup');
            if(!b.update(1) || ship.getBounds().bottom>=0)throw Error('offscreen exit/cleanup');
            s.restart(); if(s.wave!==1 || !s.player.active)throw Error('restart');
        });
        assert.deepEqual(errors, []);
        console.log('PASS: real page/config, default 1600x1200 backing buffer, maximum 4:3 fit and centering, fixed 800x600 logical world/camera, unchanged scene/HUD geometry, no scrollbars, resize, pointer mapping, keyboard movement/shooting, REKT/PUMP IT/candle synchronization, exit and restart.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

