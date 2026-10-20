import { AssetType } from './assets';

export const PopcatSettings = {
    mouthOpenMs: 180,
    lightIntervalMs: 300,
    lightFrames: 2,
    idleBrightness: 0.82,
    peakBrightness: 1.08
};

// Measured separately on all four 1536x1024 source PNGs. Only the luminous
// lens interiors are included, never their orange housings or silver rivets.
// [center X, center Y, ellipse radius X, radius Y, rotation in degrees].
export type PopcatBulb = [number, number, number, number, number];
export const PopcatBulbs: { [key: string]: PopcatBulb[][] } = {
    [AssetType.PopcatRight]: [
        [[545,290,19,29,20],[648,369,29,30,10],[802,444,30,29,0],
         [967,506,29,30,0],[1102,535,22,29,15],[1199,519,14,27,15]],
        [[502,556,19,28,10],[623,640,28,29,0],[796,726,29,28,0],[947,768,25,22,-35]]
    ],
    [AssetType.PopcatLeft]: [
        [[992,290,19,29,-20],[889,369,29,30,-10],[734,444,30,29,0],
         [569,506,29,30,0],[434,535,22,29,-15],[337,519,14,27,-15]],
        [[1034,556,19,28,-10],[913,640,28,29,0],[740,726,29,28,0],[589,768,25,22,35]]
    ],
    [AssetType.PopcatOpenRight]: [
        [[543,289,19,29,20],[648,369,29,30,10],[806,447,30,29,0],
         [972,510,29,30,0],[1110,538,22,29,15],[1206,519,14,27,15]],
        [[498,554,19,28,10],[621,641,28,29,0],[799,727,29,28,0],[950,772,25,22,-35]]
    ],
    [AssetType.PopcatOpenLeft]: [
        [[994,289,19,29,-20],[889,369,29,30,-10],[731,447,30,29,0],
         [565,510,29,30,0],[427,538,22,29,-15],[331,519,14,27,-15]],
        [[1038,554,19,28,-10],[915,641,28,29,0],[737,727,29,28,0],[586,772,25,22,35]]
    ]
};

export function popcatLightTexture(pose: string, frame: number) {
    return `${pose}-arcade-${frame}`;
}

export function popcatBulbBrightness(frame: number, index: number) {
    // Both rings use the same parity and rhythm: A/B, never a moving head.
    return index % 2 === frame % 2 ? PopcatSettings.peakBrightness : PopcatSettings.idleBrightness;
}

export function preparePopcatLights(scene: Phaser.Scene, pose: string, frame: { width: number, height: number }) {
    if (scene.textures.exists(popcatLightTexture(pose, 0))) return;
    const source = scene.textures.get(`${pose}-source`).getSourceImage() as HTMLImageElement;
    const scale = Math.min(frame.width / source.width, frame.height / source.height);
    const offsetX = (frame.width - source.width * scale) / 2;
    const offsetY = (frame.height - source.height * scale) / 2;
    // Shared cached frames keep runtime work to a normal sprite texture switch.
    // Each is only 337x282, also usable on the existing low-limit/Canvas fallback.
    for (let phase = 0; phase < PopcatSettings.lightFrames; phase++) {
        const texture = scene.textures.createCanvas(popcatLightTexture(pose, phase), frame.width, frame.height);
        const context = texture.context;
        context.drawImage(source, offsetX, offsetY, source.width * scale, source.height * scale);
        const pixels = context.getImageData(0, 0, frame.width, frame.height);
        PopcatBulbs[pose].forEach(bulbs => bulbs.forEach((bulb, index) => {
            const [sx, sy, rx, ry, degrees] = bulb;
            const cx = offsetX + sx * scale, cy = offsetY + sy * scale;
            const radius = Math.max(rx, ry) * scale;
            const angle = degrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
            const brightness = popcatBulbBrightness(phase, index);
            for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(frame.height - 1, cy + radius); y++) {
                let first = frame.width, last = -1;
                for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(frame.width - 1, cx + radius); x++) {
                    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
                    const u = (dx * cos + dy * sin) / (rx * scale);
                    const v = (-dx * sin + dy * cos) / (ry * scale);
                    const distance = Math.sqrt(u * u + v * v);
                    if (distance >= 1) continue;
                    first = Math.min(first, x); last = x;
                    const feather = Math.min(1, (1 - distance) / 0.18);
                    const factor = 1 + (brightness - 1) * feather;
                    const p = (y * frame.width + x) * 4;
                    for (let c = 0; c < 3; c++) pixels.data[p + c] *= factor;
                    // Alpha and every pixel outside the measured lenses stay intact.
                }
                // Restrict writes to lens pixels too: a full-canvas ImageData
                // round trip can round RGB in the source's faint exterior glow.
                if (last >= first) context.putImageData(pixels, 0, 0, first, y, last - first + 1, 1);
            }
        }));
        texture.refresh();
    }
}
