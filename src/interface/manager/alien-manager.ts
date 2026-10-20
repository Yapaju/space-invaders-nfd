import { Alien } from "../alien";
import { getWaveConfiguration, INVADERS_PER_WAVE, WaveConfiguration } from "../wave-config";
import { WaveDirectorConfig } from '../wave-director';
import { PremiumProgress, PremiumFormationPlan, planPremiumFormation } from '../premium-spawn';
import { premiumInvaderOf } from '../premium-invader';
import { createPremiumInvader } from '../premium-registry';

export class AlienManager {
    aliens: Phaser.Physics.Arcade.Group;
    // Minimum whole-pixel spacing for the enlarged 87.36 x 73.10px frames.
    readonly columnSpacing = WaveDirectorConfig.formation.columnSpacing;
    readonly rowSpacing = WaveDirectorConfig.formation.rowSpacing;
    configuration: WaveConfiguration;
    readonly descentStep = 25;
    descentCount = 0;
    onDescent: (count: number) => void;
    private direction = 1;
    private movementStopped = false;
    private speed = WaveDirectorConfig.movement.regularSpeed;
    private initialEntityCount = INVADERS_PER_WAVE;
    premiumPlan: PremiumFormationPlan;
    get hasAliveAliens(): boolean {
        return this.aliens.countActive(true) > 0;
    }

    constructor(private _scene: Phaser.Scene, private seed = WaveDirectorConfig.seed,
        private progress = new PremiumProgress()) {
        this.aliens = this._scene.physics.add.group({
            maxSize: INVADERS_PER_WAVE,
            classType: Alien,
            runChildUpdate: true
        });
        this.aliens.setOrigin(0, 0)
        this._sortAliens();
    }

    getRandomAliveEnemy(): Alien | undefined {
        let aliens = this.aliens.getChildren().filter(alien => alien.active && !premiumInvaderOf(alien as Alien)) as Alien[];
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
        this.speed = this.configuration.movementSpeed;
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
        const destroyedFraction = (this.initialEntityCount - aliens.length) / Math.max(1, this.initialEntityCount - 1);
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
            const premium = premiumInvaderOf(alien);
            if (premium) premium.syncFormation();
        });
    }

    private _sortAliens(wave = 1) {
        const bounds = this._scene.physics.world.bounds;
        const config = this.configuration = getWaveConfiguration(wave, this.seed, bounds);
        this.aliens.clear(true, true);
        this.premiumPlan = planPremiumFormation(config, this.progress);
        this.premiumPlan.regulars.forEach(entry => {
            const slot = config.slots[entry.slot];
            const alien: Alien = this.aliens.create(slot.x, slot.y);
            alien.configure(entry.type, this.direction);
            alien.setImmovable(false);
        });
        this.premiumPlan.premiums.forEach(footprint => {
            const premium = createPremiumInvader(this._scene, footprint);
            this.aliens.add(premium.spawn());
            premium.setFormationDirection(this.direction);
        });
        this.initialEntityCount = this.aliens.getChildren().length;
    }

    updatePremiums(delta: number, player: Phaser.Physics.Arcade.Sprite, damage: () => void) {
        (this.aliens.getChildren().slice() as Alien[]).forEach(alien => {
            const premium = premiumInvaderOf(alien);
            if (premium && alien.active && player.active) {
                premium.update(delta);
                premium.updateWeapons(delta, player, damage);
            }
        });
    }
    clearPremiumWeapons() {
        // Phaser may destroy the group before the scene's shutdown listener.
        // Its scene-owned roots have already disposed their controllers then.
        if (!this.aliens.children) return;
        (this.aliens.getChildren() as Alien[]).forEach(alien => {
            const premium = premiumInvaderOf(alien);
            if (premium) premium.stopWeapons();
        });
    }

}
