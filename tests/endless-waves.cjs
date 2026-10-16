// Run with: node tests/endless-waves.cjs (uses the existing TypeScript dependency).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const testDocument = { createElement() {
    let image;
    return { getContext: () => ({
        drawImage(source) { image = source; },
        getImageData: () => ({ data: image.pixels })
    }) };
} };

class Sprite {
    constructor(scene, x = 0, y = 0, texture) {
        const size = texture === 'alien' ? [337, 282] : texture === 'ship' ? [335, 320] : [32, 32];
        Object.assign(this, { scene, active: true, x, y, width: size[0], height: size[1],
            texture: { key: texture || 'ship' }, textureChanges: 0,
            originX: 0.5, originY: 0.5, scaleX: 1, scaleY: 1 });
        const sprite = this;
        this.body = {
            sourceWidth: size[0], sourceHeight: size[1], offsetX: 0, offsetY: 0,
            setSize(width, height) { this.sourceWidth = width; this.sourceHeight = height; },
            setOffset(x, y) { this.offsetX = x; this.offsetY = y; },
            preUpdate() {},
            get top() { return sprite.y + sprite.scaleY * (this.offsetY - sprite.originY * sprite.height); },
            get bottom() { return this.top + this.sourceHeight * sprite.scaleY; },
            reset: (x, y) => {
            this.setPosition(x, y);
            this.collisionX = x;
            this.collisionY = y;
        } };
    }
    disableBody() { this.active = false; return this; }
    enableBody(reset, x, y) { this.active = true; this.x = x; this.y = y; return this; }
    setVelocity(x, y) { this.velocityX = x; this.velocityY = y; return this; }
    setVelocityX(x) { this.velocityX = x; return this; }
    setVelocityY(y) { this.velocityY = y; return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setTexture(key) { this.texture.key = key; this.textureChanges++; return this; }
    setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; }
    setDisplaySize(width, height) { this.scaleX = width / this.width; this.scaleY = height / this.height; return this; }
    preUpdate() {}
    get top() { return this.getBounds().top; }
    get displayOriginX() { return this.originX * this.width; }
    get displayOriginY() { return this.originY * this.height; }
    setImmovable() { return this; }
    getBounds() {
        const left = this.x - this.width * this.scaleX * this.originX;
        const top = this.y - this.height * this.scaleY * this.originY;
        return { left, right: left + this.width * this.scaleX,
            top, bottom: top + this.height * this.scaleY };
    }
    setX(x) { this.x = x; return this; }
    setY(y) { this.y = y; return this; }
    play() { return this; }
    destroy() { this.destroyed = true; this.active = false; }
}
const Phaser = {
    Scene: class {},
    Physics: { Arcade: { Sprite } },
    Math: { RND: { integerInRange: (min, max) => max } }
};
const cache = new Map();
function load(relative) {
    const filename = path.resolve(__dirname, '..', relative);
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    cache.set(filename, module.exports);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015 }
    }).outputText;
    vm.runInNewContext(code, {
        module, exports: module.exports, Phaser, document: testDocument,
        require: name => load(path.relative(path.resolve(__dirname, '..'),
            path.resolve(path.dirname(filename), name + '.ts')))
    }, { filename });
    return module.exports;
}
const { MainScene } = load('src/scenes/main.ts');
const { GameState } = load('src/interface/game-state.ts');
const { ScoreManager } = load('src/interface/manager/score-manager.ts');
const { AlienManager } = load('src/interface/manager/alien-manager.ts');
const { AssetManager } = load('src/interface/manager/asset-manager.ts');
const { Bullet } = load('src/interface/bullet.ts');
const { EnemyBullet } = load('src/interface/enemy-bullet.ts');
const { Alien } = load('src/interface/alien.ts');
const { MemeSkins, PlayerPoses, PlayerCanvas, visibleImageBounds, preparePlayerPoses, applySkin, applySkinAppearance } = load('src/interface/skins.ts');
const { Ship } = load('src/interface/ship.ts');

