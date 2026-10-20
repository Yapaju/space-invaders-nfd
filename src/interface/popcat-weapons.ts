import { AssetType } from './assets';
import { Alien } from './alien';
import { EnemyBullet } from './enemy-bullet';
import { InvaderCanvas } from './enemy-skins';
import { visibleImageBounds } from './skins';
import { FORMATION_LOWEST_START_Y } from './wave-config';
import { playPopcatSound } from './popcat-audio';

// Sizes, speeds and accelerations use logical world pixels (800x600), seconds;
// rotation uses degrees and animation/cooldown durations use milliseconds.
// Display size is the longest side of the tightly fitted artwork, not PNG padding.
export const PopcornSettings = {
    shotgunProbability: 0.8,
    // All five horizontal speeds point forward; mirror the entire fan on reversal.
    fanVelocities: [12, 30, 48, 66, 84],
    upwardSpeed: 220,
    downwardAcceleration: 620,
    descentSpeed: 140,
    retryMs: 250,
    regularSize: 18,
    regularHitRadius: 6,
    randomRotation: 18,
    kernelSize: 10,
    kernelForwardSpeed: 48,
    kernelApexClearance: 12,
    kernelHitRadius: 3,
    giantStartSize: 18,
    giantSize: 64 * 1.3,
    giantHitRadius: 24 * 1.3,
    growthMs: 140,
    warningMs: 180,
    textureSize: 128,
    sourceWidth: 1536,
    sourceHeight: 1024,
    mouthLeft: { x: 540, y: 330 },
    mouthRight: { x: 997, y: 330 }
};

export const PopcornAssets = [
    { asset: AssetType.Popcorn, path: 'weapons/popcat-corn/popcat-popcorn.png' },
    { asset: AssetType.Popcorn2, path: 'weapons/popcat-corn/popcat-popcorn-2.png' },
    { asset: AssetType.PopcornGiant, path: 'weapons/popcat-corn/popcat-popcorn-giant.png' },
    { asset: AssetType.PopcornKernel, path: 'weapons/popcat-corn/popcat-popcorn-kernel.png' }
];

// Normalize transparent padding only in runtime textures. Original PNGs remain
// intact; one square frame keeps origin and body registration stable on POP.
export function preparePopcornSkins(scene: Phaser.Scene) {
    const scratch = document.createElement('canvas');
    PopcornAssets.forEach(pose => {
        if (scene.textures.exists(pose.asset)) return;
        const image = scene.textures.get(`${pose.asset}-source`).getSourceImage() as HTMLImageElement;
        scratch.width = image.width; scratch.height = image.height;
        const context = scratch.getContext('2d');
        context.drawImage(image, 0, 0);
        const bounds = visibleImageBounds(context.getImageData(0, 0, image.width, image.height).data,
            image.width, image.height);
        const size = PopcornSettings.textureSize;
        const scale = size / Math.max(bounds.width, bounds.height);
        const width = bounds.width * scale, height = bounds.height * scale;
        const texture = scene.textures.createCanvas(pose.asset, size, size);
        texture.context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height,
            (size - width) / 2, (size - height) / 2, width, height);
        texture.refresh();
    });
}

export function popcatMouthPosition(alien: Alien) {
    // Each static texture includes the pose name, including while mouth-open.
    const mouth = alien.texture.key.indexOf('left') >= 0 ? PopcornSettings.mouthLeft : PopcornSettings.mouthRight;
    const fit = Math.min(InvaderCanvas.width / PopcornSettings.sourceWidth,
        InvaderCanvas.height / PopcornSettings.sourceHeight);
    const x = (InvaderCanvas.width - PopcornSettings.sourceWidth * fit) / 2 + mouth.x * fit;
    const y = (InvaderCanvas.height - PopcornSettings.sourceHeight * fit) / 2 + mouth.y * fit;
    return { x: alien.x + (x - alien.displayOriginX) * alien.scaleX,
        y: alien.y + (y - alien.displayOriginY) * alien.scaleY };
}

// Give a low-flying emitter enough lift to cross the fixed reference line on
// descent too. Normal starting rows all use the same 220 px/s upward launch.
export function popcatKernelUpwardSpeed(mouthY: number) {
    const s = PopcornSettings;
    return Math.max(s.upwardSpeed, Math.sqrt(2 * s.downwardAcceleration *
        Math.max(0, mouthY - FORMATION_LOWEST_START_Y + s.kernelApexClearance)));
}

export function canPopcatFire(alien: Alien, bounds: Phaser.Geom.Rectangle) {
    const s = PopcornSettings, mouth = popcatMouthPosition(alien);
    const direction = alien.texture.key.indexOf('left') >= 0 ? -1 : 1;
    // x(apex) = x(mouth) + vx * |vy| / gravity. Include each sprite's half-size.
    const paths = s.fanVelocities.map(vx => ({ vx, vy: s.upwardSpeed, half: s.regularSize / 2 }));
    paths.push({ vx: s.kernelForwardSpeed, vy: popcatKernelUpwardSpeed(mouth.y), half: s.kernelSize / 2 });
    return paths.every(path => {
        const apexX = mouth.x + direction * path.vx * path.vy / s.downwardAcceleration;
        const apexY = mouth.y - path.vy * path.vy / (2 * s.downwardAcceleration);
        return Math.min(mouth.x, apexX) - path.half >= bounds.left &&
            Math.max(mouth.x, apexX) + path.half <= bounds.right && apexY - path.half >= bounds.top;
    });
}

