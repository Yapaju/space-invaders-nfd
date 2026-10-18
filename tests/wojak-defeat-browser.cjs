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
                    const b=s.wojak; b.update(1500); b.direction=direction; b.update(0);
                    for(let i=0;i<150;i++) b.hit();
                    window.ship=b.sprite; window.startY=ship.y;
                    if(!b.character.texture.key.includes('rekt') || b.lighting.visible || b.percentage.text!=='REKT') throw Error('REKT presentation');
                },direction);
                for (const [name,delta] of [['hold',999],['start',1],['rise',300],['contact',300],['push',500],['exit',499]]) {
                    const result=await page.evaluate(({delta,name}) => {
                        const b=s.wojak;
                        if(b.update(delta)) throw Error('premature completion');
                        if(name==='hold' && (ship.y!==startY || b.godCandle)) throw Error('hold');
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
                    b.start(); b.update(1500); for(let i=0;i<150;i++)b.hit(); b.update(2000);
                    const cancelled=b.godCandle, cancelledBody=b.godCandleBody; s.restart();
                    if(cancelled.active || cancelledBody.active || b.godCandleBody || b.godCandle || b.sprite || s.wave!==1) throw Error('restart cleanup');
                });
            }
        }
        assert.deepEqual(errors,[]);
        console.log('PASS: actual Phaser Canvas/WebGL, both orientations, 56 screenshots, three 100ms ON/OFF pulses at all four thresholds, continued patrol/combat, REKT hold, half-width proportional PNG, contact/push, full exit, one-shot completion, restart during push; no browser errors.');
    } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
