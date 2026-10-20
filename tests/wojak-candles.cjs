// Run with: node tests/wojak-candles.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
    const filename = path.resolve(__dirname, '..', relative);
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 }
    }).outputText, { module, exports: module.exports,
        Phaser: { Scene: class {}, Physics: { Arcade: { Sprite: class {} } } },
        require: name => load(path.relative(path.resolve(__dirname, '..'),
            path.resolve(path.dirname(filename), name + '.ts'))) }, { filename });
    return module.exports;
}
const { CandleSettings: settings, CandlePhases: phases, CandleAssets: assets,
    candlePhase, weightedCandleChoice: choose, WojakCandles } = load('src/interface/wojak-candles.ts');
const { WojakBoss, WojakPhase, WojakLayers, WojakSettings, WojakWeaponRegistration } = load('src/interface/wojak-boss.ts');
const { WojakTears, TearSettings, TearAsset, tearPhase, tearRotation } = load('src/interface/wojak-tears.ts');
const { MainScene } = load('src/scenes/main.ts');
const { GameState } = load('src/interface/game-state.ts');

for (const [value, expected] of [[50, undefined], [25.001, undefined], [25, 'B'],
    [0.001, 'B'], [0, 'C'], [-29.999, 'C'], [-30, 'D'], [-69.999, 'D'], [-70, 'E'], [-99.9, 'E']]) {
    assert.equal(candlePhase(value)?.name, expected);
}
for (const phase of phases) {
    assert.equal(phase.sizes.reduce((a, b) => a + b), 100);
    assert.equal(phase.patterns.reduce((a, b) => a + b), 100);
    for (const weights of [phase.sizes, phase.patterns]) {
        const counts = weights.map(() => 0);
        for (let i = 0; i < 10000; i++) counts[choose(weights, () => (i + 0.5) / 10000)]++;
        assert.deepEqual(counts, Array.from(weights, weight => weight * 100));
    }
}
assert.deepEqual(Array.from(phases[0].sizes), [50, 35, 15, 0, 0]);
assert.deepEqual(Array.from(phases[0].patterns), [100, 0, 0]);
assert.deepEqual(Array.from(phases, p => p.interval), [1500, 1200, 1000, 800]);
assert.deepEqual(Array.from(phases, p => Array.from(p.sizes)),
    [[50, 35, 15, 0, 0], [30, 25, 20, 15, 10], [15, 20, 25, 25, 15], [5, 10, 20, 30, 35]]);
assert.deepEqual(Array.from(phases, p => Array.from(p.patterns)),
    [[100, 0, 0], [65, 20, 15], [45, 30, 25], [30, 35, 35]]);

function harness(random = () => 0.5, width = 800) {
    const images = [];
    const scene = { physics: { world: { bounds: { left: 0, top: 0, right: width, bottom: 600 } } },
        add: { image(x, y, key) {
            const sprite = { x, y, key, active: true,
                setOrigin(x, y) { this.origin = [x, y]; return this; },
                setScale(scale) { this.scale = scale; return this; },
                setDepth() { return this; }, destroy() { this.active = false; } };
            images.push(sprite); return sprite;
        } } };
    const player = { active: true, body: { left: 380, right: 420, width: 40, top: 528, bottom: 570 } };
    const emitter = { left: 230, right: 564, y: 303 };
    const weapon = new WojakCandles(scene, random);
    let hits = 0;
    const update = (delta, portfolio = -70, enabled = true, spawnY = emitter.y) => {
        emitter.y = spawnY;
        weapon.update(delta, portfolio, enabled, emitter, player, () => hits++);
    };
    const advance = (ms, portfolio = -70) => {
        while (ms > 0) { const step = Math.min(50, ms); update(step, portfolio); ms -= step; }
    };
    return { weapon, scene, player, emitter, images, update, advance, hits: () => hits };
}

let h = harness(() => 0);
h.advance(10000, 50); assert.equal(h.images.length, 0);
h.advance(1499, 25); assert.equal(h.images.length, 0);
h.advance(1, 25); assert.equal(h.images.length, 1);
h.update(100000, 25); assert.equal(h.images.length, 1, 'resume never catches up missed intervals');
h.advance(1499, 25); assert.equal(h.images.length, 1);
h.advance(1, 25); assert.equal(h.images.length, 2);
h.update(0, 0); h.advance(1199, 0); assert.equal(h.images.length, 2);
h.advance(1, 0); assert.equal(h.images.length, 3, '0% immediately switches to C cadence');

