import { composeNfdLettering, nfdInkBounds } from './flex-card-instruction';

export const FlexCardKillLabel = 'INVADERS KILLED';

export interface FinalRunStats {
    readonly wave: number;
    readonly score: number;
    readonly invadersKilled: number;
}

export const FlexCardBackground = 'assets/flex-card/flex-card-background-v1.png';
export const FlexCardFrame = 'assets/flex-card/flex-card-frame.png';
export const GameLink = 'https://space-invaders-nfd.vercel.app';
const font = '"Arial Black", "Arial", sans-serif';

export function measureFlexText(ctx: CanvasRenderingContext2D, text: string, size: number, maxWidth: number) {
    ctx.font = `900 ${size}px ${font}`;
    ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText(text) as TextMetrics & {
        actualBoundingBoxLeft?: number; actualBoundingBoxRight?: number;
        actualBoundingBoxAscent?: number; actualBoundingBoxDescent?: number;
    };
    const left = metrics.actualBoundingBoxLeft || 0;
    const right = metrics.actualBoundingBoxRight || metrics.width;
    const ascent = metrics.actualBoundingBoxAscent || size * .75;
    const descent = metrics.actualBoundingBoxDescent || 0;
    const inset = Math.max(4, size * .085) / 2 + 3;
    const naturalWidth = left + right + inset * 2;
    const scale = Math.min(1, maxWidth / naturalWidth);
    return { left, ascent, descent, inset, scale, width: naturalWidth * scale,
        height: ascent + descent + inset * 2 + size * .055 };
}

export function flexCardLayout(ctx: CanvasRenderingContext2D, stats: FinalRunStats) {
    const left = 75, paddingX = 22, paddingY = 12;
    const wave = measureFlexText(ctx, `WAVE ${stats.wave}`, 76, 730 - paddingX * 2);
    const waveText = { x: left + paddingX, y: 209 + paddingY };
    const panelHeight = wave.height + paddingY * 2;
    // Center the frame on the visible glyphs, excluding the downward shadow.
    // Keep the text, frame dimensions and score at their existing coordinates.
    const inkCenterY = waveText.y + wave.inset + (wave.ascent + wave.descent) / 2;
    // The frame's visible blue edge starts near source (100,110). Preserve the
    // approved top-left anchor, including all transparent margins and glow.
    const frameScale = 360 / 1939;
    const panel = { x: left - 100 * frameScale, y: inkCenterY - panelHeight / 2 - 110 * frameScale,
        width: 360, height: 811 * frameScale };
    // Measured solid outer blue border, excluding the PNG's transparent margin
    // and diffuse glow. Keep this lettering container independent of the frame.
    const outer = { left: 134, top: 144, right: 1808, bottom: 661 };
    // The mockup's rows occupy roughly 75–80% of the visible outer-frame width.
    // A 10% inset on each side exceeds the required 6%; vertical clearance still
    // permits slight inner-border overlap without approaching the outer border.
    const insetX = (outer.right - outer.left) * .10;
    const insetY = (outer.bottom - outer.top) * .20;
    const waveLettering = {
        x: panel.x + (outer.left + outer.right) / 2 * frameScale,
        y: panel.y + (outer.top + outer.bottom) / 2 * frameScale,
        width: (outer.right - outer.left - insetX * 2) * frameScale,
        height: (outer.bottom - outer.top - insetY * 2) * frameScale
    };
    const score = { x: left, y: 209 + panelHeight + 22 };
    // Move the label and count together 24px below the previous -35px layout.
    const label = { x: left, y: Math.max(518, score.y + measureFlexText(ctx, stats.score.toLocaleString('en-US'), 194, 730).height + 24) - 11 };
    const kills = { x: left, y: label.y + measureFlexText(ctx, 'INVADERS KILLED', 43, 470).height + 5 };
    return { panel, wave: waveLettering, score, label, kills };
}

// Canvas lettering for dynamic card statistics; the Game Over line uses PNG glyphs.
export function glossyText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
    size: number, maxWidth: number, palette: string[], glow = false) {
    ctx.save();
    const bounds = measureFlexText(ctx, text, size, maxWidth);
    ctx.translate(x + bounds.inset * bounds.scale, y + bounds.inset);
    ctx.scale(bounds.scale, 1);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size * .085);
    ctx.strokeStyle = '#060a04';
    ctx.shadowColor = glow ? '#40ff16' : '#100600';
    ctx.shadowBlur = glow ? 22 : 3;
    ctx.shadowOffsetY = glow ? 0 : size * .055;
    ctx.strokeText(text, bounds.left, bounds.ascent);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = Math.max(1, size * .018);
    ctx.strokeStyle = palette[0];
    ctx.strokeText(text, bounds.left, bounds.ascent);
    const gradient = ctx.createLinearGradient(0, 0, 0, bounds.height);
    palette.forEach((color, i) => gradient.addColorStop(i / (palette.length - 1), color));
    ctx.fillStyle = gradient;
    ctx.fillText(text, bounds.left, bounds.ascent);
    ctx.restore();
}

