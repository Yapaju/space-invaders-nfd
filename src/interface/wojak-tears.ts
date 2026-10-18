import { AssetType } from './assets';

export const TearSettings = {
    speed: 120, singleInterval: 3500, spreadInterval: 2500, spreadAngle: 15,
    singleThreshold: -30, spreadThreshold: -70, maxFrameDelta: 250,
    // The 1536x1024 source points diagonally up/right. Rotate around the
    // droplet bulb so its circular Arcade body stays aligned at every angle.
    sourceWidth: 1536, sourceHeight: 1024, sourceLength: 1120, displayLength: 32,
    bulbX: 650, bulbY: 650, tipX: 1240, tipY: 150, bodyRadius: 250,
    reactionTime: 500
};

export const TearAsset = { asset: AssetType.WojakTear, path: 'weapons/wojak-tear/wojak-tear.png' };
export interface TearEmitter { x: number; y: number; }

export function tearPhase(portfolio: number) {
    return portfolio <= TearSettings.spreadThreshold ? 'spread' :
        portfolio <= TearSettings.singleThreshold ? 'single' : undefined;
}

export function tearRotation() {
    // Fixed screen-space up: targeting affects velocity only.
    return -Math.PI / 2 - Math.atan2(TearSettings.tipY - TearSettings.bulbY,
        TearSettings.tipX - TearSettings.bulbX);
}

export class WojakTears {
    private flights: Phaser.Physics.Arcade.Sprite[] = [];
    private phase: ReturnType<typeof tearPhase>;
    private elapsed = 0;

    constructor(private scene: Phaser.Scene) {}

    update(delta: number, portfolio: number, enabled: boolean, emitter: TearEmitter,
        player: Phaser.Physics.Arcade.Sprite, damage: () => void) {
        if (!enabled || !player.active) { this.clear(); return; }
        const phase = tearPhase(portfolio);
        if (phase !== this.phase) { this.phase = phase; this.elapsed = 0; }
        if (!phase) { this.clear(); return; }
        const bounds = this.scene.physics.world.bounds;
        for (const sprite of this.flights.slice()) {
            if (!sprite.active) continue;
            // Reuse PEPE's Arcade collision and existing player damage path.
            // Query without a callback so cleanup happens outside an overlap walk.
            if (this.scene.physics.overlap(sprite, player)) {
                sprite.destroy();
                damage();
                if (!player.active) return;
            } else {
                const art = sprite.getBounds();
                if (art.right < bounds.left || art.left > bounds.right ||
                    art.bottom < bounds.top || art.top > bounds.bottom) sprite.destroy();
            }
        }
        this.flights = this.flights.filter(sprite => sprite.active);
        if (!isFinite(delta) || delta < 0 || delta > TearSettings.maxFrameDelta) return;
        this.elapsed += delta;
        const interval = phase === 'spread' ? TearSettings.spreadInterval : TearSettings.singleInterval;
        if (this.elapsed < interval) return;
        this.elapsed = 0;
        const dx = player.x - emitter.x, dy = player.y - emitter.y;
        const radius = TearSettings.bodyRadius * TearSettings.displayLength / TearSettings.sourceLength;
        // Keep the first contact comfortably separated from the player.
        const body = player.body as Phaser.Physics.Arcade.Body;
        const nearX = Math.max(body.left, Math.min(body.right, emitter.x));
        const nearY = Math.max(body.top, Math.min(body.bottom, emitter.y));
        const clearance = TearSettings.speed * TearSettings.reactionTime / 1000 + radius;
        if (Math.pow(emitter.x - nearX, 2) + Math.pow(emitter.y - nearY, 2) < clearance * clearance ||
            dx * dx + dy * dy === 0) return;
        const offsets = phase === 'spread' ? [-TearSettings.spreadAngle, 0, TearSettings.spreadAngle] : [0];
        offsets.forEach(offset => this.spawn(emitter, player, offset));
    }

    private spawn(emitter: TearEmitter, player: Phaser.Physics.Arcade.Sprite, offset: number) {
        const settings = TearSettings;
        const scale = settings.displayLength / settings.sourceLength;
        const sprite = this.scene.physics.add.sprite(emitter.x, emitter.y, TearAsset.asset)
            .setOrigin(settings.bulbX / settings.sourceWidth, settings.bulbY / settings.sourceHeight)
            .setScale(scale).setDepth(6);
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        body.allowGravity = false;
        body.setCircle(settings.bodyRadius, settings.bulbX - settings.bodyRadius, settings.bulbY - settings.bodyRadius);
        // Same one-time target snapshot and speed as MainScene._enemyFires.
        // Arcade keeps this velocity; subsequent player/boss movement cannot home it.
        const angle = this.scene.physics.moveToObject(sprite, player, settings.speed) + offset * Math.PI / 180;
        sprite.setVelocity(Math.cos(angle) * settings.speed, Math.sin(angle) * settings.speed)
            .setRotation(tearRotation());
        body.preUpdate(false, 0);
        this.flights.push(sprite);
    }

    clear() {
        this.flights.forEach(sprite => sprite.destroy());
        this.flights = [];
        this.phase = undefined;
        this.elapsed = 0;
    }
}