// Skin textures are standalone PNGs, with collision boxes inside their artwork.
const textureRequests = [];
const preloadScene = new MainScene();
preloadScene.sound = {};
preloadScene.load = {
    setBaseURL(url) { this.baseURL = url; },
    image(asset, url) { textureRequests.push({ asset, url }); },
    spritesheet(asset, url) { assert.equal(asset, 'kaboom', 'only explosions use a sprite sheet'); },
    audio() {}
};
preloadScene.preload();
for (const skin of Object.values(MemeSkins)) {
    const asset = skin === MemeSkins.Player ? `${skin.asset}-source` : skin.asset;
    assert(textureRequests.some(request => request.asset === asset && request.url === skin.path));
    const png = fs.readFileSync(path.resolve(__dirname, '../assets', skin.path));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const width = skin === MemeSkins.Player ? PlayerCanvas.width : png.readUInt32BE(16);
    const height = skin === MemeSkins.Player ? PlayerCanvas.height : png.readUInt32BE(20);
    assert(skin.hitbox.x >= 0 && skin.hitbox.y >= 0);
    assert(skin.hitbox.x + skin.hitbox.width <= width);
    assert(skin.hitbox.y + skin.hitbox.height <= height);
    const sprite = new Sprite({}, 400, 500, skin.asset);
    applySkin(sprite, skin);
    nearSkin(sprite.getBounds().right - sprite.getBounds().left, skin.displayWidth);
    nearSkin(sprite.scaleX, sprite.scaleY);
    nearSkin(sprite.body.bottom - sprite.body.top, skin.hitbox.height * sprite.scaleY);
    assert(sprite.body.top > sprite.getBounds().top);
    assert(sprite.body.bottom < sprite.getBounds().bottom, 'glow/thrusters excluded from collisions');
}
function nearSkin(actual, expected) { assert(Math.abs(actual - expected) < 1e-7); }
const lifeIcon = new Sprite({}, 0, 0, 'ship');
applySkinAppearance(lifeIcon, MemeSkins.Player, 24);
nearSkin(lifeIcon.getBounds().right - lifeIcon.getBounds().left, 24);
assert(textureRequests.every(request => !request.url.startsWith('/')));
assert.equal(preloadScene.load.baseURL, 'assets/');

// High-resolution replacements have transparent pixels in the old crop regions.
// Locate visible pixels dynamically and normalize all five poses to a fixed canvas.
const sourceImages = new Map();
for (const pose of PlayerPoses) {
    const png = fs.readFileSync(path.resolve(__dirname, '../assets', pose.path));
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    const pixels = new Uint8ClampedArray(width * height * 4);
    const bounds = { x: Math.floor(width * 0.25), y: Math.floor(height * 0.25),
        width: Math.floor(width * 0.5), height: Math.floor(height * 0.5) };
    for (let y = bounds.y; y < bounds.y + bounds.height; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
            pixels[(y * width + x) * 4 + 3] = 255;
        }
    }
    pixels[3] = 1; // Faint glow at the canvas edge should not affect fitting.
    sourceImages.set(`${pose.asset}-source`, { width, height, pixels, bounds });
    assert.deepEqual(visibleImageBounds(pixels, width, height), bounds);
}
assert.throws(() => visibleImageBounds(new Uint8ClampedArray(16), 2, 2), /no visible artwork/);
const prepared = new Map();
const poseScene = { textures: {
    exists: key => prepared.has(key) || sourceImages.has(key),
    get: key => ({ getSourceImage: () => sourceImages.get(key) }),
    createCanvas(key, width, height) {
        const texture = { width, height, draws: [], refreshes: 0,
            context: { drawImage(...args) { texture.draws.push(args); } },
            refresh() { texture.refreshes++; }
        };
        prepared.set(key, texture);
        return texture;
    }
} };
preparePlayerPoses(poseScene);
preparePlayerPoses(poseScene);
assert.throws(() => preparePlayerPoses({ textures: { exists: () => false } }), /Missing DOGE pose texture/);
assert.equal(prepared.size, 5);
for (const pose of PlayerPoses) {
    assert(textureRequests.some(request => request.asset === `${pose.asset}-source` && request.url === pose.path));
    const png = fs.readFileSync(path.resolve(__dirname, '../assets', pose.path));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const image = sourceImages.get(`${pose.asset}-source`);
    const texture = prepared.get(pose.asset);
    assert.equal(texture.width, 335); assert.equal(texture.height, 320);
    assert.equal(texture.draws.length, 1); assert.equal(texture.refreshes, 1);
    const draw = texture.draws[0];
    assert.strictEqual(draw[0], image);
    assert.deepEqual(draw.slice(1, 5), Object.values(image.bounds));
    assert(image.pixels[(draw[2] * image.width + draw[1]) * 4 + 3] > 0, 'crop contains visible artwork');
    const [x, y, width, height] = draw.slice(5);
    assert(x >= 0 && y >= 0 && x + width <= 335 + 1e-7 && y + height <= 320 + 1e-7);
    nearSkin(width / height, image.bounds.width / image.bounds.height);
    nearSkin(x + width / 2, MemeSkins.Player.originX * PlayerCanvas.width);
    nearSkin(y + height * MemeSkins.Player.originY, MemeSkins.Player.originY * PlayerCanvas.height);
}

