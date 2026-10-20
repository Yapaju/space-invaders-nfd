import { PremiumInvader } from './premium-invader';
import { PremiumFootprint } from './premium-spawn';
import { PremiumWojak } from './premium-wojak';

// Add another implemented boss here and in the data registry; no manager rewrite.
export const PremiumFactories: { [bossType: string]: (scene: Phaser.Scene, footprint: PremiumFootprint) => PremiumInvader } = {
    wojak: (scene, footprint) => new PremiumWojak(scene, footprint)
};
export function createPremiumInvader(scene: Phaser.Scene, footprint: PremiumFootprint) {
    const factory = PremiumFactories[footprint.bossType];
    if (!factory) throw new Error('Premium controller not registered: ' + footprint.bossType);
    return factory(scene, footprint);
}
