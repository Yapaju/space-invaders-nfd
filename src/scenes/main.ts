import { AssetType, SoundType } from "../interface/assets";
import { Bullet, ElectricLaserSettings } from "../interface/bullet";
import { AssetManager } from "../interface/manager/asset-manager";
import { AlienManager } from "../interface/manager/alien-manager";
import { Ship } from "../interface/ship";
import { AnimationFactory } from "../interface/factory/animation-factory";
import { Alien } from "../interface/alien";
import { Kaboom } from "../interface/kaboom";
import { EnemyBullet } from "../interface/enemy-bullet";
import { ScoreManager } from "../interface/manager/score-manager";
import { GameState } from "../interface/game-state";
import { MemeSkins, SkinDefinition, PlayerPoses, preparePlayerPoses } from "../interface/skins";
import { PonkePoses, prepareEnemySkins } from "../interface/enemy-skins";
import { EnemyType } from "../interface/enemy-type";
import { BananaBombs } from "../interface/banana-bomb";
import { DamageFeedback } from "../interface/damage-feedback";
import { GoldenUiAssets } from "../interface/golden-number";
import { ElonAlly } from "../interface/elon-ally";
import { RapidFire, RapidFireSettings } from "../interface/rapid-fire";

export class MainScene extends Phaser.Scene {
    state: GameState;
    assetManager: AssetManager;
    animationFactory: AnimationFactory;
    scoreManager: ScoreManager;
    bulletTime = 0;
    firingTimer = 0;
    wave = 1;
    private nextWaveReadyAt = 0;
    private pendingCleanup: Array<() => void> = [];
    private bananaBombs: BananaBombs;
    private damageFeedback: DamageFeedback;
    private elonAlly: ElonAlly;
    private rapidFire: RapidFire;
    starfield: Phaser.GameObjects.TileSprite;
    player: Phaser.Physics.Arcade.Sprite;
    alienManager: AlienManager;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    fireKey: Phaser.Input.Keyboard.Key;

    constructor() {
        super({
            key: "MainScene",
        });
    }

