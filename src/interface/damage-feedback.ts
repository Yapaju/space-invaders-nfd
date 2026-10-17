// Visual deadlines only: these never gate damage or grant invulnerability.
export const DamageFeedbackSettings = {
    playerDuration: 250,
    hudDuration: 300,
    flashInterval: 50,
    tint: 0xff5555,
    ringDuration: 250,
    ringStartRadius: 14,
    ringEndRadius: 36
};

export class DamageFeedback {
    private startedAt: number | null = null;
    private hudStartedAt: number | null = null;
    private life: Phaser.GameObjects.Sprite;
    private ring: Phaser.GameObjects.Graphics;

    constructor(private scene: Phaser.Scene, private player: Phaser.Physics.Arcade.Sprite) {
        // Keep visuals advancing during transitions and GAME OVER, too.
        scene.events.on('postupdate', this.update, this);
        scene.events.once('shutdown', this.destroy, this);
    }

    show(removedLife: Phaser.GameObjects.Sprite) {
        // Retire an expired pulse before deciding whether this hit starts one,
        // including when a long frame crosses its completion deadline.
        this.update();
        const now = this.scene.time.now;
        // Coalesce rapid hits into one player pulse; do not stack or prolong it.
        if (this.startedAt === null) {
            this.startedAt = now;
            this.ring = this.scene.add.graphics();
            this.ring.setPosition(this.player.x, this.player.y);
            this.ring.setDepth(this.player.depth + 1);
        }
        this.clearHud();
        this.life = removedLife;
        this.hudStartedAt = now;
        // The icon is already inactive for life counting. Briefly render it as
        // the removed-life indicator without reviving it or changing its alpha.
        this.life.setVisible(true);
        this.update();
    }

    private update() {
        const now = this.scene.time.now;
        if (this.startedAt !== null) {
            const elapsed = now - this.startedAt;
            if (elapsed >= DamageFeedbackSettings.playerDuration) {
                this.player.clearTint();
                this.startedAt = null;
            } else if (Math.floor(elapsed / DamageFeedbackSettings.flashInterval) % 2 === 0) {
                this.player.setTint(DamageFeedbackSettings.tint);
            } else {
                this.player.clearTint();
            }
            if (this.ring) {
                const progress = Math.min(1, elapsed / DamageFeedbackSettings.ringDuration);
                if (progress >= 1) {
                    this.ring.destroy();
                    this.ring = undefined;
                } else {
                    const radius = DamageFeedbackSettings.ringStartRadius + progress *
                        (DamageFeedbackSettings.ringEndRadius - DamageFeedbackSettings.ringStartRadius);
                    this.ring.clear();
                    this.ring.lineStyle(2, 0xffcc88, 0.75 * (1 - progress));
                    this.ring.strokeCircle(0, 0, radius);
                }
            }
        }
        if (this.hudStartedAt !== null) {
            const elapsed = now - this.hudStartedAt;
            if (elapsed >= DamageFeedbackSettings.hudDuration) {
                this.clearHud();
            } else if (Math.floor(elapsed / DamageFeedbackSettings.flashInterval) % 2 === 0) {
                this.life.setTint(DamageFeedbackSettings.tint);
            } else {
                this.life.clearTint();
            }
        }
    }

    private clearHud() {
        if (this.life) this.life.clearTint().setVisible(false);
        this.life = undefined;
        this.hudStartedAt = null;
    }

    clear() {
        this.player.clearTint();
        if (this.ring) this.ring.destroy();
        this.ring = undefined;
        this.startedAt = null;
        this.clearHud();
    }

    destroy() {
        this.clear();
        this.scene.events.off('postupdate', this.update, this);
        this.scene.events.off('shutdown', this.destroy, this);
    }
}
