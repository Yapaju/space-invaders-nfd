import { AssetType, SoundType } from "./assets";
import { AnimationType } from "./factory/animation-factory";
import { Kaboom } from "./kaboom";
import { EnemyType } from "./enemy-type";
import { applySkin, MemeSkins } from "./skins";

export class Alien extends Phaser.Physics.Arcade.Sprite {
  enemyType = EnemyType.Pepe;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, AssetType.Alien)
  }

  configure(type: EnemyType, direction: number) {
    this.enemyType = type;
    this.setDirection(direction);
    applySkin(this, MemeSkins.Invader);
  }

  setDirection(direction: number) {
    const texture = this.enemyType === EnemyType.Ponke ?
      (direction < 0 ? AssetType.PonkeLeft : AssetType.PonkeRight) : AssetType.Alien;
    if (this.texture.key !== texture) {
      this.setTexture(texture);
    }
  }

  kill(explosion: Kaboom) {
    if (explosion) {
      explosion.setX(this.x);
      explosion.setY(this.y);
      explosion.play(AnimationType.Kaboom)
      this.scene.sound.play(SoundType.InvaderKilled)
    }
    // Remove from play immediately; the scene destroys it after overlap iteration.
    this.disableBody(true, true);
  }
}
