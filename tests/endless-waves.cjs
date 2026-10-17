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
    setScale(value) { this.scaleX = this.scaleY = value; return this; }
    setAngle(value) { this.angle = value; return this; }
    setTint(value) { this.tint = value; return this; }
    clearTint() { this.tint = undefined; return this; }
    setVisible(value) { this.visible = value; return this; }
    setActive(value) { this.active = value; return this; }
    setAlpha(value) { this.alpha = value; return this; }
    setCollideWorldBounds(value) { this.body.setCollideWorldBounds(value); return this; }
    on(event, callback) { this.listeners = this.listeners || {}; this.listeners[event] = callback; return this; }
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
    play(key) { this.animationKey = key; return this; }
    destroy() { this.destroyed = true; this.active = false; }
}
const Phaser = {
    Animations: { Events: { ANIMATION_COMPLETE: 'animationcomplete' } },
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
const { ScoreManager, MAX_LIVES } = load('src/interface/manager/score-manager.ts');
const { AlienManager } = load('src/interface/manager/alien-manager.ts');
const { AssetManager } = load('src/interface/manager/asset-manager.ts');
const { Bullet } = load('src/interface/bullet.ts');
const { EnemyBullet } = load('src/interface/enemy-bullet.ts');
const { Alien } = load('src/interface/alien.ts');
const { MemeSkins, PlayerPoses, PlayerCanvas, visibleImageBounds, preparePlayerPoses, applySkin, applySkinAppearance } = load('src/interface/skins.ts');
const { Ship } = load('src/interface/ship.ts');
const { EnemyType } = load('src/interface/enemy-type.ts');
const { getWaveConfiguration, FORMATION_COLUMNS, FORMATION_ROWS, INVADERS_PER_WAVE } = load('src/interface/wave-config.ts');
const { PonkePoses, prepareEnemySkins } = load('src/interface/enemy-skins.ts');
const { BananaBombs, BananaSettings, bananaTrajectory } = load('src/interface/banana-bomb.ts');
const { Kaboom } = load('src/interface/kaboom.ts');
const { AnimationFactory } = load('src/interface/factory/animation-factory.ts');
const { DamageFeedback, DamageFeedbackSettings } = load('src/interface/damage-feedback.ts');

// Skin textures are standalone PNGs, with collision boxes inside their artwork.
const textureRequests = [];
const sheetRequests = [];
const preloadScene = new MainScene();
preloadScene.sound = {};
preloadScene.load = {
    setBaseURL(url) { this.baseURL = url; },
    image(asset, url) { textureRequests.push({ asset, url }); },
    spritesheet(asset, url, config) { sheetRequests.push({ asset, url, config }); },
    audio() {}
};
preloadScene.preload();
assert.deepEqual(sheetRequests, [
    { asset: 'kaboom', url: 'images/explode.png', config: { frameWidth: 128, frameHeight: 128 } },
    { asset: 'ponke-explosion', url: 'meme-skins/ponke-explosion.png', config: { frameWidth: 128, frameHeight: 128 } }
]);
const animationConfigs = [];
new AnimationFactory({ anims: {
    create(config) { animationConfigs.push(config); },
    generateFrameNumbers(texture, range) { return { texture, start: range.start, end: range.end }; }
} });
assert.equal(animationConfigs.length, 2);
for (const [index, key] of ['kaboom', 'ponke-explosion'].entries()) {
    assert.deepEqual(animationConfigs[index], {
        key, frames: { texture: key, start: 0, end: 15 },
        frameRate: 24, repeat: 0, hideOnComplete: true
    });
}
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
assert(textureRequests.some(request => request.asset === 'ponke-banana' && request.url === 'meme-skins/ponke-weapon.png'));
assert.equal(fs.readFileSync(path.resolve(__dirname, '../assets/meme-skins/ponke-weapon.png')).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

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

// Both original PONKE PNGs load and fit the existing PEPE-sized frame unchanged.
const ponkeImages = new Map();
const ponkeTextures = new Map();
for (const pose of PonkePoses) {
    assert(textureRequests.some(request => request.asset === `${pose.asset}-source` && request.url === pose.path));
    const png = fs.readFileSync(path.resolve(__dirname, '../assets', pose.path));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    ponkeImages.set(`${pose.asset}-source`, { width: png.readUInt32BE(16), height: png.readUInt32BE(20) });
}
const enemySkinScene = { textures: {
    getFrame(key) { assert.equal(key, 'alien'); return { width: 337, height: 282 }; },
    exists: key => ponkeImages.has(key) || ponkeTextures.has(key),
    get: key => ({ getSourceImage: () => ponkeImages.get(key) }),
    createCanvas(key, width, height) {
        const texture = { width, height, draws: [], refreshes: 0,
            context: { drawImage(...args) { texture.draws.push(args); } },
            refresh() { texture.refreshes++; }
        };
        ponkeTextures.set(key, texture);
        return texture;
    }
} };
prepareEnemySkins(enemySkinScene);
prepareEnemySkins(enemySkinScene);
assert.equal(ponkeTextures.size, 2);
for (const pose of PonkePoses) {
    const texture = ponkeTextures.get(pose.asset);
    assert.equal(texture.width, 337); assert.equal(texture.height, 282);
    assert.equal(texture.draws.length, 1); assert.equal(texture.refreshes, 1);
    const [image, x, y, width, height] = texture.draws[0];
    assert.equal(texture.draws[0].length, 5, 'fit the whole original image without cropping or flipping');
    assert.strictEqual(image, ponkeImages.get(`${pose.asset}-source`));
    assert(width > 0 && height > 0 && x >= 0 && y >= 0);
    nearSkin(width / height, image.width / image.height);
    nearSkin(x + width / 2, 337 / 2); nearSkin(y + height / 2, 282 / 2);
}
for (const wave of [1, 2, 3, 4, 5, 6, 7, 8, 99, 100, 999, 1000]) {
    const config = getWaveConfiguration(wave);
    assert.equal(config.enemies.length, 24);
    assert(config.enemies.every(type => type === (wave % 2 ? EnemyType.Ponke : EnemyType.Pepe)));
}

// Use the installed Phaser Body to verify scaled offsets and no post-update drift.
const ArcadeBody = require('phaser/src/physics/arcade/Body');
Phaser.Geom = { Rectangle: require('phaser/src/geom/rectangle/Rectangle') };
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

// Exercise Ship.create with the real Arcade body, including artwork-aware edge
// limits. Original collision proportions scale uniformly with the artwork.
const playerWorld = {
    defaults: {}, bounds: new Phaser.Geom.Rectangle(0, 0, 800, 600),
    checkCollision: { left: true, right: true, up: true, down: true }
};
const playerScene = { physics: { world: playerWorld, add: { sprite(x, y, key) {
    const sprite = new Sprite(playerScene, x, y, key);
    sprite.angle = 0;
    sprite.body = new ArcadeBody(playerWorld, sprite);
    return sprite;
} } } };
const enlargedPlayer = Ship.create(playerScene);
const spawn = Ship.startPosition(playerScene);
nearSkin(enlargedPlayer.width * enlargedPlayer.scaleX, 52 * 1.4);
nearSkin(enlargedPlayer.height * enlargedPlayer.scaleY, 320 * 52 * 1.4 / 335);
nearSkin(enlargedPlayer.body.width, 180 * enlargedPlayer.scaleX);
nearSkin(enlargedPlayer.body.height, 195 * enlargedPlayer.scaleY);
nearSkin(enlargedPlayer.x, 400); nearSkin(enlargedPlayer.y, spawn.y);
nearSkin(enlargedPlayer.getBounds().bottom, 588);
const { decodePng } = require('../scripts/recolor-ponke-explosion.cjs');
const actualPoseImages = new Map(PlayerPoses.map(pose => {
    const png = decodePng(fs.readFileSync(path.resolve(__dirname, '../assets', pose.path)));
    return [`${pose.asset}-source`, { width: png.width, height: png.height, pixels: png.pixels }];
}));
const actualPoseDraws = new Map();
preparePlayerPoses({ textures: {
    exists: key => actualPoseImages.has(key),
    get: key => ({ getSourceImage: () => actualPoseImages.get(key) }),
    createCanvas(key) { return {
        context: { drawImage(...args) { actualPoseDraws.set(key, args); } }, refresh() {}
    }; }
} });
const projectedArt = draw => {
    const [x, y, width, height] = draw.slice(5);
    const left = enlargedPlayer.x + (x - enlargedPlayer.displayOriginX) * enlargedPlayer.scaleX;
    const top = enlargedPlayer.y + (y - enlargedPlayer.displayOriginY) * enlargedPlayer.scaleY;
    return { left, top, right: left + width * enlargedPlayer.scaleX,
        bottom: top + height * enlargedPlayer.scaleY };
};
for (const draw of actualPoseDraws.values()) {
    const art = projectedArt(draw);
    const margin = 600 - art.bottom;
    assert(margin >= 20 && margin <= 25, `visible DOGE bottom margin ${margin}`);
    assert(art.top >= 0 && art.bottom <= 600);
}
for (const outsideX of [-100, 900]) {
    enlargedPlayer.body.reset(outsideX, spawn.y);
    enlargedPlayer.body.preUpdate(false, 0);
    enlargedPlayer.body.checkWorldBounds();
    enlargedPlayer.body.postUpdate();
    for (const draw of actualPoseDraws.values()) {
        const art = projectedArt(draw);
        assert(art.left >= -1e-7 && art.right <= 800 + 1e-7, 'every DOGE pose remains fully visible at both canvas edges');
    }
}
enlargedPlayer.body.reset(spawn.x, spawn.y);
enlargedPlayer.body.preUpdate(false, 0);
const enlargedState = [enlargedPlayer.scaleX, enlargedPlayer.scaleY, enlargedPlayer.body.width, enlargedPlayer.body.height];
for (const [direction, now] of [[-1, 0], [1, 1], [1, 34], [-1, 35], [0, 36]]) {
    Ship.setDirection(enlargedPlayer, direction, now);
    assert.deepEqual([enlargedPlayer.scaleX, enlargedPlayer.scaleY, enlargedPlayer.body.width, enlargedPlayer.body.height], enlargedState);
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
    assert.deepEqual(shotOrigin, [400, 500 - Ship.bulletOffset], 'poses must not move the projectile origin');
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
    assert.deepEqual(shotOrigin, [400, 500 - Ship.bulletOffset]);
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
let sharedFeedbackCount = 0, feedbackClearCount = 0;
scene.damageFeedback = {
    show() { sharedFeedbackCount++; }, clear() { feedbackClearCount++; }
};
let clearCount = 0, stopCount = 0, spawnCount = 0, inOverlap = false;
let enemyClearCount = 0;
let bananaClearCount = 0;
scene.bananaBombs = { clear() { bananaClearCount++; }, update() {} };
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
let alive = INVADERS_PER_WAVE;
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
        spawnCount++; alive = INVADERS_PER_WAVE; this.lastWave = wave;
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
        for (let i = 0; i < INVADERS_PER_WAVE; i++) {
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
assert.equal(score.score, 1240);
assert.equal(score.remaining, 3);
assert.equal(score.message, 'WAVE 2', 'announce the upcoming wave immediately');
assert.equal(scene.nextWaveReadyAt, 1600);
assert.equal(clearCount, 0, 'player missiles must not be cleared');
assert.equal(enemyClearCount, 1);
assert.equal(bananaClearCount, 1, 'wave transition removes banana flights and blasts after overlaps');
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
assert.equal(score.score, 1240);
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
assert.equal(alive, 24);
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
assert.equal(score.score, 2480);
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
const feedbackBeforePepe = sharedFeedbackCount;
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
assert.equal(sharedFeedbackCount, feedbackBeforePepe + 3, 'PEPE uses the shared successful-life-loss feedback');
assert(!scene.player.active);
const before = clearCount;
scene._enemyFires();
scene._fireBullet();
scene.update();
assert.equal(clearCount, before);
const feedbackClearsBeforeRestart = feedbackClearCount;
scene.restart();
assert.equal(feedbackClearCount, feedbackClearsBeforeRestart + 1, 'restart clears damage feedback before lives are rebuilt');
assert.equal(scene.wave, 1);
assert.equal(score.score, 0);
assert.equal(score.remaining, 3);
assert.equal(score.waveLabel, 'WAVE 1');
assert.equal(scene.player.texture.key, 'ship', 'a fresh game starts in the idle pose');
assert.equal(score.message, '');
assert.equal(scene.nextWaveReadyAt, 0);
assert.equal(scene.player.x, 400);
assert.equal(scene.player.y, Ship.startPosition(scene).y);
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
assert.equal(survivors().length, 24);
assert(survivors().every(alien => alien.enemyType === EnemyType.Ponke && alien.texture.key === 'ponke-right'));
assert.equal(FORMATION_COLUMNS, 6); assert.equal(FORMATION_ROWS, 4);
assert.equal(INVADERS_PER_WAVE, 24); assert.equal(formation.aliens.maxSize, 24);
assert.equal(formation.columnSpacing, 88);
assert.equal(formation.rowSpacing, 74); assert.equal(formation.descentStep, 25);
function assertFormationFits() {
    const aliens = survivors();
    aliens.forEach((alien, i) => {
        near(alien.width * alien.scaleX, 67.2 * 1.30);
        near(alien.height * alien.scaleY, (67.2 * 282 / 337) * 1.30);
        near(alien.scaleX, alien.scaleY);
        assert(alien.getBounds().left >= -1e-7 && alien.getBounds().right <= 800 + 1e-7);
        if (i % FORMATION_COLUMNS < FORMATION_COLUMNS - 1) {
            near(aliens[i + 1].x - alien.x, 88);
            assert(alien.getBounds().right <= aliens[i + 1].getBounds().left + 1e-7);
        }
        if (i < FORMATION_COLUMNS * (FORMATION_ROWS - 1)) {
            near(aliens[i + FORMATION_COLUMNS].y - alien.y, 74);
            assert(alien.getBounds().bottom < aliens[i + FORMATION_COLUMNS].getBounds().top);
        }
    });
}
assertFormationFits();
const initialBounds = () => ({
    left: Math.min(...survivors().map(alien => alien.getBounds().left)),
    right: Math.max(...survivors().map(alien => alien.getBounds().right)),
    top: Math.min(...survivors().map(alien => alien.getBounds().top)),
    bottom: Math.max(...survivors().map(alien => alien.getBounds().bottom))
});
const fullFormationBounds = initialBounds();
near((fullFormationBounds.left + fullFormationBounds.right) / 2, 400);
near(fullFormationBounds.right - fullFormationBounds.left, 527.36);
near(fullFormationBounds.bottom - fullFormationBounds.top, 3 * 74 + 87.36 * 282 / 337);
assert(fullFormationBounds.top >= 0 && fullFormationBounds.bottom <= 600);
assert.equal(new Set(survivors().map(alien => alien.x)).size, 6);
assert.equal(new Set(survivors().map(alien => alien.y)).size, 4);
const descent = formation.descentStep;
const originalPositions = survivors().map(alien => [alien.x, alien.y]);
formation.update(1000, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, originalPositions[i][0] + 100);
    near(alien.y, originalPositions[i][1]);
});
assertInside();
// Reach the right edge using the current skin's visual bounds.
const rightTravel = 800 - fullFormationBounds.right;
formation.update((rightTravel - 100) * 10, 10000);
assert(survivors().every(alien => alien.texture.key === 'ponke-left'), 'switch at the right edge immediately');
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
    if (i % FORMATION_COLUMNS === 0 || i % FORMATION_COLUMNS === FORMATION_COLUMNS - 1) alien.active = false;
});
const sparsePositions = survivors().map(alien => [alien.x, alien.y]);
const sparseMultiplier = 1 + 0.5 * (INVADERS_PER_WAVE - survivors().length) / (INVADERS_PER_WAVE - 1);
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
    if (i < FORMATION_COLUMNS || (i >= 2 * FORMATION_COLUMNS && i < 3 * FORMATION_COLUMNS) || i % FORMATION_COLUMNS === 4) alien.active = false;
});
const gappedPositions = survivors().map(alien => [alien.x, alien.y]);
const gappedMultiplier = 1 + 0.5 * (INVADERS_PER_WAVE - survivors().length) / (INVADERS_PER_WAVE - 1);
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
// Step infinitesimally past arrival to avoid decimal round-off stopping a
// synthetic frame just short of the boundary; movement assertions allow 1e-7px.
formation.update((800 - halfWidth * 2) * 10 / 1.5 + 1e-8, 10000);
assert.equal(lone.texture.key, 'ponke-right', 'switch at the left edge immediately');
near(lone.x, halfWidth); near(lone.y, 100 + descent * 2);
assert.equal(formation.direction, 1);
formation.update(10, 10000);
near(lone.x, halfWidth + 1.5); near(lone.y, 100 + descent * 2);
assertInside();
// Resetting from leftward movement starts the next configured wave facing right.
for (const wave of [2, 3, 4, 5, 99, 100]) {
    formation.reset(wave);
    const expectedType = wave % 2 ? EnemyType.Ponke : EnemyType.Pepe;
    const expectedTexture = wave % 2 ? 'ponke-right' : 'alien';
    assert.equal(survivors().length, 24);
    assert(survivors().every(alien => alien.enemyType === expectedType && alien.texture.key === expectedTexture));
    assertFormationFits();
    near((initialBounds().left + initialBounds().right) / 2, 400);
    formation.update(rightTravel / formation.speed * 1000 + 1e-8, 10000);
    assert.equal(formation.direction, -1);
    assert(survivors().every(alien => alien.texture.key === (wave % 2 ? 'ponke-left' : 'alien')));
    near(initialBounds().right, 800);
    assertFormationFits();
    const fullSweep = 800 - (fullFormationBounds.right - fullFormationBounds.left);
    formation.update(fullSweep / formation.speed * 1000 + 1e-8, 10000);
    near(initialBounds().left, 0);
    assert.equal(formation.direction, 1);
    assert(survivors().every(alien => alien.texture.key === expectedTexture));
    assertFormationFits();
    near(survivors()[0].y, originalPositions[0][1] + 2 * 25);
}
// The visual change cannot alter origin, scale, collision geometry or velocity.
const typedAlien = new Alien({}, 250, 200);
typedAlien.angle = 0;
typedAlien.body = new ArcadeBody({ defaults: {}, bounds: {} }, typedAlien);
for (const type of [EnemyType.Ponke, EnemyType.Pepe]) {
    typedAlien.configure(type, 1);
    near(typedAlien.body.width, 247 * 67.2 * 1.30 / 337);
    near(typedAlien.body.height, 210 * 67.2 * 1.30 / 337);
    near(typedAlien.width * typedAlien.scaleX, 67.2 * 1.30);
    near(typedAlien.height * typedAlien.scaleY, (67.2 * 282 / 337) * 1.30);
    typedAlien.body.velocity.set(42, 7);
    const geometry = () => [typedAlien.x, typedAlien.y, typedAlien.scaleX, typedAlien.scaleY,
        typedAlien.originX, typedAlien.originY, typedAlien.body.left, typedAlien.body.top,
        typedAlien.body.width, typedAlien.body.height, typedAlien.body.velocity.x, typedAlien.body.velocity.y];
    const before = geometry();
    const changes = typedAlien.textureChanges;
    typedAlien.setDirection(-1);
    assert.equal(typedAlien.texture.key, type === EnemyType.Ponke ? 'ponke-left' : 'alien');
    assert.deepEqual(geometry(), before);
    if (type === EnemyType.Pepe) assert.equal(typedAlien.textureChanges, changes);
    const afterSwitch = typedAlien.textureChanges;
    typedAlien.setDirection(-1);
    assert.equal(typedAlien.textureChanges, afterSwitch);
    typedAlien.setDirection(1);
    assert.deepEqual(geometry(), before);
    assert.equal(typedAlien.texture.key, type === EnemyType.Ponke ? 'ponke-right' : 'alien');
}
// Enemy-specific selection preserves PEPE's original aiming, speed and cooldown.
for (const type of [EnemyType.Ponke, EnemyType.Pepe]) {
    typedAlien.configure(type, 1);
    const attackScene = new MainScene();
    attackScene.state = GameState.Playing;
    attackScene.time = { now: 3000 };
    attackScene.player = new Sprite(attackScene, 400, 500, 'ship');
    attackScene.alienManager = { getRandomAliveEnemy: () => typedAlien };
    const projectile = new EnemyBullet(attackScene);
    let redShots = 0, bananaLaunch;
    attackScene.assetManager = { enemyBullets: { get: () => { redShots++; return projectile; } } };
    attackScene.bananaBombs = { launch(...args) { bananaLaunch = args; } };
    let aim;
    attackScene.physics = { moveToObject(bullet, target, speed) { aim = { bullet, target, speed }; } };
    attackScene._enemyFires();
    if (type === EnemyType.Ponke) {
        assert.deepEqual(bananaLaunch, [typedAlien.x, typedAlien.y, 400, 500]);
        assert.equal(redShots, 0); assert.equal(aim, undefined);
    } else {
        assert.equal(bananaLaunch, undefined); assert.equal(redShots, 1);
        assert.equal(projectile.texture.key, 'enemyBullet');
        assert.equal(projectile.x, typedAlien.x); assert.equal(projectile.y, typedAlien.y);
        assert.strictEqual(aim.bullet, projectile); assert.strictEqual(aim.target, attackScene.player);
        assert.equal(aim.speed, 120);
    }
    assert.equal(attackScene.firingTimer, 5000);
}
// Frame splitting does not change the result, even when crossing several edges.
formation.reset(1000);
const expectedReversals = 1 + Math.floor((formation.speed * 10 - rightTravel) /
    (800 - (fullFormationBounds.right - fullFormationBounds.left)));
