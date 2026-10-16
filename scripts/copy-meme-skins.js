import fs from 'fs';
import path from 'path';

// Both Rollup builds serve/package dist; keep root artwork as the source of truth.
export default function copyMemeSkins() {
    return {
        name: 'copy-meme-skins',
        buildStart() {
            const source = path.resolve('assets/meme-skins');
            const destination = path.resolve('dist/assets/meme-skins');
            fs.mkdirSync(destination, { recursive: true });
            this.addWatchFile(source);
            fs.readdirSync(source).filter(name => name.endsWith('.png')).forEach(name => {
                const file = path.join(source, name);
                this.addWatchFile(file);
                fs.copyFileSync(file, path.join(destination, name));
            });
        }
    };
}
