// Validate the actual build-copy plugin without writing over existing artwork.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const copies = [], watches = [];
const moduleCopy = { exports: {} };
const mockFs = { ...fs, mkdirSync() {}, copyFileSync(source, destination) { copies.push([source, destination]); } };
const source = fs.readFileSync(path.join(__dirname, '../scripts/copy-meme-skins.js'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015, esModuleInterop: true
} }).outputText, { module: moduleCopy, exports: moduleCopy.exports,
    require: name => name === 'fs' ? mockFs : require(name) });
moduleCopy.exports.default().buildStart.call({ addWatchFile: file => watches.push(file) });
const corn = copies.filter(([source]) => source.includes(path.join('weapons', 'popcat-corn')));
assert.equal(corn.length, 4);
for (const [source, destination] of corn) {
    assert(watches.includes(source));
    assert.equal(destination, path.resolve('dist/assets/weapons/popcat-corn', path.basename(source)));
    assert(fs.readFileSync(source).equals(fs.readFileSync(destination)), 'distribution copy matches the original');
}
const pops=copies.filter(([source])=>source===path.resolve('assets/sounds/popcat/popcat-pop.mp3'));
assert.equal(pops.length,1,'build includes the single Popcat sound');
const [soundSource,soundDestination]=pops[0];
assert(watches.includes(soundSource),'audio source watched');
assert.equal(soundDestination,path.resolve('dist/assets/sounds/popcat/popcat-pop.mp3'));
const mp3=fs.readFileSync(soundSource);
assert(mp3.equals(fs.readFileSync(soundDestination)),'distributed MP3 is byte-identical');
assert.equal(require('crypto').createHash('sha256').update(mp3).digest('hex'),
    '05bab6669eb47afccac2d6ed4dc62db3547888ef4a104cd0de67b16dd2c9dab6',
    'normalized copy of the requested reference recording');
assert.equal(mp3.length,1728);
console.log('PASS: original PNGs and locally bundled Popcat MP3 are watched/copied by the build; source/distribution match the normalized reference. No assets written by this test.');