formation.update(10000, 10000);
assertInside();
survivors().forEach(alien => near(alien.y,
    originalPositions[formation.aliens.getChildren().indexOf(alien)][1] + descent * expectedReversals));
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
    for (let count = INVADERS_PER_WAVE; count >= 1; count--) {
        formation.reset(wave);
        formation.aliens.getChildren().forEach((alien, i) => { alien.active = i < count; });
        const before = survivors().map(alien => [alien.x, alien.y]);
        formation.update(100, 10000);
        const measuredSpeed = (survivors()[0].x - before[0][0]) / 0.1;
        near(measuredSpeed, baseSpeed * (1 + 0.5 * (INVADERS_PER_WAVE - count) / (INVADERS_PER_WAVE - 1)));
        assert(measuredSpeed >= previousSpeed - 1e-7);
        assert(measuredSpeed <= baseSpeed * 1.5 + 1e-7);
        if (count === INVADERS_PER_WAVE) near(measuredSpeed, baseSpeed);
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
    near(alien.x, acceleratingPositions[i][0] - 10 * (1 + 0.5 * 12 / 23));
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
assert.equal(survivors().length, 24);
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
const clearsBeforeRestart = bananaClearCount;
scene.restart();
assert.equal(bananaClearCount, clearsBeforeRestart + 1);
assert.equal(scene.state, GameState.Playing);
assert.equal(scene.wave, 1);
assert.equal(score.score, 0);
assert.equal(score.remaining, 3);
assert.equal(survivors().length, 24);
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
// A fixed parabola is frame-rate independent, clamped to the playfield, and
// cannot be changed by player movement or tuning changes after launch.
const arc = bananaTrajectory(200, 150, 400, 500, 12, 788);
near(arc.landingX, 400);
near(arc.position(0).x, 200); near(arc.position(0).y, 150);
near(arc.position(arc.duration).x, 400); near(arc.position(arc.duration).y, 500);
const midpoint = arc.position(arc.duration / 2);
near(midpoint.x, 300);
assert(midpoint.y < 325, 'gravity produces a curve rather than a diagonal line');
const savedGravity = BananaSettings.gravity;
BananaSettings.gravity *= 2;
near(arc.position(arc.duration / 2).y, midpoint.y);
BananaSettings.gravity = savedGravity;
assert(bananaTrajectory(780, 100, 790, 500, 12, 788).landingX <= 788);
assert(bananaTrajectory(20, 100, 0, 500, 12, 788).landingX >= 12);
assert.equal(bananaTrajectory(400, 150, 401, 500, 12, 788).landingX, 500);

const bombScene = {
    time: { now: 1000 },
    physics: { world: { bounds: { left: 0, right: 800 } } },
    add: { sprite(x, y, texture) {
        const sprite = new Sprite(bombScene, x, y, texture);
        const png = fs.readFileSync(path.resolve(__dirname, '../assets/meme-skins/ponke-weapon.png'));
        sprite.width = png.readUInt32BE(16); sprite.height = png.readUInt32BE(20);
        return sprite;
    } }
};
const blastSprites = [];
const blastGroup = { get() {
    const sprite = new Kaboom(bombScene);
    sprite.width = sprite.height = 128;
    blastSprites.push(sprite);
    return sprite;
} };
let bombHits = 0;
const bombs = new BananaBombs(bombScene, blastGroup, () => bombHits++);
assert.equal(BananaSettings.displayWidth, 36 * 1.5);
assert.equal(BananaSettings.landingInset, 12);
assert.equal(BananaSettings.rotationSpeed, 65);
assert.equal(BananaSettings.visualScale, 1);
assert.equal(BananaSettings.hitRadius, 48);
assert.equal(BananaSettings.damageDurationMs, 150);
// Enlarging the visual must not move edge landings from their original 12/788px
// bounds or change the launch point, flight duration, or sampled arc positions.
for (const [x, targetX, landingX] of [[20, 0, 12], [780, 800, 788]]) {
    const edgeBombs = new BananaBombs(bombScene, blastGroup, () => assert.fail('flying bananas are harmless'));
    edgeBombs.launch(x, 150, targetX, 500);
    const edgeFlight = edgeBombs.flights[0];
    const oldPath = bananaTrajectory(x, 150, targetX, 500, 12, 788);
    near(edgeFlight.path.landingX, landingX);
    near(edgeFlight.sprite.x, x); near(edgeFlight.sprite.y, 150);
    near(edgeFlight.path.duration, oldPath.duration);
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const seconds = fraction * oldPath.duration;
        const before = oldPath.position(seconds), after = edgeFlight.path.position(seconds);
        near(after.x, before.x); near(after.y, before.y);
    }
    edgeBombs.clear();
}
let loweredPlayerHits = 0;
const loweredBombs = new BananaBombs(bombScene, blastGroup, () => loweredPlayerHits++);
loweredBombs.launch(200, 150, enlargedPlayer.x, enlargedPlayer.y);
bombScene.time.now += loweredBombs.flights[0].path.duration * 1000 + 1;
loweredBombs.update(enlargedPlayer);
assert.equal(loweredPlayerHits, 1, 'banana landing at the new DOGE line still damages its real collision body');
near(blastSprites[blastSprites.length - 1].y, spawn.y);
loweredBombs.clear();
blastSprites.length = 0;
bombScene.time.now = 1000;
const doge = new Sprite(bombScene, 400, 500, 'ship');
function dogeAt(x, y = 500) {
    doge.setPosition(x, y);
    doge.body = { left: x - 10, right: x + 10, top: y - 10, bottom: y + 10 };
}
dogeAt(400);
bombs.launch(200, 150, doge.x, doge.y);
const flight = bombs.flights[0];
assert.equal(flight.sprite.texture.key, 'ponke-banana');
near(flight.sprite.width * flight.sprite.scaleX, 36 * 1.5);
near(flight.sprite.height * flight.sprite.scaleY, 24 * 1.5);
near(flight.sprite.scaleX, flight.sprite.scaleY);
near(flight.sprite.x, 200); near(flight.sprite.y, 150);
// Mock Sprites have a body; production scene.add.sprite creates no Arcade body.
bombScene.time.now = 1000 + arc.duration * 500;
dogeAt(midpoint.x, midpoint.y);
bombs.update(doge);
near(flight.sprite.x, midpoint.x); near(flight.sprite.y, midpoint.y);
near(flight.sprite.angle, arc.duration / 2 * 65);
assert.equal(bombHits, 0, 'flying bananas are harmless even at DOGE');
dogeAt(700);
bombScene.time.now = 1000 + arc.duration * 1000 + 1;
bombs.update(doge);
assert(flight.sprite.destroyed); assert.equal(bombs.flights.length, 0);
const blast = blastSprites[0];
assert.equal(blast.animationKey, 'ponke-explosion', 'only banana landing selects the yellow animation');
near(blast.x, 400); near(blast.y, 500);
near(blast.scaleX, 1); near(blast.width * blast.scaleX / 2, 64);
near(BananaSettings.hitRadius, 48);
assert.equal(bombHits, 0, 'landing stays fixed after DOGE moves');
dogeAt(459); // Body starts 49px away: just outside the effective fireball radius.
bombs.update(doge); assert.equal(bombHits, 0);
dogeAt(457); // Body starts 47px away: edge overlap damages DOGE even with his center outside.
bombs.update(doge); assert.equal(bombHits, 1);
for (let i = 0; i < 10; i++) bombs.update(doge);
assert.equal(bombHits, 1, 'each explosion can damage at most once');
assert.equal(blastGroup.get().scaleX, 1, 'other explosions retain original size');
const killedInvaderExplosion = blastGroup.get();
new Alien({ sound: { play() {} } }, 0, 0).kill(killedInvaderExplosion);
assert.equal(killedInvaderExplosion.animationKey, 'kaboom', 'destroyed invaders keep the original red animation');
blast.listeners.animationcomplete();
bombs.update(doge); assert.equal(bombs.blasts.length, 0, 'completed animations release damage entries');

