export const UiDepth = { Hud: 10000, Overlay: 10001 };
export const UiTexture = {
    Score: 'nfd-hud-score', Wave: 'nfd-hud-wave', Lives: 'nfd-hud-lives', GameOver: 'nfd-text-game-over'
};
export const GoldenUiAssets = [
    ...Object.keys(UiTexture).map(name => ({ key: UiTexture[name], path: `texts/${UiTexture[name]}.png` })),
    ...Array.from({ length: 10 }, (_, digit) => ({ key: `nfd-font-${digit}`, path: `font/nfd-font-${digit}.png` }))
];

interface NumberOptions {
    x: number;
    y: number;
    height: number;
    align: 'left' | 'center' | 'right';
    maxWidth: number;
    depth: number;
    gap?: number;
    label?: string;
    labelGap?: number;
}

// One row of aspect-preserving images. All digit PNGs share a height/baseline.
// Reuse existing sprites on updates; destroy surplus digits when values shrink.
export class GoldenNumber {
    private digits: Phaser.GameObjects.Image[] = [];
    private label: Phaser.GameObjects.Image;
    private visible = true;
    text = '';
    width = 0;
    height = 0;

    constructor(private scene: Phaser.Scene, private options: NumberOptions) {
        if (options.label) this.label = this.image(options.label);
    }

    private image(key: string) {
        return this.scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(this.options.depth);
    }

    setText(value: string) {
        if (!/^\d*$/.test(value)) throw new Error('GoldenNumber requires digits only');
        if (this.text === value) return this;
        this.text = value;
        while (this.digits.length > value.length) this.digits.pop().destroy();
        Array.from(value).forEach((digit, index) => {
            if (!this.digits[index]) this.digits.push(this.image(`nfd-font-${digit}`));
            else this.digits[index].setTexture(`nfd-font-${digit}`);
        });
        this.layout();
        return this;
    }

    setVisible(visible: boolean) {
        this.visible = visible;
        if (this.label) this.label.setVisible(visible);
        this.digits.forEach(digit => digit.setVisible(visible));
        return this;
    }

    private layout() {
        const o = this.options;
        const gap = o.gap === undefined ? 2 : o.gap;
        const labelGap = this.label && this.digits.length ? (o.labelGap === undefined ? 10 : o.labelGap) : 0;
        const images = this.label ? [this.label, ...this.digits] : this.digits;
        const widths = images.map(image => o.height * image.width / image.height);
        const naturalWidth = widths.reduce((sum, width) => sum + width, 0) +
            Math.max(0, this.digits.length - 1) * gap + labelGap;
        const scale = naturalWidth ? Math.min(1, o.maxWidth / naturalWidth) : 1;
        this.width = naturalWidth * scale;
        this.height = o.height * scale;
        let x = o.x - (o.align === 'center' ? this.width / 2 : o.align === 'right' ? this.width : 0);
        images.forEach((image, index) => {
            image.setDisplaySize(widths[index] * scale, this.height);
            image.setPosition(x, o.y - this.height / 2).setVisible(this.visible);
            x += widths[index] * scale + (image === this.label ? labelGap : gap) * scale;
        });
    }

    destroy() {
        this.digits.forEach(digit => digit.destroy());
        this.digits = [];
        if (this.label) this.label.destroy();
        this.label = undefined;
    }
}