// Force rain and size 5, including the longest sprite at both hover extremes.
// Premium multipliers change only permission intervals, never pending rain or flight delta.
{
    const premium = harness(() => .99);
    const tick = delta => premium.weapon.update(delta, -70, true, premium.emitter, premium.player, () => {}, 2);
    tick(200); assert.equal(premium.images.length, 0);
    tick(200); assert.equal(premium.images.length, 1);
    assert.deepEqual(Array.from(premium.weapon.pending, p => p.delay), [250, 500]);
    const y = premium.images[0].y;
    tick(100);
    assert.equal(premium.images[0].y - y, 16, 'flight still moves at 160 px/s');
    assert.deepEqual(Array.from(premium.weapon.pending, p => p.delay), [150, 400], 'rain delay uses real time');
    tick(150); assert.equal(premium.images.length, 2, 'second rain drop after real 250 ms');
    const pending = JSON.stringify(premium.weapon.pending);
    premium.weapon.elapsed = 9999;
    premium.weapon.update(0, -30, true, premium.emitter, premium.player, () => {}, 1.5);
    assert.equal(premium.weapon.elapsed, 0, 'new phase discards stale cooldown');
    assert.equal(JSON.stringify(premium.weapon.pending), pending, 'new phase preserves pending rain');
    assert.equal(premium.images.length, 2, 'phase change does not burst');
}
for (const spawnY of [289, 303]) {
    h = harness(() => 0.99);
    for (let i = 0; i < 4; i++) h.update(200, -70, true, spawnY);
    assert.equal(h.images.length, 1); assert.equal(h.weapon.pending.length, 2);
    assert(h.images.every(image => image.key === assets[4].asset));
    const pending = JSON.stringify(h.weapon.pending);
    h.update(0, -30); assert.equal(JSON.stringify(h.weapon.pending), pending, 'phase change preserves rain');
    h.update(249, -30); assert.equal(h.images.length, 1);
    h.update(1, -30); assert.equal(h.images.length, 2);
    h.update(250, -30); assert.equal(h.images.length, 3);
    assert.equal(h.weapon.pending.length, 0);
    assert.notEqual(h.images[0].x, h.images[1].x, 'rain alternates sides');
    assert(h.images.every(image => image.scale === settings.scale));
    h.update(1, -30, false); assert(h.images.every(image => !image.active));
    h.advance(500); assert.equal(h.images.filter(i => i.active).length, 0);
}

// Pattern intervals remain independent of rain and suspension.
h = harness(() => 0.99); h.advance(800);
h.update(10000); assert.equal(h.images.length, 1); assert.equal(h.weapon.pending.length, 2);
h.advance(249); assert.equal(h.images.length, 1, 'suspension preserves remaining rain delay');
h.advance(251); assert.equal(h.images.length, 3);
h.advance(299); assert.equal(h.images.length, 3);
h.advance(1); assert.equal(h.images.length, 4, '800ms interval starts patterns independently of rain');

for (const roll of [0, 0.4, 0.7, 0.99]) {
    h = harness(() => roll);
    for (let i = 0; i < 160; i++) {
        h.update(50);
        for (const image of h.images.filter(i => i.active)) {
            assert(image.x - 160 * settings.scale / 2 >= settings.edgeMargin);
            assert(image.x + 160 * settings.scale / 2 <= 800 - settings.edgeMargin);
            assert(image.x - 160 * settings.scale / 2 >= h.emitter.left);
            assert(image.x + 160 * settings.scale / 2 <= h.emitter.right);
        }
    }
}
h = harness();
const gap = h.weapon.plan('gap', phases[3].sizes, 40, h.emitter);
assert.equal(gap.length, 2); assert.equal(gap[0].delay, 0); assert.equal(gap[1].delay, 0);
gap.forEach(drop => h.weapon.spawn(drop, h.emitter, 528));
assert(Math.abs(h.images[0].x - h.images[1].x) - 160 * settings.scale >= settings.safeGap);
h = harness(() => 0, 220);
assert.equal(h.weapon.plan('rain', phases[3].sizes, 40, { left: 30, right: 200, y: 303 }).length, 1, 'narrow pattern falls back to single');