// Walk into an unspent blast after its damage window; it is visual only.
bombs.launch(200, 150, 400, 500);
dogeAt(700);
const secondLaunch = bombScene.time.now;
bombScene.time.now = secondLaunch + arc.duration * 1000 + 1;
bombs.update(doge);
dogeAt(400);
bombScene.time.now = secondLaunch + arc.duration * 1000 + BananaSettings.damageDurationMs;
bombs.update(doge); assert.equal(bombHits, 1);
// Long frames do not extend the damaging deadline.
bombs.launch(200, 150, 400, 500);
bombScene.time.now += arc.duration * 1000 + 200;
bombs.update(doge); assert.equal(bombHits, 1);
doge.active = false;
bombs.launch(200, 150, 400, 500);
bombScene.time.now += arc.duration * 1000 + 1;
bombs.update(doge); assert.equal(bombHits, 1, 'inactive DOGE cannot take damage');
bombs.launch(200, 150, 400, 500);
const objectsToClear = [...bombs.flights, ...bombs.blasts].map(entry => entry.sprite);
bombs.clear(); bombs.clear();
assert(objectsToClear.every(sprite => sprite.destroyed));
assert.equal(bombs.flights.length, 0); assert.equal(bombs.blasts.length, 0);
bombScene.time.now += 10000;
doge.active = true;
bombs.update(doge); assert.equal(bombHits, 1, 'no callbacks or hitboxes survive cleanup');
assert(bananaClearCount >= 4, 'transitions, life-loss GAME OVER, invasion and restart clear bananas');

