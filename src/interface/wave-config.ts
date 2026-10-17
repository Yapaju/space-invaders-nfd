import { EnemyType } from './enemy-type';

export const FORMATION_COLUMNS = 6;
export const FORMATION_ROWS = 4;
export const INVADERS_PER_WAVE = FORMATION_COLUMNS * FORMATION_ROWS;

export interface WaveConfiguration {
    // One entry per formation slot, row by row. Mixed waves can specify a
    // different type for each slot here without changing movement or spawning.
    enemies: EnemyType[];
}

export function getWaveConfiguration(wave: number): WaveConfiguration {
    const type = wave % 2 === 1 ? EnemyType.Ponke : EnemyType.Pepe;
    return { enemies: Array(INVADERS_PER_WAVE).fill(type) };
}
