const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/interface/wojak-charts.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText, { exports: moduleUnderTest.exports });
const { WojakChartHistory, WojakCharts, WojakMonitors, WojakChartLayout: layout,
    chartScroll, projectChartPoint, clipChartPolygon } = moduleUnderTest.exports;
const near = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const h = new WojakChartHistory();
assert.equal(h.candles.length, 4);
let previousSize = 0;
h.candles.forEach(c => {
    assert(c.close > c.open);
    assert(c.close - c.open > previousSize);
    previousSize = c.close - c.open;
});
h.update(10000); assert.equal(h.candles.length, 4);
for (let value = 49; value >= 25; value--) h.damage(value);
assert.equal(h.candles.length, 4);
h.damage(0); assert(h.candles.length > 4 && h.candles.length < 10);
h.update(55); assert(h.formation > 0 && h.formation < 1);
h.update(55); near(h.formation, 1);
const idleCount = h.candles.length;
for (let i = 0; i < 100; i++) h.update(250);
assert.equal(h.candles.length, idleCount, 'idle time never generates losses');
for (let value = -1; value >= -30; value--) h.damage(value);
assert.equal(h.candles.filter(c => c.crash === -30).length, 1);
for (let i = 0; i < 100; i++) h.update(250);
const shownBefore = h.shown;
h.damage(-70); // One hit crosses the second threshold.
h.update(1); assert(h.shown > shownBefore && h.formation < 1);
h.damage(-70); h.damage(-69); h.damage(-70);
assert.equal(h.candles.filter(c => c.crash === -70).length, 1);
const crashes = h.candles.filter(c => c.crash);
near(crashes[0].open - crashes[0].close, layout.crash30Drop);
near(crashes[1].open - crashes[1].close, 2 * (crashes[0].open - crashes[0].close));
h.damage(-99.9); h.freeze();
assert.equal(h.shown, h.candles.length);
assert(h.candles.length > layout.capacity, 'history exceeds the scrolling window and is retained');
assert(h.candles.length <= 30, 'whole encounter stays readable without per-shot candles');
assert.equal(h.candles[h.candles.length - 1].close, 0, 'liquidation reaches the zero baseline');
assert(h.candles.every(c => c.low >= 0));
assert(layout.firstX + 3 * layout.pitch + layout.bodyWidth / 2 < 0.45,
    'four initial candles leave most of the glass empty to the right');
near(chartScroll(4, 1), 0);
near(chartScroll(layout.capacity, 1), 0);
near(chartScroll(layout.capacity + 1, 0), 0);
near(chartScroll(layout.capacity + 1, 0.5), 0.5);
near(chartScroll(layout.capacity + 1, 1), 1);
// Preserve readable widths, while true OHLC heights shrink in the final bleed.
assert(layout.bodyWidth * 65 >= 3.5);
assert(layout.wickWidth < layout.bodyWidth / 3);
const frozen = JSON.stringify(h);
h.damage(-1000); h.update(250); assert.equal(JSON.stringify(h), frozen);
const skip = new WojakChartHistory(); skip.damage(-99.9); skip.damage(-99.9);
assert.deepEqual(Array.from(skip.candles), Array.from(h.candles), 'large jumps preserve threshold ordering and history');
for (const threshold of [-30, -70]) {
    const crossing = new WojakChartHistory(); crossing.damage(threshold + 0.1);
    for (let i = 0; i < 200; i++) crossing.update(50);
    crossing.damage(threshold - 0.1); crossing.update(120);
    assert.equal(crossing.candles[crossing.shown - 1].crash, threshold);
    near(crossing.formation, 0.5);
    crossing.update(120); near(crossing.formation, 1);
}

