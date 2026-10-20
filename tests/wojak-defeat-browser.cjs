// Optional actual-Phaser visual regression. Requires Playwright + Chrome.
// node tests/wojak-defeat-browser.cjs <absolute screenshot output directory>
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

(async () => {
    const browser = await chromium.launch({channel:'chrome', headless:true});
    try {
        const page = await browser.newPage({viewport:{width:800,height:600}});
        await page.route('http://wojak.test/**', serve);
        const errors=[]; page.on('pageerror', error => errors.push(error.message));
        for (const renderer of ['canvas','webgl']) {
            await page.goto(`http://wojak.test/?${renderer}`);
            await page.waitForFunction(() => window.testGame && testGame.scene.scenes[0] && testGame.scene.scenes[0].player);
            await page.evaluate(() => { testGame.loop.stop(); window.s=testGame.scene.scenes[0]; });
            for (const direction of [1,-1]) {
                for (const threshold of [25,0,-30,-70]) {
                    await page.evaluate(({direction,threshold}) => {
                        if(s.wojak)s.wojak.clear();
                        s.state='playing';s._startWojak();
                        const b=s.wojak;b.update(1500);b.direction=direction;
                        b.portfolio=threshold+1;b.update(0);b.hit();
                        const layers=[b.sprite,b.character,b.foreground];
                        if(layers.some(v=>!v.isTinted || v.tintTopLeft!==0x7777ff)) throw Error('initial red pulse '+JSON.stringify(layers.map(v=>({key:v.texture.key,tint:v.tintTopLeft,isTinted:v.isTinted}))));
                        if(b.lighting.isTinted || b.percentage.isTinted) throw Error('flash targets changed');
                        testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
                    },{direction,threshold});
                    await page.locator('canvas').screenshot({path:path.join(output,`${renderer}-${direction}-threshold-${threshold}-red.png`)});
                    await page.evaluate(() => {
                        const b=s.wojak,layers=[b.sprite,b.character,b.foreground], x=b.sprite.x;
                        for(let ms=1;ms<=600;ms++) {
                            b.update(1);
                            const red=ms<600 && ms%200<100;
                            if(layers.some(v=>v.isTinted!==red || (red && v.tintTopLeft!==0x7777ff))) throw Error('pulse timing '+ms);
                            if(!b.shootingEnabled)throw Error('combat gated');
                        }
                        if(b.sprite.x===x)throw Error('patrol paused');
                        b.update(1000);
                        if(layers.some(v=>v.isTinted))throw Error('stuck/retriggered tint');
                        testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
                    });
                    await page.locator('canvas').screenshot({path:path.join(output,`${renderer}-${direction}-threshold-${threshold}-clear.png`)});
                }
                await page.evaluate(direction => {
                    if(s.wojak) s.wojak.clear();
                    s.state='playing'; s._startWojak();
                    const b=s.wojak; b.update(1500); b.direction=direction; b.update(0); b.sprite.x=direction>0?205:595;
                    for(let i=0;i<150;i++) b.hit();
                    window.ship=b.sprite; window.startY=ship.y;
                    if(!b.character.texture.key.includes('rekt') || b.lighting.visible || b.percentage.text!=='REKT') throw Error('REKT presentation');
                },direction);
                for (const [name,delta] of [['slide',1000],['entered',1000],['pause',649],['bubble',1],['pop',150],['settled',100],['hold',999],['fade-start',1],['fading',100],['prelaunch',99],['start',1],['depart',250],['departed',250],['rising',100],['contact',600],['push',1000],['exit',999]]) {
                    const result=await page.evaluate(({delta,name}) => {
                        const b=s.wojak;
                        if(b.update(delta)) throw Error('premature completion');
                        const t=b.completionElapsed-1150; // Bubble-relative schedule is unchanged.
                        if(t<2950 && (ship.y!==startY || b.godCandle)) throw Error('premature candle');
                        if(t<3450) {
                            const c=b.pumpCharacter,p=b.pumpBubble;
                            if(!c || c.body || c.flipX) throw Error('character sprite');
                            const oldScale=Math.min(800*0.48/c.width,600*0.48/c.height);
                            if(Math.abs(c.scaleX-oldScale*0.5)>1e-6 || c.scaleX!==c.scaleY) throw Error('character half size');
                            if(Math.abs(c.getBounds().left-16)>1e-6) throw Error('bottom-left anchor');
                            const finalY=600-c.height*c.scaleY*0.86;
                            if(t>=500 && t<=2950 && Math.abs(c.y-finalY)>1e-6) throw Error('stationary pause');
                            if(t===3200 && Math.abs(c.y-(finalY+600)/2)>1e-6) throw Error('downward exit');
                            if(t<2950) {
                                if(!p || p.body || p.flipX || p.visible!==(t>=1500)) throw Error('bubble timing');
                                if(p.scaleX!==p.scaleY || c.depth<=b.percentage.depth || p.depth<=c.depth) throw Error('pump rendering');
                                if(t>=1750 && Math.abs(p.scaleX-Math.min(800*0.34/p.width,600*0.3/p.height)*0.5)>1e-6) throw Error('bubble half size');
                                const alpha=t<=2750?1:1-(t-2750)/200;
                                if(Math.abs(p.alpha-alpha)>1e-6) throw Error('bubble fade');
                            } else if(p) throw Error('bubble present at candle launch');
                        }
                        if(t>=3450 && (b.pumpCharacter || b.pumpBubble)) throw Error('pump cleanup');
                        if(b.godCandle){
                            const c=b.godCandle, top=c.y+134*c.scaleY;
                            const body=b.godCandleBody;
                            if(c.body || body.body || body.y+body.scaleY<632) throw Error('candle safety/bottom');
                            if(Math.abs(c.scaleX-c.scaleY)>1e-6 || Math.abs(body.y-(c.y+1535*c.scaleY))>1e-6) throw Error('aspect/seam');
                            const oldScale=Math.max(0.5,(664-(b.candleContactY+b.defeatExitY-b.defeatY))/(1536-134));
                            if(Math.abs(c.scaleX-oldScale*0.5)>1e-6) throw Error('half width');
                            const g=b.weaponGeometry().candles;
                            if(Math.abs(c.x-(g.left+g.right)/2)>1e-6) throw Error('centering');
                            if(['contact','push','exit'].includes(name) && Math.abs(top-b.weaponGeometry().candles.y)>1e-6) throw Error('contact lost');
                            if(name==='push' && ship.y>=startY) throw Error('no push');
                            if(name==='push' && Math.abs(ship.y-(startY+b.defeatExitY)/2)>1e-6) throw Error('half-speed push');
                        }
                        testGame.renderer.preRender(); s.sys.render(testGame.renderer); testGame.renderer.postRender();
                        return {name, y:ship.y};
                    },{name,delta});
                    await page.locator('canvas').screenshot({path:path.join(output,`${renderer}-${direction}-${name}.png`)});
                }
                await page.evaluate(() => {
                    const b=s.wojak, candle=b.godCandle, body=b.godCandleBody;
                    if(!b.update(1) || b.sprite || candle.active || body.active || ship.getBounds().bottom>=0) throw Error('exit cleanup');
                    if(b.update(10000)) throw Error('duplicate completion');
                    // Reset while a candle is active must destroy it immediately.
                    b.start(); b.update(1500); for(let i=0;i<150;i++)b.hit(); b.update(5000);
                    const cancelled=b.godCandle, cancelledBody=b.godCandleBody; s.restart();
                    if(cancelled.active || cancelledBody.active || b.godCandleBody || b.godCandle || b.sprite || s.wave!==1) throw Error('restart cleanup');
                });
            }
        }
        for (const [width,height] of [[480,800],[1280,720]]) {
            await page.setViewportSize({width,height});
            await page.evaluate(({width,height}) => {
                testGame.scale.resize(width,height);
                s.cameras.main.setSize(width,height);
                s.physics.world.setBounds(0,0,width,height);
            },{width,height});
            for (const ms of [2000,2649,2650,2800,2900,3899,4000,4350]) {
                await page.evaluate(({ms,width,height}) => {
                    // Regular waves keep their fixed logical playfield. Only
                    // the boss-overlay fixture uses the synthetic narrow world.
                    s.physics.world.setBounds(0,0,800,600);
                    s.restart();
                    s.physics.world.setBounds(0,0,width,height);
                    s._startWojak();
                    const b=s.wojak;b.update(1500);b.sprite.x=[205,400,595][ms%3];for(let i=0;i<150;i++)b.hit();b.update(ms);
                    const c=b.pumpCharacter,p=b.pumpBubble;
                    if(p) {
                        const box=p.getBounds();
                        if(box.left<0 || box.right>width || box.top<0 || box.bottom>height) throw Error('viewport bubble bounds');
                        if(p.scaleX!==p.scaleY) throw Error('bubble aspect');
                    }
                    if(Math.abs(c.getBounds().left-width*0.02)>1e-6) throw Error('viewport left margin');
                    if(c.getBounds().bottom<=height || c.y>=height) throw Error('viewport torso crop');
                    if(c.scaleX!==c.scaleY) throw Error('viewport aspect');
                    if(!s.textures.exists('wojak-bogdanoff') || !s.textures.exists('wojak-pump-it')) throw Error('missing pump textures');
                    testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
                },{ms,width,height});
                await page.locator('canvas').screenshot({path:path.join(output,`viewport-${width}x${height}-${ms}.png`)});
            }
        }
        await page.evaluate(() => {
            s.physics.world.setBounds(0,0,800,600);
            for(const action of ['restart','_gameOver']) for(const ms of [0,1000,2000,2649,2650,2800,2900,3899,4000,4100,4350,4600,5300,6300,7299]) {
                s.restart();s._startWojak();
                const b=s.wojak;b.update(1500);for(let i=0;i<150;i++)b.hit();
                const c=b.pumpCharacter,p=b.pumpBubble;b.update(ms);
                const candle=b.godCandle;s[action]();
                if(c.active || p.active || (candle && candle.active) || b.pumpCharacter || b.pumpBubble || b.sprite) throw Error(action+' pump cleanup '+ms);
                b.update(10000);
                if(b.pumpCharacter || b.pumpBubble || b.godCandle) throw Error('stale animation');
            }
        });
        assert.deepEqual(errors,[]);
        console.log('PASS: Phaser Canvas/WebGL, both orientations and opposite ship positions, combat/threshold regressions, bottom-left half-size PUMP IT, full entrance/pause/pop/hold/fade/downward exit timeline, 2000ms entrance, 650ms pause, 4100ms candle launch, unchanged candle width, half-speed rise/push, synchronized contact and exit, 480x800 and 1280x720 overlays, restart/death at fifteen stages, one-shot completion; no browser errors.');
    } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
