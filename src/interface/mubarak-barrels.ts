import { EnemyBulletSettings } from './enemy-bullet';
import { AnimationType } from './factory/animation-factory';
import { Kaboom } from './kaboom';
import { BananaBombs, BananaSettings } from './banana-bomb';

export const MubarakBarrelAsset = {
    key: 'mubarak-barel-black', path: 'weapons/mubarak-barrels/mubarak-barel-black.png'
};
export const MubarakExplosiveBarrelAsset = {
    key: 'mubarak-barel-yellow', path: 'weapons/mubarak-barrels/mubarak-barel-yellow.png'
};
export const MubarakBarrelSettings = {
    // Alpha >=128 inspected bounds inside the original 1254-square PNG.
    sourceBody: { x: 256, y: 8, width: 742, height: 1237 },
    bodyHeight: 48, spawnIntervalMs: 450, maxBarrels: 32,
    act1FrequencyMultiplier: 0.3,
    // Prior rates: 1.8 black/s and 0.2 explosive/s. V1.1 applies 0.90x / 1.10x:
    // 1.62 black/s + 0.22 explosive/s = 1.84/s; explosive share = 0.22 / 1.84.
    act2FrequencyMultiplier: 0.828,
    act2ShootableProbability: 11 / 92,
    spawnMargin: 2, spawnAttempts: 8, spawnSeparation: 1.2,
    blastRadius: BananaSettings.hitRadius,
    blastVisualScale: BananaSettings.visualScale
};

export interface MubarakRect { x: number; y: number; width: number; height: number; }
interface Flight { sprite: Phaser.GameObjects.Sprite; shootable: boolean; }
interface Blast {
    sprite: Kaboom; x: number; y: number; radius: number;
    elapsed: number; duration: number; hit: boolean;
}
export function rectsOverlap(a: MubarakRect, b: MubarakRect) {
    return a.x <= b.x + b.width && a.x + a.width >= b.x &&
        a.y <= b.y + b.height && a.y + a.height >= b.y;
}
export function circleOverlapsRect(x: number, y: number, radius: number, rect: MubarakRect) {
    const dx = x - Math.max(rect.x, Math.min(rect.x + rect.width, x));
    const dy = y - Math.max(rect.y, Math.min(rect.y + rect.height, y));
    return dx * dx + dy * dy <= radius * radius;
}

// Encounter-owned sprites and elapsed clocks. No persistent collider or TimerEvent.
export class MubarakBarrels {
    readonly flights: Flight[] = [];
    readonly blasts: Blast[] = [];
    private spawnElapsed = 0;
    private enabled = true;
    private elapsed = 0;
    private damagePlayer: () => void;
    private impacts: BananaBombs;
    private debris: Kaboom[] = [];
    constructor(private scene: Phaser.Scene, private random: () => number,
        private bossBounds: () => MubarakRect, private damageBoss: () => boolean,
        private spawnOrigin?: () => { left: number; right: number; y: number }, private explosive = true) {
        this.impacts = new BananaBombs(scene, undefined, () => { if (this.damagePlayer) this.damagePlayer(); });
    }

