import { Alien } from './alien';
import { Kaboom } from './kaboom';

export interface PremiumInvader {
    readonly defeated: boolean;
    readonly explosionScale: number;
    spawn(): Alien;
    hit(): boolean;
    setFormationDirection(direction: number): void;
    syncFormation(): void;
    update(delta: number): boolean;
    updateWeapons(delta: number, player: Phaser.Physics.Arcade.Sprite, damage: () => void): void;
    stopWeapons(): void;
    dispose(): void;
}

export class PremiumInvaderSprite extends Alien {
    private destroying = false;
    constructor(scene: Phaser.Scene, x: number, y: number, readonly premium: PremiumInvader) { super(scene, x, y); }
    setDirection(direction: number) { if (this.premium) this.premium.setFormationDirection(direction); }
    kill(explosion: Kaboom) {
        if (explosion) explosion.setScale(this.premium.explosionScale);
        this.premium.stopWeapons();
        super.kill(explosion);
    }
    destroy(fromScene?: boolean) {
        if (this.destroying) return;
        this.destroying = true;
        this.premium.dispose();
        super.destroy(fromScene);
    }
}

export function premiumInvaderOf(alien: Alien): PremiumInvader | undefined {
    return (alien as PremiumInvaderSprite).premium;
}
