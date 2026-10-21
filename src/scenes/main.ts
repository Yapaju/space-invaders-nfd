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
import { PlayerPoses, preparePlayerPoses } from "../interface/skins";
import { PepePoses, PonkePoses, PopcatPoses, prepareEnemySkins } from "../interface/enemy-skins";
import { EnemyType } from "../interface/enemy-type";
import { BananaBombs } from "../interface/banana-bomb";
import { DamageFeedback } from "../interface/damage-feedback";
import { GoldenUiAssets } from "../interface/golden-number";
import { ElonAlly } from "../interface/elon-ally";
import { RapidFire, RapidFireSettings } from "../interface/rapid-fire";
import { WojakBoss, WojakAssets, WojakSettings, shouldStartWojakTest } from "../interface/wojak-boss";
import { CandleAssets } from "../interface/wojak-candles";
import { TearAsset } from "../interface/wojak-tears";
import { PopcornAssets, preparePopcornSkins, firePopcatAttack } from "../interface/popcat-weapons";

import { preloadPopcatAudio, installPopcatAudio, stopPopcatSounds } from "../interface/popcat-audio";
import { AudioBalance, installAudioHeadroom } from '../interface/audio-balance';
import { WaveDirectorConfig, firingIntervalForWave, isBossMilestone, waveSeedFromSearch } from '../interface/wave-director';
import { PremiumProgress } from '../interface/premium-spawn';
import { premiumInvaderOf } from '../interface/premium-invader';
import { FinalRunStats } from '../interface/flex-card-renderer';
import { FlexCardPreview } from '../interface/flex-card-preview';
import { FlexCardLetters } from '../interface/flex-card-instruction';

export class MainScene extends Phaser.Scene {
    state: GameState;
    assetManager: AssetManager;
    animationFactory: AnimationFactory;
    scoreManager: ScoreManager;
    bulletTime = 0;
    firingTimer = Infinity;
    wave = 1;
    invadersKilled = 0;
    private finalRunStats: FinalRunStats;
    private flexCardPreview = new FlexCardPreview(() => this.input.keyboard.resetKeys());
    private nextWaveReadyAt = 0;
    private pendingCleanup: Array<() => void> = [];
    private bananaBombs: BananaBombs;
    private damageFeedback: DamageFeedback;
    private elonAlly: ElonAlly;
    private rapidFire: RapidFire;
    private wojak: WojakBoss;
    private completedBossWave = 0;
    private premiumProgress = new PremiumProgress();
    private waveSeed = waveSeedFromSearch(typeof location === 'undefined' ? '' : location.search);
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
        PopcornAssets.forEach(pose => this.load.image(`${pose.asset}-source`, pose.path));
        this.load.image(AssetType.Banana, "meme-skins/ponke-weapon.png");
        WojakAssets.forEach(pose => this.load.image(pose.asset, pose.path));
        CandleAssets.forEach(candle => this.load.image(candle.asset, candle.path));
        this.load.image(TearAsset.asset, TearAsset.path);
        this.load.image(AssetType.ElonRight, "meme-skins/elon-ally-right.png");
        this.load.image(AssetType.ElonLeft, "meme-skins/elon-ally-left.png");
        this.load.image(AssetType.ElonHitRight, "meme-skins/elon-ally-hit-right.png");
        this.load.image(AssetType.ElonHitLeft, "meme-skins/elon-ally-hit-left.png");
        this.load.image(AssetType.ElonEscapeRight, "meme-skins/elon-ally-escape-right.png");
        this.load.image(AssetType.ElonEscapeLeft, "meme-skins/elon-ally-escape-left.png");
        GoldenUiAssets.forEach(asset => this.load.image(asset.key, asset.path));
        FlexCardLetters.forEach(asset => this.load.image(asset.key, asset.path));
        PlayerPoses.forEach(pose => this.load.image(`${pose.asset}-source`, pose.path));
        PepePoses.concat(PonkePoses, PopcatPoses).forEach(pose => this.load.image(`${pose.asset}-source`, pose.path));
        this.load.spritesheet(AssetType.Kaboom, "images/explode.png", {
            frameWidth: 128,
            frameHeight: 128,
        });
        this.load.spritesheet(AssetType.PonkeExplosion, "meme-skins/ponke-explosion.png", {
            frameWidth: 128,
            frameHeight: 128,
        });