// Use the installed Phaser Body to verify scaled offsets and no post-update drift.
const ArcadeBody = require('phaser/src/physics/arcade/Body');
for (const skin of Object.values(MemeSkins)) {
    const sprite = new Sprite({}, 400, 500, skin.asset);
    sprite.angle = 0;
    sprite.body = new ArcadeBody({ defaults: {}, bounds: {} }, sprite);
    applySkin(sprite, skin);
    for (let i = 0; i < 40; i++) {
        sprite.body.reset(400 + i, 500 + i);
        sprite.body.preUpdate(false, 0);
        nearSkin(sprite.body.left, sprite.getBounds().left + skin.hitbox.x * sprite.scaleX);
        nearSkin(sprite.body.top, sprite.getBounds().top + skin.hitbox.y * sprite.scaleY);
        nearSkin(sprite.body.width, skin.hitbox.width * sprite.scaleX);
        nearSkin(sprite.body.height, skin.hitbox.height * sprite.scaleY);
        sprite.body.postUpdate();
        nearSkin(sprite.x, 400 + i); nearSkin(sprite.y, 500 + i);
    }
}

// Texture switches leave real Phaser collision geometry, position and velocity alone.
const directionalPlayer = new Sprite({}, 400, 500, 'ship');
directionalPlayer.angle = 0;
directionalPlayer.body = new ArcadeBody({ defaults: {}, bounds: {} }, directionalPlayer);
applySkin(directionalPlayer, MemeSkins.Player);
directionalPlayer.body.velocity.set(200, 0);
const stablePlayerState = () => [directionalPlayer.x, directionalPlayer.y,
    directionalPlayer.scaleX, directionalPlayer.scaleY, directionalPlayer.originX, directionalPlayer.originY,
    directionalPlayer.body.left, directionalPlayer.body.top, directionalPlayer.body.width, directionalPlayer.body.height,
    directionalPlayer.body.velocity.x, directionalPlayer.body.velocity.y];
const initialPlayerState = stablePlayerState();
for (const [direction, key, now] of [
    [-1, 'ship-left', 0], [1, 'ship-turn-right', 10], [1, 'ship-right', 43],
    [-1, 'ship-turn-left', 150], [-1, 'ship-left', 183], [0, 'ship', 184]
]) {
    Ship.setDirection(directionalPlayer, direction, now);
    assert.equal(directionalPlayer.texture.key, key);
    assert.deepEqual(stablePlayerState(), initialPlayerState);
    const switches = directionalPlayer.textureChanges;
    Ship.setDirection(directionalPlayer, direction, now);
    assert.equal(directionalPlayer.textureChanges, switches, 'do not reapply unchanged textures every frame');
}
// Exercise the actual input handler, including left-key precedence and shooting origin.
const inputScene = new MainScene();
inputScene.player = directionalPlayer;
inputScene.cursors = { left: { isDown: false }, right: { isDown: false } };
inputScene.fireKey = { isDown: true };
inputScene.state = GameState.Playing;
inputScene.time = { now: 1000 };
let shotOrigin;
inputScene.assetManager = { bullets: { get: () => ({ shoot(x, y) { shotOrigin = [x, y]; } }) } };
for (const [left, right, key, velocity] of [
    [true, false, 'ship-left', -200], [false, true, 'ship-turn-right', 200],
    [false, false, 'ship', 0], [true, true, 'ship-left', -200]
]) {
    inputScene.cursors.left.isDown = left; inputScene.cursors.right.isDown = right;
    inputScene.time.now += 201;
    inputScene._shipKeyboardHandler();
    assert.equal(directionalPlayer.texture.key, key);
    assert.equal(directionalPlayer.body.velocity.x, velocity);
    assert.deepEqual(shotOrigin, [400, 482], 'poses must not move the projectile origin');
    assert.equal(directionalPlayer.x, 400); assert.equal(directionalPlayer.y, 500);
}

