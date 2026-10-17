import { AssetType } from './assets';

// Disabled by default; the production build additionally disallows this entry.
export const WojakDevelopment = { startAtEncounter: false };
export function shouldStartWojakTest(development: boolean) {
    return development && WojakDevelopment.startAtEncounter;
}

// Temporary playtesting override. Intended production value: 10.
export const WOJAK_TRIGGER_AFTER_WAVE = 1;

export const WojakSettings = {
    afterWave: WOJAK_TRIGGER_AFTER_WAVE,
    displayScale: 0.22,
    patrolY: 255,
    patrolLeftX: 205,
    patrolRightX: 595,
    speed: 55,
    hoverAmplitude: 7,
    hoverFrequency: 0.5,
    entranceDuration: 1500,
    completionDuration: 1250,
    hitboxWidth: 270,
    hitboxHeight: 82
};

// Original source-pixel ship registration. The center of the front panel is
// the common world anchor; chassis widths exclude flames and raised hands.
export const WojakPoses = [
    { asset: AssetType.Wojak50, path: 'mini-boss/wojak/wojak-green-50-right.png', anchorX: 800, anchorY: 680, chassisWidth: 1410 },
    { asset: AssetType.Wojak40, path: 'mini-boss/wojak/wojak-green-40-right.png', anchorX: 800, anchorY: 680, chassisWidth: 1416 },
    { asset: AssetType.Wojak25, path: 'mini-boss/wojak/wojak-green-25-right.png', anchorX: 815, anchorY: 675, chassisWidth: 1424 }
];

export enum WojakPhase { Entrance, Patrol, Complete, Removed }

export class WojakBoss {
    sprite: Phaser.Physics.Arcade.Sprite;
    portfolio = 50;
    phase = WojakPhase.Removed;
    private direction = 1;
    private entranceElapsed = 0;
    private patrolElapsed = 0;
    private completionElapsed = 0;
    private entranceY = 0;

    constructor(private scene: Phaser.Scene) {}

    get shootingEnabled() { return this.phase === WojakPhase.Patrol; }

    start() {
        if (this.sprite) return;
        this.clear();
        this.sprite = this.scene.physics.add.sprite((WojakSettings.patrolLeftX + WojakSettings.patrolRightX) / 2,
            WojakSettings.patrolY, AssetType.Wojak50);
        this.sprite.setImmovable(true).setDepth(2);
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.moves = false;
        body.allowGravity = false;
        this.applyPose(0);
        this.entranceY = this.scene.physics.world.bounds.top -
            (this.sprite.height - this.sprite.displayOriginY) * this.sprite.scaleY - 1;
        this.phase = WojakPhase.Entrance;
        this.sprite.y = this.entranceY;
        this.syncBody();
    }

    // Returns true only when the final artwork has finished its prototype hold.
    update(delta: number): boolean {
        if (!this.sprite) return false;
        let elapsed = Math.max(0, delta);
        if (this.phase === WojakPhase.Entrance) {
            const step = Math.min(elapsed, WojakSettings.entranceDuration - this.entranceElapsed);
            this.entranceElapsed += step;
            elapsed -= step;
            const t = this.entranceElapsed / WojakSettings.entranceDuration;
            this.sprite.y = this.entranceY + (WojakSettings.patrolY - this.entranceY) * t * t * (3 - 2 * t);
            if (t < 1) { this.syncBody(); return false; }
            this.phase = WojakPhase.Patrol;
        }
        if (this.phase === WojakPhase.Complete) {
            this.completionElapsed += elapsed;
            if (this.completionElapsed >= WojakSettings.completionDuration) {
                this.remove();
                return true;
            }
        }
        this.patrolElapsed += elapsed;
        let travel = WojakSettings.speed * elapsed / 1000;
        while (travel > 0) {
            const edge = this.direction > 0 ? WojakSettings.patrolRightX : WojakSettings.patrolLeftX;
            const distance = Math.abs(edge - this.sprite.x);
            const step = Math.min(travel, distance);
            this.sprite.x += this.direction * step;
            travel -= step;
            if (step === distance) this.direction *= -1;
        }
        this.sprite.y = WojakSettings.patrolY + WojakSettings.hoverAmplitude *
            Math.sin(this.patrolElapsed / 1000 * 2 * Math.PI * WojakSettings.hoverFrequency);
        this.syncBody();
        return false;
    }

    hit(): boolean {
        if (!this.shootingEnabled || !this.sprite || !this.sprite.active) return false;
        this.portfolio--;
        if (this.portfolio === 40) this.applyPose(1);
        if (this.portfolio === 25) {
            this.applyPose(2);
            this.phase = WojakPhase.Complete;
        }
        return true;
    }

    private applyPose(index: number) {
        const pose = WojakPoses[index];
        this.sprite.setTexture(pose.asset);
        this.sprite.setOrigin(pose.anchorX / this.sprite.width, pose.anchorY / this.sprite.height);
        const scale = WojakSettings.displayScale * WojakPoses[0].chassisWidth / pose.chassisWidth;
        this.sprite.setScale(scale);
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.updateBounds();
        body.setSize(WojakSettings.hitboxWidth / scale, WojakSettings.hitboxHeight / scale, false);
        body.setOffset(pose.anchorX - WojakSettings.hitboxWidth / scale / 2,
            pose.anchorY - WojakSettings.hitboxHeight / scale / 2);
        this.syncBody();
    }

    private syncBody() {
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.reset(this.sprite.x, this.sprite.y);
        body.preUpdate(false, 0);
    }

    private remove() {
        if (this.sprite) this.sprite.destroy();
        this.sprite = undefined;
        this.phase = WojakPhase.Removed;
    }

    clear() {
        this.remove();
        this.portfolio = 50;
        this.direction = 1;
        this.entranceElapsed = this.patrolElapsed = this.completionElapsed = 0;
    }
}
