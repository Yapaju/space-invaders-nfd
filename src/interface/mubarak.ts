import { MubarakBarrels, MubarakBarrelSettings, MubarakRect, rectsOverlap } from './mubarak-barrels';
import { randomForWave, WaveDirectorConfig } from './wave-director';
import { WojakSettings } from './wojak-boss';
import { applyHitFlash } from './hit-flash';
import { AssetType } from './assets';
import { MubarakShrapnel } from './mubarak-shrapnel';

export const MubarakSettings = {
    testSpawn: { enabled: false, afterWave: 1 },
    canvasWidth: 1664, canvasHeight: 1216, displayWidth: 360,
    entranceMs: 3600, patrolY: 190, edgeMargin: 24, cruisePeriodMs: 14000,
    waveAmplitude: 14, wavePeriodMs: 7000, bobAmplitude: 3, bobPeriodMs: 2200,
    entranceMargin: 16, cruiseStartPhase: -Math.PI / 4,
    successfulHits: 4,
    weakPoint: { width: 96, height: 64 }, // Registered canvas pixels: about 21 x 14 on screen.
    carpet: { left: 180, right: 1484, bottom: 1150 }, // Registered usable rug bounds; below all Act I poses.
    framesByHits: [1, 2, 3, 4, 5],

};

export const MubarakAct2Settings = {
    health: 4, horizontalSpeedMultiplier: 2, stepMs: 1000 / 120,
    // Registered canvas bounds measured at alpha >=128 in both angry sources.
    visibleBody: { x: 86, y: 90, width: 1492, height: 1011 }
};

// Native 3:2 overlays; widths are relative to the boss's tunable display width.
export const MubarakFinalSettings = {
    characterFrame: 6,
    act2CharacterFrame: 1, act2SwitchStage: 3,
    diamondCenter: { x: 910, y: 660 },
    overlayOffset: { x: 0, y: 0 }, // registered-canvas pixels; X reflects with facing
    overlayDepthOffset: 1,
    stages: [
        { key: 'mubarak-act1-explosion-1', durationMs: 67.5, widthMultiplier: 1 },
        { key: 'mubarak-act1-explosion-2', durationMs: 67.5, widthMultiplier: 1.25 },
        { key: 'mubarak-act1-explosion-3', durationMs: 131.25, widthMultiplier: 5 / 3 },
        // New tail frames reuse the previous climax's 175ms baseline, reduced by 25%.
        { key: 'mubarak-act1-explosion-4', durationMs: 131.25, widthMultiplier: 5 / 3 },
        { key: 'mubarak-act1-explosion-5', durationMs: 131.25, widthMultiplier: 5 / 3 }
    ]
};
export const MubarakExplosionAssets = MubarakFinalSettings.stages.map(stage => ({
    key: stage.key, path: `mini-boss/mubarak/${stage.key}.png`
}));
export function mubarakFinalDuration() {
    return MubarakFinalSettings.stages.reduce((total, stage) => total + stage.durationMs, 0);
}

export function mubarakAct2SwitchTime() {
    return MubarakFinalSettings.stages.slice(0, MubarakFinalSettings.act2SwitchStage - 1)
        .reduce((total, stage) => total + stage.durationMs, 0);
}

// Dedicated source art is registered to a common canvas; never flip the sprite.
// Left Frame 3 was exported smaller, so undo its uniform export reduction.
export function mubarakTexture(frame: number, direction: number, act = 1) {
    return `mubarak-act${act}-${frame}-${direction < 0 ? 'left' : 'right'}`;
}
export const MubarakAssets: { frame: number; direction: number; x: number; y: number;
    scale: number; key: string; path: string }[] = [];
