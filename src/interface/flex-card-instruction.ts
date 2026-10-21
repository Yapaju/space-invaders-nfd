const message = 'ENTER FOR FLEX CARD';
export const FlexCardLetters = Array.from(new Set(message.replace(/ /g, '').split('')))
    .map(letter => ({ key: `nfd-flex-letter-${letter}`, path: `font/nfd-font-${letter}.png` }));

// Shared image-row compositor for NFD lettering. Null represents the existing
// 36%-of-height word space; optional gaps support the HUD's label/digit spacing.
export function composeNfdLettering(glyphs: HTMLImageElement[], height: number, gaps: number[] = []) {
    const widths = glyphs.map(image => image ? image.width / image.height * height : height * .36);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(widths.reduce((sum, width) => sum + width, 0) +
        gaps.slice(0, Math.max(0, glyphs.length - 1)).reduce((sum, gap) => sum + gap, 0));
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    let x = 0;
    glyphs.forEach((image, i) => {
        if (image) ctx.drawImage(image, x, 0, widths[i], height);
        x += widths[i] + (gaps[i] || 0);
    });
    return canvas;
}

export function nfdInkBounds(canvas: HTMLCanvasElement) {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 16) continue;
        left = Math.min(left, x); right = Math.max(right, x + 1);
        top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}

// Compose the exact existing golden glyph artwork, including its highlights/shadows.
export function flexCardInstructionTexture(scene: Phaser.Scene): string {
    const key = 'nfd-flex-card-instruction-v1';
    if (scene.textures.exists(key)) return key;
    const glyphs = message.split('').map(letter => letter === ' ' ? null :
        scene.textures.get(`nfd-flex-letter-${letter}`).getSourceImage() as HTMLImageElement);
    const canvas = composeNfdLettering(glyphs, 100);
    scene.textures.addCanvas(key, canvas);
    return key;
}