// Consecutive resolved movement, not key-press history, controls reversal poses.
function drive(now, left, right, key) {
    inputScene.time.now = now;
    inputScene.cursors.left.isDown = left; inputScene.cursors.right.isDown = right;
    inputScene._shipKeyboardHandler();
    assert.equal(directionalPlayer.texture.key, key);
    assert.equal(directionalPlayer.body.velocity.x, left ? -200 : right ? 200 : 0);
    assert.equal(directionalPlayer.x, 400); assert.equal(directionalPlayer.y, 500);
    assert.deepEqual(shotOrigin, [400, 482]);
}
drive(2000, false, false, 'ship');
drive(2010, true, false, 'ship-left');
drive(2020, false, false, 'ship');
drive(2030, false, true, 'ship-right');
drive(2040, false, false, 'ship');
drive(2050, true, false, 'ship-left');
drive(2060, false, true, 'ship-turn-right');
drive(2092, false, true, 'ship-turn-right'); // 32 ms: still turning.
drive(2093, false, true, 'ship-right');      // 33 ms: normal movement pose.
drive(2200, true, false, 'ship-turn-left');
drive(2232, true, false, 'ship-turn-left');
drive(2233, true, false, 'ship-left');
// Rapid reversals replace the current visual transition without queuing callbacks.
drive(2340, false, true, 'ship-turn-right');
drive(2360, true, false, 'ship-turn-left');
drive(2380, false, true, 'ship-turn-right');
drive(2410, false, true, 'ship-turn-right'); // Old deadlines cannot override the newest turn.
drive(2413, false, true, 'ship-right');
drive(2520, true, false, 'ship-turn-left');
drive(2530, false, false, 'ship');           // Stopping cancels immediately.
drive(2700, false, false, 'ship');           // No stale turn completion.
drive(2710, false, true, 'ship-right');      // Idle breaks the reversal chain.
drive(2720, true, true, 'ship-turn-left');   // Existing left-key precedence is preserved.
drive(2740, true, false, 'ship-turn-left');  // Releasing right does not restart this turn.
drive(2753, true, false, 'ship-left');
drive(2850, false, false, 'ship');

