import { Alien } from "../alien";
import { AnimationType } from "../factory/animation-factory";

export class AlienManager {
    aliens: Phaser.Physics.Arcade.Group;
    get hasAliveAliens(): boolean {
        return this.aliens.countActive(true) > 0;
    }

    constructor(private _scene: Phaser.Scene) {
        this.aliens = this._scene.physics.add.group({
            maxSize: 40,
            classType: Alien,
            runChildUpdate: true
        });
        this.aliens.setOrigin(0, 0)
        this._sortAliens();
        this._animate();
    }

    getRandomAliveEnemy(): Alien | undefined {
        let aliens = this.aliens.getChildren().filter(alien => alien.active) as Alien[];
        if (!aliens.length) {
            return undefined;
        }
        let random = Phaser.Math.RND.integerInRange(0, aliens.length - 1);
        return aliens[random];
    }

    reset(wave = 1) {
        this.stopMovement();
        this._sortAliens();
        this._animate(wave);
    }

    stopMovement() {
        this.aliens.getChildren().forEach(alien => {
            this._scene.tweens.killTweensOf(alien);
        });
    }

    private _sortAliens() {
        let ORIGIN_X = 100;
        let ORIGIN_Y = 100;
        this.aliens.clear(true, true);
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 10; x++) {
                let alien: Alien = this.aliens.create(ORIGIN_X + x * 48, ORIGIN_Y + y * 50);
                alien.setOrigin(0.5, 0.5);
                alien.play(AnimationType.Fly)
                alien.setImmovable(false);
            }
        }
    }

    private _animate(wave = 1) {
        this.aliens.children.iterate((c: Alien) => {
            this._scene.tweens.add({
                targets: c,
                ease: "Linear",
                duration: Math.max(600, 2000 / (1 + 0.10 * (wave - 1))),
                x: "+=200",
                paused: false,
                delay: 0,
                yoyo: true,
                repeat: -1
            })
        })
    }
}