export class PopcornProjectile extends EnemyBullet {
    private special = false;
    private transformed = false;
    private growthElapsed = 0;

    get damage(): number { return this.transformed ? 2 : 1; }

    launch(x: number, y: number, vx: number, vy: number, texture: AssetType) {
        const settings = PopcornSettings;
        this.special = texture === AssetType.PopcornKernel;
        this.transformed = false; this.growthElapsed = 0;
        this.setTexture(texture).setOrigin(0.5).setPosition(x, y);
        this.setAngle(Phaser.Math.RND.realInRange(-settings.randomRotation, settings.randomRotation));
        this.resize(this.special ? settings.kernelSize : settings.regularSize,
            this.special ? settings.kernelHitRadius : settings.regularHitRadius);
        (this.body as Phaser.Physics.Arcade.Body).preUpdate(false, 0);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.allowGravity = false;
        body.setAcceleration(0, settings.downwardAcceleration);
        this.setVelocity(vx, vy);
        return this;
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        if (!this.active) return;
        const settings = PopcornSettings;
        const body = this.body as Phaser.Physics.Arcade.Body;
        // Arcade integrates acceleration using physics delta time. Only descent
        // gets air resistance: acceleration remains continuous through the apex,
        // then approaches a 140 px/s terminal speed without a velocity snap.
        body.setAcceleration(0, settings.downwardAcceleration *
            (1 - Math.min(1, Math.max(0, body.velocity.y) / settings.descentSpeed)));
        if (!this.special) return;
        let warningStarted = false;
        if (!this.transformed && body.velocity.y > 0 && this.y >= FORMATION_LOWEST_START_Y) {
            this.transformed = true;
            this.setTexture(AssetType.PopcornGiant);
            playPopcatSound(this.scene, true);
            warningStarted = true;
        }
        if (!this.transformed) return;
        // Do not charge the triggering frame's delta against a warning that
        // has only just appeared. Even a long frame cannot skip the warning.
        if (!warningStarted) this.growthElapsed += Math.max(0, delta);
        const t = Math.min(1, this.growthElapsed / settings.growthMs);
        const ease = 1 - Math.pow(1 - t, 3);
        const size = settings.giantStartSize + (settings.giantSize - settings.giantStartSize) * ease;
        this.resize(size, this.growthElapsed < settings.warningMs ?
            settings.kernelHitRadius : settings.giantHitRadius);
    }

    private resize(size: number, radius: number) {
        this.setDisplaySize(size, size);
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.updateBounds();
        const sourceRadius = radius / this.scaleX;
        // Phaser 3.22 floors the world-space circle half-width. Compensate its
        // subpixel rounding so the 31.2px giant body stays centered on the art.
        body.setCircle(sourceRadius, this.width / 2 - Math.floor(radius) / this.scaleX,
            this.height / 2 - Math.floor(radius) / this.scaleY);
        // preUpdate runs before Arcade integrates: updateBounds on the next
        // physics step syncs scale/offset without disturbing position/velocity.
    }

    update() {
        const bounds = this.scene.physics.world.bounds, visible = this.getBounds();
        if (visible.right < bounds.left || visible.left > bounds.right ||
            visible.bottom < bounds.top || visible.top > bounds.bottom) this.kill();
    }
}

export function firePopcatAttack(scene: Phaser.Scene, group: Phaser.Physics.Arcade.Group,
    alien: Alien, _player: Phaser.Physics.Arcade.Sprite): boolean {
    if (!canPopcatFire(alien, scene.physics.world.bounds)) return false;
    alien.pop(); // Open only after the clearance check accepts an actual attack.
    playPopcatSound(scene);
    const settings = PopcornSettings, mouth = popcatMouthPosition(alien);
    const direction = alien.texture.key.indexOf('left') >= 0 ? -1 : 1;
    const spawn = (vx: number, upwardSpeed: number, texture: AssetType) => {
        const projectile = new PopcornProjectile(scene);
        scene.add.existing(projectile);
        group.add(projectile);
        projectile.launch(mouth.x, mouth.y, direction * vx, -upwardSpeed, texture);
    };
    if (Phaser.Math.RND.frac() < settings.shotgunProbability) {
        settings.fanVelocities.forEach(vx => {
            const texture = Phaser.Math.RND.frac() < 0.5 ? AssetType.Popcorn : AssetType.Popcorn2;
            spawn(vx, settings.upwardSpeed, texture);
        });
    } else {
        spawn(settings.kernelForwardSpeed, popcatKernelUpwardSpeed(mouth.y), AssetType.PopcornKernel);
    }
    return true;
}