// Swept body contact, transparent padding, offscreen cleanup and one hit/drop.
h = harness(() => 0);
h.weapon.spawn({ size: 0, position: 0.5, delay: 0 }, h.emitter, 528);
h.advance(1600, 50); // Phase A cancels every active projectile.
assert.equal(h.hits(), 0); assert(!h.images[0].active);
h = harness(() => 0);
h.weapon.phase = phases[3];
h.weapon.spawn({ size: 0, position: 0.5, delay: 0 }, h.emitter, 528);
h.images[0].y = 495;
h.update(100); assert.equal(h.hits(), 1); h.update(100); assert.equal(h.hits(), 1);
h.weapon.spawn({ size: 0, position: 0, delay: 0 }, h.emitter, 528);
h.images[1].y = 510; h.update(100); assert.equal(h.hits(), 1, 'transparent sides do not collide');
h.images[1].y = 601; h.update(0); assert(!h.images[1].active);
h.weapon.spawn({ size: 4, position: 0, delay: 0 }, { ...h.emitter, y: 450 }, 528);
assert.equal(h.images.length, 2, 'unsafe spawn near player is rejected');

// Lifecycle cancellation is synchronous with the final boss hit and removal.
h = harness(() => 0.99); h.advance(800);
const boss = new WojakBoss(h.scene);
boss.candles = h.weapon; boss.sprite = { active: true, destroy() {} };
boss.phase = WojakPhase.Patrol; boss.portfolio = -99;
boss.updatePercentage = boss.syncLayers = boss.updateFlash = boss.beginPump = () => {};
assert(boss.hit()); assert.equal(boss.portfolio, -99.9);
assert.equal(boss.phase, WojakPhase.Complete);
assert.equal(h.weapon.pending.length, 0); assert(h.images.every(i => !i.active));
boss.clear(); h.update(100, -70, false); assert.equal(h.weapon.pending.length, 0);

// Ship registration follows the real source origin/scale in either direction.
const near = (a, b) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
for (const direction of [1, -1]) {
    const layer = direction > 0 ? WojakLayers.right : WojakLayers.left;
    const registration = WojakWeaponRegistration[direction > 0 ? 'right' : 'left'];
    const geometryBoss = new WojakBoss(h.scene);
    geometryBoss.direction = direction; geometryBoss.portfolio = -30;
    geometryBoss.sprite = { x: 400, y: 255, scaleX: WojakSettings.displayScale, scaleY: WojakSettings.displayScale,
        displayOriginX: layer.anchorX, displayOriginY: layer.anchorY };
    const first = geometryBoss.weaponGeometry();
    near(first.candles.left, 400 + (registration.shipLeft - layer.anchorX) * 0.22);
    near(first.candles.right, 400 + (registration.shipRight - layer.anchorX) * 0.22);
    near(first.candles.y, 255 + (registration.undersideY - layer.anchorY) * 0.22);
    geometryBoss.sprite.x += 70; geometryBoss.sprite.y -= 7;
    const moved = geometryBoss.weaponGeometry();
    near(moved.candles.left - first.candles.left, 70); near(moved.candles.right - first.candles.right, 70);
    near(moved.candles.y - first.candles.y, -7);
    near(moved.tears.x - first.tears.x, 70); near(moved.tears.y - first.tears.y, -7);
    assert(first.tears.x > first.candles.left && first.tears.x < first.candles.right);
    assert(first.tears.y < first.candles.y);
    geometryBoss.portfolio = -70;
    assert.notEqual(geometryBoss.weaponGeometry().tears.x, moved.tears.x, 'crying pose has a registered eye offset');

    const movingRain = harness(() => 0.99);
    Object.assign(movingRain.emitter, first.candles);
    movingRain.advance(800);
    const emitted = movingRain.images[0];
    const fixedX = emitted.x;
    Object.assign(movingRain.emitter, moved.candles);
    movingRain.advance(250);
    assert.equal(emitted.x, fixedX, 'released candle never follows the ship');
    const second = movingRain.images[1];
    assert(second.x >= moved.candles.left && second.x <= moved.candles.right);
    const pending = movingRain.weapon.pending[0];
    const half = 160 * settings.scale / 2;
    const expectedThirdX = moved.candles.left + half + pending.position *
        (moved.candles.right - moved.candles.left - half * 2);
    movingRain.advance(250); near(movingRain.images[2].x, expectedThirdX);
    near(second.y + settings.visibleTop * settings.scale,
        moved.candles.y + settings.releaseGap + settings.speed * 0.25);
}