// Exercise banana impacts through the actual scene life-loss/GAME OVER path.
let bananaFeedbackCount = 0;
scene.damageFeedback = { show() { bananaFeedbackCount++; } };
const combatBombs = new BananaBombs(bombScene, blastGroup, () => scene._damagePlayer());
scene.bananaBombs = combatBombs;
scene.player = doge;
scene.state = GameState.Playing;
score.remaining = 3;
scene.assetManager.explosions.get = () => assert.fail('banana hits must not add a full-size explosion');
for (let lives = 2; lives >= 0; lives--) {
    combatBombs.launch(200, 150, 400, 500);
    bombScene.time.now += arc.duration * 1000 + 1;
    combatBombs.update(doge);
    assert.equal(score.remaining, lives);
    combatBombs.update(doge);
    assert.equal(score.remaining, lives, 'one banana explosion removes one life');
}
assert.equal(scene.state, GameState.GameOver);
assert(!doge.active);
assert.equal(combatBombs.flights.length, 0);
assert.equal(combatBombs.blasts.length, 0, 'lethal impact clears banana effects immediately');
scene._damagePlayer();
assert.equal(score.remaining, 0, 'GAME OVER blocks further damage');
assert.equal(bananaFeedbackCount, 3, 'each successful banana life loss triggers shared feedback exactly once');

