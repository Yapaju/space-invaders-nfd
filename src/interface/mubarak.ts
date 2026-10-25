import { MubarakBarrels, MubarakBarrelSettings, MubarakRect, rectsOverlap } from './mubarak-barrels';
import { randomForWave, WaveDirectorConfig } from './wave-director';
import { WojakSettings } from './wojak-boss';
import { applyHitFlash } from './hit-flash';
import { AssetType, SoundType } from './assets';
import { MubarakShrapnel } from './mubarak-shrapnel';
import { Kaboom } from './kaboom';
import { AnimationType } from './factory/animation-factory';
import { AudioBalance } from './audio-balance';

export const CZ_HIT_EXPLOSION_SCALE_MULTIPLIER = 1.5;

export const MubarakSettings = {
    // Temporary local playtest: set enabled=false to restore checkpoint-only rotation.
    testSpawn: { enabled: true, afterWave: 1 },
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
    health: 3, horizontalSpeedMultiplier: 2, stepMs: 1000 / 120,
    // Registered canvas bounds measured at alpha >=128 in both angry sources.
    visibleBody: { x: 86, y: 90, width: 1492, height: 1011 }
};

// Act III prototype: lane centers are relative to the playable world's top.
export const MubarakAct3Settings = {
    mubarakLaneY: 260, czLaneY: 100, czDisplayWidth: 130,
    mubarakSpeed: 120, czSpeed: 90, edgeMargin: 24,
    escapeInitialSpeed: 360, escapeAcceleration: 600, successfulHits: 2,
    bnbPumpIntervalMs: 3000, bnbCoinSpeed: 180, bnbCoinSize: 28, bnbMaxActiveCoins: 3,
    growthPerPump: 0.08, maxScaleMultiplier: 1.48, growthTweenMs: 200,
    collapseDurationMs: 2000, stepMs: 1000 / 120,
    czPumpOrigin: { x: 650, y: 450 },
    czInvulnerabilityMs: 800, blockingAlphaThreshold: 128, czAlphaThreshold: 16,
    blackDiamondIntervalsMs: [2500, 2000, 1500, 1000],
    blackDiamondOrigin: { x: 832, y: 1100 },
    blackDiamondAnglesDegrees: [-40, -20, 0, 20, 40],
    czHitExplosionOrigin: { x: 650, y: 400 }
};
export const MubarakBNBAsset = { key: 'mubarak-cz-bnb-coin',
    path: 'mini-boss/mubarak/mubarak-cz-bnb-coin.png' };

// Time of first contact for a moving point and an axis-aligned rectangle.
// Expand the rectangle by the projectile shape before calling this helper.
function segmentRectContact(x: number, y: number, endX: number, endY: number, rect: MubarakRect) {
    let enter = 0, exit = 1;
    const axes = [[x, endX - x, rect.x, rect.x + rect.width],
        [y, endY - y, rect.y, rect.y + rect.height]];
    for (const [start, distance, min, max] of axes) {
        if (Math.abs(distance) < 1e-10) {
            if (start < min || start > max) return Infinity;
        } else {
            const a = (min - start) / distance, b = (max - start) / distance;
            enter = Math.max(enter, Math.min(a, b));
            exit = Math.min(exit, Math.max(a, b));
            if (enter > exit) return Infinity;
        }
    }
    return enter;
}

function smoothStep(t: number) { return t * t * (3 - 2 * t); }
type BNBCoin = { sprite: Phaser.GameObjects.Image; vx: number; vy: number };

type MubarakAlpha = { width: number; height: number; alpha: Uint8Array };
const mubarakAlphaCache = new WeakMap<Phaser.Textures.Texture, MubarakAlpha>();
function cacheMubarakAlpha(texture: Phaser.Textures.Texture) {
    let cached = mubarakAlphaCache.get(texture);
    if (cached) return cached;
    // Read registered canvases or original PNGs once, retaining only alpha bytes.
    const source = texture.getSourceImage() as HTMLCanvasElement | HTMLImageElement;
    const canvas = source instanceof HTMLCanvasElement ? source : document.createElement('canvas');
    if (canvas !== source) {
        canvas.width = source.width; canvas.height = source.height;
        canvas.getContext('2d').drawImage(source, 0, 0);
    }
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const alpha = new Uint8Array(canvas.width * canvas.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3];
    cached = { width: canvas.width, height: canvas.height, alpha };
    mubarakAlphaCache.set(texture, cached);
    return cached;
}