[
    { frame: 1, x: 64, y: 80, leftX: 64, leftScale: 1 },
    { frame: 2, x: 84, y: 108, leftX: 44, leftScale: 1 },
    { frame: 3, x: 120, y: 60, leftX: 5, leftScale: 1090 / 1024 },
    { frame: 4, x: 90, y: 110, leftX: 38, leftScale: 1 },
    { frame: 5, x: 92, y: 105, leftX: 36, leftScale: 1 },
    { frame: 6, x: 64, y: 80, leftX: 64, leftScale: 1 }
].forEach(pose => [1, -1].forEach(direction => {
    const key = mubarakTexture(pose.frame, direction);
    MubarakAssets.push({ frame: pose.frame, direction, key,
        path: `mini-boss/mubarak/${key}.png`, y: pose.y,
        x: direction > 0 ? pose.x : pose.leftX, scale: direction > 0 ? 1 : pose.leftScale });
}));

// Act II's first pose shares the existing padded canvas and sprite transform.
[1, -1].forEach(direction => {
    const key = mubarakTexture(1, direction, 2);
    MubarakAssets.push({ frame: 1, direction, key,
        path: `mini-boss/mubarak/${key}.png`, x: 64, y: 80, scale: 1 });
});

// Measured source-art diamond outlines and bottom tips, before texture registration.
// Dedicated left art needs its own coordinates (especially the reduced Frame 3).
const diamondSources = [
    { tip: [846, 955], outline: [[340,450],[650,230],[910,190],[1150,240],[1360,430],[846,955]] },
    { tip: [826, 930], outline: [[350,470],[650,270],[880,220],[1150,285],[1325,455],[826,930]] },
    { tip: [790, 980], outline: [[310,500],[610,285],[840,240],[1080,290],[1290,485],[790,980]] },
    { tip: [818, 930], outline: [[350,475],[645,270],[890,220],[1125,290],[1305,470],[818,930]] }
];
const leftTips = [[690,955],[710,930],[704,922],[718,930]];

// Independent seeded stream: no formation/composition/Premium draws consumed.
export function mubarakEntranceDirection(seed: number, wave: number): -1 | 1 {
    return randomForWave(seed ^ 0x4d554241, wave)() < 0.5 ? 1 : -1;
}

export function prepareMubarak(scene: Phaser.Scene) {
    MubarakAssets.forEach(pose => {
        if (scene.textures.exists(pose.key)) return;
        const canvas = scene.textures.createCanvas(pose.key,
            MubarakSettings.canvasWidth, MubarakSettings.canvasHeight);
        const image = scene.textures.get(`${pose.key}-source`).getSourceImage() as HTMLImageElement;
        canvas.context.drawImage(image, pose.x, pose.y, image.width * pose.scale, image.height * pose.scale);
        canvas.refresh();
    });
}

// Same duration calculation and configuration as Premium Wojak; no copied timings.
export function premiumHitDuration() {
    return WaveDirectorConfig.premiumInvaders.wojak.hitFlashCount *
        (WojakSettings.milestoneFlashOnDuration + WojakSettings.milestoneFlashOffDuration);
}

// SAT for a convex diamond polygon against an Arcade projectile rectangle.
// Keeps the existing 6x36 laser body (including rapid lasers), not its visual glow.
export function diamondOverlaps(rect: { x: number; y: number; width: number; height: number },
    polygon: { x: number; y: number }[]) {
    const corners = [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height }];
    const axes = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
    polygon.forEach((point, i) => {
        const next = polygon[(i + 1) % polygon.length];
        axes.push({ x: -(next.y - point.y), y: next.x - point.x });
    });
    return axes.every(axis => {
        const a = polygon.map(p => p.x * axis.x + p.y * axis.y);
        const b = corners.map(p => p.x * axis.x + p.y * axis.y);
        return Math.max(...a) >= Math.min(...b) && Math.max(...b) >= Math.min(...a);
    });
}

