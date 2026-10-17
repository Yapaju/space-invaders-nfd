// Deterministic RGB-only recolor of the existing RGBA sprite sheet. No resizing,
// drawing, quantization or alpha changes. Run: node scripts/recolor-ponke-explosion.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(png) {
    const chunks = [];
    for (let offset = 8; offset < png.length;) {
        const length = png.readUInt32BE(offset);
        chunks.push({ type: png.toString('ascii', offset + 4, offset + 8),
            data: png.subarray(offset + 8, offset + 8 + length),
            raw: png.subarray(offset, offset + length + 12) });
        offset += length + 12;
    }
    const header = chunks[0].data;
    if (chunks[0].type !== 'IHDR' || header[8] !== 8 || header[9] !== 6 || header[12] !== 0) {
        throw new Error('Expected non-interlaced 8-bit RGBA PNG');
    }
    const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
    const stride = width * 4;
    const raw = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
    const pixels = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        if (filter > 4) throw new Error('Unsupported PNG filter');
        for (let x = 0; x < stride; x++) {
            const i = y * stride + x;
            const a = x >= 4 ? pixels[i - 4] : 0;
            const b = y > 0 ? pixels[i - stride] : 0;
            const c = y > 0 && x >= 4 ? pixels[i - stride - 4] : 0;
            const p = a + b - c;
            const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
            const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b :
                filter === 3 ? Math.floor((a + b) / 2) : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            pixels[i] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
        }
    }
    return { width, height, pixels, chunks };
}

// Low-intensity outer pixels retain amber/orange; the body is gold/yellow,
// progressing to pale yellow/near-white highlights. Spatial coordinates never change.
const palette = [
    [0, 0, 0, 0], [24, 70, 36, 0], [70, 176, 112, 0],
    [153, 255, 207, 0], [200, 255, 245, 30],
    [235, 255, 255, 173], [255, 255, 255, 245]
];

function recolorPng(source) {
    const { width, height, pixels, chunks } = decodePng(source);
    for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) continue; // Preserve even invisible RGB values.
        const heat = 0.6 * Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) +
            0.3 * pixels[i + 1] + 0.1 * pixels[i + 2];
        const upper = palette.findIndex((stop, index) => index > 0 && heat <= stop[0]);
        const high = palette[upper < 0 ? palette.length - 1 : upper];
        const low = palette[upper < 0 ? palette.length - 2 : upper - 1];
        const t = Math.max(0, Math.min(1, (heat - low[0]) / (high[0] - low[0])));
        for (let channel = 0; channel < 3; channel++) {
            pixels[i + channel] = Math.round(low[channel + 1] + t * (high[channel + 1] - low[channel + 1]));
        }
    }
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height); // PNG filter 0, lossless RGBA.
    for (let y = 0; y < height; y++) pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    const data = zlib.deflateSync(raw, { level: 9 });
    const idat = Buffer.alloc(data.length + 12);
    idat.writeUInt32BE(data.length, 0);
    idat.write('IDAT', 4);
    data.copy(idat, 8);
    let crc = 0xffffffff;
    for (const byte of idat.subarray(4, -4)) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    idat.writeUInt32BE((crc ^ 0xffffffff) >>> 0, idat.length - 4);
    let written = false;
    return Buffer.concat([source.subarray(0, 8), ...chunks.map(chunk => {
        if (chunk.type !== 'IDAT') return chunk.raw;
        if (written) return Buffer.alloc(0);
        written = true;
        return idat;
    })]);
}

if (require.main === module) {
    const root = path.resolve(__dirname, '..');
    const source = fs.readFileSync(path.join(root, 'dist/assets/images/explode.png'));
    fs.writeFileSync(path.join(root, 'assets/meme-skins/ponke-explosion.png'), recolorPng(source));
}
module.exports = { decodePng, recolorPng };
