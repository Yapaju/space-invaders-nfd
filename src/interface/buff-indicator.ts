import { GoldenNumber, UiDepth } from './golden-number';

export const BuffIndicatorSettings = {
    y: 64,
    radius: 24,
    stroke: 3,
    background: 0x101018,
    backgroundAlpha: 0.85,
    track: 0x493722,
    ring: 0xffb638,
    warningRing: 0xff4444,
    warningRemaining: 3000,
    digitHeight: 20,
    depth: UiDepth.Hud
};

interface BuffIndicatorOptions {
    x: number;
    y: number;
    duration?: number;
    logo?: string;
    ringColor?: number;
    digitColor?: number;
    warningRingColor?: number | null;
}

// One reusable circle. A future row can supply each indicator's center;
// timed content uses the NFD digit shapes, while static content can supply a logo.
export class BuffIndicator {
    private graphics: Phaser.GameObjects.Graphics;
    private number: GoldenNumber;
    private logo: Phaser.GameObjects.Image;

    constructor(private scene: Phaser.Scene, private options: BuffIndicatorOptions,
        private style = BuffIndicatorSettings) {}

    show(remaining?: number) {
        const timed = this.options.duration !== undefined;
        if (timed && remaining <= 0) {
            this.clear();
            return;
        }
        const s = this.style;
        if (!this.graphics) {
            this.graphics = this.scene.add.graphics().setPosition(this.options.x, this.options.y).setDepth(s.depth);
            if (timed) {
                this.number = new GoldenNumber(this.scene, {
                    x: this.options.x, y: this.options.y, height: s.digitHeight,
                    align: 'center', maxWidth: s.radius * 1.5, depth: s.depth + 0.1,
                    digitColor: this.options.digitColor
                });
            } else if (this.options.logo) {
                this.logo = this.scene.add.image(this.options.x, this.options.y, this.options.logo).setDepth(s.depth + 0.1);
                this.logo.setScale(s.radius * 1.3 / Math.max(this.logo.width, this.logo.height));
            }
        }
        const progress = timed ? Math.min(1, remaining / this.options.duration) : 1;
        this.graphics.clear();
        this.graphics.fillStyle(s.background, s.backgroundAlpha).fillCircle(0, 0, s.radius);
        this.graphics.lineStyle(s.stroke, s.track, 1).strokeCircle(0, 0, s.radius);
        const ring = this.options.ringColor === undefined ? s.ring : this.options.ringColor;
        const warning = this.options.warningRingColor === undefined ? s.warningRing : this.options.warningRingColor;
        this.graphics.lineStyle(s.stroke, timed && remaining < s.warningRemaining && warning !== null ? warning : ring, 1);
        this.graphics.beginPath();
        this.graphics.arc(0, 0, s.radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress, false);
        this.graphics.strokePath();
        if (this.number) this.number.setText(String(Math.ceil(remaining / 1000)));
    }

    clear() {
        if (this.graphics) this.graphics.destroy();
        if (this.number) this.number.destroy();
        if (this.logo) this.logo.destroy();
        this.graphics = undefined;
        this.number = undefined;
        this.logo = undefined;
    }
}
