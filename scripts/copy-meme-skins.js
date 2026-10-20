import fs from 'fs';
import path from 'path';

// Both Rollup builds serve/package dist; keep root artwork as the source of truth.
export default function copyMemeSkins() {
    return {
        name: 'copy-meme-skins',
        buildStart() {
            const popcatAudio = path.resolve('assets/sounds/popcat/popcat-pop.mp3');
            const audioDestination = path.resolve('dist/assets/sounds/popcat');
            this.addWatchFile(popcatAudio);
            fs.mkdirSync(audioDestination, { recursive: true });
            fs.copyFileSync(popcatAudio, path.join(audioDestination, 'popcat-pop.mp3'));
            ['meme-skins', 'meme-skins/player', 'texts', 'font', 'weapons/rapid-laser', 'weapons/wojak-red-candle', 'weapons/wojak-tear', 'weapons/popcat-corn', 'mini-boss/wojak'].forEach(folder => {
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
