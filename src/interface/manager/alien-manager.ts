import { Alien } from "../alien";
import { getWaveConfiguration, INVADERS_PER_WAVE, WaveConfiguration } from "../wave-config";
import { WaveDirectorConfig, WaveMovementGroup } from '../wave-director';
import { PremiumProgress, PremiumFormationPlan, planPremiumFormation } from '../premium-spawn';
import { premiumInvaderOf } from '../premium-invader';
import { createPremiumInvader } from '../premium-registry';

interface GroupMovement extends WaveMovementGroup {
    aliens: Alien[];
    direction: number;
    initialEntityCount: number;
    bounceCount: number;
}

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
    private rows: GroupMovement[] = [];
    private twinDescentElapsedMs = 0;
    private twinVerticalOffset = 0;
    private twinSpawnY = new Map<Alien, number>();
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
        if (this.configuration.formation === 'TWIN_SQUADS') return this._updateTwin(delta, defensiveLine);
        if (this.configuration.formation === 'SNAKE') return this._updateMovingGroups(this.rows, delta, defensiveLine, true);

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

    private _updateTwin(delta: number, defensiveLine: number): boolean {
        const config = WaveDirectorConfig.formation.twinSquads;
        let remaining = Math.max(0, delta);
        while (remaining > 0) {
            const untilDescent = config.descentIntervalMs - this.twinDescentElapsedMs;
            const step = Math.min(remaining, untilDescent);
            // Slice horizontal simulation at each timed descent, including fatal contacts.
            if (this._updateMovingGroups(this.rows, step, defensiveLine, false)) return true;
            this.twinDescentElapsedMs += step;
            remaining = Math.max(0, remaining - step);
            if (this.twinDescentElapsedMs + 1e-7 < config.descentIntervalMs) break;
            this.twinDescentElapsedMs = 0;
            this.twinVerticalOffset += config.descentPixels;
            this.descentCount++;
            const living = this.aliens.getChildren().filter(alien => alien.active) as Alien[];
            // _move uses each original spawn Y plus the one authoritative Twin offset.
            this._move(living, 0, 0);
            if (living.some(alien => (alien.body as Phaser.Physics.Arcade.Body).bottom >= defensiveLine)) {
                this.stopMovement();
                return true;
            }
            if (this.onDescent) this.onDescent(this.descentCount);
        }
        return false;
    }

    private _groupBounds(aliens: Alien[]) {
        return {
            left: Math.min(...aliens.map(alien => Math.min(alien.getBounds().left,
                (alien.body as Phaser.Physics.Arcade.Body).left))),
            right: Math.max(...aliens.map(alien => Math.max(alien.getBounds().right,
                (alien.body as Phaser.Physics.Arcade.Body).right)))
        };
    }

    private _updateMovingGroups(groups: GroupMovement[], delta: number, defensiveLine: number,
        snake: boolean): boolean {
        const world = this._scene.physics.world.bounds;
        let remaining = Math.max(0, delta) / 1000;
        while (remaining > 0) {
            // Original group order/identity persists after casualties and horizontal crossings.
            const living = groups.map(group => ({ group, aliens: group.aliens.filter(alien => alien.active) }))
                .filter(entry => entry.aliens.length > 0);
            if (!living.length) break;
            const velocities = living.map(({ group, aliens }) => {
                const destroyed = (group.initialEntityCount - aliens.length) / Math.max(1, group.initialEntityCount - 1);
                return group.direction * this.speed * (1 + 0.5 * Math.max(0, Math.min(1, destroyed)));
            });
            const walls = living.map(({ aliens }, i) => {
                const bounds = this._groupBounds(aliens);
                return Math.max(0, velocities[i] > 0 ? world.right - bounds.right : bounds.left - world.left) /
                    Math.abs(velocities[i]);
            });
            const contacts: { first: number; second: number; time: number }[] = [];
            if (!snake) for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
                const relative = velocities[i] - velocities[j];
                if (!relative) continue;
                let time = Infinity;
                for (const a of living[i].aliens) for (const b of living[j].aliens) {
                    const first = this._twinBounds(a), second = this._twinBounds(b);
                    if (first.top >= second.bottom - 1e-7 || second.top >= first.bottom - 1e-7) continue;
                    if (relative > 0 && first.right <= second.left + 1e-7)
                        time = Math.min(time, Math.max(0, second.left - first.right) / relative);
                    else if (relative < 0 && second.right <= first.left + 1e-7)
                        time = Math.min(time, Math.max(0, first.left - second.right) / -relative);
                }
                if (Number.isFinite(time)) contacts.push({ first: i, second: j, time });
            }
            const contact = Math.min(Infinity, ...contacts.map(pair => pair.time));
            const eventTime = Math.min(...walls, contact);
            const step = Math.min(remaining, eventTime);
            living.forEach(({ aliens }, i) => this._move(aliens, velocities[i] * step, 0));
            remaining = Math.max(0, remaining - step);
            if (step < eventTime) break;
            // Coalesce simultaneous wall/contact events: each involved group reverses once.
            const tolerance = 1e-7 / Math.max(1, ...velocities.map(Math.abs));
            const colliding = contacts.filter(pair => Math.abs(pair.time - eventTime) <= tolerance);
            const bounced = living.filter((entry, i) => Math.abs(walls[i] - eventTime) <= tolerance ||
                colliding.some(pair => pair.first === i || pair.second === i));
            const previousDescent = this.descentCount;
            bounced.forEach(({ group, aliens }) => {
                group.direction *= -1;
                group.bounceCount++;
                aliens.forEach(alien => alien.setDirection(group.direction));
            });
            if (snake) {
                // First living entry is the uppermost ORIGINAL row, regardless of current Y.
                if (bounced.indexOf(living[0]) >= 0) {
                    living.forEach(({ aliens }) => this._move(aliens, 0, this.descentStep));
                    this.descentCount++;
                }
            }
            if (living.some(({ aliens }) => aliens.some(alien =>
                (alien.body as Phaser.Physics.Arcade.Body).bottom >= defensiveLine))) {
                this.stopMovement();
                return true;
            }
            if (this.onDescent && this.descentCount > previousDescent) this.onDescent(this.descentCount);
        }
        return false;
    }

    // Owner-approved Twin clearance protects the complete sprite as well as its
    // unchanged damage body. In particular, Premium never splits across rows.
    private _twinBounds(alien: Alien) {
        const frame = alien.getBounds(), body = alien.body as Phaser.Physics.Arcade.Body;
        return { left: Math.min(frame.left, body.left), right: Math.max(frame.right, body.right),
            top: Math.min(frame.top, body.top), bottom: Math.max(frame.bottom, body.bottom) };
    }

    private _move(aliens: Alien[], x: number, y: number) {
        aliens.forEach(alien => {
            // Keep Arcade collision bounds in sync with the visible formation.
            const body = alien.body as Phaser.Physics.Arcade.Body;
            const nextY = this.configuration.formation === 'TWIN_SQUADS' ?
                this.twinSpawnY.get(alien) + this.twinVerticalOffset : alien.y + y;
            body.reset(alien.x + x, nextY);
            // Phaser 3.22 reset() ignores custom offsets until preUpdate.
            body.preUpdate(false, 0);
            const premium = premiumInvaderOf(alien);
            if (premium) premium.syncFormation();
        });
    }

    private _sortAliens(wave = 1) {
        const bounds = this._scene.physics.world.bounds;
        const config = this.configuration = getWaveConfiguration(wave, this.seed, bounds);
        this.direction = config.initialDirection;
        this.twinDescentElapsedMs = 0;
        this.twinVerticalOffset = 0;
        this.twinSpawnY.clear();
        this.rows = (config.rowGroups || []).map(row => ({ ...row, aliens: [],
            direction: row.initialDirection, initialEntityCount: 0, bounceCount: 0,
            ...(config.formation === 'SNAKE' ? { descentCount: 0, pendingDescents: 0 } : {}) }));
        const groups = this.rows;
        this.aliens.clear(true, true);
        this.premiumPlan = planPremiumFormation(config, this.progress);
        this.premiumPlan.regulars.forEach(entry => {
            const slot = config.slots[entry.slot];
            const alien: Alien = this.aliens.create(slot.x, slot.y);
            const squad = groups.find(group => group.slots.indexOf(entry.slot) >= 0);
            alien.configure(entry.type, squad ? squad.direction : this.direction);
            if (squad) squad.aliens.push(alien);
            alien.setImmovable(false);
        });
        this.premiumPlan.premiums.forEach(footprint => {
            const premium = createPremiumInvader(this._scene, footprint);
            const root = premium.spawn(), squad = this.rows.find(group =>
                group.squad === footprint.squad && group.row === footprint.row);
            this.aliens.add(root);
            if (squad) squad.aliens.push(root);
            premium.setFormationDirection(squad ? squad.direction : this.direction);
        });
        if (config.formation === 'TWIN_SQUADS')
            (this.aliens.getChildren() as Alien[]).forEach(alien => this.twinSpawnY.set(alien, alien.y));
        this.initialEntityCount = this.aliens.getChildren().length;
        groups.forEach(squad => squad.initialEntityCount = squad.aliens.length);
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
