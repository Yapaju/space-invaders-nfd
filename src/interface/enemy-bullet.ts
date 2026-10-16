import { AssetType } from "./assets";

export class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene) {
        super(scene, 0, 0, AssetType.EnemyBullet);
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

