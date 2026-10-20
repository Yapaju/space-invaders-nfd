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
console.log('PASS: all four original PNGs are watched and copied by the production plugin; distribution files are byte-identical. No assets written by this test.');
