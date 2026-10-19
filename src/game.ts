import 'phaser';
import { MainScene } from './scenes/main';
import { installRenderBufferExperiment } from './interface/render-buffer-experiment';

const config: Phaser.Types.Core.GameConfig = {
    title: "Space Invaders",
    type: Phaser.AUTO,
    backgroundColor: 'rgb(47, 52, 55)',
    width: 800,
    height: 600,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    callbacks: { postBoot: installRenderBufferExperiment },
    scene: MainScene,
    physics: {
        default: "arcade"
    },
    parent: "SpaceInvaders"
};

class SpaceInvadersGame extends Phaser.Game {
    constructor(config: Phaser.Types.Core.GameConfig) {
        super(config)
    }
}

const game = new SpaceInvadersGame(config);