    bounds(sprite: Phaser.GameObjects.Sprite): MubarakRect {
        const body = MubarakBarrelSettings.sourceBody;
        return { x: sprite.x + (body.x - sprite.width / 2) * sprite.scaleX,
            y: sprite.y + (body.y - sprite.height / 2) * sprite.scaleY,
            width: body.width * sprite.scaleX, height: body.height * sprite.scaleY };
    }
    spawn() {
        if (!this.enabled || this.flights.length >= MubarakBarrelSettings.maxBarrels) return;
        const world = this.scene.physics.world.bounds, config = MubarakBarrelSettings;
        const image = this.scene.textures.get(MubarakBarrelAsset.key).getSourceImage() as HTMLImageElement;
        const scale = config.bodyHeight / config.sourceBody.height;
        const halfWidth = image.width * scale / 2;
        const origin = this.spawnOrigin ? this.spawnOrigin() : undefined;
        const neighbors = this.flights.filter(flight => this.bounds(flight.sprite).y < world.top + config.bodyHeight * 1.5);
        let chosen = world.centerX, bestDistance = -1;
        if (origin) {
            const left = Math.max(world.left + halfWidth, origin.left + halfWidth);
            const right = Math.min(world.right - halfWidth, origin.right - halfWidth);
            chosen = left + this.random() * Math.max(0, right - left);
        } else for (let attempt = 0; attempt < config.spawnAttempts; attempt++) {
            const x = world.left + halfWidth + this.random() * Math.max(0, world.width - halfWidth * 2);
            const distance = neighbors.reduce((gap, flight) => Math.min(gap, Math.abs(flight.sprite.x - x)), Infinity);
            if (distance > bestDistance) { chosen = x; bestDistance = distance; }
            if (distance >= config.sourceBody.width * scale * config.spawnSeparation) break;
        }
        const sprite = this.scene.add.sprite(chosen,
            origin ? origin.y + image.height * scale / 2 + config.spawnMargin :
                world.top - image.height * scale / 2 - config.spawnMargin, MubarakBarrelAsset.key)
            .setScale(scale).setOrigin(0.5).setDepth(12);
        const shootable = this.explosive && this.random() < config.act2ShootableProbability;
        if (shootable) sprite.setTexture(MubarakExplosiveBarrelAsset.key);
        this.flights.push({ sprite, shootable });
    }
    step(delta: number, player?: Phaser.Physics.Arcade.Sprite, damagePlayer?: () => void, frequency = 1) {
        this.damagePlayer = damagePlayer;
        this.elapsed += delta;
        this.debris = this.debris.filter(sprite => sprite.active);
        for (const flight of this.flights.slice()) {
            flight.sprite.y += EnemyBulletSettings.speed * delta / 1000;
            const bounds = this.bounds(flight.sprite);
            if (player && flight.sprite.y >= player.y) {
                const overshootMs = (flight.sprite.y - player.y) / EnemyBulletSettings.speed * 1000;
                this.impacts.impact(flight.sprite.x, player.y, this.elapsed - overshootMs);
                this.removeFlight(flight);
            } else if (bounds.y > this.scene.physics.world.bounds.bottom) {
                this.removeFlight(flight);
            }
        }
        if (player) this.impacts.update(player, this.elapsed);
        if (this.enabled && frequency > 0) {
            this.spawnElapsed += delta * frequency;
            while (this.spawnElapsed + 1e-7 >= MubarakBarrelSettings.spawnIntervalMs) {
                this.spawnElapsed -= MubarakBarrelSettings.spawnIntervalMs;
                this.spawn();
            }
        }
        for (const blast of this.blasts.slice()) {
            if (!blast.sprite.active) { this.removeBlast(blast); continue; }
            this.tryDamage(blast);
            blast.elapsed += delta;
            if (blast.elapsed + 1e-7 >= blast.duration) {
                this.removeBlast(blast);
                continue;
            }
            // Use the actual banana animation, frames and duration. Its
            // paused frame cursor shares this clock with the circular damage area.
            const animation = blast.sprite.anims.currentAnim;
            const index = Math.min(animation.frames.length - 1,
                Math.floor(blast.elapsed / animation.msPerFrame));
            blast.sprite.anims.setCurrentFrame(animation.frames[index]);
        }
    }
    tryShoot(body: MubarakRect): boolean {
        const flight = this.flights.find(entry => entry.shootable && rectsOverlap(this.bounds(entry.sprite), body));
        if (!flight) return false;
        const bounds = this.bounds(flight.sprite), x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
        this.removeFlight(flight);
        const radius = MubarakBarrelSettings.blastRadius;
        const sprite = new Kaboom(this.scene);
        this.scene.add.existing(sprite);
        sprite.setPosition(x, y).setDepth(13);
        if (!this.explosive) {
            sprite.play(AnimationType.Kaboom);
            this.debris.push(sprite);
            return true;
        }
        sprite.setScale(MubarakBarrelSettings.blastVisualScale);
        sprite.play(AnimationType.PonkeExplosion);
        sprite.anims.pause();
        const blast: Blast = { sprite, x, y, radius, elapsed: 0,
            duration: sprite.anims.currentAnim.duration, hit: false };
        this.blasts.push(blast);
        this.tryDamage(blast);
        return true;
    }
    private tryDamage(blast: Blast) {
        if (!blast.hit && circleOverlapsRect(blast.x, blast.y, blast.radius, this.bossBounds())) {
            // A blocked hit is not spent: the live blast may catch the end of immunity.
            if (this.damageBoss()) blast.hit = true;
        }
    }
    private removeFlight(flight: Flight) {
        const index = this.flights.indexOf(flight);
        if (index < 0) return;
        this.flights.splice(index, 1);
        flight.sprite.destroy();
    }
    private removeBlast(blast: Blast) {
        const index = this.blasts.indexOf(blast);
        if (index < 0) return;
        this.blasts.splice(index, 1);
        if (blast.sprite.active) blast.sprite.destroy();
    }
    stop() {
        this.enabled = false;
        this.flights.slice().forEach(flight => this.removeFlight(flight));
    }
    clear() {
        this.stop();
        this.impacts.clear();
        this.debris.forEach(sprite => { if (sprite.active) sprite.destroy(); });
        this.debris = [];
        this.blasts.slice().forEach(blast => this.removeBlast(blast));
    }
}