// Visual feedback uses scene events, so completion does not depend on the combat
// update continuing after a fatal hit. No timers, tweens, or physics are needed.
let visualListeners = [];
const rings = [];
const feedbackScene = new MainScene();
feedbackScene.time = { now: 0 };
feedbackScene.events = {
    on(event, callback, context) { visualListeners.push({ event, callback, context }); },
    once(event, callback, context) { visualListeners.push({ event, callback, context, once: true }); },
    off(event, callback, context) {
        visualListeners = visualListeners.filter(item => item.event !== event || item.callback !== callback || item.context !== context);
    },
    emit(event) {
        for (const item of visualListeners.filter(item => item.event === event)) {
            if (item.once) this.off(event, item.callback, item.context);
            item.callback.call(item.context);
        }
    }
};
feedbackScene.add = { graphics() {
    const ring = {
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        clear() { return this; },
        lineStyle(width, color, alpha) { this.alpha = alpha; return this; },
        strokeCircle(x, y, radius) { this.radius = radius; return this; },
        destroy() { this.destroyed = true; }
    };
    rings.push(ring); return ring;
} };
feedbackScene.player = new Sprite(feedbackScene, 400, 500, 'ship');
feedbackScene.player.depth = 0;
const feedbackLives = [0, 1, 2].map(i => new Sprite(feedbackScene, 700 + i * 30, 60, 'ship'));
feedbackScene.scoreManager = {
    lives: { getFirstAlive: () => feedbackLives.find(life => life.active) },
    get noMoreLives() { return !feedbackLives.some(life => life.active); },
    setGameOverText() {}
};
feedbackScene.assetManager = { explosions: { get() { assert.fail('player damage must never create an invader explosion'); } } };
feedbackScene.sound = { play() {} };
feedbackScene.alienManager = { stopMovement() {} };
feedbackScene.state = GameState.Playing;
const feedback = new DamageFeedback(feedbackScene, feedbackScene.player);
feedbackScene.damageFeedback = feedback;
function tickFeedback(now) { feedbackScene.time.now = now; feedbackScene.events.emit('postupdate'); }
const playerGeometry = () => [feedbackScene.player.x, feedbackScene.player.y,
    feedbackScene.player.scaleX, feedbackScene.player.scaleY, feedbackScene.player.body];