// Tears exercise the installed Phaser Body implementation, including scaled
// circles, transform registration, movement, and circular contact geometry.
const ArcadeBody = require('phaser/src/physics/arcade/Body');
const circleToRectangle = require('phaser/src/geom/intersects/CircleToRectangle');
function tearHarness() {
    const sprites = [];
    const world = { defaults: {}, bounds: { left: 0, top: 0, right: 800, bottom: 600 },
        updateMotion() {} };
    const scene = { physics: { world, add: { sprite(x, y, key) {
        const sprite = { x, y, key, width: 1536, height: 1024, active: true, scaleX: 1, scaleY: 1,
            rotation: 0, originX: 0.5, originY: 0.5,
            get angle() { return this.rotation * 180 / Math.PI; },
            get displayOriginX() { return this.width * this.originX; },
            get displayOriginY() { return this.height * this.originY; },
            setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
            setScale(scale) { this.scaleX = this.scaleY = scale; return this; },
            setDepth(depth) { this.depth = depth; return this; },
            setRotation(rotation) { this.rotation = rotation; return this; },
            setVelocity(x, y) { this.body.velocity.set(x, y); return this; },
            setPosition(x, y) { this.x = x; this.y = y; return this; },
            getBounds() { // Rotated canvas bounding rectangle, as Phaser uses.
                const corners = [[0, 0], [this.width, 0], [0, this.height], [this.width, this.height]];
                const points = corners.map(([x, y]) => {
                    const dx = (x - this.displayOriginX) * this.scaleX;
                    const dy = (y - this.displayOriginY) * this.scaleY;
                    return { x: this.x + dx * Math.cos(this.rotation) - dy * Math.sin(this.rotation),
                        y: this.y + dx * Math.sin(this.rotation) + dy * Math.cos(this.rotation) };
                });
                return { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
                    top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
            },
            destroy() { this.active = false; this.body.enable = false; }
        };
        sprite.body = new ArcadeBody(world, sprite);
        sprites.push(sprite); return sprite;
    } }, moveToObject(sprite, target, speed) {
        const angle = Math.atan2(target.y - sprite.y, target.x - sprite.x);
        sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed); return angle;
    }, overlap(sprite, player) {
        const b = sprite.body, p = player.body;
        return circleToRectangle({ x: b.center.x, y: b.center.y, radius: b.halfWidth },
            { x: p.left, y: p.top, width: p.right - p.left, height: p.bottom - p.top });
    } } };
    const player = { x: 400, y: 550, active: true,
        body: { left: 380, right: 420, top: 528, bottom: 572 } };
    const emitter = { x: 410, y: 173 };
    const weapon = new WojakTears(scene);
    let hits = 0;
    const update = (delta, portfolio = -30, enabled = true) =>
        weapon.update(delta, portfolio, enabled, emitter, player, () => hits++);
    const advance = (ms, portfolio = -30) => {
        while (ms > 0) { const delta = Math.min(50, ms); update(delta, portfolio); ms -= delta; }
    };
    return { weapon, player, emitter, sprites, update, advance, hits: () => hits };
}
for (const [portfolio, expected] of [[50, undefined], [25, undefined], [0, undefined],
    [-29.999, undefined], [-30, 'single'], [-69.999, 'single'], [-70, 'spread'], [-99.9, 'spread']]) {
    assert.equal(tearPhase(portfolio), expected);
}
let tears = tearHarness();
tears.advance(10000, -29.999); assert.equal(tears.sprites.length, 0);
tears.advance(3499); assert.equal(tears.sprites.length, 0);
tears.advance(1); assert.equal(tears.sprites.length, 1);
let tear = tears.sprites[0];
near(Math.hypot(tear.body.velocity.x, tear.body.velocity.y), 120);
near(tear.body.width, 500 * 32 / 1120); assert(tear.body.isCircle);
near(tear.body.height, 500 * 32 / 1120);
near(tear.scaleX, 32 / 1120 * 0.7);
near(tear.width * tear.scaleX, 1536 * 32 / 1120 * 0.7);
near(tear.height * tear.scaleY, 1024 * 32 / 1120 * 0.7);
const originalCenterOffset = Math.floor(250 * 32 / 1120) - 250 * 32 / 1120;
near(tear.body.center.x, tear.x + originalCenterOffset);
near(tear.body.center.y, tear.y + originalCenterOffset);
near(tear.scaleX, tear.scaleY);
const central = Math.atan2(tears.player.y - tears.emitter.y, tears.player.x - tears.emitter.x);
near(Math.atan2(tear.body.velocity.y, tear.body.velocity.x), central);
near(tear.rotation, tearRotation());
const sourcePointAngle = Math.atan2(TearSettings.tipY - TearSettings.bulbY, TearSettings.tipX - TearSettings.bulbX);
near(sourcePointAngle + tear.rotation, -Math.PI / 2, 'tip points straight up');
near(tear.x, tears.emitter.x); near(tear.y, tears.emitter.y);
const velocity = { x: tear.body.velocity.x, y: tear.body.velocity.y };
const startX = tear.x, startY = tear.y;
tears.player.x += 100; tears.emitter.x -= 100;
tear.body.preUpdate(true, 0.1); tear.body.postUpdate();
near(tear.x, startX + velocity.x * 0.1); near(tear.y, startY + velocity.y * 0.1);
near(tear.body.center.x, tear.x + originalCenterOffset);
near(tear.body.center.y, tear.y + originalCenterOffset);
tears.update(100); near(tear.body.velocity.x, velocity.x); near(tear.body.velocity.y, velocity.y);
near(tear.rotation, tearRotation());
tears.update(0, -70); tears.advance(2499, -70); assert.equal(tears.sprites.length, 1);
tears.advance(1, -70); assert.equal(tears.sprites.length, 4);
const spread = tears.sprites.slice(1);
const newCentral = Math.atan2(tears.player.y - tears.emitter.y, tears.player.x - tears.emitter.x);
spread.forEach((sprite, i) => {
    const angle = newCentral + (i - 1) * 15 * Math.PI / 180;
    near(Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x), angle);
    near(Math.hypot(sprite.body.velocity.x, sprite.body.velocity.y), 120);
    near(sprite.rotation, tearRotation());
    near(sourcePointAngle + sprite.rotation, -Math.PI / 2);
    near(sprite.x, tears.emitter.x); near(sprite.y, tears.emitter.y);
});
tears.update(100000, -70); assert.equal(tears.sprites.length, 4, 'no pause catchup');
tears.advance(2499, -70); assert.equal(tears.sprites.length, 4);
tears.advance(1, -70); assert.equal(tears.sprites.length, 7);
tear.setPosition(400, 550); tear.body.preUpdate(false, 0);
tears.update(0, -70); assert.equal(tears.hits(), 1); assert(!tear.active);
tears.update(0, -70); assert.equal(tears.hits(), 1, 'tear consumed once');
for (const [x, y] of [[-100, 200], [900, 200], [400, -100], [400, 700]]) {
    const sprite = tears.sprites.find(s => s.active);
    sprite.setPosition(x, y); sprite.body.preUpdate(false, 0);
    tears.update(0, -70); assert(!sprite.active, 'offscreen tear removed');
}
tears.update(0, -70, false); assert(tears.sprites.every(s => !s.active));
tears.advance(1000, -70); assert.equal(tears.weapon.flights.length, 0);
tears = tearHarness(); Object.assign(tears.emitter, tears.player);
tears.advance(3500); assert.equal(tears.sprites.length, 0, 'no tears inside player');
tears = tearHarness(); tears.advance(3500);
const endBoss = new WojakBoss(tears.weapon.scene);
endBoss.tears = tears.weapon; endBoss.sprite = { active: true, destroy() {} };
endBoss.phase = WojakPhase.Patrol; endBoss.portfolio = -99;
endBoss.updatePercentage = endBoss.syncLayers = endBoss.updateFlash = endBoss.beginPump = () => {};
endBoss.hit(); assert(tears.sprites.every(s => !s.active), 'boss defeat clears tears synchronously');
endBoss.clear(); assert.equal(tears.weapon.elapsed, 0);