const scene = new MainScene();
scene.state = GameState.Playing;
scene.player = new Sprite(scene);
scene.starfield = { tilePositionY: 0 };
scene._shipKeyboardHandler = () => {};
scene.time = {
    now: 100,
    delayedCall() { assert.fail('wave progression must not schedule forced missile cleanup'); }
};
const score = Object.create(ScoreManager.prototype);
Object.assign(score, {
    score: 0, highScore: 0, remaining: 3,
    scoreText: { setText() {} }, waveText: { setText(text) { score.waveLabel = text; } },
    line1Text: { setText(text) { score.message = text; } }, line2Text: { setText() {} },
    lives: {
        countActive: () => score.remaining,
        getFirstAlive: () => ({
            setActive() { score.remaining--; return this; }, setVisible() {}
        })
    },
    resetLives() { this.remaining = 3; }
});
scene.scoreManager = score;
let clearCount = 0, stopCount = 0, spawnCount = 0, inOverlap = false;
let enemyClearCount = 0;
let transitionBullets = [];
scene.assetManager = {
    bullets: { get() {
        const bullet = new Bullet(scene);
        Object.assign(bullet, { width: 4, height: 8 });
        transitionBullets.push(bullet);
        return bullet;
    }, countActive: () => transitionBullets.filter(bullet => bullet.active).length,
    getChildren: () => transitionBullets },
    enemyBullets: { clear() { assert(!inOverlap); enemyClearCount++; } },
    explosions: { get: () => new Sprite(scene) },
    gameOver() { assert(!inOverlap); clearCount++; transitionBullets = []; },
    reset() { assert(!inOverlap); clearCount++; transitionBullets = []; }
};
let alive = 40;
let movementUpdates = 0;
scene.alienManager = {
    aliens: { getChildren: () => [] },
    update() { movementUpdates++; return false; },
    get hasAliveAliens() { return alive > 0; },
    stopMovement() { stopCount++; },
    reset(wave) {
        assert(!inOverlap);
        if (wave > 1) {
            assert.equal(scene.assetManager.bullets.countActive(true), 0, 'all active shots must finish before spawning');
        }
        spawnCount++; alive = 40; this.lastWave = wave;
    }
};
scene.sound = { play() {} };
scene.tweens = { killTweensOf() {} };
let finalBullet, finalAlien;
scene.physics = {
    world: { bounds: { left: 0, right: 800, top: 0, bottom: 600 } },
    overlap(group) {
    inOverlap = true;
    if (group === scene.assetManager.bullets.getChildren()) {
        for (let i = 0; i < 40; i++) {
            const bullet = new Sprite(scene);
            const alien = new Alien(scene, 0, 0);
            const kill = alien.kill.bind(alien);
            alien.kill = explosion => { kill(explosion); alive--; };
            scene._bulletHitAliens(bullet, alien);
            assert(!bullet.destroyed && !alien.destroyed);
            finalBullet = bullet;
            finalAlien = alien;
        }
        // A duplicate collision must not score or schedule a second wave.
        scene._bulletHitAliens(finalBullet, finalAlien);
    } else {
        scene._enemyBulletHitPlayer(scene.player, new Sprite(scene));
    }
    inOverlap = false;
} };
scene.firingTimer = Infinity;
const flyingShot = scene.assetManager.bullets.get();
flyingShot.shoot(400, 300);
const trailingShot = scene.assetManager.bullets.get();
trailingShot.shoot(500, 480);
const pooledShot = new Sprite(scene);
pooledShot.active = false;
transitionBullets.push(pooledShot);
scene.update();
assert.equal(scene.state, GameState.WaveTransition);
assert.equal(scene.wave, 1);
assert.equal(score.score, 1400);
assert.equal(score.remaining, 3);
assert.equal(score.message, 'WAVE 2', 'announce the upcoming wave immediately');
assert.equal(scene.nextWaveReadyAt, 1600);
assert.equal(clearCount, 0, 'player missiles must not be cleared');
assert.equal(enemyClearCount, 1);
assert(flyingShot.active && trailingShot.active);
assert.equal(flyingShot.y, 300);
assert.equal(trailingShot.y, 480);
assert.equal(flyingShot.velocityY, -400);
assert(finalBullet.destroyed && finalAlien.destroyed);
assert.equal(spawnCount, 0);
// Movement continues while held Space cannot create any new shots.
scene.player.body = scene.player;
scene.player.x = 400;
scene.player.y = 500;
scene.cursors = { left: { isDown: true }, right: { isDown: false } };
scene.fireKey = { isDown: true };
scene._shipKeyboardHandler = MainScene.prototype._shipKeyboardHandler;
const combatOverlap = scene.physics.overlap;
const updatesBeforeTransition = movementUpdates;
scene.physics.overlap = () => assert.fail('no collision iteration during transition');
scene.update();
assert(scene.player.active);
assert.equal(scene.player.velocityX, -200);
assert.equal(transitionBullets.length, 3);
assert.equal(movementUpdates, updatesBeforeTransition, 'formation does not move during transitions');
scene.cursors.left.isDown = false;
scene.cursors.right.isDown = true;
scene.time.now = 200;
scene.update();
assert.equal(scene.player.velocityX, 200);
assert.equal(transitionBullets.length, 3);
scene.time.now = 301;
scene.update();
assert.equal(transitionBullets.length, 3);
scene.cursors.right.isDown = false;
scene.fireKey.isDown = false;
scene.update();
assert.equal(scene.player.velocityX, 0);
// Enemy shooting and both collision callbacks stay blocked.
scene._enemyFires();
scene._enemyBulletHitPlayer(scene.player, new Sprite(scene));
scene._bulletHitAliens(new Sprite(scene), new Alien(scene, 0, 0));
assert.equal(score.remaining, 3);
assert.equal(score.score, 1400);
// Use actual Bullet.update() to expire shots naturally as physics moves them.
flyingShot.y += flyingShot.velocityY;
trailingShot.y += trailingShot.velocityY;
flyingShot.update();
trailingShot.update();
assert(flyingShot.destroyed);
assert(trailingShot.active);
scene.time.now = 1301;
scene.update();
assert.equal(spawnCount, 0, 'one trailing shot must still block the next wave');
assert.equal(trailingShot.y, 80);
assert.equal(clearCount, 0);
scene.time.now = 1700;
scene.update();
assert.equal(spawnCount, 0, 'elapsed minimum delay is insufficient while a missile remains');
assert.equal(scene.state, GameState.WaveTransition);
assert.equal(score.message, 'WAVE 2', 'announcement remains while waiting beyond 1.5 seconds');
assert(trailingShot.active);
assert.equal(trailingShot.y, 80, 'transition must not alter a flying missile');
trailingShot.y += trailingShot.velocityY * 0.25;
trailingShot.update();
assert(trailingShot.destroyed);
assert.equal(transitionBullets.length, 3, 'inactive group entries remain in this fixture');
scene.time.now = 1800;
scene.fireKey.isDown = true;
scene.cursors.right.isDown = true;
scene.physics.overlap = () => {};
scene.update();
assert.equal(scene.state, GameState.Playing);
assert.equal(scene.wave, 2);
assert.equal(score.waveLabel, 'WAVE 2');
assert.equal(score.message, '', 'hide the centered announcement on spawn');
assert.equal(scene.alienManager.lastWave, 2);
assert.equal(alive, 40);
assert.equal(scene.firingTimer, 3800);
assert.equal(transitionBullets.length, 4, 'holding Space resumes firing on the spawn frame');
assert.equal(scene.player.velocityX, 200);
assert.equal(clearCount, 0);
scene.update();
scene._startNextWave();
assert.equal(spawnCount, 1, 'no duplicate wave spawns');
// End the next wave with no active shots: still wait the full minimum delay.
transitionBullets[3].y = -20;
transitionBullets[3].update();
scene._shipKeyboardHandler = () => {};
scene.physics.overlap = combatOverlap;
scene.update();
assert.equal(scene.state, GameState.WaveTransition);
assert.equal(score.score, 2800);
assert.equal(score.message, 'WAVE 3');
assert.equal(scene.nextWaveReadyAt, 3300);
scene.physics.overlap = () => {};
scene.update();
assert.equal(spawnCount, 1);
scene.time.now = 3299;
scene.update();
assert.equal(scene.state, GameState.WaveTransition);
assert.equal(scene.wave, 2);
assert.equal(spawnCount, 1, 'do not spawn one millisecond before the minimum delay');
assert.equal(score.message, 'WAVE 3');
assert.equal(scene.assetManager.bullets.countActive(true), 0);
scene.time.now = 3300;
scene.update();
assert.equal(scene.wave, 3);
assert.equal(spawnCount, 2);
assert.equal(scene.state, GameState.Playing);
assert.equal(score.message, '');
scene._startNextWave();
scene.update();
assert.equal(spawnCount, 2, 'the deadline cannot spawn the wave twice');

