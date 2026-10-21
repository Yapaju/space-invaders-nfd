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
    squad?: 'left' | 'right';
}
export interface PremiumFormationPlan {
    premiums: PremiumFootprint[];
    regulars: { slot: number; type: EnemyType }[];
}

export function planPremiumFormation(plan: WavePlan, progress: PremiumProgress): PremiumFormationPlan {
    // Owner-approved Snake exception: no cross-row Premium, including in forced debug mode.
    // Unlock progress is retained; compatible formations keep their original 10% rolls.
    if (plan.formation === 'SNAKE') return {
        premiums: [], regulars: plan.enemies.map((type, slot) => ({ slot, type }))
    };
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
    // Build a separate occupied-cell lattice per squad; no footprint can bridge the gap.
    const groups = plan.squads || [{ id: undefined, slots: plan.slots.map((_, index) => index) }];
    const candidates = selected.map(type => {
        const choices: PremiumFootprint[] = [];
        groups.forEach(group => {
            const occupied = group.slots.map(index => plan.slots[index]);
            const left = Math.min(...occupied.map(slot => slot.x)), top = Math.min(...occupied.map(slot => slot.y));
            const columns = Math.round((Math.max(...occupied.map(slot => slot.x)) - left) / grid.columnSpacing) + 1;
            const rows = Math.round((Math.max(...occupied.map(slot => slot.y)) - top) / grid.rowSpacing) + 1;
            const cells: { [cell: string]: number } = {};
            group.slots.forEach(index => {
                const slot = plan.slots[index];
                const column = Math.round((slot.x - left) / grid.columnSpacing);
                const row = Math.round((slot.y - top) / grid.rowSpacing);
                cells[`${row}:${column}`] = index;
            });
            for (let row = 0; row <= rows - type.rows; row++) {
                // Diamond Premiums must be wholly inside its first three geometric rows.
                if (plan.formation === 'diamond' && row + type.rows > 3) continue;
                for (let column = 0; column <= columns - type.columns; column++) {
                    const slots: number[] = [];
                    for (let dy = 0; dy < type.rows; dy++) for (let dx = 0; dx < type.columns; dx++)
                        slots.push(cells[`${row + dy}:${column + dx}`]);
                    if (slots.some(slot => slot === undefined)) continue;
                    const first = plan.slots[slots[0]], last = plan.slots[slots[slots.length - 1]];
                    choices.push({ ...type, row, column, slots, x: (first.x + last.x) / 2, y: (first.y + last.y) / 2,
                        width: (type.columns - 1) * grid.columnSpacing + 87.36,
                        height: (type.rows - 1) * grid.rowSpacing + 87.36 * 282 / 337,
                        ...(group.id ? { squad: group.id } : {}) });
                }
            }
        });
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
