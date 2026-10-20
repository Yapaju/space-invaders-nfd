import { EnemyType } from './enemy-type';

export const WaveDirectorConfig = {
    seed: 0x4e464431,
    introductions: [
        { type: EnemyType.Pepe, wave: 1 },
        { type: EnemyType.Ponke, wave: 2 },
        { type: EnemyType.Popcat, wave: 6 }
    ],
    movement: {
        regularSpeed: 100, cycleBaselineGrowth: 0.02,
        multipliers: [1, 1.10, 1.25, 1.40, 1.50], maxMultiplier: 1.50
    },
    boss: { interval: 10, type: 'wojak' },
    formation: {
        columns: 6, rows: 4, startY: 100, columnSpacing: 88, rowSpacing: 74,
        // Current invader frames are 87.36 x 73.10 world pixels.
        maxEnemies: 24
    },
    composition: { minimumTypes: 2, maximumTypes: 3, recentUnlockWeight: 1.25, recentUnlockWaves: 5 },
    premiumInvaders: {
        // Owner-approved normal spawning. Enable explicitly for forced-spawn debugging.
        testMode: { enabled: false, forceWojakEveryRegularWave: true },
        waitingRegularWaves: 3,
        types: [{ bossType: 'wojak', spawnProbability: 0.10, columns: 2, rows: 2 }],
        wojak: {
            explosionScale: 2, hitFlashCount: 4,
            attackRates: { plus25: 1.5, zero: 1.5, minus30: 1.5, minus70: 2 }
        }
    },
    firing: {
        baseTimerMs: 1610, cycleBaselineReduction: 0.02,
        timerMultipliers: [1, 0.90, 0.75, 0.60, 0.50],
        retryMs: 250, maxHostileThreats: 15,
        // Reserve the full shotgun before choosing its unchanged 80/20 attack.
        projectileCost: { [EnemyType.Pepe]: 1, [EnemyType.Ponke]: 1, [EnemyType.Popcat]: 5 }
    }
};

export interface WavePlan {
    wave: number;
    seed: number;
    chapter: number;
    introduction: boolean;
    unlocked: EnemyType[];
    composition: EnemyType[];
    enemies: EnemyType[];
    formation: string;
    slots: { x: number; y: number }[];
    speedMultiplier: number;
    baselineMultiplier: number;
    movementSpeed: number;
    firingIntervalMs: number;
    bossAfter: boolean;
}

export function firingIntervalForWave(wave: number) {
    const f = WaveDirectorConfig.firing;
    const cycleIndex = Math.floor((wave - 1) / f.timerMultipliers.length);
    const positionInCycle = (wave - 1) % f.timerMultipliers.length;
    return f.baseTimerMs * Math.pow(1 - f.cycleBaselineReduction, cycleIndex) *
        f.timerMultipliers[positionInCycle];
}

export function isBossMilestone(wave: number) {
    return wave > 0 && wave % WaveDirectorConfig.boss.interval === 0;
}

// Seed affects plans only; do not reseed Phaser's shared weapon/animation RNG.
export function waveSeedFromSearch(search: string): number {
    const match = /(?:^|[?&])waveSeed=([0-9]+)(?:&|$)/.exec(search);
    if (!match) return WaveDirectorConfig.seed;
    const seed = Number(match[1]);
    return Number.isSafeInteger(seed) && seed <= 0xffffffff ? seed : WaveDirectorConfig.seed;
}

export function randomForWave(seed: number, wave: number) {
    let state = 2166136261;
    const key = `${seed}:${wave}`;
    for (let i = 0; i < key.length; i++) state = Math.imul(state ^ key.charCodeAt(i), 16777619);
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ state >>> 15, 1 | state);
        t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export function seededShuffle<T>(values: T[], random: () => number): T[] {
    for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
}

function weighted<T>(values: T[], weight: (value: T) => number, random: () => number): T {
    let remaining = random() * values.reduce((sum, value) => sum + weight(value), 0);
    for (const value of values) { remaining -= weight(value); if (remaining < 0) return value; }
    return values[values.length - 1];
}

export function getWavePlan(wave: number, seed = WaveDirectorConfig.seed,
    bounds = { left: 0, right: 800 }): WavePlan {
    if (!Number.isSafeInteger(wave) || wave < 1) throw new Error('Wave must be a positive safe integer');
    const config = WaveDirectorConfig, random = randomForWave(seed, wave);
    const available = config.introductions.filter(entry => entry.wave <= wave);
    const introduction = available.find(entry => entry.wave === wave);
    const unlocked = available.map(entry => entry.type);
    if (!unlocked.length) throw new Error('Register an invader at Wave 1');
    let composition: EnemyType[];
    if (introduction) composition = [introduction.type];
    else {
        const combinations: EnemyType[][] = [];
        const visit = (start: number, chosen: EnemyType[]) => {
            if (chosen.length >= Math.min(config.composition.minimumTypes, unlocked.length)) combinations.push(chosen);
            if (chosen.length >= config.composition.maximumTypes) return;
            for (let i = start; i < unlocked.length; i++) visit(i + 1, chosen.concat(unlocked[i]));
        };
        visit(0, []);
        composition = weighted(combinations, types => types.reduce((weight, type) => {
            const entry = available.find(item => item.type === type);
            return weight * (wave - entry.wave < config.composition.recentUnlockWaves ?
                config.composition.recentUnlockWeight : 1);
        }, 1), random);
    }
    const f = config.formation;
    if (f.columns * f.rows > f.maxEnemies) throw new Error('Formation exceeds configured enemy cap');
    if (f.columns * f.columnSpacing > bounds.right - bounds.left)
        throw new Error('Formation cannot fit playable bounds');
    // Original AlienManager origin and complete row-by-row rectangular grid.
    // Only enemy types are randomized; geometry is identical on every wave.
    const originX = (bounds.left + bounds.right) / 2 - (f.columns - 1) * f.columnSpacing / 2;
    const slots: { x: number; y: number }[] = [];
    for (let row = 0; row < f.rows; row++) for (let column = 0; column < f.columns; column++) {
        slots.push({ x: originX + column * f.columnSpacing, y: f.startY + row * f.rowSpacing });
    }
    // Balanced slot counts avoid an accidentally overwhelming all-but-one mix.
    const enemies = slots.map((_, index) => composition[index % composition.length]);
    seededShuffle(enemies, random);
    const speedMultiplier = Math.min(config.movement.maxMultiplier,
        config.movement.multipliers[(wave - 1) % config.movement.multipliers.length]);
    const cycleIndex = Math.floor((wave - 1) / config.movement.multipliers.length);
    const baselineMultiplier = Math.pow(1 + config.movement.cycleBaselineGrowth, cycleIndex);
    const movementSpeed = config.movement.regularSpeed * baselineMultiplier * speedMultiplier;
    // No balancing cap: reject numeric overflow rather than passing Infinity to movement.
    if (!Number.isFinite(movementSpeed)) throw new RangeError('Wave speed exceeds finite Number range');
    return { wave, seed, chapter: Math.floor((wave - 1) / config.movement.multipliers.length) + 1,
        introduction: !!introduction, unlocked, composition, enemies, formation: 'grid', slots,
        speedMultiplier, baselineMultiplier, movementSpeed,
        firingIntervalMs: firingIntervalForWave(wave), bossAfter: isBossMilestone(wave) };
}
