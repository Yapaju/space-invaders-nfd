import fs from 'fs';
import path from 'path';

// Both Rollup builds serve/package dist; keep root artwork as the source of truth.
export default function copyMemeSkins() {
    return {
        name: 'copy-meme-skins',
        buildStart() {
            ['meme-skins', 'texts', 'font', 'weapons/rapid-laser'].forEach(folder => {
                const source = path.resolve('assets', folder);
                const destination = path.resolve('dist/assets', folder);
                fs.mkdirSync(destination, { recursive: true });
                this.addWatchFile(source);
                fs.readdirSync(source).filter(name => name.endsWith('.png') &&
                    (folder !== 'font' || /^nfd-font-[0-9]\.png$/.test(name))).forEach(name => {
                    const file = path.join(source, name);
                    this.addWatchFile(file);
                    fs.copyFileSync(file, path.join(destination, name));
                });
            });
        }
    };
}