const undamagedGeometry = playerGeometry();

// The existing inactive-player gate blocks damage and feedback. There is no
// timed invulnerability rule in this game to alter or synthesize in the test.
feedbackScene.player.active = false;
feedbackScene._damagePlayer();
assert.equal(rings.length, 0); assert(feedbackLives.every(life => life.active));
feedbackScene.player.active = true;
feedbackScene.state = GameState.WaveTransition;
feedbackScene._damagePlayer(); assert.equal(rings.length, 0);
feedbackScene.state = GameState.Playing;
const pepeShot = new EnemyBullet(feedbackScene);
feedbackScene._enemyBulletHitPlayer(feedbackScene.player, pepeShot);
assert(!feedbackLives[0].active && feedbackLives[0].visible);
assert.equal(feedbackLives[0].tint, DamageFeedbackSettings.tint);
assert.equal(feedbackScene.player.tint, DamageFeedbackSettings.tint);
assert.equal(rings.length, 1); assert.equal(rings[0].radius, 14);
assert.deepEqual([rings[0].x, rings[0].y], [400, 500]);
feedbackScene._enemyBulletHitPlayer(feedbackScene.player, pepeShot);
assert.equal(feedbackLives.filter(life => life.active).length, 2, 'duplicate collision does not repeat life loss');
assert.equal(rings.length, 1);
for (const [now, tinted] of [[50, false], [100, true], [150, false], [200, true]]) {
    tickFeedback(now);
    assert.equal(feedbackScene.player.tint === DamageFeedbackSettings.tint, tinted);
}
// Directional and turning skins retain tint and collision geometry.
for (const [direction, now] of [[-1, 200], [1, 201], [1, 234], [-1, 235], [0, 236]]) {
    Ship.setDirection(feedbackScene.player, direction, now);
    assert.equal(feedbackScene.player.tint, DamageFeedbackSettings.tint);
    assert.deepEqual(playerGeometry(), undamagedGeometry);
}
// A second genuine life loss still counts while the pulse is active, but the
// pulse does not restart or stack. Only the latest removed HUD icon flashes.
tickFeedback(240);
feedbackScene._damagePlayer();
assert.equal(feedbackLives.filter(life => life.active).length, 1);
assert.equal(rings.length, 1); assert(!feedbackLives[0].visible);
assert(feedbackLives[1].visible && !feedbackLives[1].active);
tickFeedback(250);
assert.equal(feedbackScene.player.tint, undefined); assert(rings[0].destroyed);
tickFeedback(540);
assert(!feedbackLives[1].visible); assert.equal(feedbackLives[1].tint, undefined);

