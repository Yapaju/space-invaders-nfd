import { BuffIndicator, BuffIndicatorSettings } from './buff-indicator';

export const RapidFireSettings = {
    duration: 10000,
    fireRateMultiplier: 1.5,
    normalFiringInterval: 200,
    ringColor: 0xff3030,
    digitColor: 0xff3030
};

export class RapidFire {
    private timer: Phaser.Time.TimerEvent;
    private indicator: BuffIndicator;

    constructor(private scene: Phaser.Scene,
        private onIntervalChange: (previous: number, current: number) => void,
        private canShoot: () => boolean) {
        this.indicator = new BuffIndicator(scene, {
            x: scene.scale.gameSize.width / 2, y: BuffIndicatorSettings.y, duration: RapidFireSettings.duration,
            ringColor: RapidFireSettings.ringColor, digitColor: RapidFireSettings.digitColor,
            warningRingColor: null
        });
        scene.events.once('shutdown', this.destroy, this);
        // PRE_UPDATE runs before Clock's UPDATE, so no transition frame is
        // charged to the bonus. Do not pause the scene clock or other timers.
        scene.events.on('preupdate', this.syncShootingState, this);
    }

    get active() { return !!this.timer; }

    get firingInterval() {
        return RapidFireSettings.normalFiringInterval / (this.active ? RapidFireSettings.fireRateMultiplier : 1);
    }

    activate() {
        const previous = this.firingInterval;
        this.cancelTimer();
        this.timer = this.scene.time.delayedCall(RapidFireSettings.duration, () => this.clear());
        this.syncShootingState();
        if (previous !== this.firingInterval) this.onIntervalChange(previous, this.firingInterval);
        this.update();
    }

    update() {
        this.syncShootingState();
        if (this.timer) this.indicator.show(Math.max(0, this.timer.delay - this.timer.getElapsed()));
    }

    clear() {
        const previous = this.firingInterval;
        this.cancelTimer();
        this.timer = undefined;
        this.indicator.clear();
        if (previous !== this.firingInterval) this.onIntervalChange(previous, this.firingInterval);
    }

    destroy() {
        this.clear();
        this.scene.events.off('shutdown', this.destroy, this);
        this.scene.events.off('preupdate', this.syncShootingState, this);
    }

    private syncShootingState() {
        if (this.timer) this.timer.paused = !this.canShoot();
    }

    private cancelTimer() {
        if (this.timer) {
            // A paused TimerEvent is skipped by Clock, including its removal.
            // Let Clock retire the canceled event on its next normal update.
            this.timer.paused = false;
            this.timer.remove(false);
            this.timer.destroy();
        }
    }
}