// Pick a destination once on the actual player line, on the impacted side.
// The extra inset keeps the full rotated projectile inside the playable width.
export function reflectDiamondLaser(polygon: { x: number; y: number }[],
    impact: { x: number; y: number }, velocity: { x: number; y: number },
    playerLineY: number, bounds: { left: number; right: number }, random: () => number, inset = 0) {
    const xs = polygon.map(point => point.x);
    const diamondLeft = Math.min(...xs), diamondRight = Math.max(...xs);
    const center = (diamondLeft + diamondRight) / 2;
    const margin = Math.min(inset, (bounds.right - bounds.left) / 2);
    const left = bounds.left + margin, right = bounds.right - margin;
    const clamp = (x: number) => Math.max(left, Math.min(right, x));
    const centerBand = (diamondRight - diamondLeft) * 0.08;
    const roll = random();
    let targetX: number;
    if (impact.x < center - centerBand) {
        const end = clamp(Math.min(center, impact.x));
        targetX = left + (end - left) * (0.35 + 0.3 * roll);
    } else if (impact.x > center + centerBand) {
        const start = clamp(Math.max(center, impact.x));
        targetX = start + (right - start) * (0.35 + 0.3 * roll);
    } else {
        targetX = clamp(impact.x + (roll - 0.5) * centerBand * 0.6);
    }
    const dx = targetX - impact.x, dy = playerLineY - impact.y;
    const speed = Math.hypot(velocity.x, velocity.y), distance = Math.hypot(dx, dy);
    return { vx: dx / distance * speed, vy: dy / distance * speed, targetX };
}