// Three hits end the game; cleanup runs after the collision iteration.
scene.physics.overlap = group => {
    inOverlap = true;
    if (group === scene.assetManager.enemyBullets) {
        for (let i = 0; i < 4; i++) {
            scene._enemyBulletHitPlayer(scene.player, new Sprite(scene));
        }
    }
    inOverlap = false;
};
scene.update();
assert.equal(scene.state, GameState.GameOver);
assert.equal(score.remaining, 0);
assert(!scene.player.active);
const before = clearCount;
scene._enemyFires();
scene._fireBullet();
scene.update();
assert.equal(clearCount, before);
scene.restart();
assert.equal(scene.wave, 1);
assert.equal(score.score, 0);
assert.equal(score.remaining, 3);
assert.equal(score.waveLabel, 'WAVE 1');
assert.equal(scene.player.texture.key, 'ship', 'a fresh game starts in the idle pose');
assert.equal(score.message, '');
assert.equal(scene.nextWaveReadyAt, 0);
assert.equal(scene.player.x, 400);
assert.equal(scene.player.y, 500);
assert(scene.player.active);
assert(stopCount > 0);
// A full restart during draining discards the pending wave and clears shots.
scene.state = GameState.WaveTransition;
const restartShot = scene.assetManager.bullets.get();
restartShot.shoot(400, 300);
scene.restart();
assert.equal(scene.assetManager.bullets.countActive(true), 0);
assert.equal(scene.state, GameState.Playing);
assert.equal(scene.wave, 1);
const spawnsAfterRestart = spawnCount;
scene._startNextWave();
assert.equal(spawnCount, spawnsAfterRestart);

const manager = Object.create(AlienManager.prototype);
let children = [{ active: true }, { active: false }, { active: true }];
manager.aliens = { getChildren: () => children, children: { iterate: fn => children.forEach(fn) } };
assert.strictEqual(manager.getRandomAliveEnemy(), children[2]);
children = [children[0]];
assert.strictEqual(manager.getRandomAliveEnemy(), children[0]);
children = [];
assert.equal(manager.getRandomAliveEnemy(), undefined);

