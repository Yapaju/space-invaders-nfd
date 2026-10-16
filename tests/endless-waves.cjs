// Run with: node tests/endless-waves.cjs (uses the existing TypeScript dependency).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

class Sprite {
    constructor(scene, x = 0, y = 0) {
        Object.assign(this, { scene, active: true, x, y, width: 32, height: 32 });
        this.body = { reset: (x, y) => {
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
    setOrigin() { return this; }
    setImmovable() { return this; }
    getBounds() {
        return { left: this.x - this.width / 2, right: this.x + this.width / 2,
            top: this.y - this.height / 2, bottom: this.y + this.height / 2 };
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
        module, exports: module.exports, Phaser,
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
// Reach right edge exactly (initial right edge 548 + 100 + 152 = 800).
formation.update(1520, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, originalPositions[i][0] + 252);
    near(alien.y, originalPositions[i][1] + descent);
});
formation.update(10, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, originalPositions[i][0] + 251);
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
formation.update(2990 / sparseMultiplier, 10000);
assert.equal(formation.direction, 1);
near(Math.max(...survivors().map(alien => alien.getBounds().right)), 799);
formation.update(10 / sparseMultiplier, 10000);
assert.equal(formation.direction, -1);
survivors().forEach((alien, i) => {
    near(alien.x, sparsePositions[i][0] + 300);
    near(alien.y, sparsePositions[i][1] + descent);
});
// Empty rows stay empty, and gaps inside the formation remain unchanged.
formation.reset();
formation.aliens.getChildren().forEach((alien, i) => {
    if (i < 10 || (i >= 20 && i < 30) || i % 10 === 4) alien.active = false;
});
const gappedPositions = survivors().map(alien => [alien.x, alien.y]);
const gappedMultiplier = 1 + 0.5 * (40 - survivors().length) / 39;
formation.update(2520 / gappedMultiplier, 10000);
survivors().forEach((alien, i) => {
    near(alien.x, gappedPositions[i][0] + 252);
    near(alien.y, gappedPositions[i][1] + descent);
});
// A lone survivor travels between centers 16 and 784, descending once at each end.
formation.reset();
formation.aliens.getChildren().forEach((alien, i) => { alien.active = i === 0; });
const lone = survivors()[0];
formation.update(6840 / 1.5, 10000);
near(lone.x, 784); near(lone.y, 100 + descent);
formation.update(7680 / 1.5, 10000);
near(lone.x, 16); near(lone.y, 100 + descent * 2);
assert.equal(formation.direction, 1);
formation.update(10, 10000);
near(lone.x, 17.5); near(lone.y, 100 + descent * 2);
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
formation.update(2520, 10000);
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
survivors()[0].body.reset(100, scene.player.getBounds().top - 16);
assert.equal(formation.update(0, scene.player.getBounds().top), true);
assert.equal(formation.movementStopped, true);
formation.reset();
// Inactive invaders cannot cause invasion. Reaching the line needs no horizontal overlap.
formation.aliens.getChildren().forEach((alien, i) => { alien.active = i === 0; });
formation.aliens.getChildren()[1].y = 1000;
const invader = survivors()[0];
invader.body.reset(784, scene.player.getBounds().top - 17);
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
console.log('PASS: coordinated movement, dynamic edges, row descent, lone invader, long frames, invasion/game-over, restart, wave scaling, and all v0.1 wave-transition regressions.');