// Exact source-pixel filtering for the encounter's unrotated, vertical player beams.
// Return first-contact time along the beam's swept rectangle, or Infinity.
export function mubarakOpaqueContact(sprite: Phaser.GameObjects.Sprite, body: MubarakRect & {
    prev?: { y: number }; velocity?: { y: number }
}, threshold = MubarakAct3Settings.blockingAlphaThreshold) {
    const previousY = body.prev && body.velocity && body.velocity.y < 0 ? Math.max(body.y, body.prev.y) : body.y;
    const sweep = { x: body.x, y: body.y, width: body.width, height: body.height + previousY - body.y };
    if (!sprite.scaleX || !sprite.scaleY || !rectsOverlap(sweep, sprite.getBounds())) return Infinity;
    const mask = cacheMubarakAlpha(sprite.texture), sx = sprite.scaleX, sy = sprite.scaleY;
    const localX = (x: number) => (x - sprite.x) / sx + sprite.originX * sprite.width;
    const localY = (y: number) => (y - sprite.y) / sy + sprite.originY * sprite.height;
    const x1 = localX(sweep.x), x2 = localX(sweep.x + sweep.width);
    const y1 = localY(sweep.y), y2 = localY(sweep.y + sweep.height);
    const left = Math.max(0, Math.floor(Math.min(x1, x2))), right = Math.min(mask.width - 1, Math.ceil(Math.max(x1, x2)) - 1);
    const top = Math.max(0, Math.floor(Math.min(y1, y2))), bottom = Math.min(mask.height - 1, Math.ceil(Math.max(y1, y2)) - 1);
    // Visit world-space rows from bottom to top, covering every occupied beam
    // column, not just its center. Flip only the alpha lookup, matching rendering.
    const first = sy > 0 ? bottom : top, last = sy > 0 ? top : bottom, step = sy > 0 ? -1 : 1;
    for (let y = first; sy > 0 ? y >= last : y <= last; y += step) {
        const row = (sprite.flipY ? mask.height - 1 - y : y) * mask.width;
        for (let x = left; x <= right; x++) {
            const column = sprite.flipX ? mask.width - 1 - x : x;
            if (mask.alpha[row + column] < threshold) continue;
            const edge1 = sprite.y + (y - sprite.originY * sprite.height) * sy;
            const edge2 = edge1 + sy, worldBottom = Math.max(edge1, edge2);
            return previousY > body.y ? Math.max(0, (previousY - worldBottom) / (previousY - body.y)) : 0;
        }
    }
    return Infinity;
}
export function mubarakCZTexture(frame: number, direction: number) {
    return `mubarak-cz-${frame}-${direction < 0 ? 'left' : 'right'}`;
}
export const MubarakCZAssets = [1, 2, 3].reduce((assets, frame) => assets.concat(
    [-1, 1].map(direction => {
        const key = mubarakCZTexture(frame, direction);
        return { key, path: `mini-boss/mubarak/${key}.png` };
    })), [] as { key: string; path: string }[]);