        this.sound.volume = 0.5;
        preloadPopcatAudio(this);
        this.load.audio(SoundType.Shoot, "audio/shoot.wav");
        this.load.audio(SoundType.Kaboom, "audio/explosion.wav");
        this.load.audio(SoundType.InvaderKilled, "audio/invaderkilled.wav");
    }

    create() {
        preparePlayerPoses(this);
        prepareEnemySkins(this);
        preparePopcornSkins(this);
        installPopcatAudio(this);
        installAudioHeadroom(this);
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
        this.alienManager = new AlienManager(this, this.waveSeed, this.premiumProgress);
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
        this.events.on('pause', this._syncPlayerPose, this);
        this.events.on('resume', this._syncPlayerPose, this);
        this.events.once('shutdown', () => {
            this.flexCardPreview.close();
            this.input.keyboard.off('keydown-ENTER', this._openFlexCard, this);
            this.firingTimer = Infinity;
            stopPopcatSounds(this);
            this.events.off('pause', this._syncPlayerPose, this);
            this.events.off('resume', this._syncPlayerPose, this);
            this.bananaBombs.clear();
            this.elonAlly.clear();
            if (this.wojak) this.wojak.clear();
            this.completedBossWave = 0;
            this.premiumProgress.reset();
            if (this.alienManager.clearPremiumWeapons) this.alienManager.clearPremiumWeapons();
            this.alienManager.onDescent = undefined;
            this.pendingCleanup = [];
        });

        this.input.keyboard.on('keydown-ENTER', this._openFlexCard, this);
        this.fireKey.on("down", (_key, event: KeyboardEvent) => {
            if (this.state === GameState.GameOver && !this.flexCardPreview.isOpen && !event.repeat) {
                this.restart();
            }
        })
        this.firingTimer = this.time.now + firingIntervalForWave(this.wave);
        if (shouldStartWojakTest(typeof __NFD_DEV__ !== 'undefined' && __NFD_DEV__)) {
            this.wave = WojakSettings.afterWave;
            this.scoreManager.setWave(this.wave);
            this._startWojak();
        }
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
        if (this.state === GameState.BossEncounter) {
            const complete = this.wojak.update(delta);
            if (complete) {
                this.completedBossWave = this.wave;
                this.premiumProgress.recordDefeat(WaveDirectorConfig.boss.type, this.wave);
                this.state = GameState.WaveTransition;
                this.nextWaveReadyAt = this.time.now;
                this.scoreManager.setWaveText(this.wave + 1);
            }
            this._shipKeyboardHandler();
            if (!complete) this.physics.overlap(this.assetManager.bullets.getChildren(),
                [this.wojak.sprite], this._bulletHitWojak, null, this);
            if (!complete) this.wojak.updateWeapons(delta, this.player, () => this._damagePlayer());
            const cleanup = this.pendingCleanup;
            this.pendingCleanup = [];
            cleanup.forEach(action => action());
            return;
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

        // Advance immunity before collisions so a new hit keeps its full protection window.
        if (this.state === GameState.Playing && this.alienManager.updatePremiums) {
            this.alienManager.updatePremiums(delta, this.player, () => this._damagePlayer());
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
        if (this.cursors.left.isDown) {
            playerBody.setVelocityX(-200);
        } else if (this.cursors.right.isDown) {
            playerBody.setVelocityX(200);
        }
        this._syncPlayerPose();

        if (this.fireKey.isDown) {
            this._fireBullet();
        }
    }

    private _syncPlayerPose() {
        const direction = this.cursors.left.isDown ? -1 : this.cursors.right.isDown ? 1 : 0;
        Ship.setDirection(this.player, direction, this.time.now, this.fireKey.isDown && this.playerShootingEnabled);
    }

    private _bulletHitAliens(bullet: Bullet, alien: Alien) {
        if (this.state !== GameState.Playing || !bullet.active || !alien.active) {
            return;
        }
        bullet.disableBody(true, true);
        const premium = premiumInvaderOf(alien);
        if (premium && (!premium.hit() || !premium.defeated)) {
            this.pendingCleanup.push(() => bullet.destroy());
            return;
        }
        const explosion: Kaboom = this.assetManager.explosions.get();
        alien.kill(explosion);
        this.invadersKilled += 1;
        this.pendingCleanup.push(() => {
            bullet.destroy();
            alien.destroy();
        });
        this.scoreManager.increaseScore();
        if (!this.alienManager.hasAliveAliens) {
            this.scoreManager.increaseScore(1000);
            this.state = GameState.WaveTransition;
            this.firingTimer = Infinity;
            this.nextWaveReadyAt = this.time.now + 1500;
            if (this._bossPending()) this.scoreManager.hideText();
            else this.scoreManager.setWaveText(this.wave + 1);
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
        this._damagePlayer(enemyBullet.damage);
    }

    private _bulletHitWojak(bullet: Bullet) {
        if (this.state !== GameState.BossEncounter || !bullet.active || !this.wojak.hit()) return;
        bullet.disableBody(true, true);
        this.pendingCleanup.push(() => bullet.destroy());
    }

    private _damagePlayer(damage = 1) {
        if ((this.state !== GameState.Playing && this.state !== GameState.BossEncounter) || !this.player.active) return;
        // One accepted hit removes up to its damage in fixed HUD slots. Keep
        // protection checks above the whole hit and stop at zero remaining lives.
        if (!this.scoreManager.lives.getFirstAlive()) return;
        for (let remaining = damage; remaining > 0; remaining--) {
            const live: Phaser.GameObjects.Sprite = this.scoreManager.lives.getFirstAlive();
            if (!live) break;
            live.setActive(false).setVisible(false);
            if (this.damageFeedback) this.damageFeedback.show(live);
        }
        this.sound.play(SoundType.Kaboom, { volume: AudioBalance.gains[SoundType.Kaboom] })
        if (this.scoreManager.noMoreLives) {
            this._gameOver();
            this.pendingCleanup.push(() => this.assetManager.gameOver());
        }
    }

    private _gameOver() {
        if (this.state === GameState.GameOver) return;
        this.finalRunStats = Object.freeze({
            wave: this.wave, score: this.scoreManager.score, invadersKilled: this.invadersKilled
        });
        this.firingTimer = Infinity;
        stopPopcatSounds(this);
        if (this.wojak) this.wojak.clear();
        if (this.rapidFire) this.rapidFire.clear();
        this.state = GameState.GameOver;
        this.scoreManager.setGameOverText();
        this.player.setVelocity(0, 0);
        this.player.disableBody(true, true);
        this.alienManager.stopMovement();
        if (this.alienManager.clearPremiumWeapons) this.alienManager.clearPremiumWeapons();
        if (this.bananaBombs) this.bananaBombs.clear();
        if (this.elonAlly) this.elonAlly.clear();
    }

    private _openFlexCard(event: KeyboardEvent) {
        if (event.repeat || this.state !== GameState.GameOver || !this.finalRunStats || this.flexCardPreview.isOpen) return;
        // Opening focuses CLOSE; suppress this initiating Enter's native click.
        event.preventDefault();
        this.flexCardPreview.open(this.finalRunStats);
    }

    private _enemyFires() {
        if (this.state !== GameState.Playing || !this.player.active) {
            return;
        }
        let randomEnemy = this.alienManager.getRandomAliveEnemy();
        if (!randomEnemy) {
            return;
        }
        const firing = WaveDirectorConfig.firing;
        const activeThreats = this.assetManager.enemyBullets.countActive(true) +
            (this.bananaBombs ? this.bananaBombs.activeThreatCount : 0);
        const cost = firing.projectileCost[randomEnemy.enemyType] || 1;
        if (activeThreats + cost > firing.maxHostileThreats) {
            this.firingTimer = this.time.now + firing.retryMs;
            return;
        }
        const interval = firingIntervalForWave(this.wave);
        if (randomEnemy.enemyType === EnemyType.Popcat) {
            const fired = firePopcatAttack(this, this.assetManager.enemyBullets, randomEnemy, this.player);
            this.firingTimer = this.time.now + (fired ? interval : firing.retryMs);
            return;
        }
        if (randomEnemy.enemyType === EnemyType.Ponke) {
            this.bananaBombs.launch(randomEnemy.x, randomEnemy.y, this.player.x, this.player.y);
            this.firingTimer = this.time.now + interval;
            return;
        }
        let enemyBullet: EnemyBullet = this.assetManager.enemyBullets.get();
        if (enemyBullet && randomEnemy) {
            enemyBullet.setPosition(randomEnemy.x, randomEnemy.y);
            this.physics.moveToObject(enemyBullet, this.player, 120);
            this.firingTimer = this.time.now + interval;
        }
    }

    private get playerShootingEnabled() {
        return !this.sys.isPaused() && (this.state === GameState.Playing ||
            (this.state === GameState.BossEncounter && this.wojak && this.wojak.shootingEnabled)) && this.player.active;
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
        if (this._bossPending()) {
            this._startWojak();
            return;
        }
        this.wave += 1;
        this.scoreManager.setWave(this.wave);
        this.alienManager.reset(this.wave);
        if (this.elonAlly) this.elonAlly.startWave(this.wave);
        this.scoreManager.recoverOneLife();
        this.scoreManager.hideText();
        this.firingTimer = this.time.now + firingIntervalForWave(this.wave);
        this.state = GameState.Playing;
    }

    private _startWojak() {
        if (this.state === GameState.BossEncounter || this.completedBossWave === this.wave) return;
        this.firingTimer = Infinity;
        this.state = GameState.BossEncounter;
        this.alienManager.stopMovement();
        this.alienManager.aliens.clear(true, true);
        this.assetManager.enemyBullets.clear(true, true);
        if (this.bananaBombs) this.bananaBombs.clear();
        if (this.elonAlly) this.elonAlly.clear();
        this.scoreManager.hideText();
        if (!this.wojak) this.wojak = new WojakBoss(this);
        this.wojak.start();
    }

    private _bossPending() {
        return isBossMilestone(this.wave) && this.completedBossWave !== this.wave;
    }

    restart() {
        if (this.flexCardPreview.isOpen) return;
        this.invadersKilled = 0;
        this.finalRunStats = undefined;
        stopPopcatSounds(this);
        if (this.wojak) this.wojak.clear();
        this.completedBossWave = 0;
        this.premiumProgress.reset();
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
        this.firingTimer = this.time.now + firingIntervalForWave(this.wave);
    }
}