// Upright artwork is independent of target direction, spread, and flight time.
for (const target of [{ x: 700, y: 550 }, { x: 100, y: 550 }, { x: 400, y: 50 }]) {
    const h = tearHarness();
    Object.assign(h.player, target);
    h.weapon.spawn(h.emitter, h.player, 0);
    const sprite = h.sprites[0];
    const aim = Math.atan2(target.y - h.emitter.y, target.x - h.emitter.x);
    near(Math.atan2(sprite.body.velocity.y, sprite.body.velocity.x), aim);
    near(sourcePointAngle + sprite.rotation, -Math.PI / 2);
    sprite.body.preUpdate(true, 0.1); sprite.body.postUpdate();
    near(sourcePointAngle + sprite.rotation, -Math.PI / 2);
    h.weapon.clear();
}

// Visual-only reduction preserves contact at the old circle's edge, even outside
// the smaller visible bulb, and retains the old offscreen cleanup boundary.
for (const direction of [-1,1]) {
    const h = tearHarness(); h.weapon.spawn(h.emitter,h.player,0);
    const sprite = h.sprites[0];
    sprite.setPosition(h.player.body[direction < 0 ? 'left' : 'right'] +
        direction * (sprite.body.halfWidth-0.1) - originalCenterOffset,550);
    sprite.body.preUpdate(false,0);
    h.update(0); assert.equal(h.hits(),1,'original circle still damages at its edge');
    h.update(0); assert.equal(h.hits(),1,'single tear damage');
}
{
    const h=tearHarness(); h.weapon.spawn(h.emitter,h.player,0);
    const sprite=h.sprites[0], art=sprite.getBounds();
    const oldRight=(art.right-sprite.x)/0.7;
    sprite.setPosition(-oldRight+0.5,200); sprite.body.preUpdate(false,0);
    assert(sprite.getBounds().right<0,'smaller art is already offscreen');
    h.update(0); assert(sprite.active,'original collision lifetime retained');
    sprite.x-=1; sprite.body.preUpdate(false,0);
    h.update(0); assert(!sprite.active,'cleanup at the original offscreen boundary');
}