// Reflect any overshoot, including long frames, without leaving the lane.
export function mubarakPatrol(x: number, direction: -1 | 1, distance: number, left: number, right: number) {
    const span = right - left;
    if (span <= 0) return { x: (left + right) / 2, direction };
    const phase = ((direction > 0 ? x - left : 2 * span - (x - left)) + distance) % (2 * span);
    return { x: left + (phase < span ? phase : 2 * span - phase),
        direction: (phase < span ? 1 : -1) as -1 | 1 };
}

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
    [-1, 1].forEach(direction => cacheMubarakAlpha(scene.textures.get(mubarakTexture(1, direction, 2))));
    MubarakCZAssets.forEach(asset => cacheMubarakAlpha(scene.textures.get(asset.key)));
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
    cz: Phaser.GameObjects.Sprite;
    czHits = 0;
    czDirection: -1 | 1 = -1;
    private czEscapeSpeed = 0;
    private czFlashElapsed = MubarakAct3Settings.czInvulnerabilityMs;
    readonly czHitExplosions: Kaboom[] = [];
    act3Diamonds: MubarakShrapnel;
    private diamondElapsed = 0;
    readonly bnbCoins: BNBCoin[] = [];
    act3Pumps = 0;
    private pumpElapsed = 0;
    private act3BaseScale = 0;
    private act3Bottom = 0;
    private growthFrom = 1;
    private growthTo = 1;
    private growthElapsed = 0;
    private collapseElapsed = 0;
    private collapseScale = 0;
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
    phase: 'entrance' | 'cruise' | 'clearing' | 'final' | 'act2' | 'act3Entry' | 'act3' | 'escape' | 'collapse' | 'complete' | 'removed' = 'removed';
    private entranceElapsed = 0;
    private cruiseElapsed = 0;
    private finalElapsed = 0;
    private flashElapsed = premiumHitDuration();
    constructor(private scene: Phaser.Scene, private awardScore: (points: number) => void = () => {}) {}
    get act3Active() { return this.phase === 'act3' || this.phase === 'escape'; }
    get czInvulnerable() { return this.czFlashElapsed + 1e-7 < MubarakAct3Settings.czInvulnerabilityMs; }
    get invulnerable() { return this.act3Active || this.phase === 'collapse' || this.phase === 'act3Entry' || this.flashElapsed < premiumHitDuration(); }
    get shootingEnabled() { return this.phase === 'cruise' || this.phase === 'act2' || this.act3Active; }
    get act2Visible() {
        return this.phase === 'act2' || this.phase === 'act3Entry' || this.act3Active || this.phase === 'collapse' || (this.phase === 'final' && this.finalElapsed >= mubarakAct2SwitchTime());
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
        if (this.act3Active || this.phase === 'collapse') return this.updateAct3(Math.max(0, delta), player, damagePlayer);
        if (this.phase === 'act3Entry') {
            const remaining = Math.max(0, delta - (premiumHitDuration() - this.flashElapsed));
            this.flashElapsed = Math.min(premiumHitDuration(), this.flashElapsed + Math.max(0, delta));
            this.barrels.step(Math.max(0, delta));
            if (this.flashElapsed >= premiumHitDuration()) {
                this.beginAct3();
                return this.updateAct3(remaining, player, damagePlayer);
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
            this.phase = 'act3Entry';
            this.barrels.stop();
        }
        return true;
    }
    private beginAct3() {
        if (this.barrels) this.barrels.clear();
        this.barrels = undefined;
        if (this.shrapnel) this.shrapnel.clear();
        this.shrapnel = undefined;
        this.ricochets.splice(0).forEach(shot => shot.sprite.destroy());
        this.phase = 'act3';
        this.czHits = 0;
        this.czEscapeSpeed = 0;
        this.czDirection = this.direction > 0 ? -1 : 1;
        const world = this.scene.physics.world.bounds, config = MubarakAct3Settings;
        this.sprite.y = world.top + config.mubarakLaneY;
        this.act3BaseScale = this.sprite.scaleX;
        this.act3Bottom = this.sprite.y + this.sprite.displayHeight / 2;
        this.act3Pumps = this.pumpElapsed = 0;
        this.diamondElapsed = 0;
        this.czFlashElapsed = config.czInvulnerabilityMs;
        this.act3Diamonds = new MubarakShrapnel(this.scene,
            randomForWave(this.encounterSeed ^ 0x44494133, this.encounterWave), () => {});
        this.growthFrom = this.growthTo = 1;
        this.growthElapsed = config.growthTweenMs;
        this.sprite.clearTint();
        this.cz = this.scene.add.sprite(this.sprite.x, world.top + config.czLaneY,
            mubarakCZTexture(1, this.czDirection)).setOrigin(0.5).setDepth(this.sprite.depth - 1);
        this.cz.setScale(config.czDisplayWidth / this.cz.width);
        this.syncArtwork();
    }
    private updateAct3(delta: number, player?: Phaser.Physics.Arcade.Sprite, damagePlayer?: () => void) {
        // Small bounded steps keep moving-coin contacts and expanding boundaries
        // stable on long frames. All clocks belong to the encounter, not timers.
        let remaining = delta;
        do {
            const step = Math.min(remaining, MubarakAct3Settings.stepMs);
            if (this.stepAct3(step, player, damagePlayer)) return true;
            remaining -= step;
        } while (remaining > 1e-7 && this.sprite);
        return false;
    }
    private stepAct3(delta: number, player?: Phaser.Physics.Arcade.Sprite, damagePlayer?: () => void): boolean {
        if (this.phase === 'collapse') return this.updateCollapse(delta);
        const world = this.scene.physics.world.bounds, config = MubarakAct3Settings;
        this.czFlashElapsed = Math.min(config.czInvulnerabilityMs, this.czFlashElapsed + delta);
        if (config.czInvulnerabilityMs - this.czFlashElapsed < 1e-7) this.czFlashElapsed = config.czInvulnerabilityMs;
        this.updateGrowth(delta);
        const patrol = (sprite: Phaser.GameObjects.Sprite, direction: -1 | 1, speed: number) =>
            mubarakPatrol(sprite.x, direction, speed * delta / 1000,
                world.left + sprite.displayWidth / 2 + config.edgeMargin,
                world.right - sprite.displayWidth / 2 - config.edgeMargin);
        const lower = patrol(this.sprite, this.direction, config.mubarakSpeed);
        this.sprite.x = lower.x;
        this.direction = lower.direction;
        this.syncArtwork();
        if (this.phase === 'escape') {
            const seconds = delta / 1000;
            this.cz.x += this.czDirection * (this.czEscapeSpeed * seconds + config.escapeAcceleration * seconds * seconds / 2);
            this.czEscapeSpeed += config.escapeAcceleration * seconds;
            if (this.czDirection > 0 ? this.cz.x - this.cz.displayWidth / 2 > world.right :
                this.cz.x + this.cz.displayWidth / 2 < world.left) {
                this.beginCollapse();
                return false;
            }
        } else {
            const upper = patrol(this.cz, this.czDirection, config.czSpeed);
            this.cz.x = upper.x;
            this.czDirection = upper.direction;
        }
        const key = mubarakCZTexture(this.czHits + 1, this.czDirection);
        if (this.cz.texture.key !== key) this.cz.setTexture(key);
        this.showCZFlash();
        if (this.phase === 'act3') {
            this.updateCoins(delta);
            this.pumpElapsed += delta;
            if (this.pumpElapsed + 1e-7 >= config.bnbPumpIntervalMs) {
                this.pumpElapsed = Math.max(0, this.pumpElapsed - config.bnbPumpIntervalMs);
                this.launchBNB();
            }
            this.act3Diamonds.step(delta, player, damagePlayer);
            if (!this.sprite) return false; // Last-life impact may clear the encounter.
            this.diamondElapsed += delta;
            const intervals = config.blackDiamondIntervalsMs;
            const interval = intervals[Math.min(intervals.length - 1, Math.floor(this.act3Pumps / 2))];
            if (this.diamondElapsed + 1e-7 >= interval) {
                this.diamondElapsed = Math.max(0, this.diamondElapsed - interval);
                const origin = config.blackDiamondOrigin;
                const x = this.direction < 0 ? this.sprite.width - origin.x : origin.x;
                this.act3Diamonds.fireBlack(this.sprite.x + (x - this.sprite.width / 2) * this.sprite.scaleX,
                    this.sprite.y + (origin.y - this.sprite.height / 2) * this.sprite.scaleY,
                    config.blackDiamondAnglesDegrees);
            }
        }
        return false;
    }
    private showCZFlash() {
        applyHitFlash([this.cz], Math.round(this.czFlashElapsed * 1e6) / 1e6, MubarakAct3Settings.czInvulnerabilityMs,
            WojakSettings.milestoneFlashOnDuration, WojakSettings.milestoneFlashOffDuration,
            WojakSettings.milestoneFlashTint);
    }
    private showCZHitExplosion() {
        const origin = MubarakAct3Settings.czHitExplosionOrigin;
        const x = this.czDirection < 0 ? this.cz.width - origin.x : origin.x;
        // Use the ordinary invader effect's default display scale, then multiply
        // it. Adding only to the display list keeps this effect non-physical.
        const explosion = new Kaboom(this.scene);
        this.scene.add.existing(explosion);
        explosion.setPosition(this.cz.x + (x - this.cz.width / 2) * this.cz.scaleX,
            this.cz.y + (origin.y - this.cz.height / 2) * this.cz.scaleY)
            .setScale(explosion.scaleX * CZ_HIT_EXPLOSION_SCALE_MULTIPLIER,
                explosion.scaleY * CZ_HIT_EXPLOSION_SCALE_MULTIPLIER).setDepth(this.sprite.depth + 3);
        this.czHitExplosions.push(explosion);
        // Phaser 3.22 emits the sprite-specific completion event here. Keep this
        // compatibility hook local instead of changing all existing Kaboom users.
        explosion.once(Phaser.Animations.Events.SPRITE_ANIMATION_COMPLETE, () => explosion.destroy());
        explosion.once('destroy', () => {
            const index = this.czHitExplosions.indexOf(explosion);
            if (index >= 0) this.czHitExplosions.splice(index, 1);
        });
        explosion.play(AnimationType.Kaboom);
        this.scene.sound.play(SoundType.InvaderKilled, { volume: AudioBalance.gains[SoundType.InvaderKilled] });
    }
    private launchBNB() {
        const config = MubarakAct3Settings;
        if (this.phase !== 'act3' || this.bnbCoins.length >= config.bnbMaxActiveCoins) return;
        const origin = config.czPumpOrigin;
        const localX = this.czDirection < 0 ? this.cz.width - origin.x : origin.x;
        const x = this.cz.x + (localX - this.cz.width / 2) * this.cz.scaleX;
        const y = this.cz.y + (origin.y - this.cz.height / 2) * this.cz.scaleY;
        const dx = this.sprite.x - x, dy = this.sprite.y - y, length = Math.hypot(dx, dy) || 1;
        const sprite = this.scene.add.image(x, y, MubarakBNBAsset.key).setOrigin(0.5).setDepth(12);
        sprite.setScale(config.bnbCoinSize / sprite.width);
        this.bnbCoins.push({ sprite, vx: dx / length * config.bnbCoinSpeed, vy: dy / length * config.bnbCoinSpeed });
    }
    private removeCoin(coin: { sprite: Phaser.GameObjects.Image }) {
        const index = this.bnbCoins.findIndex(entry => entry === coin);
        if (index < 0) return;
        this.bnbCoins.splice(index, 1);
        coin.sprite.destroy();
    }
    private clearCoins() { this.bnbCoins.slice().forEach(coin => this.removeCoin(coin)); }
    private updateCoins(delta: number) {
        const world = this.scene.physics.world.bounds;
        for (const coin of this.bnbCoins.slice()) {
            const x = coin.sprite.x, y = coin.sprite.y, half = coin.sprite.displayWidth / 2;
            coin.sprite.x += coin.vx * delta / 1000;
            coin.sprite.y += coin.vy * delta / 1000;
            const body = this.bodyBounds();
            const contact = segmentRectContact(x, y, coin.sprite.x, coin.sprite.y,
                { x: body.x - half, y: body.y - half, width: body.width + 2 * half, height: body.height + 2 * half });
            if (contact !== Infinity) {
                this.removeCoin(coin);
                this.act3Pumps++;
                this.growthFrom = this.sprite.scaleX / this.act3BaseScale;
                this.growthTo = Math.min(MubarakAct3Settings.maxScaleMultiplier,
                    1 + this.act3Pumps * MubarakAct3Settings.growthPerPump);
                this.growthElapsed = 0;
            } else if (coin.sprite.x + half < world.left || coin.sprite.x - half > world.right ||
                coin.sprite.y + half < world.top || coin.sprite.y - half > world.bottom) this.removeCoin(coin);
        }
    }
    private updateGrowth(delta: number) {
        const config = MubarakAct3Settings, world = this.scene.physics.world.bounds;
        const oldSpan = Math.max(0, world.width - 2 * config.edgeMargin - this.sprite.displayWidth);
        this.growthElapsed = Math.min(config.growthTweenMs, this.growthElapsed + delta);
        const t = config.growthTweenMs > 0 ? this.growthElapsed / config.growthTweenMs : 1;
        this.sprite.setScale(this.act3BaseScale * (this.growthFrom + (this.growthTo - this.growthFrom) * smoothStep(t)));
        const newSpan = Math.max(0, world.width - 2 * config.edgeMargin - this.sprite.displayWidth);
        // Preserve progress across the shrinking patrol lane. As the scale eases,
        // the edges gently carry the boss inward without an abrupt clamp/teleport.
        if (oldSpan > 0) this.sprite.x = world.centerX + (this.sprite.x - world.centerX) * newSpan / oldSpan;
        this.sprite.y = this.act3Bottom - this.sprite.displayHeight / 2;
    }
    private beginCollapse() {
        this.clearCoins();
        this.pumpElapsed = 0;
        this.cz.destroy();
        this.cz = undefined;
        this.phase = 'collapse';
        this.collapseElapsed = 0;
        this.collapseScale = this.sprite.scaleX;
    }
    private updateCollapse(delta: number) {
        const duration = MubarakAct3Settings.collapseDurationMs;
        this.collapseElapsed = Math.min(duration, this.collapseElapsed + delta);
        const t = duration > 0 ? this.collapseElapsed / duration : 1;
        // Center origin and fixed position: the dump contracts around the current center.
        this.sprite.setScale(this.collapseScale * (1 - smoothStep(t)));
        if (this.collapseElapsed + 1e-7 < duration) return false;
        this.clear();
        this.phase = 'complete';
        return true;
    }
    czBounds(): MubarakRect {
        // Broad phase only; actual hits require opaque artwork in act3Target.
        return this.cz.getBounds();
    }
    private act3ContactTime(body: Phaser.Physics.Arcade.Body, target: MubarakRect) {
        const previousY = body.prev && body.velocity && body.velocity.y < 0 ? Math.max(body.y, body.prev.y) : body.y;
        return segmentRectContact(body.x, previousY, body.x, body.y,
            { x: target.x - body.width, y: target.y - body.height,
                width: target.width + body.width, height: target.height + body.height });
    }
    private act3Target(body: Phaser.Physics.Arcade.Body) {
        // Resolve the first physical contact, with the shield winning exact ties.
        let time = mubarakOpaqueContact(this.sprite, body);
        let target: { kind: 'mubarak' | 'coin' | 'cz'; coin?: BNBCoin } =
            time !== Infinity ? { kind: 'mubarak' } : undefined;
        if (this.phase === 'act3') {
            for (const coin of this.bnbCoins) {
                const contact = this.act3ContactTime(body, coin.sprite.getBounds());
                if (contact < time) { time = contact; target = { kind: 'coin', coin }; }
            }
        }
        if (this.cz) {
            const contact = mubarakOpaqueContact(this.cz, body, MubarakAct3Settings.czAlphaThreshold);
            if (contact < time) target = { kind: 'cz' };
        }
        return target;
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
        if (this.act3Active) {
            const target = this.act3Target(body as Phaser.Physics.Arcade.Body);
            if (target && target.kind === 'coin') this.removeCoin(target.coin);
            if (target && target.kind === 'cz' && this.phase === 'act3' && !this.czInvulnerable) {
                this.showCZHitExplosion();
                this.czHits++;
                this.cz.setTexture(mubarakCZTexture(this.czHits + 1, this.czDirection));
                this.czFlashElapsed = 0;
                this.showCZFlash();
                if (this.czHits === MubarakAct3Settings.successfulHits) {
                    this.phase = 'escape';
                    this.clearCoins();
                    this.act3Diamonds.clear();
                    this.diamondElapsed = 0;
                    this.pumpElapsed = 0;
                    this.czEscapeSpeed = MubarakAct3Settings.escapeInitialSpeed;
                }
            }
            return;
        }
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
        if (this.sprite && this.act3Active) return !!this.act3Target(body);
        if (this.sprite && (this.phase === 'act2' || this.phase === 'act3Entry')) return rectsOverlap(body, this.bodyBounds());
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
        this.czHitExplosions.splice(0).forEach(explosion => explosion.destroy());
        if (this.act3Diamonds) this.act3Diamonds.clear();
        this.act3Diamonds = undefined;
        this.diamondElapsed = 0;
        this.czFlashElapsed = MubarakAct3Settings.czInvulnerabilityMs;
        this.clearCoins();
        this.act3Pumps = this.pumpElapsed = this.collapseElapsed = 0;
        this.act3BaseScale = this.act3Bottom = this.collapseScale = 0;
        this.growthFrom = this.growthTo = 1;
        this.growthElapsed = 0;
        if (this.cz) this.cz.destroy();
        this.cz = undefined;
        this.czHits = this.czEscapeSpeed = 0;
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