// Fatal feedback finishes even though GAME OVER disables the avatar.
feedbackScene._damagePlayer();
assert.equal(feedbackScene.state, GameState.GameOver);
assert(!feedbackScene.player.active); assert.equal(rings.length, 2);
tickFeedback(840);
assert(rings[1].destroyed); assert(!feedbackLives[2].visible);
assert.equal(feedbackScene.player.tint, undefined);
feedbackScene._damagePlayer(); assert.equal(rings.length, 2);
feedbackScene.state = GameState.Playing; feedbackScene.player.active = true;
feedbackScene._damagePlayer(); assert.equal(rings.length, 2, 'no remaining life means no feedback');

// Restart cleanup restores tint, hides removed icons and cancels deadlines.
feedback.show(feedbackLives[2]);
const cancelledRing = rings[rings.length - 1];
feedback.clear(); feedback.clear();
assert(cancelledRing.destroyed); assert(!feedbackLives[2].visible);
assert.equal(feedbackScene.player.tint, undefined);
tickFeedback(2000); assert.equal(feedbackScene.player.tint, undefined);
feedback.show(feedbackLives[2]);
feedbackScene.events.emit('shutdown');
assert(rings.every(ring => ring.destroyed));
assert(!feedbackLives[2].visible); assert.equal(visualListeners.length, 0);
assert.equal(feedbackScene.player.tint, undefined);
feedback.destroy();