// Exercise the actual formation controller with a minimal Arcade group.
class FormationGroup {
    constructor(scene, config) { this.scene = scene; this.config = config; this.maxSize = config.maxSize; this.children = []; }
    setOrigin() {}
    getChildren() { return this.children; }
    countActive() { return this.children.filter(child => child.active).length; }
    clear() { this.children.forEach(child => child.destroy()); this.children = []; }
    create(x, y) {
        const alien = new this.config.classType(this.scene, x, y);
        this.children.push(alien);
        return alien;
    }
}
const formationScene = {
    physics: {
        world: { bounds: { left: 0, right: 800 } },
        add: { group: config => new FormationGroup(formationScene, config) }
    },
    tweens: { add() { assert.fail('formation must not use independent tweens'); } }
};
const formation = new AlienManager(formationScene);
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const survivors = () => formation.aliens.getChildren().filter(alien => alien.active);
const assertInside = () => survivors().forEach(alien => {
    assert(alien.getBounds().left >= -1e-7 && alien.getBounds().right <= 800 + 1e-7);
    near(alien.collisionX, alien.x);
    near(alien.collisionY, alien.y);
});
assert.equal(survivors().length, 40);
assert.equal(formation.rowSpacing, 50);
const descent = formation.rowSpacing / 2;
const originalPositions = survivors().map(alien => [alien.x, alien.y]);
formation.update(1000, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, originalPositions[i][0] + 100);
    near(alien.y, originalPositions[i][1]);
});
assertInside();
// Reach the right edge using the current skin's visual bounds.
const rightTravel = 800 - (originalPositions[9][0] + survivors()[9].width * survivors()[9].scaleX / 2);
formation.update((rightTravel - 100) * 10, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, originalPositions[i][0] + rightTravel);
    near(alien.y, originalPositions[i][1] + descent);
});
formation.update(10, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, originalPositions[i][0] + rightTravel - 1);
    near(alien.y, originalPositions[i][1] + descent);
});
assertInside();
// Empty outer columns change the next boundary, without repacking survivors.
formation.reset();
formation.aliens.getChildren().forEach((alien, i) => {
    if (i % 10 === 0 || i % 10 === 9) alien.active = false;
});
const sparsePositions = survivors().map(alien => [alien.x, alien.y]);
const sparseMultiplier = 1 + 0.5 * (40 - survivors().length) / 39;
const sparseTravel = 800 - Math.max(...survivors().map(alien => alien.getBounds().right));
formation.update((sparseTravel - 1) * 10 / sparseMultiplier, 10000);
assert.equal(formation.direction, 1);
near(Math.max(...survivors().map(alien => alien.getBounds().right)), 799);
formation.update(10 / sparseMultiplier, 10000);
assert.equal(formation.direction, -1);
survivors().forEach((alien, i) => {
    near(alien.x, sparsePositions[i][0] + sparseTravel);
    near(alien.y, sparsePositions[i][1] + descent);
});
// Empty rows stay empty, and gaps inside the formation remain unchanged.
formation.reset();
formation.aliens.getChildren().forEach((alien, i) => {
    if (i < 10 || (i >= 20 && i < 30) || i % 10 === 4) alien.active = false;
});
const gappedPositions = survivors().map(alien => [alien.x, alien.y]);
const gappedMultiplier = 1 + 0.5 * (40 - survivors().length) / 39;
formation.update(rightTravel * 10 / gappedMultiplier, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, gappedPositions[i][0] + rightTravel);
    near(alien.y, gappedPositions[i][1] + descent);
});
// A lone survivor traverses the playable width minus its visual width.
formation.reset();
formation.aliens.getChildren().forEach((alien, i) => { alien.active = i === 0; });
const lone = survivors()[0];
const halfWidth = lone.width * lone.scaleX / 2;
formation.update((800 - halfWidth - lone.x) * 10 / 1.5, 10000);
near(lone.x, 800 - halfWidth); near(lone.y, 100 + descent);
formation.update((800 - halfWidth * 2) * 10 / 1.5, 10000);
near(lone.x, halfWidth); near(lone.y, 100 + descent * 2);
assert.equal(formation.direction, 1);
formation.update(10, 10000);
near(lone.x, halfWidth + 1.5); near(lone.y, 100 + descent * 2);
assertInside();
// Frame splitting does not change the result, even when crossing several edges.
formation.reset(1000);
formation.update(10000, 10000);
assertInside();
survivors().forEach(alien => near(alien.y,
    originalPositions[formation.aliens.getChildren().indexOf(alien)][1] + descent * 10));
