import { AssetType } from './assets';
import { WojakBoss, WojakPhase, WojakSettings, WojakVisualSettings } from './wojak-boss';
import { PremiumFootprint } from './premium-spawn';
import { WaveDirectorConfig } from './wave-director';
import { PremiumInvaderSprite } from './premium-invader';

// Share the boss's presentation and actual weapon instances. Only formation
// ownership, discrete damage and lifecycle differ; no boss cinematic is called.
export class PremiumWojak extends WojakBoss {
    stage = 0;
    private disposed = false;
    private readonly fitScale: number;
    constructor(scene: Phaser.Scene, readonly footprint: PremiumFootprint) {
        super(scene);
        this.flashElapsed = this.flashDuration;
        this.fitScale = Math.min(footprint.width / WojakVisualSettings.canvasWidth,
            footprint.height / WojakVisualSettings.canvasHeight);
    }
    protected get displayScale() { return this.fitScale; }
    protected get collisionWidth() { return WojakSettings.hitboxWidth * this.fitScale / WojakSettings.displayScale; }
    protected get collisionHeight() { return WojakSettings.hitboxHeight * this.fitScale / WojakSettings.displayScale; }
    protected get centeredPresentation() { return true; }
    protected createSprite(x: number, y: number, _texture: AssetType) {
        const root = new PremiumInvaderSprite(this.scene, x, y, this);
        this.scene.add.existing(root);
        this.scene.physics.add.existing(root);
        return root;
    }
    spawn(): PremiumInvaderSprite {
        this.createPresentation(this.footprint.x, this.footprint.y);
        this.phase = WojakPhase.Patrol;
        this.syncBody();
        return this.sprite as PremiumInvaderSprite;
    }
    get explosionScale() { return WaveDirectorConfig.premiumInvaders.wojak.explosionScale; }
    protected get flashDuration() {
        return WaveDirectorConfig.premiumInvaders.wojak.hitFlashCount *
            (WojakSettings.milestoneFlashOnDuration + WojakSettings.milestoneFlashOffDuration);
    }
    get defeated() { return this.stage === 5; }
    get invulnerable() { return this.flashElapsed < this.flashDuration; }
    updateWeapons(delta: number, player: Phaser.Physics.Arcade.Sprite, damage: () => void) {
        const rates = WaveDirectorConfig.premiumInvaders.wojak.attackRates;
        const rate = this.stage === 4 ? rates.minus70 : this.stage === 3 ? rates.minus30 :
            this.stage === 2 ? rates.zero : rates.plus25;
        // Scale attack intervals only. Flights, pending rain and clearance use real delta.
        super.updateWeapons(delta, player, damage, rate);
    }
    setFormationDirection(direction: number) {
        this.direction = direction < 0 ? -1 : 1;
        if (this.sprite) this.syncBody();
    }
    syncFormation() { if (this.sprite && !this.disposed) this.syncLayers(); }
    update(delta: number): boolean {
        if (!this.sprite || this.disposed || this.defeated) return false;
        this.updateFlash(Math.max(0, delta));
        if (this.charts) this.charts.history.update(delta);
        this.syncBody();
        return false;
    }
    hit(): boolean {
        if (this.disposed || !this.sprite || !this.sprite.active || this.defeated || this.invulnerable) return false;
        this.stage++;
        this.portfolio = [50, 25, 0, -30, -70, WojakSettings.prototypeEndPortfolio][this.stage];
        if (this.charts) {
            this.charts.history.damage(this.portfolio);
            // Stage jumps publish several candles together: present that exact
            // stage immediately rather than showing an older queued state.
            this.charts.history.settle();
        }
        if (this.defeated) {
            this.phase = WojakPhase.Complete;
            this.stopWeapons();
            if (this.charts) this.charts.history.freeze();
        }
        this.updatePercentage();
        this.syncLayers();
        if (!this.defeated) { this.flashElapsed = 0; this.updateFlash(0); }
        return true;
    }
    stopWeapons() { this.candles.clear(); this.tears.clear(); }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.remove();
    }
}