export class MubarakEncounter {
    sprite: Phaser.GameObjects.Sprite;
    explosion: Phaser.GameObjects.Image;
    barrels: MubarakBarrels;
    shrapnel: MubarakShrapnel;
    act2Health = MubarakAct2Settings.health;
    readonly ricochets: { sprite: Phaser.GameObjects.Sprite; vx: number; vy: number;
        offsetX: number; offsetY: number; width: number; height: number }[] = [];
    private ricochetRandom: () => number;
    private encounterSeed = 0;
    private encounterWave = 1;
    private act2Elapsed = 0;
    private act2BarrelsUnlocked = false;
    private act2Ticks = 0;
    private act2FlashStartedAt = -premiumHitDuration();
    private act2Accumulator = 0;
    private act2HorizontalPhase = 0;
    private act2YOffset = 0;
    hits = 0;
    direction: -1 | 1 = 1;
    private entranceDirection: -1 | 1 = 1;
    phase: 'entrance' | 'cruise' | 'clearing' | 'final' | 'act2' | 'defeat' | 'complete' | 'removed' = 'removed';
    private entranceElapsed = 0;
    private cruiseElapsed = 0;
    private finalElapsed = 0;
    private flashElapsed = premiumHitDuration();
    constructor(private scene: Phaser.Scene, private awardScore: (points: number) => void = () => {}) {}
    get invulnerable() { return this.flashElapsed < premiumHitDuration(); }
    get shootingEnabled() { return this.phase === 'cruise' || this.phase === 'act2'; }
    get act2Visible() {
        return this.phase === 'act2' || this.phase === 'defeat' || (this.phase === 'final' && this.finalElapsed >= mubarakAct2SwitchTime());
    }
    get frame() {
        return this.act2Visible ? MubarakFinalSettings.act2CharacterFrame :
            this.phase === 'clearing' ? 5 : this.phase === 'final' ? MubarakFinalSettings.characterFrame : MubarakSettings.framesByHits[this.hits];
    }
    start(seed = WaveDirectorConfig.seed, wave = MubarakSettings.testSpawn.afterWave) {
        this.clear();
        this.encounterSeed = seed;
        this.ricochetRandom = randomForWave(seed ^ 0x5249434f, wave);
        this.encounterWave = wave;
        this.act2Health = MubarakAct2Settings.health;
        this.act2Elapsed = this.act2Accumulator = this.act2Ticks = 0;
        this.act2FlashStartedAt = -premiumHitDuration();
        this.hits = this.entranceElapsed = this.cruiseElapsed = this.finalElapsed = 0;
        this.flashElapsed = premiumHitDuration();
        this.phase = 'entrance';
        this.direction = this.entranceDirection = mubarakEntranceDirection(seed, wave);
        const bounds = this.scene.physics.world.bounds;
        this.sprite = this.scene.add.sprite(0, 0, mubarakTexture(this.frame, this.direction))
            .setOrigin(0.5).setScale(MubarakSettings.displayWidth / MubarakSettings.canvasWidth).setDepth(10);
        this.sprite.x = this.direction > 0 ? bounds.left - this.sprite.displayWidth / 2 - MubarakSettings.entranceMargin :
            bounds.right + this.sprite.displayWidth / 2 + MubarakSettings.entranceMargin;
        this.sprite.y = bounds.top - this.sprite.displayHeight / 2 - MubarakSettings.entranceMargin;
    }
    update(delta: number, player?: Phaser.Physics.Arcade.Sprite, damagePlayer?: () => void): boolean {
        if (!this.sprite || this.phase === 'removed') return false;
        if (this.phase === 'clearing') {
            this.beginFinalSequence();
            return false;
        }
        if (this.phase === 'act2') return this.updateAct2(delta, player, damagePlayer);
        if (this.phase === 'defeat') {
            this.flashElapsed = Math.min(premiumHitDuration(), this.flashElapsed + Math.max(0, delta));
            this.barrels.step(Math.max(0, delta));
            if (this.flashElapsed >= premiumHitDuration()) {
                this.clear();
                this.phase = 'complete';
                return true;
            }
            this.showFlash();
            return false;
        }
        const dt = Math.max(0, delta), config = MubarakSettings;
        this.flashElapsed = Math.min(premiumHitDuration(), this.flashElapsed + dt);
        let remaining = dt;
        const bounds = this.scene.physics.world.bounds;
        if (this.phase === 'entrance') {
            const step = Math.min(remaining, config.entranceMs - this.entranceElapsed);
            this.entranceElapsed += step;
            remaining -= step;
            const t = this.entranceElapsed / config.entranceMs;
            // Cubic Hermite: start at rest; arrive with the exact cruise tangent.
            const smooth = t * t * (3 - 2 * t), tangent = t * t * (t - 1);
            const radius = this.cruiseRadius;
            const startX = this.entranceDirection > 0 ? bounds.left - this.sprite.displayWidth / 2 - config.entranceMargin :
                bounds.right + this.sprite.displayWidth / 2 + config.entranceMargin;
            const endX = bounds.centerX + this.entranceDirection * radius * Math.sin(config.cruiseStartPhase);
            const velocityX = this.entranceDirection * radius * Math.cos(config.cruiseStartPhase) * 2 * Math.PI / config.cruisePeriodMs;
            const startY = bounds.top - this.sprite.displayHeight / 2 - config.entranceMargin;
            const velocityY = config.waveAmplitude * 2 * Math.PI / config.wavePeriodMs +
                config.bobAmplitude * 2 * Math.PI / config.bobPeriodMs;
            this.sprite.x = startX + (endX - startX) * smooth + tangent * config.entranceMs * velocityX;
            this.sprite.y = startY + (bounds.top + config.patrolY - startY) * smooth + tangent * config.entranceMs * velocityY;
            if (t === 1) this.phase = 'cruise';
        }
        if (this.phase === 'cruise') {
            this.cruiseElapsed += remaining;
            const t = this.cruiseElapsed;
            const phase = config.cruiseStartPhase + t * Math.PI * 2 / config.cruisePeriodMs;
            this.sprite.x = bounds.centerX + this.entranceDirection * this.cruiseRadius * Math.sin(phase);
            const velocitySign = this.entranceDirection * Math.cos(phase);
            // Retain facing at the zero-velocity turning point; switch as travel reverses.
            if (Math.abs(velocitySign) > 1e-10) this.direction = velocitySign < 0 ? -1 : 1;
            this.sprite.y = bounds.top + config.patrolY +
                config.waveAmplitude * Math.sin(t * Math.PI * 2 / config.wavePeriodMs) +
                config.bobAmplitude * Math.sin(t * Math.PI * 2 / config.bobPeriodMs);
        } else if (this.phase === 'final') {
            const previous = this.finalElapsed;
            const needed = mubarakFinalDuration() - this.finalElapsed;
            if (remaining + 1e-7 >= needed) {
                this.finalElapsed = mubarakFinalDuration();
                this.updateFinalShrapnel(previous, this.finalElapsed, player, damagePlayer);
                if (!this.sprite) return false;
                this.phase = 'act2';
                this.syncArtwork();
                if (this.explosion) this.explosion.destroy();
                this.explosion = undefined;
                this.beginAct2();
                return this.updateAct2(Math.max(0, remaining - needed), player, damagePlayer);
            }
            this.finalElapsed += remaining;
            this.updateFinalShrapnel(previous, this.finalElapsed, player, damagePlayer);
            if (!this.sprite) return false;
        }
        if (this.phase === 'cruise') {
            if (this.barrels) this.barrels.step(remaining, player, damagePlayer,
                MubarakBarrelSettings.act1FrequencyMultiplier * (1 + (this.hits - 1) * 0.25));
            if (!this.sprite) return false;
            this.updateRicochets(remaining, player, damagePlayer);
            if (!this.sprite) return false;
        }
        this.syncArtwork();
        if (this.phase === 'final') {
            this.updateExplosion();
            return false;
        }
        applyHitFlash([this.sprite], this.flashElapsed, premiumHitDuration(),
            WojakSettings.milestoneFlashOnDuration, WojakSettings.milestoneFlashOffDuration,
            WojakSettings.milestoneFlashTint);
        return false;
    }
    private updateFinalShrapnel(from: number, to: number, player?: Phaser.Physics.Arcade.Sprite,
        damagePlayer?: () => void) {
        const climax = mubarakAct2SwitchTime();
        if (to < climax) return;
        if (!this.shrapnel) {
            const anchor = MubarakFinalSettings.diamondCenter;
            const x = this.direction < 0 ? MubarakSettings.canvasWidth - anchor.x : anchor.x;
            this.act2BarrelsUnlocked = false;
            this.shrapnel = new MubarakShrapnel(this.scene,
                randomForWave(this.encounterSeed ^ 0x53485250, this.encounterWave), this.awardScore);
            this.shrapnel.begin(this.sprite.x + (x - MubarakSettings.canvasWidth / 2) * this.sprite.scaleX,
                this.sprite.y + (anchor.y - MubarakSettings.canvasHeight / 2) * this.sprite.scaleY);
        }
        this.shrapnel.step(to - Math.max(from, climax), player, damagePlayer);
    }
    tryHitShrapnel(body: MubarakRect) {
        return !!this.shrapnel && this.shrapnel.tryShoot(body);
    }
    private beginAct2() {
        this.act2Health = MubarakAct2Settings.health;
        this.act2Elapsed = this.act2Accumulator = this.act2Ticks = 0;
        this.act2FlashStartedAt = -premiumHitDuration();
        this.flashElapsed = premiumHitDuration();
        const radius = this.cruiseRadius, center = this.scene.physics.world.bounds.centerX;
        const sine = radius > 0 ? Math.max(-1, Math.min(1, (this.sprite.x - center) / radius)) : 0;
        const angle = Math.asin(sine);
        // Reconstruct the current patrol phase, also preserving F6's centered placement.
        this.act2HorizontalPhase = this.direction < 0 ? Math.PI - angle : angle;
        this.act2YOffset = this.sprite.y - this.scene.physics.world.bounds.top -
            MubarakSettings.patrolY - this.hover(this.cruiseElapsed);
        this.barrels = new MubarakBarrels(this.scene,
            randomForWave(this.encounterSeed ^ 0x4f494c42, this.encounterWave),
            () => this.bodyBounds(), () => this.hitByExplosion());
    }
    private hover(t: number) {
        return MubarakSettings.waveAmplitude * Math.sin(t * Math.PI * 2 / MubarakSettings.wavePeriodMs) +
            MubarakSettings.bobAmplitude * Math.sin(t * Math.PI * 2 / MubarakSettings.bobPeriodMs);
    }
    private updateAct2(delta: number, player?: Phaser.Physics.Arcade.Sprite, damagePlayer?: () => void) {
        this.act2Accumulator += Math.max(0, delta);
        const step = MubarakAct2Settings.stepMs, config = MubarakSettings;
        while (this.act2Accumulator + 1e-7 >= step && this.phase === 'act2') {
            this.act2Accumulator = Math.max(0, this.act2Accumulator - step);
            this.act2Ticks++;
            this.act2Elapsed = this.act2Ticks * step;
            this.flashElapsed = Math.min(premiumHitDuration(), Math.round((this.act2Elapsed - this.act2FlashStartedAt) * 1e9) / 1e9);
            const angle = this.act2HorizontalPhase + this.act2Elapsed * Math.PI * 2 /
                config.cruisePeriodMs * MubarakAct2Settings.horizontalSpeedMultiplier;
            this.sprite.x = this.scene.physics.world.bounds.centerX + this.cruiseRadius * Math.sin(angle);
            if (Math.abs(Math.cos(angle)) > 1e-10) this.direction = Math.cos(angle) < 0 ? -1 : 1;
            this.sprite.y = this.scene.physics.world.bounds.top + config.patrolY +
                this.hover(this.cruiseElapsed + this.act2Elapsed) + this.act2YOffset;
            this.syncArtwork();
            if (!this.act2BarrelsUnlocked && (!this.shrapnel || this.shrapnel.readyForBarrels))
                this.act2BarrelsUnlocked = true;
            this.barrels.step(step, player, damagePlayer,
                this.act2BarrelsUnlocked ? MubarakBarrelSettings.act2FrequencyMultiplier : 0);
            if (this.shrapnel) this.shrapnel.step(step, player, damagePlayer);
        }
        if (this.sprite) this.showFlash();
        return false;
    }
    private showFlash() {
        applyHitFlash([this.sprite], this.flashElapsed, premiumHitDuration(),
            WojakSettings.milestoneFlashOnDuration, WojakSettings.milestoneFlashOffDuration,
            WojakSettings.milestoneFlashTint);
    }
    bodyBounds(): MubarakRect {
        const body = MubarakAct2Settings.visibleBody;
        return { x: this.sprite.x + (body.x - MubarakSettings.canvasWidth / 2) * this.sprite.scaleX,
            y: this.sprite.y + (body.y - MubarakSettings.canvasHeight / 2) * this.sprite.scaleY,
            width: body.width * this.sprite.scaleX, height: body.height * this.sprite.scaleY };
    }
    tryHitBarrel(body: Phaser.Physics.Arcade.Body) {
        return (this.phase === 'act2' || this.phase === 'cruise') && !!this.barrels && this.barrels.tryShoot(body);
    }
    private hitByExplosion(): boolean {
        if (this.phase !== 'act2' || this.invulnerable || this.act2Health <= 0) return false;
        this.act2Health--;
        this.act2FlashStartedAt = this.act2Elapsed;
        this.flashElapsed = 0;
        this.showFlash();
        if (this.act2Health === 0) {
            this.phase = 'defeat';
            this.barrels.stop();
        }
        return true;
    }
    private get cruiseRadius() {
        return Math.max(0, this.scene.physics.world.bounds.width / 2 - this.sprite.displayWidth / 2 - MubarakSettings.edgeMargin);
    }
    private syncArtwork() {
        const key = mubarakTexture(this.frame, this.direction, this.act2Visible ? 2 : 1);
        if (this.sprite.texture.key !== key) this.sprite.setTexture(key);
    }
    private updateExplosion() {
        let end = 0;
        const stage = MubarakFinalSettings.stages.find(entry => {
            end += entry.durationMs;
            return this.finalElapsed < end;
        });
        if (!stage || !this.explosion) return;
        if (this.explosion.texture.key !== stage.key) this.explosion.setTexture(stage.key);
        const anchor = MubarakFinalSettings.diamondCenter, offset = MubarakFinalSettings.overlayOffset;
        const localX = anchor.x + offset.x;
        const x = this.direction < 0 ? MubarakSettings.canvasWidth - localX : localX;
        this.explosion.setPosition(this.sprite.x + (x - MubarakSettings.canvasWidth / 2) * this.sprite.scaleX,
            this.sprite.y + (anchor.y + offset.y - MubarakSettings.canvasHeight / 2) * this.sprite.scaleY);
        this.explosion.setScale(this.sprite.displayWidth * stage.widthMultiplier / this.explosion.width);
    }
    private beginFinalSequence() {
        this.phase = 'final';
        this.finalElapsed = 0;
        this.syncArtwork();
        // The final cinematic supersedes the last hit's flash; earlier hits keep
        // Premium Wojak feedback. Keep Frame 6 and its overlay in their source colors.
        this.sprite.clearTint();
        this.explosion = this.scene.add.image(0, 0, MubarakFinalSettings.stages[0].key)
            .setOrigin(0.5).setDepth(this.sprite.depth + MubarakFinalSettings.overlayDepthOffset);
        this.updateExplosion();
    }
    private sourcePoint(x: number, y: number) {
        const pose = MubarakAssets.find(p => p.frame === Math.min(4, this.frame) && p.direction === this.direction);
        return { x: this.sprite.x + (pose.x + x * pose.scale - MubarakSettings.canvasWidth / 2) * this.sprite.scaleX,
            y: this.sprite.y + (pose.y + y * pose.scale - MubarakSettings.canvasHeight / 2) * this.sprite.scaleY };
    }
    weakPointBounds(): MubarakRect {
        const index = Math.min(3, this.hits), source = diamondSources[index];
        const tip = this.direction < 0 ? leftTips[index] : source.tip;
        const point = this.sourcePoint(tip[0], tip[1]);
        const width = MubarakSettings.weakPoint.width * this.sprite.scaleX;
        const height = MubarakSettings.weakPoint.height * this.sprite.scaleY;
        return { x: point.x - width / 2, y: point.y - height, width, height };
    }
    diamondPolygon() {
        if (!this.sprite) return [];
        const index = Math.min(3, this.hits), source = diamondSources[index];
        return source.outline.map(point => {
            if (this.direction > 0) return this.sourcePoint(point[0], point[1]);
            // Frame 3's left source is a separately reduced export of the right.
            const ratio = index === 2 ? 1024 / 1090 : 1;
            const tip = leftTips[index];
            return this.sourcePoint(tip[0] - (point[0] - source.tip[0]) * ratio,
                tip[1] + (point[1] - source.tip[1]) * ratio);
        });
    }
    receiveLaser(body: MubarakRect, original: Phaser.GameObjects.Sprite | undefined, playerLineY: number) {
        if (this.phase !== 'cruise') return;
        if (rectsOverlap(body, this.weakPointBounds())) { this.hit(); return; }
        const incomingBody = original && (original as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
        const reflected = reflectDiamondLaser(this.diamondPolygon(),
            { x: original ? original.x : body.x + body.width / 2, y: original ? original.y : body.y },
            incomingBody ? incomingBody.velocity : { x: 0, y: -400 }, playerLineY,
            this.scene.physics.world.bounds, this.ricochetRandom, Math.hypot(body.width, body.height) / 2 + 1);
        const sprite = this.scene.add.sprite(original ? original.x : body.x + body.width / 2,
            original ? original.y : body.y, original ? original.texture.key : AssetType.Bullet,
            original ? original.frame.name : undefined).setDepth(12);
        if (original) {
            sprite.setOrigin(original.originX, original.originY).setScale(original.scaleX, original.scaleY)
                .setAlpha(original.alpha).setRotation(original.rotation).setFlip(original.flipX, original.flipY)
                .setBlendMode(original.blendMode);
            // Phaser 3.22 exposes stored tints in BGR, while setTint takes RGB.
            const rgb = (tint: number) => ((tint & 255) << 16) | (tint & 0xff00) | ((tint >>> 16) & 255);
            const colors = [original.tintTopLeft, original.tintTopRight, original.tintBottomLeft, original.tintBottomRight].map(rgb);
            if (original.tintFill) sprite.setTintFill(colors[0], colors[1], colors[2], colors[3]);
            else sprite.setTint(colors[0], colors[1], colors[2], colors[3]);
            if (original.anims.isPlaying && original.anims.currentAnim) {
                sprite.play(original.anims.currentAnim.key);
                sprite.anims.setCurrentFrame(original.anims.currentFrame);
                sprite.anims.setTimeScale(original.anims.getTimeScale());
            }
        }
        const rotation = Math.atan2(reflected.vy, reflected.vx) + Math.PI / 2;
        sprite.setRotation(rotation);
        const width = Math.abs(Math.cos(rotation)) * body.width + Math.abs(Math.sin(rotation)) * body.height;
        const height = Math.abs(Math.sin(rotation)) * body.width + Math.abs(Math.cos(rotation)) * body.height;
        // Only this player-hazard list owns reflected shots: they never enter the
        // player bullet group or diamond collision path, even while overlapping it.
        this.ricochets.push({ sprite, vx: reflected.vx, vy: reflected.vy,
            offsetX: body.x + body.width / 2 - sprite.x - width / 2,
            offsetY: body.y + body.height / 2 - sprite.y - height / 2, width, height });
    }
    private updateRicochets(delta: number, player?: Phaser.Physics.Arcade.Sprite, damagePlayer?: () => void) {
        for (const shot of this.ricochets.slice()) {
            shot.sprite.x += shot.vx * delta / 1000;
            shot.sprite.y += shot.vy * delta / 1000;
            const body = { x: shot.sprite.x + shot.offsetX, y: shot.sprite.y + shot.offsetY,
                width: shot.width, height: shot.height };
            const hit = player && player.active && rectsOverlap(body, player.body as Phaser.Physics.Arcade.Body);
            const world = this.scene.physics.world.bounds;
            const offscreen = body.x + body.width < world.left || body.x > world.right ||
                body.y + body.height < world.top || body.y > world.bottom;
            if (hit || offscreen || !shot.sprite.active) {
                if (shot.sprite.active) shot.sprite.destroy();
                this.ricochets.splice(this.ricochets.indexOf(shot), 1);
                if (hit && damagePlayer) damagePlayer();
                if (!this.sprite) break;
            }
        }
    }
    collides(body: Phaser.Physics.Arcade.Body) {
        if (this.sprite && (this.phase === 'act2' || this.phase === 'defeat')) return rectsOverlap(body, this.bodyBounds());
        return !!this.sprite && this.phase === 'cruise' &&
            (rectsOverlap(body, this.weakPointBounds()) || diamondOverlaps(body, this.diamondPolygon()));
    }
    hit(): boolean {
        if (this.phase !== 'cruise' || this.invulnerable || !this.sprite || !this.sprite.active) return false;
        this.hits++;
        if (this.hits >= MubarakSettings.successfulHits) {
            this.phase = 'clearing';
            this.syncArtwork();
            this.sprite.clearTint();
            if (this.barrels) this.barrels.clear();
            this.barrels = undefined;
            this.ricochets.splice(0).forEach(shot => shot.sprite.destroy());
            return true;
        }
        if (!this.barrels) this.barrels = new MubarakBarrels(this.scene,
            randomForWave(this.encounterSeed ^ 0x41435431, this.encounterWave),
            () => this.bodyBounds(), () => false,
            () => ({
                left: this.sprite.x + (MubarakSettings.carpet.left - MubarakSettings.canvasWidth / 2) * this.sprite.scaleX,
                right: this.sprite.x + (MubarakSettings.carpet.right - MubarakSettings.canvasWidth / 2) * this.sprite.scaleX,
                y: this.sprite.y + (MubarakSettings.carpet.bottom - MubarakSettings.canvasHeight / 2) * this.sprite.scaleY
            }), false);
        this.syncArtwork();
        this.flashElapsed = 0;
        applyHitFlash([this.sprite], 0, premiumHitDuration(),
            WojakSettings.milestoneFlashOnDuration, WojakSettings.milestoneFlashOffDuration,
            WojakSettings.milestoneFlashTint);
        return true;
    }
    clear() {
        this.act2BarrelsUnlocked = false;
        if (this.shrapnel) this.shrapnel.clear();
        this.shrapnel = undefined;
        this.ricochets.splice(0).forEach(shot => shot.sprite.destroy());
        if (this.barrels) this.barrels.clear();
        this.barrels = undefined;
        if (this.explosion) this.explosion.destroy();
        this.explosion = undefined;
        if (this.sprite) this.sprite.destroy();
        this.sprite = undefined;
        this.phase = 'removed';
    }
}
