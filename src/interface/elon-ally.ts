import { AssetType } from './assets';
import { visibleImageBounds } from './skins';

export const ELON_VISUAL_TEST_OVERRIDE = false;
export const ElonAppearancePresets = {
    production: { firstWave: 3, appearanceChance: 0.30 },
    visualTest: { firstWave: 2, appearanceChance: 1 }
};

export const ElonSettings = {
    ...ElonAppearancePresets[ELON_VISUAL_TEST_OVERRIDE ? 'visualTest' : 'production'],
    arrivalDescents: [
        { descent: 2, weight: 40 },
        { descent: 3, weight: 35 },
        { descent: 4, weight: 25 }
    ],
    visibleWidth: 84 * 1.30,
    // Enlarged visible artwork clears both HUD icons and PEPE after descent 2.
    laneY: 89.5,
    speed: 280,
    escapeSpeedMultiplier: 2.5,
    escapeAccelerationDuration: 250,
    hitDuration: 1000,
    flashDuration: 250,
    flashInterval: 50,
    flashTint: 0x5555ff
};

export enum ElonState { Flying, Hit, Escaping, Removed }

export function selectElonDescent(roll: number): number {
    let threshold = 0;
    for (const target of ElonSettings.arrivalDescents) {
        threshold += target.weight;
        if (roll * 100 < threshold) return target.descent;
    }
    return ElonSettings.arrivalDescents[ElonSettings.arrivalDescents.length - 1].descent;
}

// Source-pixel registration: front wheel center and chassis width (excluding
// rocket exhaust and impact sparks). Keep the car's size/anchor through escape.
export const ElonCarRegistration = {
    [AssetType.ElonHitRight]: { x: 866, y: 760, width: 1080 },
    [AssetType.ElonHitLeft]: { x: 670, y: 760, width: 1080 },
    [AssetType.ElonEscapeRight]: { x: 1030, y: 745, width: 1054 },
    [AssetType.ElonEscapeLeft]: { x: 506, y: 745, width: 1054 }
};

export class ElonAlly {
    private sprite: Phaser.GameObjects.Sprite;
    private pending = false;
    private direction = 1;
    private wave = 0;
    private state = ElonState.Removed;
    private hitAt = 0;
    private targetDescent = 0;
    private escapeX = 0;
    private artwork: { [key: string]: { x: number; y: number; width: number; height: number } } = {};

    constructor(private scene: Phaser.Scene, private random: () => number = Math.random,
        private appearance: { firstWave: number; appearanceChance: number } = ElonSettings) {
        // Read visible bounds once per scene. Keep the original PNG textures;
        // only the origin and uniform display scale account for their padding.
        const canvas = document.createElement('canvas');
        [AssetType.ElonRight, AssetType.ElonLeft, AssetType.ElonHitRight, AssetType.ElonHitLeft,
            AssetType.ElonEscapeRight, AssetType.ElonEscapeLeft].forEach(key => {
            const image = scene.textures.get(key).getSourceImage() as HTMLImageElement;
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            this.artwork[key] = visibleImageBounds(context.getImageData(0, 0, image.width, image.height).data,
                image.width, image.height);
        });
    }

    startWave(wave: number) {
        if (wave === this.wave) return;
        this.clear();
        this.wave = wave;
        // No RNG before the configured first wave. Select direction and target
        // descent once for scheduled appearances; never reroll during the wave.
        if (wave < this.appearance.firstWave) return;
        this.pending = this.random() < this.appearance.appearanceChance;
        if (this.pending) {
            this.direction = this.random() < 0.5 ? 1 : -1;
            this.targetDescent = selectElonDescent(this.random());
        }
    }

    onDescent(count: number) {
        if (!this.pending || count !== this.targetDescent) return;
        this.pending = false;
        const key = this.direction > 0 ? AssetType.ElonRight : AssetType.ElonLeft;
        const art = this.artwork[key];
        // Plain GameObject: player shots test visible bounds directly below.
        this.sprite = this.scene.add.sprite(0, ElonSettings.laneY, key);
        this.sprite.setOrigin((art.x + art.width / 2) / this.sprite.width,
            (art.y + art.height / 2) / this.sprite.height);
        this.sprite.setScale(ElonSettings.visibleWidth / art.width).setDepth(2);
        this.state = ElonState.Flying;
        const bounds = this.scene.physics.world.bounds;
        const extent = this.sprite.getBounds();
        this.sprite.x = this.direction > 0 ? bounds.left - extent.right - 1 : bounds.right - extent.left + 1;
    }

