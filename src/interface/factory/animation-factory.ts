import { AssetType } from "../assets";

export enum AnimationType {
    Kaboom = "kaboom",
    PonkeExplosion = "ponke-explosion"
}

export class AnimationFactory {
    constructor(private _scene: Phaser.Scene) {
        this._init();
    }

    private _init() {
        this._scene.anims.create({
            key: AnimationType.Kaboom,
            frames: this._scene.anims.generateFrameNumbers(AssetType.Kaboom, {
                start: 0,
                end: 15
            }),
            frameRate: 24,
            repeat: 0,
            hideOnComplete: true
        })
        this._scene.anims.create({
            key: AnimationType.PonkeExplosion,
            frames: this._scene.anims.generateFrameNumbers(AssetType.PonkeExplosion, {
                start: 0,
                end: 15
            }),
            frameRate: 24,
            repeat: 0,
            hideOnComplete: true
        });
    }
}