const preload = new MainScene(), loaded = [];
preload.sound = {}; preload.load = { setBaseURL() {}, image(key, file) { loaded.push([key, file]); },
    spritesheet() {}, audio() {} };
preload.preload(); assert(loaded.some(([key, file]) => key === TearAsset.asset && file === TearAsset.path));
const tearPng = fs.readFileSync(path.resolve(__dirname, '../assets', TearAsset.path));
assert.equal(tearPng.readUInt32BE(16), TearSettings.sourceWidth);
assert.equal(tearPng.readUInt32BE(20), TearSettings.sourceHeight);

// Boss damage uses the same life removal, sound and feedback as normal combat.
const main = new MainScene();
let lives = 3, sounds = 0, flashes = 0;
main.state = GameState.BossEncounter; main.player = { active: true };
main.scoreManager = { lives: { getFirstAlive: () => ({ setActive() { lives--; return this; }, setVisible() { return this; } }) }, noMoreLives: false };
main.sound = { play() { sounds++; } }; main.damageFeedback = { show() { flashes++; } };
main._damagePlayer(); assert.equal(lives, 2); assert.equal(sounds, 1); assert.equal(flashes, 1);
main.state = GameState.WaveTransition; main._damagePlayer(); assert.equal(lives, 2);

assets.forEach((asset, i) => {
    const png = fs.readFileSync(path.resolve(__dirname, '../assets', asset.path));
    assert.equal(png.readUInt32BE(16), asset.width); assert.equal(png.readUInt32BE(20), asset.height);
    if (i) assert(asset.height > assets[i - 1].height);
});
console.log('PASS: candle phases/probabilities/cadence, ship-bound releases in both directions, moving staggered rain, fixed flight X, gaps, collision, tear thresholds/cadence/spread, one-time aiming, rotation, real Arcade bodies/movement, cleanup and boss cancellation.');
