import { AssetType } from "./assets";
import { applySkin, MemeSkins } from "./skins";

export class Ship {
    private static poses = new WeakMap<Phaser.Physics.Arcade.Sprite, { direction: number; turnUntil: number }>();

    static setDirection(ship: Phaser.Physics.Arcade.Sprite, direction: number, now = 0) {
        const movement = Math.sign(direction);
        const pose = this.poses.get(ship) || { direction: 0, turnUntil: 0 };
        if (movement !== pose.direction) {
            // Only consecutive nonzero movement directions can start a turn.
            // A new reversal replaces the deadline; stopping clears it.
            pose.turnUntil = movement !== 0 && pose.direction !== 0 ? now + 33 : 0;
            pose.direction = movement;
        }
        this.poses.set(ship, pose);
        const turning = movement !== 0 && now < pose.turnUntil;
        const texture = movement < 0 ? (turning ? AssetType.ShipTurnLeft : AssetType.ShipLeft) :
            movement > 0 ? (turning ? AssetType.ShipTurnRight : AssetType.ShipRight) : AssetType.Ship;
        // All poses share idle's dimensions, origin and hitbox. Change only when
        // needed, without resetting the physics body or its current movement.
        // Deadlines are checked each frame, so no queued timer can change a pose.
        if (ship.texture.key !== texture) {
            ship.setTexture(texture);
        }
    }

    static create(scene: Phaser.Scene): Phaser.Physics.Arcade.Sprite {
        let ship = scene.physics.add.sprite(400, 500, AssetType.Ship);
        applySkin(ship, MemeSkins.Player);
        ship.setCollideWorldBounds(true);
        return ship;
    }
}
