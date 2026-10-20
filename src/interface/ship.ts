import { AssetType } from "./assets";
import { applySkin, MemeSkins, PlayerCanvas, PlayerVisualScale } from "./skins";

export class Ship {
    static readonly bulletOffset = 18 * PlayerVisualScale;
    // Normalized DOGE frames have bottom padding: a 12px frame margin leaves
    // about 20-25px below the visible artwork across the normalized poses.
    static readonly bottomFrameMargin = 12;
    private static poses = new WeakMap<Phaser.Physics.Arcade.Sprite, { direction: number; turnUntil: number }>();

    static startPosition(scene: Phaser.Scene) {
        const bounds = scene.physics.world.bounds;
        const skin = MemeSkins.Player;
        const height = skin.displayWidth * PlayerCanvas.height / PlayerCanvas.width;
        return { x: (bounds.left + bounds.right) / 2,
            y: bounds.bottom - this.bottomFrameMargin - height * (1 - skin.originY) };
    }

    static setDirection(ship: Phaser.Physics.Arcade.Sprite, direction: number, now = 0, shooting = false) {
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
        let texture = movement < 0 ? (turning ? AssetType.ShipTurnLeft : AssetType.ShipLeft) :
            movement > 0 ? (turning ? AssetType.ShipTurnRight : AssetType.ShipRight) : AssetType.Ship;
        const shootingPoses = MemeSkins.Player.shootingPoses;
        if (shooting && shootingPoses) {
            const candidate = movement < 0 ? shootingPoses.left : movement > 0 ? shootingPoses.right : shootingPoses.idle;
            if (ship.texture.manager.exists(candidate)) texture = candidate;
        }
        // All poses share idle's dimensions, origin and hitbox. Change only when
        // needed, without resetting the physics body or its current movement.
        // Deadlines are checked each frame, so no queued timer can change a pose.
        if (ship.texture.key !== texture) {
            ship.setTexture(texture);
        }
    }

    static create(scene: Phaser.Scene): Phaser.Physics.Arcade.Sprite {
        const position = this.startPosition(scene);
        let ship = scene.physics.add.sprite(position.x, position.y, AssetType.Ship);
        applySkin(ship, MemeSkins.Player);
        const skin = MemeSkins.Player;
        const bounds = scene.physics.world.bounds;
        const scale = skin.displayWidth / PlayerCanvas.width;
        // The prepared poses fit inside this common artwork envelope. Inset
        // only DOGE's body limits so its padding cannot slide beyond the canvas.
        // Keep the existing collision rectangle inside the enlarged artwork.
        const artWidth = 2 * Math.min(skin.originX, 1 - skin.originX) * PlayerCanvas.width;
        const artLeft = skin.originX * PlayerCanvas.width - artWidth / 2;
        const artRight = artLeft + artWidth;
        const leftInset = (skin.hitbox.x - artLeft) * scale;
        const rightInset = (artRight - skin.hitbox.x - skin.hitbox.width) * scale;
        (ship.body as Phaser.Physics.Arcade.Body).setBoundsRectangle(new Phaser.Geom.Rectangle(
            bounds.left + leftInset, bounds.top,
            bounds.width - leftInset - rightInset, bounds.height
        ));
        ship.setCollideWorldBounds(true);
        return ship;
    }
}
