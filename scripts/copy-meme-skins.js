import fs from 'fs';
import path from 'path';

// Both Rollup builds serve/package dist; keep root artwork as the source of truth.
export default function copyMemeSkins() {
    return {
        name: 'copy-meme-skins',
        buildStart() {
            // The approved mockup is reference-only and must never be packaged.
            fs.mkdirSync(path.resolve('dist/assets/flex-card'), { recursive: true });
            ['flex-card-background-v1.png', 'flex-card-circle-button.png', 'flex-card-share.png',
                'flex-card-download.png', 'flex-card-website.png', 'flex-card-close.png', 'flex-card-frame.png'].forEach(name => {
                const file = path.resolve('assets/flex-card', name);
                this.addWatchFile(file);
                fs.copyFileSync(file, path.resolve('dist/assets/flex-card', name));
            });
            const popcatAudio = path.resolve('assets/sounds/popcat/popcat-pop.mp3');
            const audioDestination = path.resolve('dist/assets/sounds/popcat');
            this.addWatchFile(popcatAudio);
            fs.mkdirSync(audioDestination, { recursive: true });
            fs.copyFileSync(popcatAudio, path.join(audioDestination, 'popcat-pop.mp3'));
            ['meme-skins', 'meme-skins/player', 'texts', 'font', 'weapons/rapid-laser', 'weapons/mubarak-barrels', 'weapons/mubarak-diamonds', 'weapons/wojak-red-candle', 'weapons/wojak-tear', 'weapons/popcat-corn', 'mini-boss/wojak', 'mini-boss/mubarak'].forEach(folder => {
                const source = path.resolve('assets', folder);
                const destination = path.resolve('dist/assets', folder);
                fs.mkdirSync(destination, { recursive: true });
                this.addWatchFile(source);
                fs.readdirSync(source).filter(name => name.endsWith('.png') &&
                    (folder !== 'mini-boss/mubarak' || /^mubarak-(act1-([1-6]-(left|right)|explosion-[1-5])|act2-1-(left|right)|cz-([1-3]-(left|right)|bnb-coin))\.png$/.test(name)) &&
                    (folder !== 'font' || /^nfd-font-[0-9ENTRFOLXCADIVSK]\.png$/.test(name))).forEach(name => {
                    const file = path.join(source, name);
                    this.addWatchFile(file);
                    fs.copyFileSync(file, path.join(destination, name));
                });
            });
        }
    };
}