export const GoldPalette = ['#fff5b4', '#ffe361', '#ffc024', '#ed9100'];
export const SilverPalette = ['#ffffff', '#e1f2ff', '#a7c8de', '#779bb4'];

function loadArtwork(source: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Could not load the Flex Card artwork. Please try again.'));
        image.src = source;
    });
}

// Compose the existing NFD label and digits as one row, then center its complete
// painted bounds. No character gets a separate correction or a distorted scale.
export function drawFlexWave(ctx: CanvasRenderingContext2D, images: HTMLImageElement[],
    lettering: { x: number; y: number; width: number; height: number }) {
    const height = 380;
    // Match the game's Wave announcement spacing: 20px label gap / 4px digit
    // gaps at a 96px glyph height, scaled along with the source artwork.
    const row = composeNfdLettering(images, height,
        images.map((_, i) => height * (i === 0 ? 20 / 96 : 4 / 96)));
    const { left, top, right, bottom } = nfdInkBounds(row);
    // Measure the complete inscription (including its spaces), then apply one
    // uniform fit and center the painted row in the single lettering container.
    const inkWidth = right - left, inkHeight = bottom - top;
    const scale = Math.min(lettering.width / inkWidth, lettering.height / inkHeight);
    const drawX = lettering.x - inkWidth * scale / 2 - left * scale;
    const drawY = lettering.y - inkHeight * scale / 2 - top * scale;
    ctx.drawImage(row, drawX, drawY, row.width * scale, row.height * scale);
    return { x: drawX + left * scale, y: drawY + top * scale,
        width: (right - left) * scale, height: (bottom - top) * scale, scale };
}

export function drawFlexKillLabel(ctx: CanvasRenderingContext2D, glyphs: HTMLImageElement[],
    position: { x: number; y: number }) {
    const row = composeNfdLettering(glyphs, 100), ink = nfdInkBounds(row);
    // Retain the approved label's box and leave count positioning independent
    // of the new artwork's aspect ratio. Only measurement uses legacy metrics.
    const box = measureFlexText(ctx, FlexCardKillLabel, 43, 470);
    const scale = Math.min(box.width / ink.width, (box.height - box.inset * 2) / ink.height);
    const x = position.x, y = position.y + box.inset;
    ctx.drawImage(row, x - ink.left * scale, y - ink.top * scale, row.width * scale, row.height * scale);
    return { x, y, width: ink.width * scale, height: ink.height * scale, scale };
}

export async function renderFlexCard(stats: FinalRunStats): Promise<HTMLCanvasElement> {
    const labelGlyphs = await Promise.all(FlexCardKillLabel.split('').map(letter =>
        letter === ' ' ? Promise.resolve(null) : loadArtwork(`assets/font/nfd-font-${letter}.png`)));
    const [background, frame, ...waveImages] = await Promise.all([
        loadArtwork(FlexCardBackground), loadArtwork(FlexCardFrame),
        loadArtwork('assets/texts/nfd-hud-wave.png'),
        ...String(stats.wave).split('').map(digit => loadArtwork(`assets/font/nfd-font-${digit}.png`))
    ]);
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    if (fonts) await fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = background.naturalWidth;
    canvas.height = background.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not create the Flex Card.');
    ctx.drawImage(background, 0, 0);
    const layout = flexCardLayout(ctx, stats);
    const p = layout.panel;
    ctx.drawImage(frame, p.x, p.y, p.width, p.height);
    drawFlexWave(ctx, waveImages, layout.wave);
    // Canvas shadows do not shrink with horizontal text fitting. Contain even
    // huge scores' glow within the left statistics area, away from the avatar.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 825, canvas.height); ctx.clip();
    glossyText(ctx, stats.score.toLocaleString('en-US'), layout.score.x, layout.score.y, 194, 730,
        ['#d4ffba', '#8bff64', '#4bff2c', '#20e719'], true);
    ctx.restore();
    drawFlexKillLabel(ctx, labelGlyphs, layout.label);
    glossyText(ctx, stats.invadersKilled.toLocaleString('en-US'), layout.kills.x, layout.kills.y, 144, 465, SilverPalette);
    return canvas;
}

export function flexCardPng(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('PNG export failed. Please try again.'));
    }, 'image/png'));
}

export async function downloadFlexCard(canvas: HTMLCanvasElement, stats: FinalRunStats) {
    const blob = await flexCardPng(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NFD-Flex-Wave${stats.wave}-Score${stats.score}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give browsers time to consume the URL before releasing its storage.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
