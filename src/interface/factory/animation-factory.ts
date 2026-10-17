import { AssetType } from "../assets";
import { ElectricLaserSettings } from "../bullet";

export enum AnimationType {
    Kaboom = "kaboom",
    PonkeExplosion = "ponke-explosion"
}

export class AnimationFactory {
    constructor(private _scene: Phaser.Scene) {
        this._init();
    }

    private _init() {
        if (!this._scene.anims.exists(ElectricLaserSettings.animation)) {
            this._scene.anims.create({
                key: ElectricLaserSettings.animation,
                frames: this._scene.anims.generateFrameNumbers(AssetType.RapidLaser, { start: 0, end: 5 }),
                frameRate: ElectricLaserSettings.frameRate,
                repeat: -1
            });
        }
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
