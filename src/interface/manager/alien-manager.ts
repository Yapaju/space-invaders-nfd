import { Alien } from "../alien";
import { getWaveConfiguration, FORMATION_COLUMNS, FORMATION_ROWS, INVADERS_PER_WAVE, FORMATION_START_Y, FORMATION_ROW_SPACING } from "../wave-config";

export class AlienManager {
    aliens: Phaser.Physics.Arcade.Group;
    // Minimum whole-pixel spacing for the enlarged 87.36 x 73.10px frames.
    readonly columnSpacing = 88;
    readonly rowSpacing = FORMATION_ROW_SPACING;
    readonly descentStep = 25;
    descentCount = 0;
    onDescent: (count: number) => void;
    private direction = 1;
    private movementStopped = false;
    private speed = 100;
    get hasAliveAliens(): boolean {
        return this.aliens.countActive(true) > 0;
    }

    constructor(private _scene: Phaser.Scene) {
        this.aliens = this._scene.physics.add.group({
            maxSize: INVADERS_PER_WAVE,
            classType: Alien,
            runChildUpdate: true
        });
        this.aliens.setOrigin(0, 0)
        this._sortAliens();
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
        this.direction = 1;
        this.descentCount = 0;
        this._sortAliens(wave);
        const duration = Math.max(600, 2000 / (1 + 0.10 * (wave - 1)));
        // Preserve v0.1's speed: 200 pixels over the scaled duration.
        this.speed = 200 / (duration / 1000);
        this.movementStopped = false;
    }

    stopMovement() {
        this.movementStopped = true;
    }

    // Returns true as soon as a living invader reaches the player's defensive line.
    update(delta: number, defensiveLine: number): boolean {
        const aliens = this.aliens.getChildren().filter(alien => alien.active) as Alien[];
        if (this.movementStopped || !aliens.length) {
            return false;
        }
        const reachedPlayer = () => aliens.some(alien => (alien.body as Phaser.Physics.Arcade.Body).bottom >= defensiveLine);
        if (reachedPlayer()) {
            this.stopMovement();
            return true;
        }

        const bounds = this._scene.physics.world.bounds;
        // Scale the wave's starting speed linearly from 1x at full strength to
        // 1.5x for the final survivor, without changing position or direction.
        const destroyedFraction = (this.aliens.maxSize - aliens.length) / (this.aliens.maxSize - 1);
        const multiplier = 1 + 0.5 * Math.max(0, Math.min(1, destroyedFraction));
        let remaining = this.speed * multiplier * Math.max(0, delta) / 1000;
        // Consume travel up to each edge, then reverse and descend exactly once.
        // This handles long frames without letting the formation overshoot.
        while (remaining > 0) {
            const left = Math.min(...aliens.map(alien => alien.getBounds().left));
            const right = Math.max(...aliens.map(alien => alien.getBounds().right));
            const distance = Math.max(0, this.direction > 0 ? bounds.right - right : left - bounds.left);
            const step = Math.min(remaining, distance);
            this._move(aliens, this.direction * step, 0);
            remaining -= step;
            if (step < distance) {
                break;
            }
            this._move(aliens, 0, this.descentStep);
            this.descentCount += 1;
            this.direction *= -1;
            aliens.forEach(alien => alien.setDirection(this.direction));
            if (reachedPlayer()) {
                this.stopMovement();
                return true;
            }
            if (this.onDescent) this.onDescent(this.descentCount);
        }
        return false;
    }

    private _move(aliens: Alien[], x: number, y: number) {
        aliens.forEach(alien => {
            // Keep Arcade collision bounds in sync with the visible formation.
            const body = alien.body as Phaser.Physics.Arcade.Body;
            body.reset(alien.x + x, alien.y + y);
            // Phaser 3.22 reset() ignores custom offsets until preUpdate.
            body.preUpdate(false, 0);
        });
    }

    private _sortAliens(wave = 1) {
        const bounds = this._scene.physics.world.bounds;
        const ORIGIN_X = (bounds.left + bounds.right) / 2 - (FORMATION_COLUMNS - 1) * this.columnSpacing / 2;
        const ORIGIN_Y = FORMATION_START_Y;
        const config = getWaveConfiguration(wave);
        this.aliens.clear(true, true);
        for (let y = 0; y < FORMATION_ROWS; y++) {
            for (let x = 0; x < FORMATION_COLUMNS; x++) {
                let alien: Alien = this.aliens.create(ORIGIN_X + x * this.columnSpacing, ORIGIN_Y + y * this.rowSpacing);
                alien.configure(config.enemies[y * FORMATION_COLUMNS + x], this.direction);
                alien.setImmovable(false);
            }
        }
    }

}