const longFrame = survivors().map(alien => [alien.x, alien.y]);
formation.reset(1000);
for (let i = 0; i < 100; i++) formation.update(100, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, longFrame[i][0]); near(alien.y, longFrame[i][1]);
});
assertInside();
[1, 2, 1000].forEach(wave => {
    formation.reset(wave);
    const x = survivors()[0].x;
    formation.update(100, 10000);
    near(survivors()[0].x - x, 200 / (Math.max(600, 2000 / (1 + 0.10 * (wave - 1))) / 1000) * 0.1);
});
// Check every survivor count against the wave's starting speed, including the cap.
[1, 2, 1000].forEach(wave => {
    const baseSpeed = 200 / (Math.max(600, 2000 / (1 + 0.10 * (wave - 1))) / 1000);
    let previousSpeed = 0;
    for (let count = 40; count >= 1; count--) {
        formation.reset(wave);
        formation.aliens.getChildren().forEach((alien, i) => { alien.active = i < count; });
        const before = survivors().map(alien => [alien.x, alien.y]);
        formation.update(100, 10000);
        const measuredSpeed = (survivors()[0].x - before[0][0]) / 0.1;
        near(measuredSpeed, baseSpeed * (1 + 0.5 * (40 - count) / 39));
        assert(measuredSpeed >= previousSpeed - 1e-7);
        assert(measuredSpeed <= baseSpeed * 1.5 + 1e-7);
        if (count === 40) near(measuredSpeed, baseSpeed);
        if (count === 1) near(measuredSpeed, baseSpeed * 1.5);
        survivors().forEach((alien, i) => {
            near(alien.x - before[i][0], measuredSpeed * 0.1);
            near(alien.y, before[i][1]);
        });
        // Repeated updates must not compound the multiplier.
        formation.update(100, 10000);
        near(survivors()[0].x - before[0][0], measuredSpeed * 0.2);
        previousSpeed = measuredSpeed;
    }
    // Starting another wave resets survivor acceleration to its normal speed.
    formation.reset(wave + 1);
    const x = survivors()[0].x;
    const nextWaveSpeed = 200 / (Math.max(600, 2000 / (1 + 0.10 * wave)) / 1000);
    formation.update(100, 10000);
    near(survivors()[0].x - x, nextWaveSpeed * 0.1);
});
// Changing survivor count mid-flight retains current positions and leftward direction.
formation.reset();
formation.update(rightTravel * 10, 10000);
formation.aliens.getChildren().forEach((alien, i) => { alien.active = i % 2 === 0; });
const acceleratingPositions = survivors().map(alien => [alien.x, alien.y]);
formation.update(0, 10000);
assert.equal(formation.direction, -1);
survivors().forEach((alien, i) => {
    near(alien.x, acceleratingPositions[i][0]); near(alien.y, acceleratingPositions[i][1]);
});
formation.update(100, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, acceleratingPositions[i][0] - 10 * (1 + 0.5 * 20 / 39));
    near(alien.y, acceleratingPositions[i][1]);
});
assert.equal(formation.direction, -1);
const stoppedPositions = survivors().map(alien => [alien.x, alien.y]);
formation.stopMovement();
assert.equal(formation.update(10000, 10000), false);
survivors().forEach((alien, i) => {
    near(alien.x, stoppedPositions[i][0]); near(alien.y, stoppedPositions[i][1]);
});
formation.reset();
assert.equal(formation.direction, 1);
assert.equal(formation.movementStopped, false);
assert.equal(formation.speed, 100);
assert.equal(survivors().length, 40);
// Equality at the defensive line triggers invasion even without a descent.
formation.aliens.getChildren().forEach((alien, i) => { alien.active = i === 0; });
const bodyBottomOffset = survivors()[0].body.bottom - survivors()[0].y;
survivors()[0].body.reset(100, scene.player.getBounds().top - bodyBottomOffset);
assert.equal(formation.update(0, scene.player.getBounds().top), true);
assert.equal(formation.movementStopped, true);
formation.reset();
// Inactive invaders cannot cause invasion. Reaching the line needs no horizontal overlap.
formation.aliens.getChildren().forEach((alien, i) => { alien.active = i === 0; });
formation.aliens.getChildren()[1].y = 1000;
const invader = survivors()[0];
invader.body.reset(800 - halfWidth, scene.player.getBounds().top - bodyBottomOffset - 1);
assert.equal(formation.update(0, scene.player.getBounds().top), false);
scene.alienManager = formation;
scene.physics.overlap = () => assert.fail('invasion ends combat before collision checks');
scene._shipKeyboardHandler = () => assert.fail('invasion ends combat before input/shooting');
const livesBeforeInvasion = score.remaining;
scene.update(0, 20);
assert.equal(scene.state, GameState.GameOver);
assert.equal(score.remaining, livesBeforeInvasion);
assert.equal(score.remaining, 3);
assert.equal(score.message, 'GAME OVER');
assert(!scene.player.active);
assert.equal(formation.movementStopped, true);
const invadedY = invader.y;
formation.update(1000, 0);
scene.update(1000, 1000);
assert.equal(invader.y, invadedY);
scene._enemyFires(); scene._fireBullet();
scene.restart();
assert.equal(scene.state, GameState.Playing);
assert.equal(scene.wave, 1);
assert.equal(score.score, 0);
assert.equal(score.remaining, 3);
assert.equal(survivors().length, 40);
assert.equal(formation.direction, 1);
assert.equal(formation.movementStopped, false);
assert.equal(score.message, '');

const assets = Object.create(AssetManager.prototype);
let cleared = 0;
const group = () => ({ clear: () => cleared++ });
assets.bullets = group(); assets.enemyBullets = group(); assets.explosions = group();
const originalBullets = assets.bullets;
for (let i = 0; i < 100; i++) assets.reset();
assert.strictEqual(assets.bullets, originalBullets);
assert.equal(cleared, 300);

for (const Type of [Bullet, EnemyBullet]) {
    for (const [x, y] of [[-20, 300], [820, 300], [400, -20], [400, 620], [400, 300]]) {
        const bullet = new Type({ physics: { world: { bounds: { left: 0, right: 800, top: 0, bottom: 600 } } } });
        Object.assign(bullet, { x, y, width: 4, height: 8 });
        bullet.update();
        assert.equal(!!bullet.destroyed, x !== 400 || y !== 300);
    }
}
console.log('PASS: resolution-independent DOGE poses, alpha bounds, stable hitboxes/controls, coordinated movement, wave scaling, and all wave-transition regressions.');