    update(delta: number) {
        if (!this.sprite) return;
        if (this.state === ElonState.Hit) {
            const elapsed = this.scene.time.now - this.hitAt;
            if (elapsed >= ElonSettings.hitDuration) {
                this.startEscape();
            } else if (elapsed < ElonSettings.flashDuration &&
                Math.floor(elapsed / ElonSettings.flashInterval) % 2 === 0) {
                this.sprite.setTint(ElonSettings.flashTint);
            } else {
                this.sprite.clearTint();
            }
            if (this.state === ElonState.Hit) return;
        }
        if (this.state === ElonState.Escaping) {
            const seconds = Math.max(0, this.scene.time.now - this.hitAt - ElonSettings.hitDuration) / 1000;
            const acceleration = ElonSettings.escapeAccelerationDuration / 1000;
            const t = Math.min(1, seconds / acceleration);
            // Integral of a smoothstep speed ramp: continuous speed from normal
            // flight to 2.5x, independent of frame rate and long-frame overshoot.
            const boost = ElonSettings.speed * (ElonSettings.escapeSpeedMultiplier - 1);
            const distance = ElonSettings.speed * seconds + boost *
                (acceleration * (t * t * t - t * t * t * t / 2) + Math.max(0, seconds - acceleration));
            this.sprite.x = this.escapeX + this.direction * distance;
        } else {
            this.sprite.x += this.direction * ElonSettings.speed * Math.max(0, delta) / 1000;
        }
        const extent = this.sprite.getBounds();
        const bounds = this.scene.physics.world.bounds;
        if ((this.direction > 0 && extent.left > bounds.right) ||
            (this.direction < 0 && extent.right < bounds.left)) {
            this.remove();
        }
    }

    private startEscape() {
        const hitKey = this.direction > 0 ? AssetType.ElonHitRight : AssetType.ElonHitLeft;
        const key = this.direction > 0 ? AssetType.ElonEscapeRight : AssetType.ElonEscapeLeft;
        const hit = ElonCarRegistration[hitKey];
        const escape = ElonCarRegistration[key];
        const anchorX = (hit.x - this.sprite.displayOriginX) * this.sprite.scaleX;
        const anchorY = (hit.y - this.sprite.displayOriginY) * this.sprite.scaleY;
        const scale = this.sprite.scaleX * hit.width / escape.width;
        this.sprite.setTexture(key).clearTint().setScale(scale);
        this.sprite.setOrigin((escape.x - anchorX / scale) / this.sprite.width,
            (escape.y - anchorY / scale) / this.sprite.height);
        this.escapeX = this.sprite.x;
        this.state = ElonState.Escaping;
    }

    tryHit(body: Phaser.Physics.Arcade.Body): boolean {
        if (this.state !== ElonState.Flying || !body || !body.enable) return false;
        const normalKey = this.direction > 0 ? AssetType.ElonRight : AssetType.ElonLeft;
        const normal = this.artwork[normalKey];
        const width = normal.width * this.sprite.scaleX;
        const height = normal.height * this.sprite.scaleY;
        // Both normal sprites are anchored at the center of their visible art.
        if (body.right < this.sprite.x - width / 2 || body.left > this.sprite.x + width / 2 ||
            body.bottom < this.sprite.y - height / 2 || body.top > this.sprite.y + height / 2) return false;

        this.state = ElonState.Hit;
        this.hitAt = this.scene.time.now;
        const key = this.direction > 0 ? AssetType.ElonHitRight : AssetType.ElonHitLeft;
        const art = this.artwork[key];
        this.sprite.setTexture(key);
        this.sprite.setOrigin((art.x + art.width / 2) / this.sprite.width,
            (art.y + art.height / 2) / this.sprite.height);
        // Fit the differently padded hit art uniformly into the existing visible
        // envelope. Its center and flight lane stay fixed, with no stretching.
        this.sprite.setScale(Math.min(width / art.width, height / art.height));
        this.sprite.setTint(ElonSettings.flashTint);
        return true;
    }

    private remove() {
        if (this.sprite) this.sprite.destroy();
        this.sprite = undefined;
        this.state = ElonState.Removed;
        this.hitAt = 0;
        this.escapeX = 0;
    }

    clear() {
        this.remove();
        this.pending = false;
        this.targetDescent = 0;
        this.wave = 0;
    }
}
