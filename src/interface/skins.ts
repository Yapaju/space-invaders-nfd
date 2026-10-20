import { AssetType } from './assets';

export interface SkinDefinition {
    asset: AssetType;
    path: string;
    displayWidth: number;
    originX: number;
    originY: number;
    // Collision rectangle in original PNG pixels, excluding padding/effects.
    hitbox: { x: number; y: number; width: number; height: number };
    shootingPoses?: { idle: AssetType; left: AssetType; right: AssetType };
}

export const PlayerVisualScale = 1.4;

export const MemeSkins: { Player: SkinDefinition; Invader: SkinDefinition } = {
    Player: {
        asset: AssetType.Ship,
        path: 'meme-skins/player/gundam-purple-player.png',
        displayWidth: 52 * PlayerVisualScale,
        originX: 190 / 335, originY: 0.45,
        hitbox: { x: 100, y: 42, width: 180, height: 195 },
        shootingPoses: { idle: AssetType.ShipShooting,
            left: AssetType.ShipLeftShooting, right: AssetType.ShipRightShooting }
    },
    Invader: {
        asset: AssetType.Alien,
        path: 'meme-skins/pepe-invader-right.png',
        displayWidth: 48 * 1.4 * 1.30,
        originX: 0.5, originY: 0.5,
        hitbox: { x: 45, y: 25, width: 247, height: 210 }
    }
};

// Keep texture coordinates and the existing hitbox independent of PNG resolution.
export const PlayerCanvas = { width: 335, height: 320 };

export const PlayerPoses: { asset: AssetType; path: string; optional?: boolean }[] = [
    { asset: AssetType.Ship, path: 'meme-skins/player/gundam-purple-player.png' },
    {
        asset: AssetType.ShipLeft, path: 'meme-skins/player/gundam-purple-player-left.png'
    },
    {
        asset: AssetType.ShipRight, path: 'meme-skins/player/gundam-purple-player-right.png'
    },
    // Reuse the movement art during the existing brief reversal state.
    {
        asset: AssetType.ShipTurnLeft, path: 'meme-skins/player/gundam-purple-player-left.png'
    },
    {
        asset: AssetType.ShipTurnRight, path: 'meme-skins/player/gundam-purple-player-right.png'
    },
    {
        asset: AssetType.ShipShooting, path: 'meme-skins/player/gundam-purple-player-shooting.png', optional: true
    },
    {
        asset: AssetType.ShipLeftShooting, path: 'meme-skins/player/gundam-purple-player-left-shooting.png', optional: true
    },
    {
        asset: AssetType.ShipRightShooting, path: 'meme-skins/player/gundam-purple-player-right-shooting.png', optional: true
    }
];

export function visibleImageBounds(data: Uint8ClampedArray, width: number, height: number) {
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Ignore almost-transparent glow so padding cannot shrink the character.
            if (data[(y * width + x) * 4 + 3] >= 32) {
                left = Math.min(left, x); top = Math.min(top, y);
                right = Math.max(right, x); bottom = Math.max(bottom, y);
            }
        }
    }
    if (right < left) {
        throw new Error('DOGE pose has no visible artwork');
    }
    return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function preparePlayerPoses(scene: Phaser.Scene) {
    const scratch = document.createElement('canvas');
    PlayerPoses.forEach(pose => {
        if (scene.textures.exists(pose.asset)) {
            return;
        }
        if (!scene.textures.exists(`${pose.asset}-source`)) {
            if (pose.optional) return; // Skins without shooting art keep their normal poses.
            throw new Error(`Missing DOGE pose texture: ${pose.path}`);
        }
        const image = scene.textures.get(`${pose.asset}-source`).getSourceImage() as HTMLImageElement;
        scratch.width = image.width;
        scratch.height = image.height;
        const context = scratch.getContext('2d');
        context.drawImage(image, 0, 0);
        const s = visibleImageBounds(context.getImageData(0, 0, image.width, image.height).data, image.width, image.height);
        const skin = MemeSkins.Player;
        // Fit the visible art around the same anchor, retaining its aspect ratio.
        const maxWidth = 2 * Math.min(skin.originX, 1 - skin.originX) * PlayerCanvas.width;
        const scale = Math.min(maxWidth / s.width, PlayerCanvas.height * 0.9 / s.height);
        const width = s.width * scale, height = s.height * scale;
        const x = skin.originX * PlayerCanvas.width - width / 2;
        const y = skin.originY * (PlayerCanvas.height - height);
        const texture = scene.textures.createCanvas(pose.asset, PlayerCanvas.width, PlayerCanvas.height);
        texture.context.drawImage(image, s.x, s.y, s.width, s.height, x, y, width, height);
        texture.refresh();
    });
}

export function applySkinAppearance(sprite: Phaser.GameObjects.Sprite, skin: SkinDefinition, width = skin.displayWidth) {
    sprite.setOrigin(skin.originX, skin.originY);
    sprite.setDisplaySize(width, width * sprite.height / sprite.width);
}

export function applySkin(sprite: Phaser.Physics.Arcade.Sprite, skin: SkinDefinition) {
    applySkinAppearance(sprite, skin);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(skin.hitbox.width, skin.hitbox.height, false);
    body.setOffset(skin.hitbox.x, skin.hitbox.y);
    body.preUpdate(false, 0);
}
