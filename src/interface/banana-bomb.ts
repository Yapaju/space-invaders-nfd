import { AssetType } from './assets';
import { AnimationType } from './factory/animation-factory';
import { Kaboom } from './kaboom';

// World pixels and seconds, except damageDurationMs and rotation (degrees/sec).
// Hit radius is independent of visualScale and approximates the visible fireball
// (about 96px across inside the original 128px animation frame).
export const BananaSettings = {
    initialVerticalSpeed: -60,
    gravity: 180,
    minHorizontalDisplacement: 100,
    maxHorizontalDisplacement: 260,
    rotationSpeed: 65,
    displayWidth: 36 * 1.5,
    // Keep the original landing bounds independent of flying-sprite size.
    landingInset: 12,
    visualScale: 1.6875,
    hitRadius: 48 * 1.6875,
    damageDurationMs: 150
};

export function bananaTrajectory(x: number, y: number, targetX: number, landingY: number,
    left: number, right: number) {
    const direction = targetX < x ? -1 : 1;
    const displacement = Math.max(BananaSettings.minHorizontalDisplacement,
        Math.min(BananaSettings.maxHorizontalDisplacement, Math.abs(targetX - x)));
    const landingX = Math.max(left, Math.min(right, x + direction * displacement));
    const speed = BananaSettings.initialVerticalSpeed;
    const gravity = BananaSettings.gravity;
    const duration = (Math.sqrt(speed * speed + 2 * gravity * Math.max(0, landingY - y)) - speed) / gravity;
    const velocityX = (landingX - x) / duration;
    // Capture every trajectory parameter at launch; no subsequent player reads.
    return {
        landingX, landingY, duration,
        position(seconds: number) {
            const t = Math.max(0, Math.min(duration, seconds));
            return { x: x + velocityX * t, y: y + speed * t + 0.5 * gravity * t * t };
        }
    };
}

interface Flight {
    sprite: Phaser.GameObjects.Sprite;
    path: ReturnType<typeof bananaTrajectory>;
    launchedAt: number;
}
interface Blast {
    sprite: Kaboom;
    x: number;
    y: number;
    expiresAt: number;
    hit: boolean;
}

export class BananaBombs {
    private flights: Flight[] = [];
    private blasts: Blast[] = [];

    // Read-only accounting for the director; trajectories/damage stay owned here.
    get activeThreatCount(): number {
        return this.flights.length + this.blasts.filter(blast => blast.sprite.active &&
            !blast.hit && this.scene.time.now < blast.expiresAt).length;
    }

    constructor(private scene: Phaser.Scene, private explosions: Phaser.Physics.Arcade.Group,
        private damagePlayer: () => void) {}

    launch(x: number, y: number, targetX: number, landingY: number) {
        const bounds = this.scene.physics.world.bounds;
        const path = bananaTrajectory(x, y, targetX, landingY,
            bounds.left + BananaSettings.landingInset, bounds.right - BananaSettings.landingInset);
        // No Arcade body: flying bananas cannot overlap or damage DOGE.
        const sprite = this.scene.add.sprite(x, y, AssetType.Banana);
        sprite.setScale(BananaSettings.displayWidth / sprite.width);
        this.flights.push({ sprite, path, launchedAt: this.scene.time.now });
    }

    impact(x: number, y: number, landedAt = this.scene.time.now) {
        const sprite: Kaboom = this.explosions ? this.explosions.get() : new Kaboom(this.scene);
        if (!this.explosions) this.scene.add.existing(sprite);
        sprite.setPosition(x, y).setScale(BananaSettings.visualScale);
        sprite.play(AnimationType.PonkeExplosion);
        this.blasts.push({ sprite, x, y,
            expiresAt: landedAt + BananaSettings.damageDurationMs, hit: false });
    }

    update(player: Phaser.Physics.Arcade.Sprite, now = this.scene.time.now) {
        this.flights = this.flights.filter(flight => {
            const seconds = (now - flight.launchedAt) / 1000;
            if (seconds >= flight.path.duration) {
                flight.sprite.destroy();
                this.impact(flight.path.landingX, flight.path.landingY,
                    flight.launchedAt + flight.path.duration * 1000);
                return false;
            }
            const position = flight.path.position(seconds);
            flight.sprite.setPosition(position.x, position.y);
            flight.sprite.setAngle(seconds * BananaSettings.rotationSpeed);
            return true;
        });
        // Damage uses a world-space circle against DOGE's existing body, not the artwork.
        // Animation completion still owns visual destruction via Kaboom's existing listener.
        for (const blast of this.blasts.slice()) {
            if (!player.active || blast.hit || now >= blast.expiresAt || !blast.sprite.active) continue;
            const body = player.body as Phaser.Physics.Arcade.Body;
            const dx = blast.x - Math.max(body.left, Math.min(body.right, blast.x));
            const dy = blast.y - Math.max(body.top, Math.min(body.bottom, blast.y));
            if (dx * dx + dy * dy <= BananaSettings.hitRadius * BananaSettings.hitRadius) {
                blast.hit = true;
                this.damagePlayer();
            }
        }
        this.blasts = this.blasts.filter(blast => blast.sprite.active);
    }

    clear() {
        this.flights.forEach(flight => flight.sprite.destroy());
        this.blasts.forEach(blast => { if (blast.sprite.active) blast.sprite.destroy(); });
        this.flights = [];
        this.blasts = [];
        // Deadlines belong to these entries; there are no outstanding timer callbacks.
    }
}
