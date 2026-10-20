import { AssetType, SoundType } from "./assets";
import { AnimationType } from "./factory/animation-factory";
import { Kaboom } from "./kaboom";
import { EnemyType } from "./enemy-type";
import { applySkin, MemeSkins } from "./skins";
import { PopcatSettings } from "./popcat-lights";

export class Alien extends Phaser.Physics.Arcade.Sprite {
  enemyType = EnemyType.Pepe;
  private direction = 1;
  private mouthRemaining = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, AssetType.Alien)
  }

  configure(type: EnemyType, direction: number) {
    this.enemyType = type;
    this.mouthRemaining = 0;
    this.setDirection(direction);
    applySkin(this, MemeSkins.Invader);
  }

  setDirection(direction: number) {
    this.direction = direction;
    if (this.enemyType === EnemyType.Popcat) {
      this.refreshPopcat();
      return;
    }
    const texture = this.enemyType === EnemyType.Ponke ?
      (direction < 0 ? AssetType.PonkeLeft : AssetType.PonkeRight) :
      AssetType.Alien;
    if (this.texture.key !== texture) {
      this.setTexture(texture);
    }
  }

  pop() {
    if (!this.active || this.enemyType !== EnemyType.Popcat) return;
    this.mouthRemaining = PopcatSettings.mouthOpenMs;
    this.refreshPopcat();
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (!this.active || this.enemyType !== EnemyType.Popcat) return;
    this.mouthRemaining = Math.max(0, this.mouthRemaining - delta);
    this.refreshPopcat();
  }

  private refreshPopcat() {
    const open = this.mouthRemaining > 0;
    const pose = this.direction < 0 ?
      (open ? AssetType.PopcatOpenLeft : AssetType.PopcatLeft) :
      (open ? AssetType.PopcatOpenRight : AssetType.PopcatRight);
    const texture = pose;
    if (this.texture.key !== texture) this.setTexture(texture);
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
