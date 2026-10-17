import { AssetType } from './assets';

export const PonkePoses = [
    { asset: AssetType.PonkeLeft, path: 'meme-skins/ponke-invader-left.png' },
    { asset: AssetType.PonkeRight, path: 'meme-skins/ponke-invader-right.png' }
];

export function prepareEnemySkins(scene: Phaser.Scene) {
    const frame = scene.textures.getFrame(AssetType.Alien);
    PonkePoses.forEach(pose => {
        if (scene.textures.exists(pose.asset)) {
            return;
        }
        if (!scene.textures.exists(`${pose.asset}-source`)) {
            throw new Error(`Missing PONKE texture: ${pose.path}`);
        }
        const image = scene.textures.get(`${pose.asset}-source`).getSourceImage() as HTMLImageElement;
        // Fit the complete, unflipped artwork on PEPE's canvas. Matching frame
        // dimensions keeps formation bounds and physics identical for both types.
        const scale = Math.min(frame.width / image.width, frame.height / image.height);
        const width = image.width * scale, height = image.height * scale;
        const texture = scene.textures.createCanvas(pose.asset, frame.width, frame.height);
        texture.context.drawImage(image, (frame.width - width) / 2, (frame.height - height) / 2, width, height);
        texture.refresh();
    });
}