    preload() {
        this.load.setBaseURL("assets/");
        this.load.image(AssetType.Starfield, "images/starfield.png");
        this.load.image(AssetType.Bullet, "images/bullet.png");
        this.load.spritesheet(AssetType.RapidLaser, "weapons/rapid-laser/rapid-laser-spritesheet.png", {
            frameWidth: ElectricLaserSettings.frameWidth, frameHeight: ElectricLaserSettings.frameHeight
        });
        this.load.image(AssetType.EnemyBullet, "images/enemy-bullet.png");
        this.load.image(AssetType.Banana, "meme-skins/ponke-weapon.png");
        this.load.image(AssetType.ElonRight, "meme-skins/elon-ally-right.png");
        this.load.image(AssetType.ElonLeft, "meme-skins/elon-ally-left.png");
        this.load.image(AssetType.ElonHitRight, "meme-skins/elon-ally-hit-right.png");
        this.load.image(AssetType.ElonHitLeft, "meme-skins/elon-ally-hit-left.png");
        this.load.image(AssetType.ElonEscapeRight, "meme-skins/elon-ally-escape-right.png");
        this.load.image(AssetType.ElonEscapeLeft, "meme-skins/elon-ally-escape-left.png");
        GoldenUiAssets.forEach(asset => this.load.image(asset.key, asset.path));
        Object.keys(MemeSkins).forEach(key => {
            const skin = MemeSkins[key] as SkinDefinition;
            if (skin.asset !== MemeSkins.Player.asset) {
                this.load.image(skin.asset, skin.path);
            }
        });
        PlayerPoses.forEach(pose => this.load.image(`${pose.asset}-source`, pose.path));
        PonkePoses.forEach(pose => this.load.image(`${pose.asset}-source`, pose.path));
        this.load.spritesheet(AssetType.Kaboom, "images/explode.png", {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(AssetType.PonkeExplosion, "meme-skins/ponke-explosion.png", {
            frameWidth: 128,
            frameHeight: 128,
        });

        this.sound.volume = 0.5;
        this.load.audio(SoundType.Shoot, "audio/shoot.wav");
        this.load.audio(SoundType.Kaboom, "audio/explosion.wav");
        this.load.audio(SoundType.InvaderKilled, "audio/invaderkilled.wav");
    }

    create() {
        preparePlayerPoses(this);
        prepareEnemySkins(this);
        this.state = GameState.Playing;
        this.starfield = this.add
            .tileSprite(0, 0, 800, 600, AssetType.Starfield)
            .setOrigin(0, 0);
        this.assetManager = new AssetManager(this);
        this.animationFactory = new AnimationFactory(this);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.fireKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );
        this.player = Ship.create(this);
        this.alienManager = new AlienManager(this);
        this.scoreManager = new ScoreManager(this);
        this.rapidFire = new RapidFire(this, (previous, current) => {
            // Recalculate the pending shot from its original fire time so a
            // rate change takes effect immediately, without stacking refreshes.
            this.bulletTime += current - previous;
        }, () => this.playerShootingEnabled);
        this.damageFeedback = new DamageFeedback(this, this.player);
        this.bananaBombs = new BananaBombs(this, this.assetManager.explosions, () => this._damagePlayer());
        this.elonAlly = new ElonAlly(this);
        this.elonAlly.startWave(this.wave);
        this.alienManager.onDescent = count => {
            if (this.state === GameState.Playing) this.elonAlly.onDescent(count);
        };
        this.events.once('shutdown', () => {
            this.bananaBombs.clear();
            this.elonAlly.clear();
            this.alienManager.onDescent = undefined;
            this.pendingCleanup = [];
        });

        this.fireKey.on("down", () => {
            if (this.state === GameState.GameOver) {
                this.restart();
            }
        })
    }

    update(time?: number, delta = 0) {
        this.starfield.tilePositionY -= 1;
        if (this.state === GameState.GameOver) {
            this.player.setVelocity(0, 0);
            return;
        }
        if (this.rapidFire) this.rapidFire.update();
        if (this.state === GameState.WaveTransition) {
            this._startNextWave();
        }
        if (this.state === GameState.Playing && this.elonAlly) this.elonAlly.update(delta);
        if (this.state === GameState.Playing &&
            this.alienManager.update(delta, (this.player.body as Phaser.Physics.Arcade.Body).top)) {
            this._gameOver();
            this.assetManager.gameOver();
            return;
        }
        this._shipKeyboardHandler();
        if (this.state === GameState.WaveTransition) {
            return;
        }
        if (this.time.now > this.firingTimer) {
            this._enemyFires();
        }

        this.physics.overlap(
            // Check the small formation directly: its bodies have just moved,
            // after Arcade's spatial index was built for this frame.
            this.assetManager.bullets.getChildren(),
            this.alienManager.aliens.getChildren(),
            this._bulletHitAliens,
            null,
            this
        );

        if (this.state === GameState.Playing && this.elonAlly) {
            this.assetManager.bullets.getChildren().forEach((bullet: Bullet) => {
                if (bullet.active && this.elonAlly.tryHit(bullet.body as Phaser.Physics.Arcade.Body)) {
                    if (this.rapidFire) this.rapidFire.activate();
                    bullet.disableBody(true, true);
                    this.pendingCleanup.push(() => bullet.destroy());
                }
            });
        }

        this.physics.overlap(
            this.assetManager.enemyBullets,
            this.player,
            this._enemyBulletHitPlayer,
            null,
            this
        );

        if (this.state === GameState.Playing && this.bananaBombs) {
            this.bananaBombs.update(this.player);
        }

        // Callbacks only disable bodies. Destroy objects and clear groups once
        // both overlap iterations have finished.
        const cleanup = this.pendingCleanup;
        this.pendingCleanup = [];
        cleanup.forEach(action => action());
    }

    private _shipKeyboardHandler() {
        let playerBody = this.player.body as Phaser.Physics.Arcade.Body;
        playerBody.setVelocity(0, 0);
        let direction = 0;
        if (this.cursors.left.isDown) {
            playerBody.setVelocityX(-200);
            direction = -1;
        } else if (this.cursors.right.isDown) {
            playerBody.setVelocityX(200);
            direction = 1;
        }
        Ship.setDirection(this.player, direction, this.time.now);

        if (this.fireKey.isDown) {
            this._fireBullet();
        }
    }

    private _bulletHitAliens(bullet: Bullet, alien: Alien) {
        if (this.state !== GameState.Playing || !bullet.active || !alien.active) {
            return;
        }
        let explosion: Kaboom = this.assetManager.explosions.get();
        bullet.disableBody(true, true);
        alien.kill(explosion);
        this.pendingCleanup.push(() => {
            bullet.destroy();
            alien.destroy();
        });
        this.scoreManager.increaseScore();
        if (!this.alienManager.hasAliveAliens) {
            this.scoreManager.increaseScore(1000);
            this.state = GameState.WaveTransition;
            this.nextWaveReadyAt = this.time.now + 1500;
            this.scoreManager.setWaveText(this.wave + 1);
            this.pendingCleanup.push(() => {
                this.assetManager.enemyBullets.clear(true, true);
                if (this.bananaBombs) this.bananaBombs.clear();
                if (this.elonAlly) this.elonAlly.clear();
                this.alienManager.stopMovement();
            });
        }
    }

    private _enemyBulletHitPlayer(ship, enemyBullet: EnemyBullet) {
        if (this.state !== GameState.Playing || !enemyBullet.active || !this.player.active) {
            return;
        }
        enemyBullet.disableBody(true, true);
        this.pendingCleanup.push(() => enemyBullet.destroy());
        this._damagePlayer();
    }

    private _damagePlayer() {
        if (this.state !== GameState.Playing || !this.player.active) return;
        // Icons stay fixed: remove the leftmost active slot.
        let live: Phaser.GameObjects.Sprite = this.scoreManager.lives.getFirstAlive();
        if (!live) return;
        live.setActive(false).setVisible(false);
        if (this.damageFeedback) this.damageFeedback.show(live);
        this.sound.play(SoundType.Kaboom)
        if (this.scoreManager.noMoreLives) {
            this._gameOver();
            this.pendingCleanup.push(() => this.assetManager.gameOver());
        }
    }

    private _gameOver() {
        if (this.rapidFire) this.rapidFire.clear();
        this.state = GameState.GameOver;
        this.scoreManager.setGameOverText();
        this.player.setVelocity(0, 0);
        this.player.disableBody(true, true);
        this.alienManager.stopMovement();
        if (this.bananaBombs) this.bananaBombs.clear();
        if (this.elonAlly) this.elonAlly.clear();
    }

    private _enemyFires() {
        if (this.state !== GameState.Playing || !this.player.active) {
            return;
        }
        let randomEnemy = this.alienManager.getRandomAliveEnemy();
        if (!randomEnemy) {
            return;
        }
        if (randomEnemy.enemyType === EnemyType.Ponke) {
            this.bananaBombs.launch(randomEnemy.x, randomEnemy.y, this.player.x, this.player.y);
            this.firingTimer = this.time.now + 2000;
            return;
        }
        let enemyBullet: EnemyBullet = this.assetManager.enemyBullets.get();
        if (enemyBullet && randomEnemy) {
            enemyBullet.setPosition(randomEnemy.x, randomEnemy.y);
            this.physics.moveToObject(enemyBullet, this.player, 120);
            this.firingTimer = this.time.now + 2000;
        }
    }

    private get playerShootingEnabled() {
        return this.state === GameState.Playing && this.player.active;
    }

    private _fireBullet() {
        if (!this.playerShootingEnabled) {
            return;
        }

        if (this.time.now > this.bulletTime) {
            let bullet: Bullet = this.assetManager.bullets.get();
            if (bullet) {
                bullet.shoot(this.player.x, this.player.y - Ship.bulletOffset, !!this.rapidFire && this.rapidFire.active);
                this.bulletTime = this.time.now + (this.rapidFire ? this.rapidFire.firingInterval : RapidFireSettings.normalFiringInterval);
            }
        }
    }

    private _startNextWave() {
        // In-flight player shots finish naturally, including off-screen cleanup.
        // Wait at least 1.5 seconds and count active shots so inactive pooled
        // objects cannot block progression. Neither condition removes missiles.
        if (this.state !== GameState.WaveTransition || this.scoreManager.noMoreLives ||
            this.time.now < this.nextWaveReadyAt ||
            this.assetManager.bullets.countActive(true) > 0) {
            return;
        }
        this.wave += 1;
        this.scoreManager.setWave(this.wave);
        this.alienManager.reset(this.wave);
        if (this.elonAlly) this.elonAlly.startWave(this.wave);
        this.scoreManager.recoverOneLife();
        this.scoreManager.hideText();
        this.firingTimer = this.time.now + 2000;
        this.state = GameState.Playing;
    }

    restart() {
        if (this.rapidFire) this.rapidFire.clear();
        if (this.elonAlly) this.elonAlly.clear();
        if (this.damageFeedback) this.damageFeedback.clear();
        if (this.bananaBombs) this.bananaBombs.clear();
        this.pendingCleanup = [];
        this.nextWaveReadyAt = 0;
        this.wave = 1;
        this.state = GameState.Playing;
        Ship.setDirection(this.player, 0);
        const position = Ship.startPosition(this);
        this.player.enableBody(true, position.x, position.y, true, true);
        (this.player.body as Phaser.Physics.Arcade.Body).preUpdate(false, 0);
        this.player.setVelocity(0, 0);
        this.scoreManager.setHighScore();
        this.scoreManager.resetLives();
        this.scoreManager.setWave(this.wave);
        this.scoreManager.hideText();
        this.alienManager.reset(this.wave);
        this.assetManager.reset();
        if (this.elonAlly) this.elonAlly.startWave(this.wave);
        this.bulletTime = this.time.now;
        this.firingTimer = this.time.now + 2000;
    }
}
