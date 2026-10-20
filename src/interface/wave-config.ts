import { EnemyType } from './enemy-type';

export const FORMATION_COLUMNS = 6;
export const FORMATION_ROWS = 4;
export const FORMATION_START_Y = 100;
export const FORMATION_ROW_SPACING = 74;
export const FORMATION_LOWEST_START_Y = FORMATION_START_Y + (FORMATION_ROWS - 1) * FORMATION_ROW_SPACING;
export const INVADERS_PER_WAVE = FORMATION_COLUMNS * FORMATION_ROWS;

export interface WaveConfiguration {
    // One entry per formation slot, row by row. Mixed waves can specify a
    // different type for each slot here without changing movement or spawning.
    enemies: EnemyType[];
}

export function getWaveConfiguration(wave: number): WaveConfiguration {
    const type = [EnemyType.Popcat, EnemyType.Pepe, EnemyType.Ponke][(wave - 1) % 3];
    return { enemies: Array(INVADERS_PER_WAVE).fill(type) };
}
