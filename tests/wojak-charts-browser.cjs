// Optional actual-Phaser visual regression. Requires Playwright + Chrome.
// node tests/wojak-charts-browser.cjs <absolute screenshot output directory>
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
    let browser;
    try {
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        const page = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
        // Fulfill every request from local files: no server, ports, or network.
        await page.route('http://wojak.test/**', serve);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const results = [];
        const histories = new Map();
        for (const renderer of ['webgl', 'canvas']) {
            await page.goto(`http://wojak.test/?${renderer}`);
            await page.waitForFunction(() => window.testGame && testGame.scene.scenes[0] && testGame.scene.scenes[0].player);
            await page.evaluate(() => {
                testGame.loop.stop();
                window.testScene = testGame.scene.scenes[0];
                testScene._startWojak();
                testScene.wojak.update(1500);
            });
            for (const direction of ['right', 'left']) {
                for (const stage of [50, 25, 0, -15, -30, -50, -70, -85, -99.9, 'REKT']) {
                    const result = await page.evaluate(({ direction, stage }) => {
                        const b = testScene.wojak;
                        b.clear(); b.start(); b.update(1500);
                        b.direction = direction === 'right' ? 1 : -1;
                        const value = stage === 'REKT' ? -99.9 : stage;
                        // At -99.9 the real encounter immediately enters REKT.
                        // Capture both chart endpoint and defeat presentation.
                        if (stage === -99.9) {
                            b.portfolio = value; b.charts.history.damage(value);
                            b.updatePercentage();
                        } else {
                            while (b.portfolio > value) b.hit();
                        }
                        for (let i = 0; i < 200; i++) b.charts.history.update(50);
                        b.updateFlash(500);
                        b.sprite.setPosition(400, 255); b.syncBody();
                        testGame.renderer.preRender(); testScene.sys.render(testGame.renderer);
                        testGame.renderer.postRender();
                        return { stage, direction, shown: b.charts.history.shown,
                            candles: b.charts.history.candles, frozen: b.charts.history.frozen,
                            formation: b.charts.history.formation, lights: b.lighting.visible,
                            renderer: testGame.renderer.type };
                    }, { direction, stage });
                    assert.equal(result.formation, 1);
                    assert.equal(result.frozen, stage === 'REKT');
                    assert.equal(result.lights, stage !== 'REKT');
                    if (stage === 50) assert.equal(result.shown, 4);
                    if (stage === 25) assert.equal(result.shown, 4);
                    if (stage === -99.9 || stage === 'REKT') assert.equal(result.candles[result.candles.length - 1].close, 0);
                    assert.equal(result.renderer, renderer === 'webgl' ? 2 : 1);
                    if (histories.has(stage)) assert.deepEqual(result.candles, histories.get(stage),
                        'both orientations and renderers must use identical candle sequences');
                    else histories.set(stage, result.candles);
                    const filename = `${renderer}-${direction}-${String(stage).replace('-', 'minus')}.png`;
                    await page.locator('canvas').screenshot({ path: path.join(output, filename) });
                    results.push({ renderer, ...result, filename });
                }
            }
            // Exercise registration and the project's current defeat timeline.
            await page.evaluate(() => {
                const b = testScene.wojak;
                const before = {x:b.charts.graphics.x,y:b.charts.graphics.y};
                b.sprite.x += 70; b.sprite.y -= 7; b.syncLayers();
                if (Math.abs(b.charts.graphics.x-before.x-70)>1e-7 ||
                    Math.abs(b.charts.graphics.y-before.y+7)>1e-7) throw Error('chart movement');
                const frozen = JSON.stringify(b.charts.history);
                b.update(999);
                if (!b.sprite || JSON.stringify(b.charts.history)!==frozen) throw Error('REKT freeze');
                if (b.update(1) || !b.sprite || !b.charts) throw Error('premature cleanup');
                const { WojakSettings: w, WojakPumpSettings: p } = load('src/interface/wojak-boss');
                const duration = p.entranceDuration + p.dramaticPauseDuration + p.bubblePopDuration +
                    p.commandHoldDuration + p.bubbleFadeDuration + w.godCandleRiseDuration + w.godCandlePushDuration;
                if (b.update(duration - 1001) || !b.sprite || !b.charts) throw Error('premature final cleanup');
                if (!b.update(1) || b.sprite || b.charts) throw Error('defeat cleanup');
            });
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
        console.log(`PASS: actual Phaser Canvas/WebGL rendering, 40 stage/orientation screenshots at 800x600, preserved pump, shared seeded OHLC history, zero endpoint, movement, REKT freeze/lights and configured defeat cleanup; no browser errors. Screenshots: ${output}`);
    } finally {
        if (browser) await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
