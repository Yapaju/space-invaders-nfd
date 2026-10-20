import { WaveDirectorConfig } from './wave-director';
export { getWavePlan as getWaveConfiguration, WavePlan as WaveConfiguration } from './wave-director';

export const FORMATION_COLUMNS = WaveDirectorConfig.formation.columns;
export const FORMATION_ROWS = WaveDirectorConfig.formation.rows;
export const FORMATION_START_Y = WaveDirectorConfig.formation.startY;
export const FORMATION_ROW_SPACING = WaveDirectorConfig.formation.rowSpacing;
export const FORMATION_LOWEST_START_Y = FORMATION_START_Y + (FORMATION_ROWS - 1) * FORMATION_ROW_SPACING;
export const INVADERS_PER_WAVE = FORMATION_COLUMNS * FORMATION_ROWS;
