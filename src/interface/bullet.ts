import { AssetType, SoundType } from "./assets";

export class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene) {
        super(scene, 0, 0, AssetType.Bullet);
    }

    shoot(x: number, y: number) {
        this.scene.sound.play(SoundType.Shoot)
        this.setPosition(x, y);
        this.setVelocityY(-400);
    }

    kill() {
        this.destroy();
    }

    update() {
        const bounds = this.scene.physics.world.bounds;
        if (this.x + this.width < bounds.left || this.x - this.width > bounds.right ||
            this.y + this.height < bounds.top || this.y - this.height > bounds.bottom) {
            this.kill();
        }
    }
}

