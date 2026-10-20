import { AssetType, SoundType } from "./assets";
import { AudioBalance } from './audio-balance';

export const ElectricLaserSettings = {
    animation: 'rapid-electric-laser',
    frameWidth: 64,
    frameHeight: 128,
    frameRate: 14,
    displayHeight: 40
};

export class Bullet extends Phaser.Physics.Arcade.Sprite {
    private normalWidth: number;
    private normalHeight: number;

    constructor(scene: Phaser.Scene) {
        super(scene, 0, 0, AssetType.Bullet);
        this.normalWidth = this.width;
        this.normalHeight = this.height;
    }

    shoot(x: number, y: number, rapidFire = false) {
        if (this.texture.key === AssetType.Bullet) {
            this.normalWidth = this.width;
            this.normalHeight = this.height;
        }
        this.anims.stop();
        if (rapidFire || this.texture.key !== AssetType.Bullet) {
            this.setTexture(rapidFire ? AssetType.RapidLaser : AssetType.Bullet);
        }
        this.clearTint();
        const scale = rapidFire ? ElectricLaserSettings.displayHeight / ElectricLaserSettings.frameHeight : 1;
        this.setScale(scale);
        if (rapidFire) this.play(ElectricLaserSettings.animation);
        // Texture/animation dimensions must never determine the physics shape.
        // Preserve the blue beam's world-space size, anchor and spawn position.
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.updateBounds();
        body.setSize(this.normalWidth / scale, this.normalHeight / scale, false);
        body.setOffset(this.width * this.originX - this.normalWidth * this.originX / scale,
            this.height * this.originY - this.normalHeight * this.originY / scale);
        this.scene.sound.play(SoundType.Shoot, { volume: AudioBalance.gains[SoundType.Shoot] });
        this.setPosition(x, y);
        this.setVelocityY(-400);
    }

    kill() {
        this.destroy();
    }

    update() {
        const bounds = this.scene.physics.world.bounds;
        // Preserve natural missile clearing independently of electric-art padding.
        const width = this.texture.key === AssetType.Bullet ? this.width : this.normalWidth;
        const height = this.texture.key === AssetType.Bullet ? this.height : this.normalHeight;
        if (this.x + width < bounds.left || this.x - width > bounds.right ||
            this.y + height < bounds.top || this.y - height > bounds.bottom) {
            this.kill();
        }
    }
}
