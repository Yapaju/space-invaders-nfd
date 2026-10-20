import { AssetType } from './assets';

// Retain the original PEPE frame for display size, formations and collision offsets.
export const InvaderCanvas = { width: 337, height: 282 };
export const PonkePoses = [
    { asset: AssetType.PonkeLeft, path: 'meme-skins/ponke-invader-left.png' },
    { asset: AssetType.PonkeRight, path: 'meme-skins/ponke-invader-right.png' }
];

export const PopcatPoses = [
    { asset: AssetType.PopcatLeft, path: 'meme-skins/popcat-invader-left.png' },
    { asset: AssetType.PopcatRight, path: 'meme-skins/popcat-invader-right.png' },
    { asset: AssetType.PopcatOpenLeft, path: 'meme-skins/popcat-invader-open-left.png' },
    { asset: AssetType.PopcatOpenRight, path: 'meme-skins/popcat-invader-open-right.png' }
];

export function prepareEnemySkins(scene: Phaser.Scene) {
    const frame = InvaderCanvas;
    PonkePoses.concat(PopcatPoses).forEach(pose => {
        if (scene.textures.exists(pose.asset)) {
            return;
        }
        if (!scene.textures.exists(`${pose.asset}-source`)) {
            throw new Error(`Missing invader texture: ${pose.path}`);
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