// Use the real lives initialization/reset/recovery code and transition method.
const recoveryScene = new MainScene();
recoveryScene.game = { canvas: { width: 800, height: 600 } };
recoveryScene.add = { text: () => ({ setText() { return this; }, setOrigin() { return this; } }) };
let lifeIcons = [], livesGroupConfig;
recoveryScene.physics = { world: { bounds: { left: 0, right: 800, top: 0, bottom: 600 } }, add: { group(config) {
    livesGroupConfig = config;
    return {
        clear() { lifeIcons.forEach(icon => icon.destroy()); lifeIcons = []; },
        create(x, y, texture) { const icon = new Sprite(recoveryScene, x, y, texture).setVisible(true); lifeIcons.push(icon); return icon; },
        countActive: () => lifeIcons.filter(icon => icon.active).length,
        getFirstAlive: () => lifeIcons.find(icon => icon.active),
        getLast: state => lifeIcons.slice().reverse().find(icon => icon.active === state),
        getFirstDead: () => lifeIcons.find(icon => !icon.active)
    };
} } };
let recoveryCalls = 0;
const recoverOneLife = ScoreManager.prototype.recoverOneLife;
ScoreManager.prototype.recoverOneLife = function() { recoveryCalls++; return recoverOneLife.call(this); };
recoveryScene.scoreManager = new ScoreManager(recoveryScene);
ScoreManager.prototype.recoverOneLife = recoverOneLife;
recoveryScene.scoreManager.recoverOneLife = function() { recoveryCalls++; return recoverOneLife.call(this); };
const lifeCount = () => recoveryScene.scoreManager.lives.countActive(true);
assert.equal(MAX_LIVES, 3); assert.equal(livesGroupConfig.maxSize, MAX_LIVES);
assert.equal(lifeCount(), 3); assert.equal(recoveryCalls, 0, 'initial Wave 1 does not grant recovery');
assert(lifeIcons.every(icon => icon.visible !== false && icon.alpha === 0.6));
recoveryScene.time = { now: 0 };
recoveryScene.player = new Sprite(recoveryScene, 400, 500, 'ship');
let activeRecoveryShots = 0, recoveryWaveSpawns = 0;
recoveryScene.assetManager = {
    bullets: { countActive: () => activeRecoveryShots }, reset() {}, gameOver() {}
};
recoveryScene.alienManager = { reset() { recoveryWaveSpawns++; }, stopMovement() {} };
recoveryScene.sound = { play() {} };
recoveryScene.state = GameState.Playing;
recoveryScene._startNextWave();
assert.equal(recoveryCalls, 0);
// Regression: fixed slots [1,2,3] -> [2,3] -> [3] -> [2,3] -> [1,2,3].
const initialIconGeometry = lifeIcons.map(icon => [icon.x, icon.y, icon.scaleX, icon.scaleY, icon.alpha, icon.texture.key]);
function assertConsecutiveLives(expected) {
    assert.equal(lifeCount(), expected);
    const expectedSlots = [[], [3], [2, 3], [1, 2, 3]][expected];
    assert.deepEqual(lifeIcons.map((icon, index) => icon.active ? index + 1 : null).filter(Boolean), expectedSlots);
    assert.deepEqual(lifeIcons.map((icon, index) => icon.visible ? index + 1 : null).filter(Boolean), expectedSlots);
    assert.deepEqual(lifeIcons.map(icon => [icon.x, icon.y, icon.scaleX, icon.scaleY, icon.alpha, icon.texture.key]), initialIconGeometry,
        'icon positions, spacing, size, opacity and artwork stay unchanged');
}
assertConsecutiveLives(3);
recoveryScene._damagePlayer(); assertConsecutiveLives(2);
recoveryScene._damagePlayer(); assertConsecutiveLives(1);
recoveryScene.scoreManager.recoverOneLife(); assertConsecutiveLives(2);
recoveryScene.scoreManager.recoverOneLife(); assertConsecutiveLives(3);
for (const [beforeRecovery, afterRecovery] of [[1, 2], [2, 3], [3, 3]]) {
    recoveryScene.scoreManager.resetLives();
    for (let i = beforeRecovery; i < MAX_LIVES; i++) {
        recoveryScene.scoreManager.lives.getFirstAlive().setActive(false).setVisible(false);
    }
    const callsBefore = recoveryCalls, spawnsBefore = recoveryWaveSpawns;
    recoveryScene.state = GameState.WaveTransition;
    recoveryScene.nextWaveReadyAt = 1500;
    recoveryScene.time.now = 1499;
    recoveryScene._startNextWave();
    assert.equal(lifeCount(), beforeRecovery, 'no recovery during the transition delay');
    recoveryScene.time.now = 1500;
    activeRecoveryShots = 1;
    recoveryScene._startNextWave();
    assert.equal(lifeCount(), beforeRecovery, 'wait for player shots to finish naturally');
    activeRecoveryShots = 0;
    recoveryScene._startNextWave();
    assert.equal(lifeCount(), afterRecovery);
    assert.equal(lifeIcons.filter(icon => icon.visible).length, afterRecovery, 'HUD reflects recovery immediately');
    assertConsecutiveLives(afterRecovery);
    assert(lifeIcons.filter(icon => icon.active).every(icon => icon.tint === undefined && icon.alpha === 0.6));
    for (let i = 0; i < 100; i++) recoveryScene._startNextWave();
    assert.equal(lifeCount(), afterRecovery, 'no duplicate recovery within a single transition');
    assert.equal(recoveryCalls, callsBefore + 1);
    assert.equal(recoveryWaveSpawns, spawnsBefore + 1);
}
recoveryScene.scoreManager.resetLives();
for (let i = 0; i < MAX_LIVES; i++) recoveryScene._damagePlayer();
assert.equal(recoveryScene.state, GameState.GameOver); assert.equal(lifeCount(), 0);
assertConsecutiveLives(0);
const callsAtGameOver = recoveryCalls, waveAtGameOver = recoveryScene.wave;
recoveryScene.time.now = 10000;
for (let i = 0; i < 5; i++) recoveryScene._startNextWave();
assert.equal(lifeCount(), 0); assert.equal(recoveryCalls, callsAtGameOver);
recoveryScene.scoreManager.recoverOneLife();
assert.equal(lifeCount(), 0, 'recovery cannot revive a zero-life player');
recoveryScene.state = GameState.WaveTransition;
recoveryScene._startNextWave();
assert.equal(recoveryScene.wave, waveAtGameOver, 'even a stale transition cannot start a wave at zero lives');
assert.equal(lifeCount(), 0);
recoveryScene.state = GameState.GameOver;
const callsBeforeRecoveryRestart = recoveryCalls;
recoveryScene.restart();
assert.equal(lifeCount(), 3); assert.equal(recoveryScene.wave, 1);
assert.equal(recoveryScene.state, GameState.Playing); assert(recoveryScene.player.active);
assert.equal(recoveryCalls, callsBeforeRecoveryRestart, 'restart resets lives without a Wave 1 bonus');
assert(lifeIcons.every(icon => icon.active && icon.visible !== false && icon.tint === undefined));
assertConsecutiveLives(3);
recoveryScene._startNextWave();
assert.equal(lifeCount(), 3); assert.equal(recoveryCalls, callsBeforeRecoveryRestart);
console.log('PASS: banana selection, fixed arcs, explosion-only damage, radius/window, single hits, animation and lifecycle cleanup; existing wave, movement, skin, DOGE and PEPE regressions.');
console.log('PASS: shared DOGE feedback, damage gates, PEPE impact removal, directional tint, pulse coalescing, HUD life accounting, GAME OVER and shutdown cleanup.');
console.log('PASS: capped new-wave life recovery (1 to 2, 2 to 3, 3 to 3), immediate HUD, transition gates, no duplicates or revival, initial Wave 1 and restart.');
console.log('PASS: fixed HUD slots [1,2,3] -> [2,3] -> [3] -> [2,3] -> [1,2,3], zero lives and restart; lost leftmost icon retains damage flash.');
console.log('PASS: approved DOGE size/margins/edge limits unchanged; centered 6x4 alternating waves, exact 1.30x invader sizing and proportional bodies, no overlap, unchanged speeds/25px descent and canvas boundaries.');
console.log('PASS: flying banana 36x24 -> 54x36 (+50%), unchanged launch/arc/rotation including edge landings, unchanged yellow explosion scale/radius/window and explosion-only damage.');
