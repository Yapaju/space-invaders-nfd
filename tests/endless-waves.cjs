// Run with: node tests/endless-waves.cjs (uses the existing TypeScript dependency).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const testDocument = { createElement() {
    let image;
    const canvas = { getContext: () => ({
        drawImage(source) { image = source; },
        getImageData: () => ({ data: new Uint8ClampedArray(image.pixels) }),
        putImageData(data) { canvas.pixels = data.data; }
    }) };
    return canvas;
} };

class Sprite {
    constructor(scene, x = 0, y = 0, texture) {
        const size = texture === 'alien' ? [337, 282] : texture === 'ship' ? [335, 320] : texture === 'bullet' ? [6, 36] : [32, 32];
        Object.assign(this, { scene, active: true, x, y, width: size[0], height: size[1],
            texture: { key: texture || 'ship' }, textureChanges: 0,
            originX: 0.5, originY: 0.5, scaleX: 1, scaleY: 1 });
        this.anims = { stop: () => { this.animationKey = undefined; } };
        const sprite = this;
        this.body = {
            sourceWidth: size[0], sourceHeight: size[1], offsetX: 0, offsetY: 0,
            setSize(width, height) { this.sourceWidth = width; this.sourceHeight = height; },
            setOffset(x, y) { this.offsetX = x; this.offsetY = y; },
            updateBounds() {},
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
    setScale(value, y = value) { this.scaleX = value; this.scaleY = y; return this; }
    setAngle(value) { this.angle = value; return this; }
    setCrop(x, y, width, height) { this.crop = { x, y, width, height }; return this; }
    setTint(value) { this.tint = value; return this; }
    clearTint() { this.tint = undefined; return this; }
    setVisible(value) { this.visible = value; return this; }
    setActive(value) { this.active = value; return this; }
    setAlpha(value) { this.alpha = value; return this; }
    setDepth(value) { this.depth = value; return this; }
    setCollideWorldBounds(value) { this.body.setCollideWorldBounds(value); return this; }
    on(event, callback) { this.listeners = this.listeners || {}; this.listeners[event] = callback; return this; }
    setTexture(key) {
        this.texture.key = key; this.textureChanges++;
        if (key === 'bullet') { this.width = 6; this.height = 36; }
        if (key === 'rapid-electric-laser') { this.width = 64; this.height = 128; }
        return this;
    }
    setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; }
    setDisplaySize(width, height) { this.scaleX = width / this.width; this.scaleY = height / this.height; return this; }
    preUpdate() {}
    get top() { return this.getBounds().top; }
    get displayOriginX() { return this.originX * this.width; }
    get displayOriginY() { return this.originY * this.height; }
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
const { WojakBoss, WojakSettings, WojakAssets, WojakLayers, Wojak25Poses, Wojak0Poses, WojakMinus30Poses, WojakMinus70Poses, WojakLighting, formatWojakPortfolio, WojakVisualSettings, WojakPhase, WojakDevelopment, shouldStartWojakTest, WOJAK_TRIGGER_AFTER_WAVE } = load('src/interface/wojak-boss.ts');
const { GameState } = load('src/interface/game-state.ts');
const { ScoreManager, MAX_LIVES } = load('src/interface/manager/score-manager.ts');
const { AlienManager } = load('src/interface/manager/alien-manager.ts');
const { AssetManager } = load('src/interface/manager/asset-manager.ts');
const { Bullet, ElectricLaserSettings } = load('src/interface/bullet.ts');
const { RapidFire, RapidFireSettings } = load('src/interface/rapid-fire.ts');
const { BuffIndicator, BuffIndicatorSettings } = load('src/interface/buff-indicator.ts');
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
const { GoldenNumber, GoldenUiAssets, UiDepth, UiTexture, digitTexture, recolorDigitPixels } = load('src/interface/golden-number.ts');
const { ElonAlly, ElonState, ElonSettings, ElonAppearancePresets, ELON_VISUAL_TEST_OVERRIDE, selectElonDescent, ElonCarRegistration } = load('src/interface/elon-ally.ts');
const uiDimensions = new Map(GoldenUiAssets.map(asset => {
    const png = fs.readFileSync(path.resolve(__dirname, '../assets', asset.path));
    return [asset.key, [png.readUInt32BE(16), png.readUInt32BE(20)]];
}));
const uiImages = [];
function uiImage(scene, x, y, key) {
    assert(uiDimensions.has(key), `missing UI texture ${key}`);
    const sprite = new Sprite(scene, x, y, key);
    [sprite.width, sprite.height] = uiDimensions.get(key);
    uiImages.push(sprite);
    return sprite;
}

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
WojakAssets.forEach(pose => assert(textureRequests.some(request => request.asset === pose.asset && request.url === pose.path)));
for (const direction of ['left', 'right']) {
    assert(textureRequests.some(request => request.asset === `elon-ally-${direction}` &&
        request.url === `meme-skins/elon-ally-${direction}.png`));
    assert(textureRequests.some(request => request.asset === `elon-ally-hit-${direction}` &&
        request.url === `meme-skins/elon-ally-hit-${direction}.png`));
    assert(textureRequests.some(request => request.asset === `elon-ally-escape-${direction}` &&
        request.url === `meme-skins/elon-ally-escape-${direction}.png`));
}
assert.equal(GoldenUiAssets.length, 14, 'four complete labels/images plus ten digits, no A-Z engine');
GoldenUiAssets.forEach(asset => assert(textureRequests.some(request => request.asset === asset.key && request.url === asset.path)));
assert.deepEqual(sheetRequests, [
    { asset: 'rapid-electric-laser', url: 'weapons/rapid-laser/rapid-laser-spritesheet.png', config: { frameWidth: 64, frameHeight: 128 } },
    { asset: 'kaboom', url: 'images/explode.png', config: { frameWidth: 128, frameHeight: 128 } },
    { asset: 'ponke-explosion', url: 'meme-skins/ponke-explosion.png', config: { frameWidth: 128, frameHeight: 128 } }
]);
const animationConfigs = [];
const animationScene = { anims: {
    exists: key => animationConfigs.some(config => config.key === key),
    create(config) { animationConfigs.push(config); },
    generateFrameNumbers(texture, range) { return { texture, start: range.start, end: range.end }; }
} };
new AnimationFactory(animationScene);
assert.equal(animationConfigs.length, 3);
assert.deepEqual(animationConfigs[0], { key: 'rapid-electric-laser',
    frames: { texture: 'rapid-electric-laser', start: 0, end: 5 }, frameRate: 14, repeat: -1 });
for (const [index, key] of ['kaboom', 'ponke-explosion'].entries()) {
    assert.deepEqual(animationConfigs[index + 1], {
        key, frames: { texture: key, start: 0, end: 15 },
        frameRate: 24, repeat: 0, hideOnComplete: true
    });
}
new AnimationFactory(animationScene);
assert.equal(animationConfigs.filter(config => config.key === ElectricLaserSettings.animation).length, 1, 'shared electric animation registered once');
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
    // The wider Gundam art leaves slightly more vertical padding in the same frame.
    assert(margin >= 20 && margin <= 30, `visible Gundam DOGE bottom margin ${margin}`);
    nearSkin(draw[7] / draw[8], draw[3] / draw[4]);
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

// These normal-wave regressions isolate progression after the one-off boss.
const scene = new MainScene();
scene.wojakCompleted = true;
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
    scoreText: { setText() {} }, waveText: { setText(text) { score.waveLabel = `WAVE ${text}`; } },
    waveAnnouncement: {
        setText(text) { score.message = `WAVE ${text}`; return this; },
        setVisible(visible) { if (!visible && score.message.startsWith('WAVE')) score.message = ''; return this; }
    },
    gameOverImage: { setVisible(visible) {
        if (visible) score.message = 'GAME OVER';
        else if (score.message === 'GAME OVER') score.message = '';
        return this;
    } },
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
let allyClearCount = 0;
const allyWaveStarts = [];
scene.elonAlly = { clear() { allyClearCount++; }, startWave(wave) { allyWaveStarts.push(wave); }, update() {}, tryHit() { return false; } };
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
assert.equal(allyClearCount, 1, 'wave completion cancels pending/active allies');
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
assert.deepEqual(allyWaveStarts, [2], 'new-wave ally selection runs once at the actual wave start');
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
const allyClearsBeforeRestart = allyClearCount;
scene.restart();
assert.equal(allyClearCount, allyClearsBeforeRestart + 1);
assert.equal(allyWaveStarts[allyWaveStarts.length - 1], 1, 'restart reinitializes ally state for Wave 1');
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
const feedbackLives = [0, 1, 2].map(i => new Sprite(feedbackScene, 700 + i * 30, 60, 'ship').setAlpha(1));
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
assert.equal(feedbackLives[0].alpha, 1, 'life-loss flash preserves full icon opacity');
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
recoveryScene.wojakCompleted = true; // Isolate ordinary new-wave life recovery.
recoveryScene.game = { canvas: { width: 800, height: 600 } };
recoveryScene.add = { image: (x, y, key) => uiImage(recoveryScene, x, y, key) };
let uiShutdownListeners = [];
recoveryScene.events = {
    once(event, callback, context) { uiShutdownListeners.push({ event, callback, context }); },
    off(event, callback, context) { uiShutdownListeners = uiShutdownListeners.filter(item =>
        item.event !== event || item.callback !== callback || item.context !== context); }
};
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
assert(lifeIcons.every(icon => icon.visible !== false && icon.alpha === 1 && icon.tint === undefined));
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
    assert(lifeIcons.filter(icon => icon.active).every(icon => icon.tint === undefined && icon.alpha === 1));
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
// Golden UI layout, value updates and lifecycle use the real PNG dimensions.
const uiManager = recoveryScene.scoreManager;
assert.equal(uiManager.scoreText.text, '0000');
assert.equal(uiManager.waveText.text, '1');
lifeIcons.forEach((icon, index) => {
    near(icon.width * icon.scaleX, 35);
    near(icon.x, 686.5 + 38 * index); near(icon.y, 49);
    assert.equal(icon.depth, UiDepth.Hud);
    assert.equal(icon.alpha, 1); assert.equal(icon.tint, undefined);
});
assert(lifeIcons[0].getBounds().right < lifeIcons[1].getBounds().left);
assert(lifeIcons[1].getBounds().right < lifeIcons[2].getBounds().left);
near(lifeIcons[2].getBounds().right, 780);
lifeIcons[0].setActive(false).setVisible(false).setAlpha(0.2).setTint(0x123456);
uiManager.recoverOneLife();
assert(lifeIcons[0].active && lifeIcons[0].visible);
assert.equal(lifeIcons[0].alpha, 1); assert.equal(lifeIcons[0].tint, undefined);
uiManager.increaseScore(12345);
assert.equal(uiManager.scoreText.text, '12345');
const sameLengthImages = uiManager.scoreText.digits.slice();
uiManager.increaseScore(1);
assert(uiManager.scoreText.digits.every((image, index) => image === sameLengthImages[index]));
uiManager.setHighScore();
assert.equal(uiManager.scoreText.text, '0000');
assert(sameLengthImages[4].destroyed, 'shrinking numeric values destroys surplus sprites');
for (const wave of [1, 12, 100, 999999, 1000000000000]) {
    uiManager.setWave(wave);
    assert.equal(uiManager.waveText.text, String(wave));
    uiManager.setWaveText(wave);
    const previousAnnouncement = new GoldenNumber(recoveryScene, {
        x: 400, y: 300, height: 96, align: 'center', maxWidth: 720,
        gap: 4, labelGap: 20, depth: UiDepth.Overlay, label: UiTexture.Wave
    }).setText(String(wave));
    near(uiManager.waveAnnouncement.width, previousAnnouncement.width * 0.85);
    near(uiManager.waveAnnouncement.height, previousAnnouncement.height * 0.85);
    const oldGap = previousAnnouncement.digits[0].getBounds().left - previousAnnouncement.label.getBounds().right;
    const newGap = uiManager.waveAnnouncement.digits[0].getBounds().left - uiManager.waveAnnouncement.label.getBounds().right;
    near(newGap, oldGap * 0.85);
    previousAnnouncement.destroy();
    const images = [uiManager.waveAnnouncement.label, ...uiManager.waveAnnouncement.digits];
    const left = images[0].getBounds().left, right = images[images.length - 1].getBounds().right;
    near((left + right) / 2, 400);
    assert(left >= 94 - 1e-7 && right <= 706 + 1e-7);
    const tops = images.map(image => image.getBounds().top);
    const bottoms = images.map(image => image.getBounds().bottom);
    tops.forEach(top => near(top, tops[0]));
    bottoms.forEach(bottom => near(bottom, bottoms[0]));
    near((tops[0] + bottoms[0]) / 2, 300);
    assert(images.every(image => image.visible && image.depth === UiDepth.Overlay));
    assert.equal(uiManager.gameOverImage.visible, false);
}
uiManager.setWaveText(12);
uiManager.setWave(12);
near(uiManager.waveAnnouncement.height, 96 * 0.85);
near(uiManager.waveText.height, 22);
uiManager.setGameOverText();
assert.equal(uiManager.gameOverImage.texture.key, UiTexture.GameOver);
assert.equal(uiManager.gameOverImage.visible, true);
assert.equal(uiImages.filter(image => image.active && image.texture.key === UiTexture.GameOver).length, 1);
assert(uiManager.waveAnnouncement.digits.every(image => !image.visible));
near(uiManager.gameOverImage.x, 400); near(uiManager.gameOverImage.y, 300);
near(uiManager.gameOverImage.scaleX, uiManager.gameOverImage.scaleY);
near(uiManager.gameOverImage.width * uiManager.gameOverImage.scaleX, 760 * 0.70);
near(uiManager.gameOverImage.height * uiManager.gameOverImage.scaleY, 760 * 749 / 2098 * 0.70);
assert(uiManager.gameOverImage.getBounds().left >= 0 && uiManager.gameOverImage.getBounds().right <= 800);
assert.equal(uiManager.gameOverImage.depth, UiDepth.Overlay);
assert(UiDepth.Overlay > UiDepth.Hud && UiDepth.Hud > 1, 'explicit UI depth beats gameplay creation order and impact rings');
uiManager.hideText();
assert(!uiManager.gameOverImage.visible && !uiManager.waveAnnouncement.label.visible);
const imageCountBeforeRestarts = () => uiImages.filter(image => image.active).length;
uiManager.setWaveText(1); uiManager.hideText(); uiManager.setWave(1);
const stableImageCount = imageCountBeforeRestarts();
for (let i = 0; i < 25; i++) {
    uiManager.increaseScore(10); uiManager.setWaveText(1); uiManager.setGameOverText();
    recoveryScene.restart();
    assert.equal(uiManager.scoreText.text, '0000'); assert.equal(uiManager.waveText.text, '1');
    assert(!uiManager.gameOverImage.visible && !uiManager.waveAnnouncement.label.visible);
    assert.equal(imageCountBeforeRestarts(), stableImageCount, 'restart reuses UI objects without leaks');
}
for (const align of ['left', 'center', 'right']) {
    const number = new GoldenNumber(recoveryScene, { x: 400, y: 300, height: 24,
        maxWidth: 160, depth: UiDepth.Hud, align });
    number.setText('1234567890');
    const left = number.digits[0].getBounds().left;
    const right = number.digits[number.digits.length - 1].getBounds().right;
    near(right - left, 160);
    near(align === 'left' ? left : align === 'right' ? right : (left + right) / 2, 400);
    assert(number.digits.every(image => image.height * image.scaleY <= 24));
    number.destroy(); number.destroy();
}
const ownedUiImages = uiImages.filter(image => image.active);
uiShutdownListeners.slice().forEach(listener => listener.callback.call(listener.context));
assert(ownedUiImages.every(image => image.destroyed), 'scene shutdown destroys all owned UI images');
assert.equal(uiShutdownListeners.length, 0);

// Elon uses original transparent PNGs and plain sprites, never Arcade bodies.
assert.deepEqual([0, 0.399999, 0.40, 0.749999, 0.75, 0.999999].map(selectElonDescent), [2, 2, 3, 3, 4, 4]);
const descentWeights = { 2: 0, 3: 0, 4: 0 };
for (let sample = 0; sample < 10000; sample++) descentWeights[selectElonDescent((sample + 0.5) / 10000)]++;
assert.deepEqual(descentWeights, { 2: 4000, 3: 3500, 4: 2500 }, 'exact 40/35/25 weighted intervals');
const elonImages = new Map(['left', 'right', 'hit-left', 'hit-right', 'escape-left', 'escape-right'].map(direction => {
    const filename = direction;
    const png = decodePng(fs.readFileSync(path.resolve(__dirname, `../assets/meme-skins/elon-ally-${filename}.png`)));
    assert.equal(png.width, 1536); assert.equal(png.height, 1024);
    assert(png.pixels.some((value, index) => index % 4 === 3 && value === 0), 'ally PNG retains real transparency');
    return [`elon-ally-${direction}`, { width: png.width, height: png.height, pixels: png.pixels }];
}));
const elonSprites = [];
const elonScene = {
    textures: { get: key => ({ getSourceImage: () => elonImages.get(key) }) },
    physics: { world: { bounds: { left: 0, right: 800 } }, add: {
        sprite() { assert.fail('ally must not get a physics body'); },
        group() { assert.fail('ally must not enter an enemy or collision group'); }
    } },
    time: { now: 0, delayedCall() { assert.fail('no ally arrival timer'); }, addEvent() { assert.fail('no ally timers'); } },
    add: { sprite(x, y, key) {
        const image = elonImages.get(key);
        const sprite = new Sprite(elonScene, x, y, key);
        sprite.width = image.width; sprite.height = image.height;
        delete sprite.body;
        elonSprites.push(sprite); return sprite;
    } }
};
let elonRolls = 0;
let elonRandomValues = [0.299999, 0.499999, 0, 0.30];
const elon = new ElonAlly(elonScene, () => { elonRolls++; assert(elonRandomValues.length); return elonRandomValues.shift(); });
elon.startWave(1); elon.onDescent(1); elon.onDescent(2);
elon.startWave(2); elon.onDescent(2); elon.update(1000000);
assert.equal(elonRolls, 0); assert.equal(elonSprites.length, 0);
elon.startWave(3); elon.startWave(3);
assert.equal(elonRolls, 3, 'one eligibility, direction and target draw, no repeated wave-start roll');
elon.onDescent(1); elon.update(1000000);
assert.equal(elonSprites.length, 0, 'time alone never triggers an appearance');
elon.onDescent(2);
assert.equal(elonSprites.length, 1, 'selected wave spawns synchronously on second descent at time zero');
const elonRight = elonSprites[0];
assert.equal(elonRight.texture.key, 'elon-ally-right');
assert.equal(elonRight.body, undefined);
assert(elonRight.getBounds().right < 0, 'spawn fully outside the left edge');
near(elonRight.width * elonRight.scaleX, 1536 * 84 * 1.30 / 1403);
near(elonRight.height * elonRight.scaleY, 1024 * 84 * 1.30 / 1403);
near(elonRight.scaleX, elonRight.scaleY);
near(1403 * elonRight.scaleX, 84 * 1.30);
near(678 * elonRight.scaleY, 678 * 84 * 1.30 / 1403);
near(elonRight.y, 89.5);
const idleDraw = actualPoseDraws.get('ship');
const hudVisibleBottom = 49 + (idleDraw[6] + idleDraw[8] - 320 / 2) * 35 / 335;
const pepeImage = decodePng(fs.readFileSync(path.resolve(__dirname, '../assets/meme-skins/pepe-invader.png')));
const pepeVisible = visibleImageBounds(pepeImage.pixels, pepeImage.width, pepeImage.height);
const invaderVisibleTop = 150 + (pepeVisible.y - 282 / 2) * MemeSkins.Invader.displayWidth / 337;
assert(89.5 - 678 * elonRight.scaleY / 2 > hudVisibleBottom, 'enlarged ally clears visible HUD artwork');
assert(89.5 + 678 * elonRight.scaleY / 2 < invaderVisibleTop,
    'enlarged ally clears visible PEPE artwork after two descents');
assert(elonRight.depth < UiDepth.Hud);
const elonStartX = elonRight.x;
elon.update(1000); near(elonRight.x - elonStartX, 280); near(elonRight.y, 89.5);
elon.onDescent(2); elon.onDescent(3); elon.onDescent(4);
assert.equal(elonSprites.length, 1); assert.equal(elonRolls, 3);
elon.update(100000);
assert(elonRight.destroyed); assert.equal(elon.sprite, undefined);
elon.onDescent(5); assert.equal(elonSprites.length, 1, 'no second appearance after exiting');
elon.startWave(4);
assert.equal(elonRolls, 4, 'failed chance uses one draw and no direction/target draw');
elon.onDescent(1); elon.onDescent(2); elon.update(100000);
assert.equal(elonSprites.length, 1);
for (const directionRoll of [0, 0.499999, 0.5, 0.999999]) {
    elon.clear(); elonRandomValues = [0, directionRoll, 0]; elon.startWave(3);
    elon.onDescent(2);
    const sprite = elon.sprite;
    near(sprite.scaleX, sprite.scaleY);
    near(1403 * sprite.scaleX, 109.2);
    near(sprite.y, 89.5);
    assert.equal(sprite.texture.key, directionRoll < 0.5 ? 'elon-ally-right' : 'elon-ally-left');
    if (directionRoll >= 0.5) {
        assert(sprite.getBounds().left > 800, 'spawn fully outside the right edge');
        const x = sprite.x;
        elon.update(1000); near(sprite.x, x - 280);
    }
    elon.update(100000); assert(sprite.destroyed);
}
elon.clear(); elonRandomValues = [0, 0, 0, 0, 0, 0];
elon.startWave(3); elon.onDescent(1); elon.clear(); elon.onDescent(2);
assert.equal(elon.sprite, undefined, 'cancel pending appearance on wave completion/restart/shutdown');
elon.startWave(4); elon.onDescent(1);
assert.equal(elon.sprite, undefined, 'a new wave cannot inherit the previous descent count');
elon.onDescent(2); const cancelledElon = elon.sprite;
elon.clear(); elon.clear(); assert(cancelledElon.destroyed);

// Every eligible wave independently uses the same threshold, including long
// losing streaks. Extra direction/descent RNG is separate from appearance RNG.
let chanceDraws = [], chanceCalls = 0, selectedWaves = 0;
const chanceAlly = new ElonAlly(elonScene, () => {
    chanceCalls++; assert(chanceDraws.length); return chanceDraws.shift();
});
chanceAlly.startWave(1); chanceAlly.startWave(2); assert.equal(chanceCalls, 0);
for (let i = 0; i < 1000; i++) {
    // Alternating groups include 700 consecutive failures, then fresh successes.
    const roll = ((i + 300) % 1000 + 0.5) / 1000;
    const succeeds = roll < 0.30;
    chanceDraws = succeeds ? [roll, 0, 0] : [roll];
    const calls = chanceCalls;
    chanceAlly.startWave(i + 3); chanceAlly.startWave(i + 3);
    assert.equal(chanceCalls - calls, succeeds ? 3 : 1);
    assert.equal(chanceAlly.pending, succeeds);
    assert.equal(chanceDraws.length, 0);
    for (const descent of [2, 3, 4, 2]) chanceAlly.onDescent(descent);
    if (chanceAlly.sprite) selectedWaves++;
    assert.equal(!!chanceAlly.sprite, succeeds);
}
assert.equal(selectedWaves, 300);
chanceAlly.clear(); chanceAlly.startWave(1); chanceAlly.startWave(2);
chanceDraws = [0, 0, 0]; chanceAlly.startWave(3); chanceAlly.onDescent(2);
assert(chanceAlly.sprite, 'restart allows a fresh Wave 3 roll'); chanceAlly.clear();

// Integrate with actual formation edge steps, including multi-edge long frames.
const descentAlly = new ElonAlly(elonScene, () => 0);
const allyFormation = new AlienManager(formationScene);
const descentEvents = [];
allyFormation.onDescent = count => {
    descentEvents.push(count);
    descentAlly.onDescent(count);
    assert.equal(!!descentAlly.sprite, count >= 2, 'ally appears in the exact second descent callback');
};
allyFormation.reset(3); descentAlly.startWave(3);
const startTravel = 800 - Math.max(...allyFormation.aliens.getChildren().map(alien => alien.getBounds().right));
const travelAcross = 800 - 527.36;
allyFormation.update((startTravel + travelAcross * 2) / allyFormation.speed * 1000 + 1e-8, 10000);
assert.deepEqual(descentEvents, [1, 2, 3], 'one event per formation step, not per invader');
assert.equal(allyFormation.descentCount, 3);
allyFormation.reset(4); assert.equal(allyFormation.descentCount, 0);
descentAlly.clear(); descentAlly.startWave(4);
const allyGameOver = new MainScene();
allyGameOver.player = new Sprite(allyGameOver);
allyGameOver.scoreManager = { setGameOverText() {} };
allyGameOver.alienManager = allyFormation;
allyGameOver.elonAlly = descentAlly;
allyGameOver._gameOver();
descentAlly.onDescent(2); assert.equal(descentAlly.sprite, undefined, 'GAME OVER cancels selected appearances');
assert.equal(allyGameOver.state, GameState.GameOver);
// A fatal second descent counts as movement, but must not spawn a doomed ally
// before the scene applies its unchanged invasion GAME OVER handling.
allyFormation.reset(3); descentAlly.startWave(3);
const fatalDescentEvents = [];
allyFormation.onDescent = count => { fatalDescentEvents.push(count); descentAlly.onDescent(count); };
allyFormation.update(startTravel / allyFormation.speed * 1000 + 1e-8, 10000);
assert.equal(allyFormation.descentCount, 1);
const invasionLine = Math.max(...allyFormation.aliens.getChildren().map(alien => alien.body.bottom)) + 1;
assert.equal(allyFormation.update(travelAcross / allyFormation.speed * 1000 + 1e-8, invasionLine), true);
assert.equal(allyFormation.descentCount, 2);
assert.deepEqual(fatalDescentEvents, [1]);
allyGameOver._gameOver();
descentAlly.onDescent(2); assert.equal(descentAlly.sprite, undefined);
assert(elonSprites.every(sprite => sprite.destroyed), 'all ally sprites release on exit/cleanup');
// Production is the default; explicitly injected visual-test presets remain
// available to exercise guaranteed appearances and weighted arrival mechanics.
assert.equal(ELON_VISUAL_TEST_OVERRIDE, false);
assert.equal(ElonSettings.firstWave, 3); assert.equal(ElonSettings.appearanceChance, 0.30);
assert.equal(ElonAppearancePresets.production.firstWave, 3);
assert.equal(ElonAppearancePresets.production.appearanceChance, 0.30);
assert.equal(ElonSettings.speed, 280);
let testRolls = 0;
const guaranteedElon = new ElonAlly(elonScene, () => { testRolls++; return 0.999999; }, ElonAppearancePresets.visualTest);
guaranteedElon.startWave(1); guaranteedElon.onDescent(1); guaranteedElon.onDescent(2);
assert.equal(testRolls, 0); assert.equal(guaranteedElon.sprite, undefined);
for (let wave = 2; wave <= 8; wave++) {
    const oldRolls = testRolls;
    guaranteedElon.startWave(wave); guaranteedElon.startWave(wave);
    assert.equal(testRolls, oldRolls + 3, 'one appearance, direction and descent draw per test wave');
    const before = elonSprites.length;
    guaranteedElon.onDescent(1); guaranteedElon.update(1000000);
    assert.equal(elonSprites.length, before, 'no timed or first-descent spawn');
    guaranteedElon.onDescent(2); guaranteedElon.onDescent(3);
    assert.equal(elonSprites.length, before, 'no appearance before selected descent 4');
    guaranteedElon.onDescent(4);
    assert.equal(elonSprites.length, before + 1, 'each eligible test wave spawns immediately on selected descent 4');
    const selected = guaranteedElon.sprite;
    assert.equal(selected.texture.key, 'elon-ally-left');
    near(selected.width * selected.scaleX, 1536 * 109.2 / 1403);
    guaranteedElon.onDescent(2); guaranteedElon.onDescent(3);
    assert.equal(guaranteedElon.sprite, selected); assert.equal(elonSprites.length, before + 1);
    guaranteedElon.update(100000);
    assert(selected.destroyed); assert.equal(testRolls, oldRolls + 3);
}
guaranteedElon.startWave(9); guaranteedElon.onDescent(1); guaranteedElon.clear(); guaranteedElon.onDescent(2);
assert.equal(guaranteedElon.sprite, undefined);
guaranteedElon.startWave(1); assert.equal(guaranteedElon.sprite, undefined);
assert(elonSprites.every(sprite => sprite.destroyed));

// Each weighted target spawns synchronously from descent events, independently
// of direction, and selection is made once even with repeated wave updates.
let arrivalDraws = [], arrivalRolls = 0, arrivalWave = 1;
const arrivalAlly = new ElonAlly(elonScene, () => { arrivalRolls++; assert(arrivalDraws.length); return arrivalDraws.shift(); }, ElonAppearancePresets.visualTest);
for (const directionRoll of [0.499999, 0.5]) {
    for (const targetRoll of [0, 0.399999, 0.40, 0.749999, 0.75, 0.999999]) {
        arrivalDraws = [0.999999, directionRoll, targetRoll];
        const before = arrivalRolls;
        arrivalAlly.startWave(++arrivalWave); arrivalAlly.startWave(arrivalWave);
        assert.equal(arrivalRolls, before + 3); assert.equal(arrivalDraws.length, 0);
        const target = selectElonDescent(targetRoll);
        assert.equal(arrivalAlly.targetDescent, target);
        for (let descent = 1; descent < target; descent++) {
            arrivalAlly.onDescent(descent); arrivalAlly.update(100000);
            assert.equal(arrivalAlly.sprite, undefined, 'time cannot spawn an ally before its selected descent');
        }
        arrivalAlly.onDescent(target);
        const selected = arrivalAlly.sprite;
        assert(selected, 'spawn inside the selected descent callback');
        assert.equal(selected.texture.key, directionRoll < 0.5 ? 'elon-ally-right' : 'elon-ally-left');
        for (const count of [target, target + 1, target + 2]) arrivalAlly.onDescent(count);
        assert.equal(arrivalAlly.sprite, selected); assert.equal(arrivalRolls, before + 3);
        arrivalAlly.clear(); assert(selected.destroyed); assert.equal(arrivalAlly.targetDescent, 0);
    }
}
arrivalDraws = [0, 0, 0.99]; arrivalAlly.startWave(++arrivalWave);
arrivalAlly.onDescent(2); arrivalAlly.onDescent(3); arrivalAlly.clear(); arrivalAlly.onDescent(4);
assert.equal(arrivalAlly.sprite, undefined, 'early wave completion cancels the selected fourth descent');
arrivalDraws = [0, 0, 0]; arrivalAlly.startWave(++arrivalWave); arrivalAlly.onDescent(2);
assert(arrivalAlly.sprite, 'new wave selects afresh instead of retaining descent 4'); arrivalAlly.clear();

// Both hit directions use the real PNG bounds; no physics/timer allocations.
for (const directionRoll of [0, 0.999999]) {
    let directionDraw = 0;
    const hitAlly = new ElonAlly(elonScene, () => directionDraw++ % 3 === 1 ? directionRoll : 0);
    elonScene.time.now = 100;
    hitAlly.startWave(3); hitAlly.onDescent(2);
    const sprite = hitAlly.sprite;
    sprite.x = 400;
    const shot = { enable: true, left: 397, right: 403, top: 71.5, bottom: 107.5 };
    const originalShot = { ...shot };
    assert.equal(hitAlly.state, ElonState.Flying);
    assert.equal(hitAlly.tryHit({ ...shot, enable: false }), false);
    assert.equal(hitAlly.tryHit({ ...shot, left: 460, right: 466 }), false, 'horizontal miss');
    assert.equal(hitAlly.tryHit({ ...shot, top: 117, bottom: 130 }), false, 'transparent padding is not hittable');
    const width = 1403 * sprite.scaleX, height = 678 * sprite.scaleY;
    near(width, 109.2); near(height, 52.77091945830364);
    assert.equal(hitAlly.tryHit(shot), true);
    assert.deepEqual(shot, originalShot, 'collision never resizes or moves the projectile body');
    assert.equal(hitAlly.state, ElonState.Hit);
    const key = directionRoll < 0.5 ? 'elon-ally-hit-right' : 'elon-ally-hit-left';
    assert.equal(sprite.texture.key, key);
    const image = elonImages.get(key);
    const art = visibleImageBounds(image.pixels, image.width, image.height);
    const bounds = sprite.getBounds();
    near(bounds.left + (art.x + art.width / 2) * sprite.scaleX, 400);
    near(bounds.top + (art.y + art.height / 2) * sprite.scaleY, 89.5);
    near(sprite.scaleX, sprite.scaleY);
    near(art.height * sprite.scaleY, height);
    assert(art.width * sprite.scaleX <= width, 'hit art stays within the original visible envelope');
    assert.equal(sprite.tint, 0x5555ff);
    for (const elapsed of [0, 49, 50, 99, 100, 149, 150, 199, 200, 249, 250, 999]) {
        elonScene.time.now = 100 + elapsed;
        assert.equal(hitAlly.tryHit(shot), false, 'additional hits cannot consume shots or extend the deadline');
        hitAlly.update(5000);
        near(sprite.x, 400); near(sprite.y, 89.5);
        assert.equal(sprite.textureChanges, 1);
        assert(!sprite.destroyed, 'hit frame lives until the 1000 ms deadline');
        assert.equal(sprite.tint, elapsed < 250 && Math.floor(elapsed / 50) % 2 === 0 ? 0x5555ff : undefined);
    }
    const registration = ElonCarRegistration[key];
    const carWidth = registration.width * sprite.scaleX;
    const wheelX = sprite.x + (registration.x - sprite.displayOriginX) * sprite.scaleX;
    const wheelY = sprite.y + (registration.y - sprite.displayOriginY) * sprite.scaleY;
    elonScene.time.now = 1100; hitAlly.update(0);
    assert.equal(hitAlly.state, ElonState.Escaping); assert(!sprite.destroyed);
    const escapeKey = directionRoll < 0.5 ? 'elon-ally-escape-right' : 'elon-ally-escape-left';
    assert.equal(sprite.texture.key, escapeKey); assert.equal(sprite.tint, undefined);
    near(sprite.x, 400); near(sprite.y, 89.5);
    const escape = ElonCarRegistration[escapeKey];
    near(escape.width * sprite.scaleX, carWidth);
    near(sprite.x + (escape.x - sprite.displayOriginX) * sprite.scaleX, wheelX);
    near(sprite.y + (escape.y - sprite.displayOriginY) * sprite.scaleY, wheelY);
    near(sprite.scaleX, sprite.scaleY);
    // Continuous acceleration, in original direction, reaching 700 px/s.
    let previousX = sprite.x, previousDistance = 0;
    for (const elapsed of [50, 100, 150, 200, 250, 300, 350]) {
        elonScene.time.now = 1100 + elapsed;
        assert.equal(hitAlly.tryHit(shot), false, 'escape never consumes additional shots');
        hitAlly.update(50);
        const distance = (sprite.x - previousX) * (directionRoll < 0.5 ? 1 : -1);
        assert(distance >= previousDistance - 1e-9, 'speed increases smoothly without reversing');
        if (elapsed >= 300) near(distance, 700 * 0.05);
        previousDistance = distance; previousX = sprite.x;
        near(sprite.y, 89.5); assert.equal(sprite.textureChanges, 2);
        hitAlly.update(5000); near(sprite.x, previousX, 'escape displacement follows elapsed time, not frame count');
    }
    elonScene.time.now = 10000; hitAlly.update(0);
    assert(sprite.destroyed); assert.equal(hitAlly.state, ElonState.Removed);
    assert.equal(hitAlly.sprite, undefined); assert.equal(hitAlly.tryHit(shot), false);
    hitAlly.onDescent(2); assert.equal(hitAlly.sprite, undefined, 'removal does not grant a second appearance');
    // Clearing a hit cancels its deadline; a later wave cannot inherit it.
    hitAlly.startWave(4); hitAlly.onDescent(2); hitAlly.sprite.x = 400;
    assert(hitAlly.tryHit(shot));
    const cancelled = hitAlly.sprite;
    hitAlly.clear(); hitAlly.clear(); assert(cancelled.destroyed);
    hitAlly.startWave(5); hitAlly.onDescent(2);
    elonScene.time.now += 1001; hitAlly.update(0);
    assert.equal(hitAlly.state, ElonState.Flying); assert(!hitAlly.sprite.destroyed);
    hitAlly.clear();
}

// Actual scene update consumes only a successful player shot, after overlaps.
const hitScene = new MainScene();
const sceneAlly = new ElonAlly(elonScene, () => 0);
sceneAlly.startWave(3); sceneAlly.onDescent(2); sceneAlly.sprite.x = 400;
const shots = [new Sprite(hitScene), new Sprite(hitScene), new Sprite(hitScene)];
shots.forEach((shot, index) => { shot.body = { enable: true, left: index === 0 ? 600 : 397,
    right: index === 0 ? 606 : 403, top: 71.5, bottom: 107.5 }; });
const enemyShot = new Sprite(hitScene);
let enemyIterations = 0;
Object.assign(hitScene, {
    state: GameState.Playing, wave: 2, time: elonScene.time,
    starfield: { tilePositionY: 0 }, player: new Sprite(hitScene), firingTimer: Infinity,
    elonAlly: sceneAlly, _shipKeyboardHandler() {},
    alienManager: { update: () => false, aliens: { getChildren: () => [] }, stopMovement() {}, reset() {} },
    assetManager: { bullets: { getChildren: () => shots }, enemyBullets: [enemyShot], reset() {} },
    scoreManager: { increaseScore() { assert.fail('ally hits cannot score'); }, setGameOverText() {},
        setHighScore() {}, resetLives() {}, setWave() {}, hideText() {} },
    physics: { world: { bounds: { left: 0, right: 800, bottom: 600 } }, overlap(group) {
        if (group === hitScene.assetManager.enemyBullets) {
            enemyIterations++;
            assert(!shots[1].destroyed, 'successful shot destruction is deferred until overlaps complete');
            assert.equal(shots[1].active, false);
        }
    } }
});
hitScene.update(0, 0);
assert(shots[0].active && !shots[0].destroyed, 'miss passes normally');
assert(shots[1].destroyed, 'successful player shot consumed');
assert(shots[2].active && !shots[2].destroyed, 'HIT ally ignores subsequent shots');
assert(enemyShot.active && !enemyShot.destroyed); assert.equal(enemyIterations, 1);
const gameOverHit = sceneAlly.sprite;
hitScene._gameOver(); assert(gameOverHit.destroyed); assert.equal(sceneAlly.state, ElonState.Removed);
sceneAlly.startWave(3); sceneAlly.onDescent(2); sceneAlly.sprite.x = 400;
assert(sceneAlly.tryHit(shots[2].body)); const restartHit = sceneAlly.sprite;
hitScene.restart(); assert(restartHit.destroyed); assert.equal(sceneAlly.sprite, undefined);
assert.equal(sceneAlly.state, ElonState.Removed); assert.equal(hitScene.wave, 1);
elonScene.time.now += 2000; sceneAlly.update(0); sceneAlly.onDescent(2);
assert.equal(sceneAlly.sprite, undefined, 'no stale hit deadline or spawn after restart into Wave 1');
// Last-invader cleanup also removes an in-progress hit reaction.
hitScene.state = GameState.Playing;
sceneAlly.startWave(3); sceneAlly.onDescent(2); sceneAlly.sprite.x = 400;
assert(sceneAlly.tryHit(shots[2].body));
const transitionHit = sceneAlly.sprite;
hitScene.scoreManager.increaseScore = () => {};
hitScene.scoreManager.setWaveText = () => {};
hitScene.alienManager.hasAliveAliens = false;
hitScene.assetManager.explosions = { get: () => ({}) };
hitScene.assetManager.enemyBullets.clear = () => {};
hitScene._bulletHitAliens(new Sprite(hitScene), { active: true, kill() {}, destroy() {} });
assert.equal(hitScene.state, GameState.WaveTransition);
const transitionCleanup = hitScene.pendingCleanup; hitScene.pendingCleanup = [];
transitionCleanup.forEach(action => action());
assert(transitionHit.destroyed); assert.equal(sceneAlly.state, ElonState.Removed);
elonScene.time.now += 2000; sceneAlly.update(0);
assert.equal(sceneAlly.sprite, undefined);

// The shared lifecycle cleanup handles both stationary HIT and ESCAPING.
for (const phase of [ElonState.Hit, ElonState.Escaping]) {
    for (const action of ['gameOver', 'restart', 'wave', 'shutdown']) {
        hitScene.state = GameState.Playing;
        sceneAlly.startWave(3); sceneAlly.onDescent(2); sceneAlly.sprite.x = 400;
        assert(sceneAlly.tryHit(shots[2].body));
        const sprite = sceneAlly.sprite;
        if (phase === ElonState.Escaping) {
            elonScene.time.now += 1000; sceneAlly.update(0);
        }
        assert.equal(sceneAlly.state, phase);
        if (action === 'gameOver') hitScene._gameOver();
        else if (action === 'restart') hitScene.restart();
        else if (action === 'shutdown') sceneAlly.clear(); // MainScene's existing shutdown hook.
        else {
            hitScene._bulletHitAliens(new Sprite(hitScene), { active: true, kill() {}, destroy() {} });
            const pending = hitScene.pendingCleanup; hitScene.pendingCleanup = [];
            pending.forEach(callback => callback());
        }
        assert(sprite.destroyed); assert.equal(sceneAlly.state, ElonState.Removed);
        assert.equal(sceneAlly.targetDescent, 0);
        elonScene.time.now += 2000; sceneAlly.update(100000); sceneAlly.onDescent(4);
        assert.equal(sceneAlly.sprite, undefined, `${action} leaves no stale escape or pending arrival`);
    }
}
assert(elonSprites.every(sprite => sprite.destroyed));
// Verify the supplied horizontal RGBA sheet against all six original frames.
const electricSheet = decodePng(fs.readFileSync(path.resolve(__dirname, '../assets/weapons/rapid-laser/rapid-laser-spritesheet.png')));
assert.equal(electricSheet.width, 384); assert.equal(electricSheet.height, 128);
for (let frame = 0; frame < 6; frame++) {
    const png = decodePng(fs.readFileSync(path.resolve(__dirname, '../assets/weapons/rapid-laser/rapid-laser-0' + (frame + 1) + '.png')));
    assert.equal(png.width, 64); assert.equal(png.height, 128);
    assert(png.pixels.some((value, index) => index % 4 === 3 && value === 0));
    assert(png.pixels.some((value, index) => index % 4 === 3 && value > 0));
    for (let y = 0; y < 128; y++) for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4, j = (y * 384 + frame * 64 + x) * 4;
        assert.equal(electricSheet.pixels[j + 3], png.pixels[i + 3]);
        if (png.pixels[i + 3]) for (let channel = 0; channel < 3; channel++) {
            assert.equal(electricSheet.pixels[j + channel], png.pixels[i + channel], 'visible sheet pixels match individual assets');
        }
    }
}

// Use Phaser's actual Clock/TimerEvent to verify expiration, pause and timeScale.
for (const originY of [0.5, 1]) {
    const projectileScene = { sound: { play() {} }, physics: { world: {
        bounds: { left: 0, right: 800, top: 0, bottom: 600 }
    } } };
    const projectile = new Bullet(projectileScene).setOrigin(0.5, originY);
    projectile.angle = 0;
    projectile.body = new ArcadeBody({ defaults: {}, bounds: {} }, projectile);
    projectile.setVelocityY = value => { projectile.body.velocity.y = value; return projectile; };
    const worldShape = () => [projectile.body.left, projectile.body.top, projectile.body.width,
        projectile.body.height, projectile.body.velocity.y, projectile.x, projectile.y, projectile.originX, projectile.originY];
    projectile.shoot(400, 300); projectile.body.preUpdate(false, 0);
    const blueShape = worldShape();
    for (let reuse = 0; reuse < 3; reuse++) {
        projectile.shoot(400, 300, true); projectile.body.preUpdate(false, 0);
        blueShape.forEach((value, index) => near(worldShape()[index], value));
        near(projectile.width * projectile.scaleX, 20); near(projectile.height * projectile.scaleY, 40);
        for (let frame = 0; frame < 6; frame++) {
            // All frames share source dimensions; frame switches must leave
            // the explicitly sized physics rectangle and velocity untouched.
            projectile.setTexture('rapid-electric-laser'); projectile.body.preUpdate(false, 0);
            blueShape.forEach((value, index) => near(worldShape()[index], value));
        }
        projectile.shoot(400, 300); projectile.body.preUpdate(false, 0);
        blueShape.forEach((value, index) => near(worldShape()[index], value));
        assert.equal(projectile.animationKey, undefined); near(projectile.scaleX, 1);
        near(projectile.body.offset.x, 0); near(projectile.body.offset.y, 0);
    }
    projectile.shoot(400, 300, true); projectile.y = -37; projectile.update();
    assert(projectile.destroyed, 'electric artwork padding does not delay natural projectile clearing');
}

// Derived NFD digit palettes keep the exact source shapes, alpha and dimensions.
const fontSources = new Map(Array.from({ length: 10 }, (_, digit) => {
    const png = decodePng(fs.readFileSync(path.resolve(__dirname, `../assets/font/nfd-font-${digit}.png`)));
    return [`nfd-font-${digit}`, png];
}));
const coloredFonts = new Map();
const fontTextures = {
    exists: key => fontSources.has(key) || coloredFonts.has(key),
    get: key => ({ getSourceImage: () => fontSources.get(key) || coloredFonts.get(key) || elonImages.get(key) }),
    addCanvas(key, canvas) {
        assert(!coloredFonts.has(key), 'each digit/color texture is generated once');
        coloredFonts.set(key, canvas); uiDimensions.set(key, [canvas.width, canvas.height]);
    }
};
const fontScene = { textures: fontTextures };
for (let digit = 0; digit < 10; digit++) {
    const source = fontSources.get(`nfd-font-${digit}`), original = Buffer.from(source.pixels);
    assert.equal(digitTexture(fontScene, String(digit)), `nfd-font-${digit}`, 'default HUD uses original gold');
    const key = digitTexture(fontScene, String(digit), 0xff3030);
    assert.equal(key, `nfd-font-${digit}-color-ff3030`);
    assert.equal(digitTexture(fontScene, String(digit), 0xff3030), key);
    const red = coloredFonts.get(key);
    assert.equal(red.width, source.width); assert.equal(red.height, source.height);
    let vividPixels = 0;
    for (let i = 0; i < source.pixels.length; i += 4) {
        assert.equal(red.pixels[i + 3], source.pixels[i + 3], 'exact original alpha on every frame pixel');
        if (source.pixels[i + 3]) {
            const high = Math.max(source.pixels[i], source.pixels[i + 1], source.pixels[i + 2]);
            assert.equal(red.pixels[i], high, 'preserve original shading/highlight intensity');
            assert.equal(red.pixels[i + 1], red.pixels[i + 2], 'electric red hue, no yellow/gold cast');
            assert(red.pixels[i] >= red.pixels[i + 1]);
            if (red.pixels[i] > 230 && red.pixels[i + 1] < 120) vividPixels++;
        }
    }
    assert(vividPixels > 0, 'each digit contains vivid red');
    assert(original.equals(Buffer.from(source.pixels)), 'source gold pixels remain unchanged');
}
assert.equal(coloredFonts.size, 10);
const greenSample = new Uint8ClampedArray([255, 190, 0, 128, 255, 255, 255, 255, 0, 0, 0, 0]);
recolorDigitPixels(greenSample, 0x30ff30);
assert.deepEqual(Array.from(greenSample), [48, 255, 48, 128, 255, 255, 255, 255, 0, 0, 0, 0], 'future buff palettes retain alpha and white highlights');

const Clock = require('phaser/src/time/Clock');
const EventEmitter = require('eventemitter3');
const bonusScene = new MainScene();
const bonusGraphics = [], bonusDigits = [], bonusShots = [];
bonusScene.events = new EventEmitter();
bonusScene.game = { canvas: { width: 800, height: 600 }, loop: { time: 1000 } };
bonusScene.sys = { events: bonusScene.events, game: bonusScene.game };
bonusScene.time = new Clock(bonusScene);
bonusScene.events.emit('boot'); bonusScene.events.emit('start');
bonusScene.add = {
    image(x, y, key) {
        const sprite = uiImage(bonusScene, x, y, key);
        const setTexture = sprite.setTexture.bind(sprite);
        sprite.setTexture = key => { setTexture(key); [sprite.width, sprite.height] = uiDimensions.get(key); return sprite; };
        bonusDigits.push(sprite); return sprite;
    },
    sprite: (x, y, key) => elonScene.add.sprite(x, y, key),
    graphics() {
        const graphic = {
            ellipses: [],
            setPosition(x, y) { this.x = x; this.y = y; return this; },
            setDepth(depth) { this.depth = depth; return this; },
            clear() { return this; }, fillStyle() { return this; }, fillCircle(x, y, radius) { this.radius = radius; return this; },
            lineStyle(width, color, alpha) { this.stroke = width; this.color = color; this.alpha = alpha; return this; },
            strokeCircle() { return this; }, beginPath() { return this; },
            strokeEllipse(x, y, width, height) { this.ellipses.push({ width, height, stroke: this.stroke, color: this.color, alpha: this.alpha }); return this; },
            arc(x, y, radius, start, end, anticlockwise) { Object.assign(this, { start, end, anticlockwise }); return this; },
            strokePath() { return this; }, destroy() { this.destroyed = true; }
        };
        bonusGraphics.push(graphic); bonusScene.children.add(graphic); return graphic;
    }
};
bonusScene.sound = { play() {} };
bonusScene.state = GameState.Playing; bonusScene.wave = 2;
bonusScene.player = new Sprite(bonusScene, 400, 500);
applySkinAppearance(bonusScene.player, MemeSkins.Player);
bonusScene.player.setDepth(0);
const List = require('phaser/src/structs/List');
bonusScene.children = new List();
const auraBackground = { depth: 0 };
bonusScene.children.add(auraBackground); bonusScene.children.add(bonusScene.player);
bonusScene.starfield = { tilePositionY: 0 }; bonusScene.firingTimer = Infinity;
bonusScene._shipKeyboardHandler = () => {};
bonusScene.physics = { world: { bounds: { left: 0, right: 800, top: 0, bottom: 600 } }, overlap() {} };
bonusScene.textures = fontTextures;
bonusScene.alienManager = { update: () => false, aliens: { getChildren: () => [] },
    stopMovement() {}, reset() {}, hasAliveAliens: false };
bonusScene.scoreManager = { increaseScore() { assert.fail('bonus activation must not score'); },
    setGameOverText() {}, setHighScore() {}, resetLives() {}, setWave() {}, hideText() {},
    setWaveText() {}, recoverOneLife() {}, noMoreLives: false };
bonusScene.assetManager = {
    bullets: { get() {
        const shot = new Bullet(bonusScene);
        shot.width = shot.body.sourceWidth = 6; shot.height = shot.body.sourceHeight = 36;
        shot.body.enable = true;
        Object.defineProperties(shot.body, {
            left: { get: () => shot.x - 3 }, right: { get: () => shot.x + 3 }
        });
        bonusShots.push(shot); return shot;
    }, getChildren: () => bonusShots, countActive: () => 0 },
    enemyBullets: { clear() {} }, explosions: { get: () => ({}) },
    reset() { bonusShots.forEach(shot => shot.destroy()); }
};
const intervalChanges = [];
bonusScene.rapidFire = new RapidFire(bonusScene, (previous, current) => {
    intervalChanges.push([previous, current]); bonusScene.bulletTime += current - previous;
}, () => bonusScene.playerShootingEnabled);
const rapid = bonusScene.rapidFire;
const tickBonus = delta => {
    bonusScene.events.emit('preupdate');
    bonusScene.events.emit('update', bonusScene.time.now + delta, delta);
    rapid.update();
    bonusScene.events.emit('postupdate');
};
assert.equal(RapidFireSettings.duration, 10000); assert.equal(RapidFireSettings.fireRateMultiplier, 1.5);
assert.equal(rapid.active, false); assert.equal(rapid.firingInterval, 200); assert.equal(bonusGraphics.length, 0);
bonusScene._fireBullet();
const normalShot = bonusShots[0]; assert.equal(normalShot.texture.key, 'bullet');
assert.equal(normalShot.velocityY, -400); near(bonusScene.bulletTime, 1200);
const unaffectedShot = bonusScene.assetManager.bullets.get(); unaffectedShot.shoot(600, 300);
bonusScene.elonAlly = new ElonAlly(bonusScene, () => 0);
bonusScene.elonAlly.startWave(3); bonusScene.elonAlly.onDescent(2); bonusScene.elonAlly.sprite.x = 400;
normalShot.setPosition(400, 89.5);
bonusScene.update(0, 0);
assert(normalShot.destroyed); assert(rapid.active, 'activation occurs on the successful hit before HIT animation completes');
assert.equal(bonusScene.elonAlly.state, ElonState.Hit); assert.equal(rapid.timer.getElapsed(), 0);
assert.equal(intervalChanges.length, 1); near(rapid.firingInterval, 200 / 1.5); near(bonusScene.bulletTime, 1000 + 200 / 1.5);
assert.equal(unaffectedShot.texture.key, 'bullet', 'existing blue shots remain blue');
assert.equal(bonusGraphics.filter(g => !g.destroyed).length, 1);
const circle = rapid.indicator.graphics;
assert.equal(rapid.aura, undefined, 'DOGE aura removed');
assert.equal(bonusScene.player.tint, undefined);
near(circle.x, 400); near(circle.y, 64); near(circle.radius * 2 + circle.stroke, 51);
assert(circle.y - circle.radius - circle.stroke / 2 > 32, 'gap below unchanged WAVE HUD');
assert(circle.y + circle.radius + circle.stroke / 2 < 100, 'clear of starting invader frames');
assert(circle.depth >= UiDepth.Hud && circle.depth < UiDepth.Overlay);
near(circle.start, -Math.PI / 2); near(circle.end - circle.start, 2 * Math.PI);
assert.equal(circle.anticlockwise, false);
assert.equal(circle.color, 0xff3030, 'electric-red ring from activation');
const countdown = rapid.indicator.number;
const assertCountdown = value => {
    assert.equal(countdown.text, String(value));
    assert.equal(circle.color, 0xff3030, 'ring stays electric red throughout the bonus');
    const digits = countdown.digits;
    near((digits[0].getBounds().left + digits[digits.length - 1].getBounds().right) / 2, 400);
    assert(digits.every(digit => /^nfd-font-\d-color-ff3030$/.test(digit.texture.key) && digit.depth > UiDepth.Hud));
};
assertCountdown(10);
const geometry = [unaffectedShot.width, unaffectedShot.height, unaffectedShot.scaleX, unaffectedShot.scaleY,
    unaffectedShot.originX, unaffectedShot.originY, unaffectedShot.body.sourceWidth, unaffectedShot.body.sourceHeight];
tickBonus(134); bonusScene._fireBullet();
const redShot = bonusShots[bonusShots.length - 1]; assert.equal(redShot.texture.key, 'rapid-electric-laser');
near(bonusScene.bulletTime, bonusScene.time.now + 200 / 1.5);
near(redShot.width * redShot.scaleX, 20); near(redShot.height * redShot.scaleY, 40);
near(redShot.body.sourceWidth * redShot.scaleX, 6); near(redShot.body.sourceHeight * redShot.scaleY, 36);
assert.equal(redShot.animationKey, ElectricLaserSettings.animation);
near(redShot.originX, unaffectedShot.originX); near(redShot.originY, unaffectedShot.originY);
assert.equal(redShot.velocityY, -400);
const shotCount = bonusShots.length; tickBonus(133); bonusScene._fireBullet(); assert.equal(bonusShots.length, shotCount);
tickBonus(1); bonusScene._fireBullet(); assert.equal(bonusShots.length, shotCount + 1);
const untilRemaining = remaining => tickBonus(rapid.timer.delay - rapid.timer.getElapsed() - remaining);
untilRemaining(9600); assertCountdown(10);
const disabledRemaining = rapid.timer.delay - rapid.timer.getElapsed();
const disabledEnd = circle.end, disabledShots = bonusShots.length;
bonusScene.player.setActive(false);
tickBonus(1234); bonusScene._fireBullet();
near(rapid.timer.delay - rapid.timer.getElapsed(), disabledRemaining);
near(circle.end, disabledEnd); assertCountdown(10); assert.equal(bonusShots.length, disabledShots);
bonusScene.player.setActive(true);
const pausedEnd = circle.end;
bonusScene.time.paused = true; tickBonus(5000);
assertCountdown(10); near(circle.end, pausedEnd, 'Phaser Clock pause freezes the buff');
bonusScene.time.paused = false; bonusScene.time.timeScale = 0.5;
tickBonus(2000); near(rapid.timer.delay - rapid.timer.getElapsed(), 8600);
bonusScene.time.timeScale = 1;
untilRemaining(8200); assertCountdown(9); near(circle.end - circle.start, 2 * Math.PI * 0.82);
untilRemaining(3000); assertCountdown(3); assert.equal(circle.color, RapidFireSettings.ringColor);
untilRemaining(2999); assertCountdown(3); assert.equal(circle.color, RapidFireSettings.ringColor);
untilRemaining(2100); assertCountdown(3);
untilRemaining(200); assertCountdown(1);
const expiringTimer = rapid.timer;
untilRemaining(0);
assert.equal(rapid.active, false); assert.equal(rapid.firingInterval, 200);
assert(circle.destroyed); assert.equal(rapid.indicator.number, undefined, 'no lingering zero');
assert.equal(rapid.aura, undefined);
assert.equal(expiringTimer.callback, undefined);
assert.equal(redShot.texture.key, 'rapid-electric-laser', 'existing red shots retain their color at expiration');
assert.equal(unaffectedShot.texture.key, 'bullet');
bonusScene._fireBullet(); assert.equal(bonusShots[bonusShots.length - 1].texture.key, 'bullet');
near(bonusScene.bulletTime, bonusScene.time.now + 200);
// The same projectile object also resets to blue when reused.
redShot.shoot(400, 500); assert.equal(redShot.texture.key, 'bullet');

rapid.activate(); tickBonus(9000);
const oldTimer = rapid.timer, oldIndicator = rapid.indicator.graphics;
const deadlineBeforeRefresh = bonusScene.bulletTime, changesBeforeRefresh = intervalChanges.length;
rapid.activate();
assert.equal(oldTimer.callback, undefined, 'refresh releases the old timer callback');
assert.equal(rapid.timer.delay - rapid.timer.getElapsed(), 10000);
assert.equal(rapid.indicator.number.text, '10');
assert.equal(rapid.indicator.graphics, oldIndicator, 'refresh reuses a single HUD indicator');
assert.equal(rapid.aura, undefined, 'refresh does not create an aura');
assert.equal(intervalChanges.length, changesBeforeRefresh); near(bonusScene.bulletTime, deadlineBeforeRefresh);
near(rapid.firingInterval, 200 / 1.5);
tickBonus(200); assert.equal(rapid.indicator.number.text, '10');
tickBonus(801); assert(rapid.active, 'old expiration cannot cancel refreshed boost');
assert.equal(bonusGraphics.filter(g => !g.destroyed).length, 1);

const boostDamageFeedback = new DamageFeedback(bonusScene, bonusScene.player);
boostDamageFeedback.show(new Sprite(bonusScene));
assert.equal(bonusScene.player.tint, DamageFeedbackSettings.tint);
rapid.update(); assert.equal(bonusScene.player.tint, DamageFeedbackSettings.tint, 'rapid fire does not overwrite red damage flashes');
assert.equal(rapid.aura, undefined);
tickBonus(50); assert.equal(bonusScene.player.tint, undefined, 'damage flash still alternates normally');
tickBonus(200); assert.equal(bonusScene.player.tint, undefined);
boostDamageFeedback.destroy();

// Actual wave completion freezes the same timer before Clock's next update,
// even if a lingering shot prolongs the announcement far beyond its delay.
const transitionTimer = rapid.timer;
const transitionElapsed = transitionTimer.getElapsed();
const transitionEnd = rapid.indicator.graphics.end, transitionNumber = rapid.indicator.number.text;
let bonusTrailingShots = 1;
bonusScene.assetManager.bullets.countActive = () => bonusTrailingShots;
bonusScene.scoreManager.increaseScore = () => {};
bonusScene._bulletHitAliens(new Sprite(bonusScene), { active: true, kill() {}, destroy() {} });
assert.equal(bonusScene.state, GameState.WaveTransition);
const bonusCleanup = bonusScene.pendingCleanup; bonusScene.pendingCleanup = [];
bonusCleanup.forEach(callback => callback());
assert.equal(rapid.timer, transitionTimer);
tickBonus(1000); bonusScene.update(0, 0);
assert.equal(bonusScene.state, GameState.WaveTransition); assert(rapid.active);
near(transitionTimer.getElapsed(), transitionElapsed);
near(rapid.indicator.graphics.end, transitionEnd); assert.equal(rapid.indicator.number.text, transitionNumber);
tickBonus(15000); bonusScene.update(0, 0);
assert.equal(bonusScene.state, GameState.WaveTransition); assert(rapid.active);
near(transitionTimer.getElapsed(), transitionElapsed);
near(rapid.indicator.graphics.end, transitionEnd); assert.equal(rapid.indicator.number.text, transitionNumber);
bonusTrailingShots = 0; bonusScene._startNextWave();
assert.equal(bonusScene.state, GameState.Playing); assert.equal(bonusScene.wave, 3);
assert.equal(rapid.timer, transitionTimer); assert(rapid.active);
tickBonus(37); near(transitionTimer.getElapsed(), transitionElapsed + 37);
assert(rapid.indicator.graphics.end < transitionEnd, 'ring resumes from its frozen progress');
untilRemaining(1); assert(rapid.active); assert.equal(rapid.indicator.number.text, '1');
tickBonus(1); assert(!rapid.active, 'expires after exactly 10000 ms of usable gameplay, excluding announcement');
assert.equal(rapid.aura, undefined);

// Repeated GAME OVER/restarts release HUD/timer state and start with blue shots.
for (let restart = 0; restart < 4; restart++) {
    if (!rapid.active) rapid.activate();
    const timer = rapid.timer;
    if (restart % 2 === 1) {
        bonusScene.state = GameState.WaveTransition; tickBonus(0);
        assert(timer.paused, 'also cancel bonuses paused for an announcement');
    }
    bonusScene._gameOver();
    assert(!rapid.active); assert.equal(rapid.firingInterval, 200); assert.equal(timer.callback, undefined);
    assert(bonusGraphics.every(graphic => graphic.destroyed));
    bonusScene.restart();
    assert(!rapid.active); assert.equal(bonusScene.wave, 1); assert.equal(rapid.indicator.graphics, undefined);
    tickBonus(1); bonusScene._fireBullet();
    const shot = bonusShots[bonusShots.length - 1];
    assert.equal(shot.texture.key, 'bullet'); near(bonusScene.bulletTime, bonusScene.time.now + 200);
    assert(bonusDigits.every(digit => digit.destroyed));
    tickBonus(0); assert.equal(bonusScene.time._active.length, 0, 'paused canceled timers retire instead of lingering');
}
rapid.activate();
const shutdownTimer = rapid.timer;
bonusScene.events.emit('shutdown');
assert(!rapid.active); assert.equal(shutdownTimer.callback, undefined);
assert(bonusGraphics.every(graphic => graphic.destroyed)); assert(bonusDigits.every(digit => digit.destroyed));
assert.equal(bonusScene.events.listenerCount('shutdown'), 0);
assert.equal(bonusScene.time._active.length, 0); assert.equal(bonusScene.time._pendingInsertion.length, 0);
assert.equal(bonusScene.events.listenerCount('preupdate'), 0); assert.equal(bonusScene.events.listenerCount('postupdate'), 0);
// Static logo content uses the same small component, without creating a buff.
const staticCircle = new BuffIndicator(bonusScene, { x: 450, y: 64, logo: 'nfd-font-1' });
staticCircle.show(); near(staticCircle.graphics.end - staticCircle.graphics.start, 2 * Math.PI);
assert.equal(staticCircle.number, undefined); near(staticCircle.logo.x, 450);
assert.equal(staticCircle.graphics.color, BuffIndicatorSettings.ring, 'default indicator palette unchanged');
staticCircle.clear(); staticCircle.clear();
const numberLayout = { x: 400, y: 64, height: 20, align: 'center', maxWidth: 36, depth: UiDepth.Hud };
const goldenReference = new GoldenNumber(bonusScene, numberLayout);
const redReference = new GoldenNumber(bonusScene, { ...numberLayout, digitColor: 0xff3030 });
for (const text of ['10', '9', '8', '3', '1']) {
    goldenReference.setText(text); redReference.setText(text);
    near(goldenReference.width, redReference.width); near(goldenReference.height, redReference.height);
    goldenReference.digits.forEach((gold, index) => {
        const red = redReference.digits[index];
        assert.equal(gold.texture.key, `nfd-font-${text[index]}`, 'other HUD digits stay golden');
        assert.equal(red.texture.key, `${gold.texture.key}-color-ff3030`);
        assert.deepEqual(red.getBounds(), gold.getBounds(), 'palette does not change placement or spacing');
    });
}
goldenReference.destroy(); redReference.destroy();
assert.equal(coloredFonts.size, 10, 'refreshes and countdown changes reuse the same palette cache');
assert(bonusGraphics.every(graphic => graphic.destroyed)); assert(bonusDigits.every(digit => digit.destroyed));
for (const [value, text] of [[50, '+50%'], [25, '+25%'], [1, '+1%'], [0, '0%'], [-1, '−1%'], [-25, '−25%'], [-99, '−99%'], [-99.9, '−99.9%']]) {
    assert.equal(formatWojakPortfolio(value), text);
}
// Wojak uses the actual supplied PNGs and a real Arcade physics rectangle.
const wojakImages = new Map(WojakAssets.map(pose => {
    const png = decodePng(fs.readFileSync(path.resolve(__dirname, '../assets', pose.path)));
    assert.equal(png.width, pose.asset === 'wojak-god-candle' ? 1024 : pose.asset === 'wojak-pump-it' ? 1774 : 1536);
    assert.equal(png.height, pose.asset === 'wojak-god-candle' ? 1536 : pose.asset === 'wojak-pump-it' ? 887 : 1024);
    assert(png.pixels.some((value, i) => i % 4 === 3 && value === 0));
    assert(png.pixels.some((value, i) => i % 4 === 3 && value > 0 && value < 255));
    return [pose.asset, png];
}));
const wojakSprites = [], wojakVisuals = [];
function wojakAdd(scene) {
    return {
        graphics() {
            const graphics = bonusScene.add.graphics();
            for (const name of ['setScale', 'moveTo', 'lineTo', 'closePath', 'fillPath']) {
                graphics[name] = () => graphics;
            }
            return graphics;
        },
        image(x, y, key) {
            if (!wojakImages.has(key)) return bonusScene.add.image(x, y, key);
            const image = new Sprite(scene, x, y, key);
            delete image.body; // scene.add.image has no Arcade body.
            const source = wojakImages.get(key);
            image.width = source.width; image.height = source.height;
            wojakVisuals.push(image); return image;
        },
        text(x, y, value, style) {
            const text = new Sprite(scene, x, y);
            text.text = value; text.style = style;
            text.setText = value => { text.text = value; text.width = value.length * 60 + 36; return text; };
            text.setColor = value => { text.style.color = value; return text; };
            text.setStroke = (value, thickness) => { text.style.stroke = value; text.style.strokeThickness = thickness; return text; };
            text.setShadow = (...args) => { text.shadow = args; return text; };
            wojakVisuals.push(text); return text;
        }
    };
}
function assertWojakLayers(boss) {
    const layer = boss.direction > 0 ? WojakLayers.right : WojakLayers.left;
    const defeated = boss.phase === WojakPhase.Complete;
    const pose = defeated ? { ...WojakMinus70Poses.right, character: `wojak-boss-rekt-${boss.direction > 0 ? 'right' : 'left'}` } :
        boss.portfolio <= -70 ? (boss.direction > 0 ? WojakMinus70Poses.right : WojakMinus70Poses.left) :
        boss.portfolio <= -30 ? (boss.direction > 0 ? WojakMinus30Poses.right : WojakMinus30Poses.left) :
        boss.portfolio <= 0 ? (boss.direction > 0 ? Wojak0Poses.right : Wojak0Poses.left) :
        boss.portfolio <= WojakSettings.poseThreshold ?
        (boss.direction > 0 ? Wojak25Poses.right : Wojak25Poses.left) : layer;
    const visual = WojakVisualSettings, scale = WojakSettings.displayScale;
    const left = boss.sprite.x - layer.anchorX * scale, top = boss.sprite.y - layer.anchorY * scale;
    assert.equal(boss.sprite.texture.key, layer.ship);
    assert.equal(boss.foreground.texture.key, layer.ship);
    assert.equal(boss.character.texture.key, pose.character);
    near(boss.foreground.x, boss.sprite.x); near(boss.foreground.y, boss.sprite.y);
    near(boss.character.x, left + pose.characterX * scale);
    near(boss.character.y, top + pose.characterY * scale);
    near(boss.character.scaleX, scale * pose.characterScale);
    near(boss.percentage.x, left + layer.percentageX * scale);
    near(boss.percentage.y, top + layer.percentageY * scale);
    near(boss.percentage.angle, layer.percentageAngle);
    const expectedText = defeated ? 'REKT' : boss.portfolio > 0 ? `+${boss.portfolio}%` : boss.portfolio < 0 ? `−${Math.abs(boss.portfolio)}%` : '0%';
    assert.equal(boss.percentage.text, expectedText);
    assert.equal(boss.percentage.style.color, boss.portfolio > 0 ? '#63ff65' : '#ff5555');
    assert.equal(boss.percentage.shadow[2], boss.portfolio > 0 ? '#27ff4b' : '#ff263f');
    assert.equal(boss.lighting.visible, !defeated);
    if (defeated) {
        assert(boss.charts.history.frozen);
        assert.equal(boss.charts.history.shown, boss.charts.history.candles.length);
        assert.equal(boss.charts.history.formation, 1);
        assert.equal(boss.percentage.shadow[3], 0);
        assert.equal(boss.percentage.shadow[4], false); assert.equal(boss.percentage.shadow[5], false);
    }
    assert(boss.percentage.width * boss.percentage.scaleX <= visual.percentageMaxWidth * scale + 1e-7);
    const expectedLight = WojakLighting[boss.portfolio > 0 ? 'green' : 'red'][boss.direction > 0 ? 'right' : 'left'];
    assert.equal(boss.lighting.texture.key, expectedLight);
    near(boss.lighting.x, boss.sprite.x); near(boss.lighting.y, boss.sprite.y);
    near(boss.lighting.scaleX, scale); near(boss.lighting.originX, boss.sprite.originX);
    near(boss.lighting.originY, boss.sprite.originY);
    assert(boss.foreground.depth < boss.lighting.depth && boss.lighting.depth < boss.percentage.depth);
    assert(boss.sprite.depth < boss.character.depth && boss.character.depth < boss.foreground.depth &&
        boss.foreground.depth < boss.percentage.depth);
    assert.equal(boss.sprite.crop.y + boss.sprite.crop.height, boss.foreground.crop.y,
        'ship crops partition translucent source pixels without double drawing');
    assert.equal(boss.foreground.crop.y + boss.foreground.crop.height, visual.canvasHeight);
    near(boss.character.crop.height * pose.characterScale + pose.characterY, visual.cockpitRimY,
        'character stops at cockpit rim and cannot bleed through translucent panels');
}
function createWojakSprite(scene, x, y, key) {
    const sprite = new Sprite(scene, x, y, key), image = wojakImages.get(key);
    sprite.width = image.width; sprite.height = image.height; sprite.angle = 0;
    sprite.body = new ArcadeBody(scene.physics.world, sprite);
    sprite.setImmovable = value => { sprite.body.immovable = value; return sprite; };
    wojakSprites.push(sprite); return sprite;
}
const wojakUnitScene = { physics: { world: { defaults: {}, bounds: new Phaser.Geom.Rectangle(0, 0, 800, 600) } } };
wojakUnitScene.physics.add = { sprite: (x, y, key) => createWojakSprite(wojakUnitScene, x, y, key) };
wojakUnitScene.add = wojakAdd(wojakUnitScene);
const unitWojak = new WojakBoss(wojakUnitScene);
unitWojak.start(); const firstWojak = unitWojak.sprite;
const initialLayers = [unitWojak.character, unitWojak.foreground, unitWojak.percentage, unitWojak.lighting];
assertWojakLayers(unitWojak);
assert.equal(unitWojak.percentage.style.fontStyle, 'bold');
assert.equal(unitWojak.percentage.style.color, '#63ff65');
assert(firstWojak.getBounds().bottom < 0, 'entrance starts completely offscreen');
near(firstWojak.width * firstWojak.scaleX, 337.92); near(firstWojak.height * firstWojak.scaleY, 225.28);
assert(firstWojak.body.immovable); assert.equal(firstWojak.body.moves, false);
assert.equal(unitWojak.portfolio, 50); assert.equal(unitWojak.hit(), false);
unitWojak.update(1499); assert.equal(unitWojak.phase, WojakPhase.Entrance);
unitWojak.update(1); assert.equal(unitWojak.phase, WojakPhase.Patrol);
near(firstWojak.y, WojakSettings.patrolY); near(firstWojak.x, 400);
unitWojak.update(500); near(firstWojak.x, 427.5); near(firstWojak.y, WojakSettings.patrolY + 7);
let wojakReversals = 0;
for (let frame = 0; frame < 500; frame++) {
    const x = firstWojak.x, direction = unitWojak.direction;
    unitWojak.update(77);
    if (direction !== unitWojak.direction) wojakReversals++;
    assert(Math.abs(firstWojak.x - x) <= 55 * 0.077 + 1e-7, 'no reversal jump');
    assert(firstWojak.x >= 205 && firstWojak.x <= 595);
    assert(firstWojak.getBounds().left >= 0 && firstWojak.getBounds().right <= 800);
    assert(firstWojak.getBounds().top > 89.5, 'below buff and fixed HUD');
    assert(firstWojak.y >= 248 && firstWojak.y <= 262);
    near(firstWojak.body.width, 270); near(firstWojak.body.height, 82);
    near(firstWojak.body.left, firstWojak.x - 135); near(firstWojak.body.top, firstWojak.y - 41);
    assertWojakLayers(unitWojak);
    assert(!firstWojak.flipX, 'use directional artwork without flipping');
}
assert(wojakReversals >= 4);
const initialWojakChanges = firstWojak.textureChanges;
for (let hit = 1; hit <= 150; hit++) {
    const before = [firstWojak.x, firstWojak.y, unitWojak.direction, unitWojak.patrolElapsed];
    assert(unitWojak.hit()); assert.equal(unitWojak.portfolio, hit < 150 ? 50 - hit : -99.9);
    assertWojakLayers(unitWojak);
    assert.equal(firstWojak.textureChanges, initialWojakChanges, 'hits never swap ship art');
    assert.deepEqual([firstWojak.x, firstWojak.y, unitWojak.direction, unitWojak.patrolElapsed], before);
    near(firstWojak.scaleX, WojakSettings.displayScale);
    near(firstWojak.body.width, 270); near(firstWojak.body.height, 82);
    near(firstWojak.body.left, firstWojak.x - 135); near(firstWojak.body.top, firstWojak.y - 41);
    assert(firstWojak.getBounds().left >= 0 && firstWojak.getBounds().right <= 800);
}
assert.equal(unitWojak.phase, WojakPhase.Complete); assert.equal(unitWojak.hit(), false);
assert.equal(unitWojak.update(2949), false); assert(!firstWojak.destroyed);
assert.equal(unitWojak.update(1), false);
assert.equal(unitWojak.update(3200), true); assert(firstWojak.destroyed);
assert(initialLayers.every(layer => layer.destroyed));
assert.equal(unitWojak.update(10000), false, 'completion fires once'); unitWojak.clear();
// PUMP IT finishes before the half-speed candle grows and pushes every layer.
assert.equal(WojakSettings.godCandleRiseDuration, 1200);
assert.equal(WojakSettings.godCandlePushDuration, 2000);
for (const direction of [1, -1]) {
    const boss = new WojakBoss(wojakUnitScene);
    boss.start(); boss.update(1500); boss.direction = direction;
    boss.portfolio = -98; boss.update(0);
    boss.hit(); assert.equal(boss.portfolio, -99);
    assert.equal(boss.character.texture.key, `wojak-boss--70-${direction > 0 ? 'right' : 'left'}`);
    assert.equal(boss.percentage.text, '−99%'); assert(boss.lighting.visible);
    // Defeat while a milestone tint is still active must clear it immediately.
    boss.flashElapsed = 0; boss.updateFlash(0);
    const flyingCandle = new Sprite(wojakUnitScene), flyingTear = new Sprite(wojakUnitScene);
    boss.candles.flights.push({ sprite: flyingCandle, size: 0 });
    boss.candles.pending.push({ size: 4, position: 0.5, delay: 250 });
    boss.tears.flights.push(flyingTear);
    const existingDisplay = boss.percentage, count = wojakVisuals.length;
    assert(boss.hit()); assert.equal(boss.portfolio, -99.9);
    assert.equal(boss.phase, WojakPhase.Complete); assert.equal(boss.shootingEnabled, false);
    assertWojakLayers(boss);
    assert.equal(boss.percentage, existingDisplay); assert.equal(wojakVisuals.length, count + 2);
    assert.equal(boss.percentage.text, 'REKT'); assert.equal(boss.lighting.visible, false);
    [boss.sprite, boss.character, boss.foreground].forEach(layer => assert.equal(layer.tint, undefined));
    assert(flyingCandle.destroyed && flyingTear.destroyed);
    assert.equal(boss.candles.pending.length, 0); assert.equal(boss.candles.flights.length, 0);
    assert.equal(boss.tears.flights.length, 0);
    const layers = [boss.sprite, boss.character, boss.foreground, boss.lighting, boss.percentage];
    const positions = () => layers.map(layer => [layer.x, layer.y, layer.angle, layer.texture.key]);
    const frozen = positions(), patrol = boss.patrolElapsed;
    boss.updateWeapons(5000, { active: true }, () => assert.fail('defeated boss cannot damage player'));
    assert.equal(boss.hit(), false);
    assert.equal(boss.update(500), false); assert.equal(boss.update(2449), false);
    assert.deepEqual(positions(), frozen); assert.equal(boss.patrolElapsed, patrol);
    assert.equal(boss.direction, direction); assert(layers.every(layer => !layer.destroyed));
    assert.equal(boss.update(1), false);
    const candle = boss.godCandle, extension = boss.godCandleBody;
    const oldScale = Math.max(0.5, (600 + 64 - (boss.candleContactY + boss.defeatExitY - boss.defeatY)) / (1536 - 134));
    near(candle.scaleX, oldScale * 0.5);
    near(candle.x, (boss.weaponGeometry().candles.left + boss.weaponGeometry().candles.right) / 2);
    assert(candle && !candle.body, 'pure visual candle cannot damage the player');
    const initialCrop = candle.crop.height, widthScale = candle.scaleX;
    near(candle.y + 134 * candle.scaleY, 600);
    boss.update(600);
    assert(candle.crop.height > initialCrop, 'visible body grows instead of a fixed projectile');
    near(boss.sprite.y, frozen[0][1]);
    near(candle.y + 134 * candle.scaleY, (600 + boss.candleContactY) / 2);
    boss.update(600);
    const contactY = candle.y + 134 * candle.scaleY;
    near(contactY, boss.weaponGeometry().candles.y);
    const contactCrop = candle.crop.height;
    for (let step = 0; step < 19; step++) {
        assert.equal(boss.update(100), false);
        if (step === 9) near(boss.sprite.y, (boss.defeatY + boss.defeatExitY) / 2);
        near(candle.y + 134 * candle.scaleY, boss.weaponGeometry().candles.y);
        near(candle.scaleX, widthScale); near(candle.scaleY, widthScale);
        near(extension.y, candle.y + 1535 * candle.scaleY);
        near(extension.scaleX, candle.scaleX);
        assert(extension.y + extension.scaleY >= 632, 'continuous candle bottom stays below screen');
        assert(candle.crop.height <= 1535, 'never sample outside source PNG');
        assertWojakLayers(boss);
        assert(layers.every(layer => !layer.destroyed));
    }
    assert(candle.crop.height >= contactCrop);
    assert(extension.scaleY > widthScale, 'smaller art uses a matching body extension');
    const ship = boss.sprite;
    assert.equal(boss.update(100), true);
    assert(ship.getBounds().bottom < 0, 'entire ship canvas exits before cleanup');
    assert(candle.destroyed && extension.destroyed && layers.every(layer => layer.destroyed));
    assert.equal(boss.update(1000), false, 'ending cannot advance progression twice');
    boss.start(); assert.equal(boss.percentage.text, '+50%'); assert(boss.lighting.visible);
    boss.clear();
}
// PUMP IT order, aspect ratio, readable bounds, fade and cancellation at each stage.
for (const [width, height] of [[800, 600], [480, 800], [1280, 720]]) {
    const bounds = wojakUnitScene.physics.world.bounds;
    const saved = { ...bounds };
    Object.assign(bounds, { left: 0, top: 0, right: width, bottom: height });
    for (const shipX of [205, 400, 595]) for (const cancelAt of [0, 250, 499, 500, 1499, 1500, 1650, 1750, 2749, 2750, 2850, 2949, 2950, 3200, 3450]) {
        const boss = new WojakBoss(wojakUnitScene);
        boss.start(); boss.update(1500); boss.sprite.x = shipX; boss.portfolio = -99; boss.hit();
        const character = boss.pumpCharacter, bubble = boss.pumpBubble;
        assert.equal(character.y, height); assert.equal(bubble.visible, false);
        assert(!character.body && !bubble.body);
        const objects = wojakVisuals.length;
        boss.update(cancelAt); boss.update(0);
        assert.equal(wojakVisuals.length, objects + (cancelAt >= 2950 ? 2 : 0), 'no duplicate sprites');
        const oldScale = Math.min(width * 0.48 / character.width, height * 0.48 / character.height);
        near(character.scaleX, oldScale * 0.5);
        near(character.getBounds().left, width * 0.02);
        if (cancelAt < 3450) {
            near(character.scaleX, character.scaleY); near(bubble.scaleX, bubble.scaleY);
            if (cancelAt < 2950) assert.equal(bubble.visible, cancelAt >= 1500);
            else assert(bubble.destroyed && !boss.pumpBubble, 'bubble removed before candle');
            assert(character.depth > boss.percentage.depth && bubble.depth > character.depth);
            const b = bubble.getBounds();
            assert(b.left >= 0 && b.right <= width && b.top >= 0 && b.bottom <= height);
            if (cancelAt >= 500) {
                const c = character.getBounds();
                assert(c.top < height && c.bottom > height, 'torso stays below canvas');
            }
            const finalY = height - character.height * oldScale * 0.5 * 0.86;
            if (cancelAt >= 500 && cancelAt <= 2950) near(character.y, finalY);
            if (cancelAt === 3200) near(character.y, (finalY + height) / 2);
            if (cancelAt >= 1750 && cancelAt < 2950) {
                near(bubble.scaleX, Math.min(width * 0.34 / bubble.width, height * 0.3 / bubble.height) * 0.5);
                near(bubble.alpha, cancelAt <= 2750 ? 1 : 1 - (cancelAt - 2750) / 200);
            }
        } else {
            assert(character.destroyed && bubble.destroyed);
            assert(!boss.pumpCharacter && !boss.pumpBubble);
        }
        assert.equal(!!boss.godCandle, cancelAt >= 2950);
        const candle = boss.godCandle;
        boss.clear();
        assert(character.destroyed && bubble.destroyed);
        if (candle) assert(candle.destroyed);
        boss.start(); assert.equal(boss.completionElapsed, 0);
        assert(!boss.pumpCharacter && !boss.pumpBubble); boss.clear();
    }
    Object.assign(bounds, saved);
}
// A suspended/long frame still completes once and cleans the whole cinematic.
{
    const boss = new WojakBoss(wojakUnitScene);
    boss.start(); boss.update(1500);
    for (let hit = 0; hit < 150; hit++) boss.hit();
    const ship = boss.sprite;
    assert.equal(boss.update(10000), true);
    assert(ship.destroyed && ship.getBounds().bottom < 0);
    assert.equal(boss.godCandle, undefined);
    assert.equal(boss.update(10000), false);
}
// Each exact threshold flashes once, keeps combat enabled, and supports
// reversal while pulsing. Adjacent non-threshold hits never restart the sequence.
for (const direction of [1, -1]) {
    for (const threshold of [25, 0, -30, -70]) {
        const boss = new WojakBoss(wojakUnitScene);
        boss.start(); boss.update(1500); boss.direction = direction;
        while (boss.portfolio > threshold + 1) { boss.hit(); boss.update(500); }
        boss.update(0); assertWojakLayers(boss);
        const position = [boss.sprite.x, boss.sprite.y, boss.sprite.scaleX, boss.sprite.body.width, boss.sprite.body.height];
        const beforePose = boss.character.texture.key;
        assert(boss.hit()); assert.equal(boss.portfolio, threshold);
        assert(boss.shootingEnabled); assertWojakLayers(boss);
        assert.notEqual(boss.character.texture.key, beforePose);
        assert.deepEqual([boss.sprite.x, boss.sprite.y, boss.sprite.scaleX, boss.sprite.body.width, boss.sprite.body.height], position);
        assert.equal(boss.character.tint, WojakSettings.milestoneFlashTint);
        assert.equal(boss.foreground.tint, WojakSettings.milestoneFlashTint);
        const initialX = boss.sprite.x;
        boss.direction *= -1;
        for (let elapsed = 1; elapsed <= 600; elapsed++) {
            boss.update(1);
            const red = elapsed < 600 && elapsed % 200 < 100;
            for (const layer of [boss.sprite, boss.character, boss.foreground]) {
                assert.equal(layer.tint, red ? WojakSettings.milestoneFlashTint : undefined,
                    `threshold ${threshold} at ${elapsed}ms`);
            }
            assert(boss.shootingEnabled, 'flashes do not gate combat');
            if (elapsed === 250) {
                assert(boss.hit()); assert.equal(boss.portfolio, threshold - 1);
                assert.equal(boss.flashElapsed, 250, 'adjacent hits never restart pulses');
                assertWojakLayers(boss);
            }
        }
        assert.notEqual(boss.sprite.x, initialX, 'patrol continues throughout flashes');
        boss.update(1000);
        assert.equal(boss.character.tint, undefined, 'remaining below threshold does not retrigger');
        boss.clear(); assert.equal(boss.flashElapsed, WojakSettings.milestoneFlashDuration);
    }
    // Explicit independent expectations for every range, including fractional
    // values immediately above/below boundaries and the defeat endpoint.
    for (const [value, pose] of [
        [50, '50'], [26, '50'], [25 + 1e-9, '50'], [25, '25'], [25 - 1e-9, '25'],
        [1, '25'], [1e-9, '25'], [0, '0'], [-1e-9, '0'], [-29, '0'], [-30 + 1e-9, '0'],
        [-30, '-30'], [-30 - 1e-9, '-30'], [-69, '-30'], [-70 + 1e-9, '-30'],
        [-70, '-70'], [-70 - 1e-9, '-70'], [-99, '-70'], [-99.9, '-70']
    ]) {
        const selected = unitWojak.characterPose.call({ direction, portfolio: value });
        assert.equal(selected.character, `wojak-boss-${pose}-${direction > 0 ? 'right' : 'left'}`);
    }
    // Crossing detection must not depend on landing on an exactly equal float.
    for (const threshold of [25, 0, -30, -70]) {
        const boss = new WojakBoss(wojakUnitScene);
        boss.start(); boss.update(1500); boss.direction = direction;
        boss.portfolio = threshold + 1e-9;
        boss.updatePercentage(); boss.update(0);
        assert(boss.hit()); assert(boss.portfolio < threshold);
        assert.equal(boss.flashElapsed, 0); assertWojakLayers(boss);
        boss.clear();
    }
}

// Rapid crossings queue one full sequence each; long frames consume queued
// time correctly, and both defeat and restart cancel all remaining pulses.
for (const finish of ['complete', 'defeat', 'restart']) {
    const boss = new WojakBoss(wojakUnitScene); boss.start(); boss.update(1500);
    while (boss.portfolio > -70) boss.hit();
    assert.equal(boss.pendingFlashes, 3);
    if (finish === 'complete') {
        for (let elapsed = 1; elapsed <= 2400; elapsed++) {
            boss.update(1);
            assert.equal(boss.character.tint,
                elapsed < 2400 && elapsed % 200 < 100 ? WojakSettings.milestoneFlashTint : undefined);
        }
        assert.equal(boss.pendingFlashes, 0);
    } else if (finish === 'defeat') {
        while (boss.portfolio > -99.9) boss.hit();
        assert.equal(boss.pendingFlashes, 0); assert.equal(boss.character.tint, undefined);
    } else {
        const layers = [boss.sprite, boss.character, boss.foreground]; boss.clear();
        assert(layers.every(layer => layer.destroyed)); assert.equal(boss.pendingFlashes, 0);
        boss.start(); boss.update(1500); assert.equal(boss.character.tint, undefined);
    }
    boss.clear();
}
{
    const boss = new WojakBoss(wojakUnitScene); boss.start(); boss.update(1500);
    while (boss.portfolio > -70) boss.hit();
    boss.update(1950); assert.equal(boss.pendingFlashes, 0);
    assert.equal(boss.flashElapsed, 150); assert.equal(boss.character.tint, undefined);
    boss.update(50); assert.equal(boss.character.tint, WojakSettings.milestoneFlashTint);
    boss.update(400); assert.equal(boss.character.tint, undefined); boss.clear();
}

assert.equal(WojakDevelopment.startAtEncounter, false);
assert.equal(shouldStartWojakTest(true), false);
WojakDevelopment.startAtEncounter = true;
assert.equal(shouldStartWojakTest(false), false, 'production never enables the shortcut');
assert.equal(shouldStartWojakTest(true), true); WojakDevelopment.startAtEncounter = false;
assert(fs.readFileSync(path.resolve(__dirname, '../rollup.config.dist.js'), 'utf8').includes("'__NFD_DEV__': JSON.stringify(false)"));

// Actual MainScene progression: Wave 1 -> entrance -> patrol -> hold -> Wave 2.
assert.equal(WOJAK_TRIGGER_AFTER_WAVE, 1);
assert.equal(WojakSettings.afterWave, WOJAK_TRIGGER_AFTER_WAVE);
const encounter = new MainScene(), encounterShots = [], encounterWaves = [];
let encounterInvaders = [], encounterLifeRecoveries = 0, encounterLives = 2, encounterOverlap = false;
encounter.events = new EventEmitter(); encounter.game = { canvas: { width: 800, height: 600 }, loop: { time: 1000 } };
encounter.sys = { events: encounter.events, game: encounter.game };
encounter.time = new Clock(encounter); encounter.events.emit('boot'); encounter.events.emit('start');
encounter.state = GameState.Playing; encounter.wave = WOJAK_TRIGGER_AFTER_WAVE;
encounter.player = new Sprite(encounter, 400, 550);
encounter.starfield = { tilePositionY: 0 }; encounter.firingTimer = Infinity;
encounter._shipKeyboardHandler = () => {};
encounter.add = { ...bonusScene.add, ...wojakAdd(encounter) }; encounter.textures = fontTextures;
encounter.sound = { play() {} };
encounter.physics = { world: { defaults: {}, bounds: new Phaser.Geom.Rectangle(0, 0, 800, 600) },
    add: { sprite: (x, y, key) => createWojakSprite(encounter, x, y, key) },
    overlap(shots, targets, callback, process, context) {
        if (encounter.state !== GameState.BossEncounter || !targets[0]) return;
        assert.equal(targets[0], encounter.wojak.sprite, 'only boss collision is evaluated during encounter');
        encounterOverlap = true;
        const b = targets[0].body;
        shots.forEach(shot => {
            if (!shot.active) return;
            shot.body.preUpdate(false, 0);
            const a = shot.body;
            if (a.right >= b.left && a.left <= b.right && a.bottom >= b.top && a.top <= b.bottom) {
                callback.call(context, shot, targets[0]); callback.call(context, shot, targets[0]);
                assert(!shot.destroyed, 'destruction waits until overlap iteration completes');
            }
        });
        encounterOverlap = false;
    }
};
encounter.assetManager = { bullets: {
    get() {
        const shot = new Bullet(encounter); shot.angle = 0;
        shot.body = new ArcadeBody(encounter.physics.world, shot);
        shot.setVelocityY = value => { shot.body.velocity.y = value; return shot; };
        const destroy = shot.destroy.bind(shot);
        shot.destroy = () => { assert(!encounterOverlap); destroy(); };
        encounterShots.push(shot); return shot;
    }, getChildren: () => encounterShots, countActive: () => encounterShots.filter(shot => shot.active).length
}, enemyBullets: { clear() { assert(!encounterOverlap); } }, explosions: { get: () => new Sprite(encounter) },
    reset() { encounterShots.forEach(shot => shot.destroy()); }, gameOver() { encounterShots.forEach(shot => shot.destroy()); } };
encounter.alienManager = { aliens: { getChildren: () => encounterInvaders, clear() { encounterInvaders = []; } },
    hasAliveAliens: false, stopMovement() {}, getRandomAliveEnemy: () => null,
    update() { assert.notEqual(encounter.state, GameState.BossEncounter); return false; },
    reset(wave) { encounterWaves.push(wave); encounterInvaders = getWaveConfiguration(wave).enemies; }
};
let encounterHudWave = WOJAK_TRIGGER_AFTER_WAVE, encounterAnnouncement = '';
encounter.scoreManager = { noMoreLives: false, increaseScore() {}, setHighScore() {},
    resetLives() { encounterLives = 3; }, setWave(wave) { encounterHudWave = wave; },
    hideText() { encounterAnnouncement = ''; }, setWaveText(wave) { encounterAnnouncement = `WAVE ${wave}`; },
    setGameOverText() { encounterAnnouncement = 'GAME OVER'; },
    recoverOneLife() { encounterLifeRecoveries++; encounterLives = Math.min(3, encounterLives + 1); } };
let encounterAllyClears = 0;
encounter.elonAlly = { clear() { encounterAllyClears++; }, startWave() {}, update() {}, tryHit: () => false };
encounter.bananaBombs = { clear() {}, update() {} };
encounter.rapidFire = new RapidFire(encounter, (oldInterval, newInterval) => { encounter.bulletTime += newInterval - oldInterval; },
    () => encounter.playerShootingEnabled);
const stepEncounter = delta => {
    encounter.events.emit('preupdate'); encounter.events.emit('update', encounter.time.now + delta, delta);
    encounter.update(encounter.time.now, delta); encounter.events.emit('postupdate');
};
encounter.rapidFire.activate();
const trailingEncounterShot = encounter.assetManager.bullets.get(); trailingEncounterShot.shoot(700, 500);
encounter._bulletHitAliens(new Sprite(encounter), { active: true, kill() {}, destroy() {} });
assert.equal(encounter.state, GameState.WaveTransition); assert.equal(encounterAnnouncement, '');
const triggerWaveCleanup = encounter.pendingCleanup; encounter.pendingCleanup = []; triggerWaveCleanup.forEach(fn => fn());
stepEncounter(2000);
assert.equal(encounter.wojak, undefined, 'natural trailing missiles delay boss entrance');
trailingEncounterShot.y = -37; trailingEncounterShot.update();
encounter._startNextWave();
assert.equal(encounter.state, GameState.BossEncounter); assert.equal(encounterInvaders.length, 0);
assert.equal(encounter.wave, 1); assert.equal(encounterHudWave, 1); assert.equal(encounterWaves.length, 0);
const encounterSprite = encounter.wojak.sprite;
encounter._startNextWave(); encounter._startWojak(); assert.equal(encounter.wojak.sprite, encounterSprite);
const entranceShotCount = encounterShots.length;
encounter._fireBullet(); assert.equal(encounterShots.length, entranceShotCount);
stepEncounter(1499); assert.equal(encounter.playerShootingEnabled, false);
stepEncounter(1); assert.equal(encounter.playerShootingEnabled, true);
assert.equal(encounter.rapidFire.timer.getElapsed(), 0, 'boost freezes through Wave 1 announcement and boss entrance');
assert(encounterAllyClears >= 1);
stepEncounter(100); near(encounter.rapidFire.timer.getElapsed(), 100);
encounter._fireBullet(); assert.equal(encounterShots[encounterShots.length - 1].texture.key, 'rapid-electric-laser');
// This real shot misses the hull; it must remain alive and not count as damage.
const miss = encounterShots[encounterShots.length - 1];
miss.setPosition(encounter.wojak.sprite.x, encounter.wojak.sprite.y - 90); stepEncounter(0);
assert(miss.active); assert.equal(encounter.wojak.portfolio, 50);
for (let hit = 1; hit <= 150; hit++) {
    const shot = encounter.assetManager.bullets.get();
    shot.shoot(encounter.wojak.sprite.x, encounter.wojak.sprite.y, hit % 2 === 0);
    near(shot.body.width, 6); near(shot.body.height, 36); near(shot.body.velocity.y, -400);
    stepEncounter(0); assert(shot.destroyed); assert.equal(encounter.wojak.portfolio, hit < 150 ? 50 - hit : -99.9);
    assertWojakLayers(encounter.wojak);
}
assert.equal(encounter.wave, 1); assert.equal(encounterHudWave, 1);
assert.equal(encounter.wojak.phase, WojakPhase.Complete); assert.equal(encounter.playerShootingEnabled, false);
const excess = encounter.assetManager.bullets.get(); excess.shoot(encounterSprite.x, encounterSprite.y, true);
const finalElapsed = encounter.rapidFire.timer.getElapsed();
stepEncounter(2949); assert(!encounterSprite.destroyed); assert(excess.active);
assert.equal(encounter.wojak.portfolio, -99.9); near(encounter.rapidFire.timer.getElapsed(), finalElapsed);
stepEncounter(1); assert(!encounterSprite.destroyed);
assert.equal(encounter.state, GameState.BossEncounter);
stepEncounter(3199); assert(!encounterSprite.destroyed);
stepEncounter(1); assert(encounterSprite.destroyed); assert.equal(encounter.state, GameState.WaveTransition);
assert.equal(encounter.wave, 1); assert.equal(encounterWaves.length, 0);
assert.equal(encounterAnnouncement, 'WAVE 2'); encounter._startNextWave(); assert.equal(encounter.wave, 1);
encounterShots.filter(shot => shot.active).forEach(shot => { shot.y = -37; shot.update(); });
encounter._startNextWave(); encounter._startNextWave();
assert.equal(encounter.wave, 2); assert.equal(encounterHudWave, 2); assert.deepEqual(encounterWaves, [2]);
assert.equal(encounterInvaders.length, 24); assert(encounterInvaders.every(type => type === EnemyType.Pepe));
assert.equal(encounterLifeRecoveries, 1); assert.equal(encounterLives, 3); assert(encounter.wojakCompleted);
assert(encounter.rapidFire.active); assert.equal(encounter.state, GameState.Playing);
const spritesAfterEncounter = wojakSprites.length;
for (let nextWave = 3; nextWave <= 11; nextWave++) {
    encounter._bulletHitAliens(new Sprite(encounter), { active: true, kill() {}, destroy() {} });
    const cleanup = encounter.pendingCleanup; encounter.pendingCleanup = []; cleanup.forEach(fn => fn());
    stepEncounter(1500); encounter._startNextWave();
    assert.equal(encounter.wave, nextWave); assert.equal(encounterHudWave, nextWave);
    assert.equal(encounter.state, GameState.Playing);
    assert.equal(encounter.wojak.sprite, undefined);
    assert.equal(wojakSprites.length, spritesAfterEncounter, 'no second boss, including the old Wave 10 trigger');
    assert.equal(encounterInvaders.length, 24);
    assert(encounterInvaders.every(type => type === (nextWave % 2 ? EnemyType.Ponke : EnemyType.Pepe)));
}
assert.deepEqual(encounterWaves, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
for (const phase of [WojakPhase.Entrance, WojakPhase.Patrol, WojakPhase.Complete]) {
    encounter.wave = WOJAK_TRIGGER_AFTER_WAVE; encounter._startWojak();
    if (phase !== WojakPhase.Entrance) encounter.wojak.update(1500);
    if (phase === WojakPhase.Complete) for (let hit = 0; hit < 150; hit++) encounter.wojak.hit();
    if (phase === WojakPhase.Patrol) {
        for (let hit = 0; hit < 25; hit++) encounter.wojak.hit();
        assert.equal(encounter.wojak.character.tint, WojakSettings.milestoneFlashTint);
    }
    const sprite = encounter.wojak.sprite; assert.equal(encounter.wojak.phase, phase);
    const layers = [encounter.wojak.character, encounter.wojak.foreground, encounter.wojak.percentage, encounter.wojak.lighting];
    encounter._gameOver(); assert(sprite.destroyed); assert(layers.every(layer => layer.destroyed)); assert.equal(encounter.wojak.phase, WojakPhase.Removed);
    encounter.restart(); assert.equal(encounter.wave, 1); assert.equal(encounterLives, 3);
    assert.equal(encounter.wojakCompleted, false); assert.equal(encounter.wojak.sprite, undefined);
    assert.equal(encounter.rapidFire.active, false); stepEncounter(2000);
    assert.equal(encounter.state, GameState.Playing); assert.equal(encounter.wojak.sprite, undefined);
}
encounter.events.emit('shutdown');
assert(wojakSprites.every(sprite => sprite.destroyed));
assert(wojakVisuals.every(layer => layer.destroyed));
console.log('PASS: Wojak combat/charts/threshold regressions, bottom-left PUMP IT at three ship positions and three viewport sizes, half-size sprites, 500ms entrance/1000ms pause/250ms pop/1000ms hold/200ms bubble fade, 2950ms candle launch with 500ms downward exit, cancellation at every phase, half-speed candle growth/contact/push/exit, single wave progression and lifecycle cleanup.');
console.log('PASS: electric-red buff ring at all durations, red NFD digit palettes with identical alpha/shapes/layout, original golden HUD preserved, per-buff colors, unchanged wave pause/resume and expiration.');
console.log('PASS: immediate Elon rapid fire (200ms / 1.5), exact 10s usable-gameplay timer, frozen announcement ring/digits, pause/timeScale, refresh, six-frame 14fps electric lasers with unchanged 6x36 bodies, no DOGE aura or runtime glow, preserved damage flash, expiration/restart/shutdown cleanup.');
console.log('PASS: directional ally hit textures/bounds, misses, single player-shot consumption, enemy exclusion, stationary HIT, 250ms blue pulses, exact 1000ms HIT, aligned accelerating escape, wave/GAME OVER/restart and stale-deadline cleanup.');
console.log('PASS: banana selection, fixed arcs, explosion-only damage, radius/window, single hits, animation and lifecycle cleanup; existing wave, movement, skin, DOGE and PEPE regressions.');
console.log('PASS: shared DOGE feedback, damage gates, PEPE impact removal, directional tint, pulse coalescing, HUD life accounting, GAME OVER and shutdown cleanup.');
console.log('PASS: capped new-wave life recovery (1 to 2, 2 to 3, 3 to 3), immediate HUD, transition gates, no duplicates or revival, initial Wave 1 and restart.');
console.log('PASS: fixed HUD slots [1,2,3] -> [2,3] -> [3] -> [2,3] -> [1,2,3], zero lives and restart; lost leftmost icon retains damage flash.');
console.log('PASS: approved DOGE size/margins/edge limits unchanged; centered 6x4 alternating waves, exact 1.30x invader sizing and proportional bodies, no overlap, unchanged speeds/25px descent and canvas boundaries.');
console.log('PASS: flying banana 36x24 -> 54x36 (+50%), unchanged launch/arc/rotation including edge landings, unchanged yellow explosion scale/radius/window and explosion-only damage.');
console.log('PASS: golden HUD assets, digit reuse/cleanup/alignment, centered single-line multi-digit announcements, enlarged fixed life slots, single GAME OVER image, explicit overlay depths and restart/shutdown cleanup.');
console.log('PASS: preserved production preset: Waves 1-2 exclusion, one 30% wave roll, 50/50 direction, weighted descent spawn with no timers, off-screen entry/exit, no physics and lifecycle cancellation.');
console.log('PASS: production default Wave 3+/30% appearance, 1000 independent threshold checks including losing streaks and restart; injected visual-test preset, ally scale/lane/speed and weighted descent preserved.');
