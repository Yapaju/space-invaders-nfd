import { AssetType } from "../assets";
import { applySkinAppearance, MemeSkins } from "../skins";
import { GoldenNumber, UiDepth, UiTexture } from "../golden-number";

export const MAX_LIVES = 3;

export class ScoreManager {
  scoreText: GoldenNumber;
  waveText: GoldenNumber;
  waveAnnouncement: GoldenNumber;
  gameOverImage: Phaser.GameObjects.Image;
  private scoreLabel: Phaser.GameObjects.Image;
  private livesLabel: Phaser.GameObjects.Image;
  lives: Phaser.Physics.Arcade.Group;

  get noMoreLives() {
    return this.lives.countActive(true) === 0;
  }

  highScore = 0;
  score = 0;

  constructor(private _scene: Phaser.Scene) {
    this._init();
    this.print();
  }

  private _init() {
    const { width: SIZE_X, height: SIZE_Y } = this._scene.game.canvas;
    this.scoreLabel = this._scene.add.image(20, 10, UiTexture.Score).setOrigin(0, 0).setDepth(UiDepth.Hud);
    this.scoreLabel.setScale(22 / this.scoreLabel.height);
    this.scoreText = new GoldenNumber(this._scene, {
      x: 22, y: 47, height: 22, align: 'left', maxWidth: 220, depth: UiDepth.Hud
    });
    this.waveText = new GoldenNumber(this._scene, {
      x: SIZE_X / 2, y: 21, height: 22, align: 'center', maxWidth: 240,
      depth: UiDepth.Hud, label: UiTexture.Wave
    }).setText('1');
    this.waveAnnouncement = new GoldenNumber(this._scene, {
      x: SIZE_X / 2, y: SIZE_Y / 2, height: 96 * 0.85, align: 'center', maxWidth: (SIZE_X - 80) * 0.85,
      gap: 4 * 0.85, labelGap: 20 * 0.85, depth: UiDepth.Overlay, label: UiTexture.Wave
    }).setVisible(false);
    this.gameOverImage = this._scene.add.image(SIZE_X / 2, SIZE_Y / 2, UiTexture.GameOver)
      .setDepth(UiDepth.Overlay).setVisible(false);
    this.gameOverImage.setScale(0.70 * Math.min((SIZE_X - 40) / this.gameOverImage.width,
      (SIZE_Y - 80) / this.gameOverImage.height));
    this._setLivesText(SIZE_X);
    this._scene.events.once('shutdown', this.destroy, this);
  }

  private _setLivesText(
    SIZE_X: number
  ) {
    this.livesLabel = this._scene.add.image(SIZE_X - 20, 10, UiTexture.Lives)
      .setOrigin(1, 0).setDepth(UiDepth.Hud);
    this.livesLabel.setScale(22 / this.livesLabel.height);
    this.lives = this._scene.physics.add.group({
      maxSize: MAX_LIVES,
      runChildUpdate: true,
    });
    this.resetLives();
  }

  resetLives() {
    let SIZE_X = this._scene.game.canvas.width;
    this.lives.clear(true, true)
    for (let i = 0; i < MAX_LIVES; i++) {
      let ship: Phaser.GameObjects.Sprite = this.lives.create(
        SIZE_X - 20 - 35 / 2 - 38 * (MAX_LIVES - 1 - i),
        49,
        AssetType.Ship
      );
      applySkinAppearance(ship, MemeSkins.Player, 35);
      ship.setOrigin(0.5, 0.5);
      ship.clearTint().setAlpha(1);
      ship.setDepth(UiDepth.Hud);
    }
  }

  recoverOneLife() {
    const remaining = this.lives.countActive(true);
    if (remaining === 0 || remaining >= MAX_LIVES) return;
    // Restore the inactive slot immediately left of the remaining icons.
    const life: Phaser.GameObjects.Sprite = this.lives.getLast(false);
    if (life) life.clearTint().setAlpha(1).setActive(true).setVisible(true);
  }

  setWave(wave: number) {
    this.waveText.setText(String(wave));
  }

  setWaveText(wave: number) {
    this.gameOverImage.setVisible(false);
    this.waveAnnouncement.setText(String(wave)).setVisible(true);
  }

  setGameOverText() {
    this.waveAnnouncement.setVisible(false);
    this.gameOverImage.setVisible(true);
  }

  hideText() {
    this.waveAnnouncement.setVisible(false);
    this.gameOverImage.setVisible(false);
  }

  destroy() {
    this.scoreText.destroy();
    this.waveText.destroy();
    this.waveAnnouncement.destroy();
    this.scoreLabel.destroy();
    this.livesLabel.destroy();
    this.gameOverImage.destroy();
    this._scene.events.off('shutdown', this.destroy, this);
  }

  setHighScore() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
    this.score = 0;
    this.print();
  }

  print() {
    this.scoreText.setText(`${this.padding(this.score)}`);
  }

  increaseScore(step = 10) {
    this.score += step;
    this.print();
  }

  padding(num: number) {
    return `${num}`.padStart(4, "0");
  }
}
