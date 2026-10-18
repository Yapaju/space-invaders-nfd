import { AssetType } from './assets';

export type CandlePattern = 'single' | 'gap' | 'rain';
export const CandleSettings = {
    speed: 160, scale: 0.32, rainInterval: 250,
    safeGap: 120, edgeMargin: 12, reactionTime: 500,
    releaseGap: 4, visibleTop: 14,
    // Discard suspended frames rather than catching up missed attacks.
    maxFrameDelta: 250
};

export const CandlePhases = [
    { name: 'B', threshold: 25, interval: 1500, sizes: [50, 35, 15, 0, 0], patterns: [100, 0, 0] },
    { name: 'C', threshold: 0, interval: 1200, sizes: [30, 25, 20, 15, 10], patterns: [65, 20, 15] },
    { name: 'D', threshold: -30, interval: 1000, sizes: [15, 20, 25, 25, 15], patterns: [45, 30, 25] },
    { name: 'E', threshold: -70, interval: 800, sizes: [5, 10, 20, 30, 35], patterns: [30, 35, 35] }
];

export function candlePhase(portfolio: number) {
    for (let i = CandlePhases.length - 1; i >= 0; i--) {
        if (portfolio <= CandlePhases[i].threshold) return CandlePhases[i];
    }
    return undefined;
}

export function weightedCandleChoice(weights: number[], random: () => number = Math.random) {
    const roll = random() * 100;
    let total = 0;
    for (let i = 0; i < weights.length; i++) {
        total += weights[i];
        if (roll < total) return i;
    }
    return weights.length - 1;
}

// Source rectangles exclude transparent padding and the red glow. All PNGs
// retain one common scale, including their different body and wick lengths.
export const CandleAssets = [
    { asset: AssetType.WojakCandle1, height: 142, bodyHeight: 42 },
    { asset: AssetType.WojakCandle2, height: 178, bodyHeight: 78 },
    { asset: AssetType.WojakCandle3, height: 222, bodyHeight: 122 },
    { asset: AssetType.WojakCandle4, height: 305, bodyHeight: 205 },
    { asset: AssetType.WojakCandle5, height: 400, bodyHeight: 300 }
].map((asset, i) => ({ ...asset, path: `weapons/wojak-red-candle/wojak-red-candle-${i + 1}.png`,
    width: 160, bodyX: 54, bodyY: 50, bodyWidth: 53 }));

export interface CandleEmitter { left: number; right: number; y: number; }
// Store a relative position, never a world X, for pending rain.
interface Drop { size: number; position: number; delay: number; }
interface Flight { sprite: Phaser.GameObjects.Image; size: number; }

export class WojakCandles {
    private flights: Flight[] = [];
    private pending: Drop[] = [];
    private phase: ReturnType<typeof candlePhase>;
    private elapsed = 0;

    constructor(private scene: Phaser.Scene, private random: () => number = Math.random) {}