// Anchor prices and realistic OHLC invariants must hold across different seeds
// and frame/shot batching, not only the default visual sample.
const entry = JSON.stringify(new WojakChartHistory().candles);
const complete = history => { history.damage(-99.9); return history.candles; };
for (let seed = 1; seed <= 100; seed++) {
    const history = new WojakChartHistory(seed), stepped = new WojakChartHistory(seed);
    assert.equal(JSON.stringify(history.candles), entry, 'seed cannot change the approved pump');
    for (const [portfolio, price] of [[25, 120], [0, 106], [-30, 76], [-70, 14], [-99.9, 0]]) {
        history.damage(portfolio);
        near(history.candles[history.candles.length - 1].close, price);
    }
    for (let value = 50; value >= -99; value--) stepped.damage(value);
    stepped.damage(-99.899); assert(stepped.candles[stepped.candles.length - 1].close > 0);
    stepped.damage(-99.9);
    assert.equal(JSON.stringify(stepped.candles), JSON.stringify(history.candles), 'shot batching cannot change the path');
    const candles = history.candles;
    candles.forEach((c, i) => {
        assert(c.high >= Math.max(c.open, c.close));
        assert(c.low <= Math.min(c.open, c.close) && c.low >= 0);
        assert([c.open, c.close, c.high, c.low].every(Number.isFinite));
        if (i) near(c.open, candles[i - 1].close);
        if (i > 4) assert(c.portfolio < candles[i - 1].portfolio);
    });
    assert.equal(candles.filter(c => c.crash).length, 2);
    for (const [upper, lower] of [[25, 0], [0, -30], [-30, -70]]) {
        const phase = candles.filter(c => !c.crash && c.portfolio < upper && c.portfolio >= lower);
        const green = phase.filter(c => c.close > c.open);
        const red = phase.filter(c => c.close < c.open);
        assert(green.length >= 1 && red.length > green.length, 'declines contain rebounds but remain predominantly red');
        assert(new Set(phase.map(c => (c.high - Math.max(c.open, c.close)).toFixed(5))).size > 1);
    }
    const bleed = candles.filter(c => c.portfolio < -70);
    const recoveries = bleed.filter(c => c.close > c.open);
    assert(recoveries.length >= 1);
    if (recoveries.length > 1) assert(recoveries[recoveries.length - 1].close - recoveries[recoveries.length - 1].open <
        recoveries[0].close - recoveries[0].open, 'late recovery attempts weaken');
    assert(Math.abs(bleed[bleed.length - 1].open - bleed[bleed.length - 1].close) < 2);
    const gaps = candles.slice(5).map((c, i) => candles[i + 4].portfolio - c.portfolio);
    assert(new Set(gaps).size > 2, 'damage intervals are irregular, not a repetitive candle schedule');
}
assert.notEqual(JSON.stringify(complete(new WojakChartHistory(1))),
    JSON.stringify(complete(new WojakChartHistory(2))), 'different seeds produce different price action');

for (const direction of ['left', 'right']) {
    for (const monitor of WojakMonitors[direction]) {
        [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([x, y], i) => {
            const p = projectChartPoint(monitor.quad, x, y);
            near(p.x, monitor.quad[i].x); near(p.y, monitor.quad[i].y);
        });
        const clip = monitor.clip;
        clip.forEach((a, i) => {
            const b = clip[(i + 1) % clip.length], c = clip[(i + 2) % clip.length];
            assert((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) >= 0, 'convex clockwise glass clip');
        });
        const result = clipChartPolygon([{ x: 0, y: 0 }, { x: 1536, y: 0 },
            { x: 1536, y: 1024 }, { x: 0, y: 1024 }], clip);
        result.forEach(p => clip.forEach((a, i) => {
            const b = clip[(i + 1) % clip.length];
            assert((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-7);
        }));
    }
}
let shapes = [], current, color;
const graphics = {
    setDepth(v) { this.depth = v; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setScale(v) { this.scale = v; return this; },
    clear() { shapes = []; return this; },
    fillStyle(v) { color = v; return this; }, beginPath() { current = []; return this; },
    moveTo(x, y) { current.push([x, y]); return this; },
    lineTo(x, y) { current.push([x, y]); return this; }, closePath() { return this; },
    fillPath() { shapes.push({ color, points: current }); return this; },
    destroy() { this.destroyed = true; }
};
const charts = new WojakCharts({ add: { graphics: () => graphics } });
const previews = [];
for (const direction of ['right', 'left']) {
    for (const value of [50, 25, 0, -15, -30, -50, -70, -85, -99.9, 'REKT']) {
        const history = new WojakChartHistory(); history.damage(value === 'REKT' ? -99.9 : value);
        for (let i = 0; i < 200; i++) history.update(50);
        if (value === 'REKT') history.freeze();
        Object.assign(charts.history, history);
        const before = JSON.stringify(charts.history);
        charts.sync(120, 80, 0.22, direction);
        assert.equal(JSON.stringify(charts.history), before, 'drawing both monitors never advances the shared model');
        assert.equal(shapes.filter(s => s.color === 0x08121c).length, 2);
        assert(shapes.length >= 18);
        let monitorIndex = -1;
        shapes.forEach(shape => {
            if (shape.color === 0x08121c) monitorIndex++;
            const clip = WojakMonitors[direction][monitorIndex].clip;
            shape.points.forEach(([x, y]) => clip.forEach((a, i) => {
                const b = clip[(i + 1) % clip.length];
                assert((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= -1e-6,
                    'every rendered vertex stays inside its glass boundary');
            }));
        });
        previews.push({ direction, value, shapes });
        near(graphics.x, 120); near(graphics.y, 80); near(graphics.scale, 0.22);
        charts.sync(190, 73, 0.22, direction);
        near(graphics.x, 190); near(graphics.y, 73);
    }
}
charts.destroy(); assert(graphics.destroyed);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(previews));
console.log('PASS: 100 seeded OHLC paths, preserved pump, red-majority phases with rebounds/consolidation, varied wicks and damage intervals, anchored crashes, fractional zero endpoint, batching equivalence, animation/idle/freeze, perspective/clipping/movement/cleanup.');
