import { WaveDirectorConfig, WavePlan, randomForWave, seededShuffle as shuffle } from './wave-director';
import { EnemyType } from './enemy-type';

export class PremiumProgress {
    private defeats: { [bossType: string]: number } = {};
    recordDefeat(bossType: string, completedWave: number) {
        if (this.defeats[bossType] === undefined) this.defeats[bossType] = completedWave;
    }
    eligible(bossType: string, wave: number) {
        const firstDefeat = this.defeats[bossType];
        return firstDefeat !== undefined &&
            wave > firstDefeat + WaveDirectorConfig.premiumInvaders.waitingRegularWaves;
    }
    reset() { this.defeats = {}; }
}

export interface PremiumFootprint {
    bossType: string;
    slots: number[];
    column: number;
    row: number;
    columns: number;
    rows: number;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface PremiumFormationPlan {
    premiums: PremiumFootprint[];
    regulars: { slot: number; type: EnemyType }[];
}

export function planPremiumFormation(plan: WavePlan, progress: PremiumProgress): PremiumFormationPlan {
    const config = WaveDirectorConfig.premiumInvaders, grid = WaveDirectorConfig.formation;
    // Reuse the director PRNG in a separate domain; base composition is untouched.
    const random = randomForWave(plan.seed ^ 0x5052454d, plan.wave);
    const selected = shuffle(config.types.filter(type => {
        if (type.bossType === 'wojak' && config.testMode.enabled && config.testMode.forceWojakEveryRegularWave) return true;
        return progress.eligible(type.bossType, plan.wave) && random() < type.spawnProbability;
    }), random);
    if (config.testMode.enabled && config.testMode.forceWojakEveryRegularWave) {
        const forced = selected.findIndex(type => type.bossType === 'wojak');
        if (forced > 0) selected.unshift(selected.splice(forced, 1)[0]);
    }
    const candidates = selected.map(type => {
        const choices: PremiumFootprint[] = [];
        for (let row = 0; row <= grid.rows - type.rows; row++) {
            for (let column = 0; column <= grid.columns - type.columns; column++) {
                const slots: number[] = [];
                for (let dy = 0; dy < type.rows; dy++) for (let dx = 0; dx < type.columns; dx++)
                    slots.push((row + dy) * grid.columns + column + dx);
                const first = plan.slots[slots[0]], last = plan.slots[slots[slots.length - 1]];
                choices.push({ ...type, row, column, slots, x: (first.x + last.x) / 2, y: (first.y + last.y) / 2,
                    width: (type.columns - 1) * grid.columnSpacing + 87.36,
                    height: (type.rows - 1) * grid.rowSpacing + 87.36 * 282 / 337 });
            }
        }
        return shuffle(choices, random);
    });
    // Maximize fitted count, not a one-Premium limit or a greedy placement that
    // can waste usable space. Randomized priority also resolves overflow fairly.
    let premiums: PremiumFootprint[] = [], best: PremiumFootprint[] = [];
    const minimumArea = selected.length ? Math.min(...selected.map(type => type.columns * type.rows)) : 1;
    const upperLimit = Math.min(selected.length, Math.floor(plan.slots.length / minimumArea));
    const search = (index: number, occupied: number, chosen: PremiumFootprint[]): boolean => {
        if (chosen.length > best.length) best = chosen.slice();
        if (best.length === upperLimit) return true;
        if (index === candidates.length) return chosen.length === selected.length;
        if (chosen.length + candidates.length - index <= best.length) return false;
        for (const candidate of candidates[index]) {
            const mask = candidate.slots.reduce((bits, slot) => bits | (1 << slot), 0);
            if (!(occupied & mask) && search(index + 1, occupied | mask, chosen.concat(candidate))) return true;
        }
        return search(index + 1, occupied, chosen);
    };
    search(0, 0, []);
    premiums = best;
    const occupied = new Set<number>();
    premiums.forEach(premium => premium.slots.forEach(slot => occupied.add(slot)));
    const free = plan.slots.map((_, slot) => slot).filter(slot => !occupied.has(slot));
    if (!premiums.length) return { premiums, regulars: free.map(slot => ({ slot, type: plan.enemies[slot] })) };
    const types = shuffle(plan.composition.slice(), random);
    const enemies = shuffle(free.map((_, index) => types[index % types.length]), random);
    return { premiums, regulars: free.map((slot, index) => ({ slot, type: enemies[index] })) };
}
