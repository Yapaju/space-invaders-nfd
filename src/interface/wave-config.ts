import { EnemyType } from './enemy-type';

export interface WaveConfiguration {
    // One entry per formation slot, row by row. Mixed waves can specify a
    // different type for each slot here without changing movement or spawning.
    enemies: EnemyType[];
}

export function getWaveConfiguration(wave: number): WaveConfiguration {
    const type = wave % 2 === 1 ? EnemyType.Ponke : EnemyType.Pepe;
    return { enemies: Array(40).fill(type) };
}
