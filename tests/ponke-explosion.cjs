// Run with: node tests/ponke-explosion.cjs
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { decodePng, recolorPng } = require('../scripts/recolor-ponke-explosion.cjs');
const source = fs.readFileSync(path.resolve(__dirname, '../dist/assets/images/explode.png'));
const output = fs.readFileSync(path.resolve(__dirname, '../assets/meme-skins/ponke-explosion.png'));
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),
    'a601803cc20bd5d1495f0e039325873b78cf2c0d2342fe1085f09d8bd7ed61c3',
    'the original red explosion remains byte-for-byte unchanged');
assert(output.equals(recolorPng(source)), 'the separate asset is reproducible');
const original = decodePng(source), yellow = decodePng(output);
assert.equal(original.width, 2048); assert.equal(original.height, 128);
assert.equal(yellow.width, original.width); assert.equal(yellow.height, original.height);
let changed = 0, warmEdges = 0, brightYellow = 0, paleHighlights = 0;
for (let i = 0; i < original.pixels.length; i += 4) {
    const [r, g, b, a] = yellow.pixels.subarray(i, i + 4);
    assert.equal(a, original.pixels[i + 3], `alpha/silhouette changed at pixel ${i / 4}`);
    if (!a) {
        assert(yellow.pixels.subarray(i, i + 4).equals(original.pixels.subarray(i, i + 4)));
        continue;
    }
    if (!yellow.pixels.subarray(i, i + 3).equals(original.pixels.subarray(i, i + 3))) changed++;
    assert(g >= r * 0.49, 'no deep red areas remain');
    if (r > 30 && g < r * 0.7 && b < 20) warmEdges++;
    if (r > 230 && g > 220 && b < 100) brightYellow++;
    if (r > 240 && g > 240 && b > 170) paleHighlights++;
    // Recoloring must not introduce or remove nonblack pixels inside opaque areas.
    assert.equal(r + g + b > 0,
        original.pixels[i] + original.pixels[i + 1] + original.pixels[i + 2] > 0);
}
assert(changed > 0); assert(warmEdges > 0); assert(brightYellow > 0); assert(paleHighlights > 0);
assert.deepEqual(yellow.chunks.filter(c => c.type !== 'IDAT').map(c => c.raw),
    original.chunks.filter(c => c.type !== 'IDAT').map(c => c.raw), 'PNG metadata preserved');
console.log('PASS: deterministic yellow palette, unchanged original asset, all frame pixels/alpha/silhouettes and metadata preserved.');