    update(delta: number, portfolio: number, enabled: boolean, emitter: CandleEmitter,
        player: Phaser.Physics.Arcade.Sprite, damage: () => void) {
        if (!enabled || !player.active) { this.clear(); return; }
        const phase = candlePhase(portfolio);
        if (phase !== this.phase) {
            this.phase = phase;
            this.elapsed = 0;
            // Pending drops retain sizes and relative positions across phase changes.
        }
        if (!phase) { this.clear(); return; }
        if (!isFinite(delta) || delta < 0 || delta > CandleSettings.maxFrameDelta) return;

        const body = player.body as Phaser.Physics.Arcade.Body;
        const scale = CandleSettings.scale;
        // Move and collide manually, like BananaBombs: no bullet collider exists.
        // Sweep the vertical body so a slow frame cannot tunnel through DOGE.
        for (const flight of this.flights.slice()) {
            if (!flight.sprite.active) continue;
            const art = CandleAssets[flight.size];
            const oldTop = flight.sprite.y + art.bodyY * scale;
            flight.sprite.y += CandleSettings.speed * delta / 1000;
            const left = flight.sprite.x - art.width * scale / 2 + art.bodyX * scale;
            const bottom = flight.sprite.y + (art.bodyY + art.bodyHeight) * scale;
            if (player.active && left < body.right && left + art.bodyWidth * scale > body.left &&
                oldTop < body.bottom && bottom > body.top) {
                flight.sprite.destroy();
                damage();
                // Damage may end the encounter and synchronously clear every flight.
                if (!player.active) return;
            } else if (flight.sprite.y > this.scene.physics.world.bounds.bottom) {
                flight.sprite.destroy();
            }
        }
        this.flights = this.flights.filter(flight => flight.sprite.active);
        this.pending.forEach(drop => drop.delay -= delta);
        const due = this.pending.filter(drop => drop.delay <= 0);
        this.pending = this.pending.filter(drop => drop.delay > 0);
        due.forEach(drop => this.spawn(drop, emitter, body.top));

        this.elapsed += delta;
        if (this.elapsed < phase.interval) return;
        this.elapsed = 0;
        const pattern = (['single', 'gap', 'rain'] as CandlePattern[])[weightedCandleChoice(phase.patterns, this.random)];
        const drops = this.plan(pattern, phase.sizes, body.width, emitter);
        drops.forEach(drop => {
            if (drop.delay === 0) this.spawn(drop, emitter, body.top);
            else this.pending.push(drop);
        });
    }

    private range(emitter: CandleEmitter) {
        const bounds = this.scene.physics.world.bounds;
        const half = CandleAssets[0].width * CandleSettings.scale / 2;
        return {
            left: Math.max(emitter.left + half, bounds.left + CandleSettings.edgeMargin + half),
            right: Math.min(emitter.right - half, bounds.right - CandleSettings.edgeMargin - half)
        };
    }

    private plan(pattern: CandlePattern, weights: number[], playerWidth: number, emitter: CandleEmitter): Drop[] {
        const { left, right } = this.range(emitter);
        if (left > right) return [];
        const gap = Math.max(CandleSettings.safeGap, playerWidth + 48);
        // Use full image widths for a gap more generous than the solid bodies.
        const separation = gap + CandleAssets[0].width * CandleSettings.scale;
        if (pattern !== 'single' && right - left < separation) pattern = 'single';
        const count = pattern === 'single' ? 1 : pattern === 'gap' ? 2 : 3;
        const side = this.random() < 0.5 ? 0 : 1;
        const laneWidth = right > left ? (1 - separation / (right - left)) / 2 : 0;
        const drops: Drop[] = [];
        for (let i = 0; i < count; i++) {
            const size = weightedCandleChoice(weights, this.random);
            const position = pattern === 'single' ? this.random() :
                (side + i) % 2 === 0 ? this.random() * laneWidth : 1 - this.random() * laneWidth;
            drops.push({ size, position,
                delay: pattern === 'rain' ? i * CandleSettings.rainInterval : 0 });
        }
        return drops;
    }

    private spawn(drop: Drop, emitter: CandleEmitter, playerTop: number) {
        const art = CandleAssets[drop.size];
        const range = this.range(emitter);
        if (range.left > range.right) return;
        const x = range.left + drop.position * (range.right - range.left);
        // Align the visible wick rather than the padded top of the PNG.
        const spawnY = emitter.y + CandleSettings.releaseGap - CandleSettings.visibleTop * CandleSettings.scale;
        const bottom = spawnY + art.height * CandleSettings.scale;
        if (bottom + CandleSettings.speed * CandleSettings.reactionTime / 1000 > playerTop) return;
        const sprite = this.scene.add.image(x, spawnY, art.asset)
            .setOrigin(0.5, 0).setScale(CandleSettings.scale).setDepth(1);
        this.flights.push({ sprite, size: drop.size });
    }

    clear() {
        this.flights.forEach(flight => flight.sprite.destroy());
        this.flights = [];
        this.pending = [];
        this.elapsed = 0;
        this.phase = undefined;
    }
}
