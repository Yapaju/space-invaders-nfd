import { AssetType } from './assets';
import { WojakCandles } from './wojak-candles';
import { WojakTears } from './wojak-tears';
import { WojakCharts } from './wojak-charts';
import { WaveDirectorConfig } from './wave-director';

// Disabled by default; the production build additionally disallows this entry.
export const WojakDevelopment = { startAtEncounter: false };
export function shouldStartWojakTest(development: boolean) {
    return development && WojakDevelopment.startAtEncounter;
}

// Compatibility reference for the first milestone / development shortcut.
export const WOJAK_TRIGGER_AFTER_WAVE = WaveDirectorConfig.boss.interval;

export const WojakSettings = {
    afterWave: WOJAK_TRIGGER_AFTER_WAVE,
    displayScale: 0.22,
    patrolY: 255,
    patrolLeftX: 205,
    patrolRightX: 595,
    speed: 55,
    hoverAmplitude: 7,
    hoverFrequency: 0.5,
    entranceDuration: 1500,
    godCandleRiseDuration: 1200,
    godCandlePushDuration: 2000,
    godCandleSizeMultiplier: 0.5,
    prototypeEndPortfolio: -99.9,
    poseThreshold: 25,
    minus30PoseThreshold: -30,
    minus70PoseThreshold: -70,
    milestoneFlashDuration: 600,
    milestoneFlashOnDuration: 100,
    milestoneFlashOffDuration: 100,
    milestoneFlashTint: 0xff7777,
    hitboxWidth: 270,
    hitboxHeight: 82
};

// Relative to REKT; the existing candle rise/push durations stay independent.
export const WojakPumpSettings = {
    entranceDuration: 2000,
    dramaticPauseDuration: 650,
    bubblePopDuration: 250,
    commandHoldDuration: 1000,
    bubbleFadeDuration: 200,
    exitDuration: 500,
    characterScale: 0.5,
    bubbleScale: 0.5,
    leftMargin: 0.02,
    characterWidth: 0.48,
    characterMaxHeight: 0.48,
    visibleTorso: 0.86,
    bubbleWidth: 0.34,
    bubbleOffsetX: 0.16,
    bubbleBottomOffset: -0.04,
    depth: 100
};

// All positions below are source pixels on the 1536 x 1024 artwork canvas.
// Mirrored registration keeps the front panel anchored during reversals.
export const WojakLayers = {
    right: {
        ship: AssetType.WojakShipRight, character: AssetType.WojakCharacterRight,
        anchorX: 800, anchorY: 680,
        characterX: 0, characterY: 45, characterScale: 1,
        percentageX: 810, percentageY: 620, percentageAngle: 6
    },
    left: {
        ship: AssetType.WojakShipLeft, character: AssetType.WojakCharacterLeft,
        anchorX: 736, anchorY: 680,
        characterX: 0, characterY: 45, characterScale: 1,
        percentageX: 726, percentageY: 620, percentageAngle: -6
    }
};

// Measured source-art coordinates, not screen coordinates. Horizontal extents
// exclude the transparent ship canvas margin. Release from the solid hull's
// underside rather than from the much lower engine flames/glow.
export const WojakWeaponRegistration = {
    right: { shipLeft: 11, shipRight: 1528, undersideY: 900 },
    left: { shipLeft: 8, shipRight: 1525, undersideY: 900 },
    faces: {
        masked: { right: { x: 805, y: 260 }, left: { x: 731, y: 260 } },
        crying: { right: { x: 850, y: 260 }, left: { x: 686, y: 260 } }
    }
};

// Pose canvases register the head at the same cockpit position; the arms
// change without needing compensating translation or scaling.
export const Wojak25Poses = {
    right: { character: AssetType.WojakCharacter25Right, characterX: 0, characterY: 45, characterScale: 1 },
    left: { character: AssetType.WojakCharacter25Left, characterX: 0, characterY: 45, characterScale: 1 }
};

export const Wojak0Poses = {
    right: { character: AssetType.WojakCharacter0Right, characterX: 0, characterY: 45, characterScale: 1 },
    left: { character: AssetType.WojakCharacter0Left, characterX: 0, characterY: 45, characterScale: 1 }
};

export const WojakMinus30Poses = {
    right: { character: AssetType.WojakCharacterMinus30Right, characterX: 0, characterY: 45, characterScale: 1 },
    left: { character: AssetType.WojakCharacterMinus30Left, characterX: 0, characterY: 45, characterScale: 1 }
};

export const WojakMinus70Poses = {
    right: { character: AssetType.WojakCharacterMinus70Right, characterX: 0, characterY: 45, characterScale: 1 },
    left: { character: AssetType.WojakCharacterMinus70Left, characterX: 0, characterY: 45, characterScale: 1 }
};

export const WojakRektPoses = {
    right: { character: AssetType.WojakCharacterRektRight, characterX: 0, characterY: 45, characterScale: 1 },
    left: { character: AssetType.WojakCharacterRektLeft, characterX: 0, characterY: 45, characterScale: 1 }
};

const WojakFlashThresholds = [WojakSettings.poseThreshold, 0,
    WojakSettings.minus30PoseThreshold, WojakSettings.minus70PoseThreshold];

export const WojakLighting = {
    green: { right: AssetType.WojakLightsGreenRight, left: AssetType.WojakLightsGreenLeft },
    red: { right: AssetType.WojakLightsRedRight, left: AssetType.WojakLightsRedLeft }
};

export function formatWojakPortfolio(portfolio: number): string {
    return `${portfolio > 0 ? '+' : portfolio < 0 ? '−' : ''}${Math.abs(portfolio)}%`;
}

export const WojakVisualSettings = {
    canvasWidth: 1536,
    canvasHeight: 1024,
    cockpitRimY: 430,
    percentageFontSize: 96,
    percentageColor: '#63ff65',
    percentageStroke: '#126628',
    percentageGlow: '#27ff4b',
    percentageRedColor: '#ff5555',
    percentageRedStroke: '#781c25',
    percentageRedGlow: '#ff263f',
    percentageMaxWidth: 440,
    percentageGlowBlur: 12,
    percentagePadding: 18
};

export const WojakAssets = [
    { asset: AssetType.WojakPumpCharacter, path: 'mini-boss/wojak/wojak-bogdanoff.png' },
    { asset: AssetType.WojakPumpBubble, path: 'mini-boss/wojak/wojak-pump-it.png' },
    { asset: AssetType.WojakGodCandle, path: 'mini-boss/wojak/wojak-god-candle.png' },
    { asset: AssetType.WojakShipRight, path: 'mini-boss/wojak/wojak-boss-spaceship-right.png' },
    { asset: AssetType.WojakShipLeft, path: 'mini-boss/wojak/wojak-boss-spaceship-left.png' },
    { asset: AssetType.WojakCharacterRight, path: 'mini-boss/wojak/wojak-boss-50-right.png' },
    { asset: AssetType.WojakCharacterLeft, path: 'mini-boss/wojak/wojak-boss-50-left.png' },
    { asset: AssetType.WojakCharacter25Right, path: 'mini-boss/wojak/wojak-boss-25-right.png' },
    { asset: AssetType.WojakCharacter25Left, path: 'mini-boss/wojak/wojak-boss-25-left.png' },
    { asset: AssetType.WojakCharacter0Right, path: 'mini-boss/wojak/wojak-boss-0-right.png' },
    { asset: AssetType.WojakCharacter0Left, path: 'mini-boss/wojak/wojak-boss-0-left.png' },
    { asset: AssetType.WojakCharacterMinus30Right, path: 'mini-boss/wojak/wojak-boss--30-right.png' },
    { asset: AssetType.WojakCharacterMinus30Left, path: 'mini-boss/wojak/wojak-boss--30-left.png' },
    { asset: AssetType.WojakCharacterMinus70Right, path: 'mini-boss/wojak/wojak-boss--70-right.png' },
    { asset: AssetType.WojakCharacterMinus70Left, path: 'mini-boss/wojak/wojak-boss--70-left.png' },
    { asset: AssetType.WojakCharacterRektRight, path: 'mini-boss/wojak/wojak-boss-rekt-right.png' },
    { asset: AssetType.WojakCharacterRektLeft, path: 'mini-boss/wojak/wojak-boss-rekt-left.png' },
    { asset: AssetType.WojakLightsGreenRight, path: 'mini-boss/wojak/wojak-lights-green-right.png' },
    { asset: AssetType.WojakLightsGreenLeft, path: 'mini-boss/wojak/wojak-lights-green-left.png' },
    { asset: AssetType.WojakLightsRedRight, path: 'mini-boss/wojak/wojak-lights-red-right.png' },
    { asset: AssetType.WojakLightsRedLeft, path: 'mini-boss/wojak/wojak-lights-red-left.png' }
];

export enum WojakPhase { Entrance, Patrol, Complete, Removed }

export class WojakBoss {
    readonly candles: WojakCandles;
    readonly tears: WojakTears;
    sprite: Phaser.Physics.Arcade.Sprite;
    private character: Phaser.GameObjects.Image;
    private foreground: Phaser.GameObjects.Image;
    private lighting: Phaser.GameObjects.Image;
    private percentage: Phaser.GameObjects.Text;
    private charts: WojakCharts;
    private visualDirection = 0;
    private visualCharacter: AssetType;
    private visualLighting: AssetType;
    private flashElapsed = WojakSettings.milestoneFlashDuration;
    private pendingFlashes = 0;
    portfolio = 50;
    phase = WojakPhase.Removed;
    private direction = 1;
    private entranceElapsed = 0;
    private patrolElapsed = 0;
    private completionElapsed = 0;
    private entranceY = 0;
    private godCandle: Phaser.GameObjects.Image;
    private godCandleBody: Phaser.GameObjects.Image;
    private defeatY = 0;
    private candleContactY = 0;
    private defeatExitY = 0;
    private candleScale = 1;
    private pumpCharacter: Phaser.GameObjects.Image;
    private pumpBubble: Phaser.GameObjects.Image;

    constructor(private scene: Phaser.Scene) {
        this.candles = new WojakCandles(scene);
        this.tears = new WojakTears(scene);
    }

    weaponGeometry() {
        if (!this.sprite) return { candles: { left: 0, right: 0, y: 0 }, tears: { x: 0, y: 0 } };
        const direction = this.direction > 0 ? 'right' : 'left';
        const registration = WojakWeaponRegistration[direction];
        const pose = this.characterPose();
        const face = WojakWeaponRegistration.faces[this.portfolio <= WojakSettings.minus70PoseThreshold ? 'crying' : 'masked'][direction];
        const sx = this.sprite.scaleX, sy = this.sprite.scaleY;
        const left = this.sprite.x - this.sprite.displayOriginX * sx;
        const top = this.sprite.y - this.sprite.displayOriginY * sy;
        return {
            candles: { left: left + registration.shipLeft * sx,
                right: left + registration.shipRight * sx, y: top + registration.undersideY * sy },
            tears: { x: left + (pose.characterX + face.x * pose.characterScale) * sx,
                y: top + (pose.characterY + face.y * pose.characterScale) * sy }
        };
    }

    updateWeapons(delta: number, player: Phaser.Physics.Arcade.Sprite, damage: () => void) {
        const geometry = this.weaponGeometry();
        const enabled = () => this.shootingEnabled && !!this.sprite && this.sprite.active;
        this.candles.update(delta, this.portfolio, enabled(), geometry.candles, player, damage);
        // Candle damage can synchronously end the encounter; recheck the gate.
        this.tears.update(delta, this.portfolio, enabled(), geometry.tears, player, damage);
    }

    get shootingEnabled() { return this.phase === WojakPhase.Patrol; }

    start() {
        if (this.sprite) return;
        this.clear();
        this.sprite = this.scene.physics.add.sprite((WojakSettings.patrolLeftX + WojakSettings.patrolRightX) / 2,
            WojakSettings.patrolY, WojakLayers.right.ship);
        this.sprite.setImmovable(true).setDepth(2);
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.moves = false;
        body.allowGravity = false;
        this.charts = new WojakCharts(this.scene);
        this.character = this.scene.add.image(0, 0, WojakLayers.right.character).setDepth(3);
        this.foreground = this.scene.add.image(0, 0, WojakLayers.right.ship).setDepth(4);
        this.lighting = this.scene.add.image(0, 0, WojakLighting.green.right).setDepth(4.5);
        const visual = WojakVisualSettings;
        this.percentage = this.scene.add.text(0, 0, '+50%', {
            fontFamily: 'Arial, sans-serif', fontSize: visual.percentageFontSize,
            fontStyle: 'bold', color: visual.percentageColor,
            stroke: visual.percentageStroke, strokeThickness: 3,
            padding: { x: visual.percentagePadding, y: visual.percentagePadding }
        }).setOrigin(0.5).setDepth(5)
            .setShadow(0, 0, visual.percentageGlow, visual.percentageGlowBlur, true, true);
        this.updatePercentage();
        this.applyDirection();
        this.entranceY = this.scene.physics.world.bounds.top -
            (this.sprite.height - this.sprite.displayOriginY) * this.sprite.scaleY - 1;
        this.phase = WojakPhase.Entrance;
        this.sprite.y = this.entranceY;
        this.syncBody();
    }

    // Returns true once, only after the entire defeat cinematic has finished.
    update(delta: number): boolean {
        if (!this.sprite) return false;
        let elapsed = Math.max(0, delta);
        if (this.phase === WojakPhase.Complete) {
            this.completionElapsed += elapsed;
            return this.updateDefeat();
        }
        this.updateFlash(elapsed);
        if (this.charts) this.charts.history.update(elapsed);
        if (this.phase === WojakPhase.Entrance) {
            const step = Math.min(elapsed, WojakSettings.entranceDuration - this.entranceElapsed);
            this.entranceElapsed += step;
            elapsed -= step;
            const t = this.entranceElapsed / WojakSettings.entranceDuration;
            this.sprite.y = this.entranceY + (WojakSettings.patrolY - this.entranceY) * t * t * (3 - 2 * t);
            if (t < 1) { this.syncBody(); return false; }
            this.phase = WojakPhase.Patrol;
        }
        this.patrolElapsed += elapsed;
        let travel = WojakSettings.speed * elapsed / 1000;
        while (travel > 0) {
            const edge = this.direction > 0 ? WojakSettings.patrolRightX : WojakSettings.patrolLeftX;
            const distance = Math.abs(edge - this.sprite.x);
            const step = Math.min(travel, distance);
            this.sprite.x += this.direction * step;
            travel -= step;
            if (step === distance) this.direction *= -1;
        }
        this.sprite.y = WojakSettings.patrolY + WojakSettings.hoverAmplitude *
            Math.sin(this.patrolElapsed / 1000 * 2 * Math.PI * WojakSettings.hoverFrequency);
        this.syncBody();
        return false;
    }

    hit(): boolean {
        if (!this.shootingEnabled || !this.sprite || !this.sprite.active) return false;
        const previousPortfolio = this.portfolio;
        this.portfolio = Math.max(WojakSettings.prototypeEndPortfolio, previousPortfolio - 1);
        if (this.charts) this.charts.history.damage(this.portfolio);
        if (this.portfolio === WojakSettings.prototypeEndPortfolio) {
            this.beginDefeat();
            return true;
        }
        this.updatePercentage();
        this.syncLayers();
        // Range crossings also handle fractional values around a threshold.
        // Queue complete pulse sequences when thresholds arrive during a flash.
        const crossings = WojakFlashThresholds.filter(threshold => previousPortfolio > threshold && this.portfolio <= threshold).length;
        if (crossings) {
            this.pendingFlashes += crossings;
            if (this.flashElapsed >= WojakSettings.milestoneFlashDuration) {
                this.pendingFlashes--;
                this.flashElapsed = 0;
            }
            this.updateFlash(0);
        }
        return true;
    }

    // Complete gates damage, weapons, poses and lighting throughout the launch.
    private beginDefeat() {
        this.phase = WojakPhase.Complete;
        this.completionElapsed = 0;
        if (this.charts) this.charts.history.freeze();
        this.candles.clear();
        this.tears.clear();
        this.pendingFlashes = 0;
        this.updateFlash(WojakSettings.milestoneFlashDuration);
        this.updatePercentage();
        this.syncLayers();
        this.beginPump();
    }

    private beginPump() {
        this.pumpCharacter = this.scene.add.image(0, 0, AssetType.WojakPumpCharacter)
            .setOrigin(0.5, 0).setDepth(WojakPumpSettings.depth);
        this.pumpBubble = this.scene.add.image(0, 0, AssetType.WojakPumpBubble)
            .setDepth(WojakPumpSettings.depth + 1).setVisible(false);
        this.updatePump();
    }

    private clearPump() {
        if (this.pumpCharacter) this.pumpCharacter.destroy();
        if (this.pumpBubble) this.pumpBubble.destroy();
        this.pumpCharacter = this.pumpBubble = undefined;
    }

    private get pumpLaunchAt() {
        const settings = WojakPumpSettings;
        return settings.entranceDuration + settings.dramaticPauseDuration +
            settings.bubblePopDuration + settings.commandHoldDuration + settings.bubbleFadeDuration;
    }

    // Pure elapsed-time animation: no timers/tweens can outlive the encounter.
    private updatePump() {
        if (!this.pumpCharacter) return;
        const settings = WojakPumpSettings;
        const elapsed = this.completionElapsed;
        const bubbleAt = settings.entranceDuration + settings.dramaticPauseDuration;
        const fadeAt = bubbleAt + settings.bubblePopDuration + settings.commandHoldDuration;
        const exit = Math.max(0, Math.min(1, (elapsed - this.pumpLaunchAt) / settings.exitDuration));
        if (exit === 1) { this.clearPump(); return; }
        const bounds = this.scene.physics.world.bounds;
        const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
        const character = this.pumpCharacter, bubble = this.pumpBubble;
        const scale = Math.min(width * settings.characterWidth / character.width,
            height * settings.characterMaxHeight / character.height) * settings.characterScale;
        const finalY = bounds.bottom - character.height * scale * settings.visibleTorso;
        const entrance = Math.min(1, elapsed / settings.entranceDuration);
        const ease = 1 - Math.pow(1 - entrance, 3);
        const exitEase = exit * exit * (3 - 2 * exit);
        character.setScale(scale).setPosition(bounds.left + width * settings.leftMargin + character.width * scale / 2,
            bounds.bottom + (finalY - bounds.bottom) * ease + (bounds.bottom - finalY) * exitEase);
        // Destroy the bubble before launching the candle; the character exits independently.
        if (elapsed >= this.pumpLaunchAt) {
            if (bubble) bubble.destroy();
            this.pumpBubble = undefined;
            return;
        }
        const pop = Math.max(0, Math.min(1,
            (elapsed - bubbleAt) / settings.bubblePopDuration));
        const popScale = pop < 0.6 ? 0.7 + 0.4 * Math.sin(pop / 0.6 * Math.PI / 2) :
            1 + 0.1 * Math.cos((pop - 0.6) / 0.4 * Math.PI / 2);
        const bubbleScale = Math.min(width * settings.bubbleWidth / bubble.width,
            height * 0.3 / bubble.height) * settings.bubbleScale;
        const halfWidth = bubble.width * bubbleScale * 1.1 / 2;
        const halfHeight = bubble.height * bubbleScale * 1.1 / 2;
        const x = Math.max(bounds.left + halfWidth, Math.min(bounds.right - halfWidth,
            character.x + character.width * scale * settings.bubbleOffsetX));
        const y = Math.max(bounds.top + halfHeight, Math.min(bounds.bottom - halfHeight,
            finalY + character.height * scale * settings.bubbleBottomOffset - halfHeight));
        const fade = Math.max(0, Math.min(1, (elapsed - fadeAt) / settings.bubbleFadeDuration));
        bubble.setVisible(elapsed >= bubbleAt).setScale(bubbleScale * popScale)
            .setPosition(x, y).setAlpha(1 - fade);
    }

    private updateDefeat(): boolean {
        this.updatePump();
        const elapsed = this.completionElapsed - this.pumpLaunchAt;
        if (elapsed < 0) return false;
        const bounds = this.scene.physics.world.bounds;
        if (!this.godCandle) {
            this.defeatY = this.sprite.y;
            this.candleContactY = this.weaponGeometry().candles.y;
            this.defeatExitY = bounds.top -
                (WojakVisualSettings.canvasHeight - this.sprite.displayOriginY) * this.sprite.scaleY - 1;
            const finalTop = this.candleContactY + this.defeatExitY - this.defeatY;
            // Source PNG: flat top at y=134, continuous body through y=1536.
            // Keep the artwork proportional; the multiplier is relative to the
            // original full-size launch. Extend its last row below the artwork
            // when necessary, so a smaller size never exposes a lower edge.
            this.candleScale = Math.max(0.5, (bounds.bottom + 64 - finalTop) / (1536 - 134)) *
                WojakSettings.godCandleSizeMultiplier;
            const geometry = this.weaponGeometry().candles;
            this.godCandle = this.scene.add.image((geometry.left + geometry.right) / 2,
                bounds.bottom, AssetType.WojakGodCandle).setOrigin(0.5, 0)
                .setScale(this.candleScale).setDepth(1.9);
            this.godCandleBody = this.scene.add.image(this.godCandle.x, 0, AssetType.WojakGodCandle)
                .setOrigin(0.5, 1535 / 1536).setCrop(0, 1535, 1024, 1).setDepth(1.9);
        }
        const rise = Math.min(1, elapsed / WojakSettings.godCandleRiseDuration);
        const push = Math.min(1, Math.max(0, elapsed - WojakSettings.godCandleRiseDuration) /
            WojakSettings.godCandlePushDuration);
        this.sprite.y = this.defeatY + (this.defeatExitY - this.defeatY) * push;
        const top = bounds.bottom + (this.candleContactY - bounds.bottom) * rise +
            this.sprite.y - this.defeatY;
        this.godCandle.y = top - 134 * this.candleScale;
        // Reveal more original artwork as the top rises; the cropped lower edge
        // stays fixed below the screen. No physics body or player interaction.
        this.godCandle.setCrop(0, 0, 1024,
            Math.min(1535, (bounds.bottom + 32 - this.godCandle.y) / this.candleScale));
        const bodyTop = this.godCandle.y + 1535 * this.candleScale;
        this.godCandleBody.setPosition(this.godCandle.x, bodyTop)
            .setScale(this.candleScale, Math.max(this.candleScale, bounds.bottom + 32 - bodyTop));
        this.syncBody();
        if (push < 1) return false;
        this.remove();
        return true;
    }

    private applyDirection() {
        if (this.visualDirection === this.direction) return;
        this.visualDirection = this.direction;
        const layer = this.direction > 0 ? WojakLayers.right : WojakLayers.left;
        const visual = WojakVisualSettings;
        const scale = WojakSettings.displayScale;
        this.sprite.setTexture(layer.ship).setScale(scale)
            .setOrigin(layer.anchorX / visual.canvasWidth, layer.anchorY / visual.canvasHeight);
        // Split the ship without double drawing its translucent pixels.
        this.sprite.setCrop(0, 0, visual.canvasWidth, visual.cockpitRimY);
        this.foreground.setTexture(layer.ship).setScale(scale).setOrigin(this.sprite.originX, this.sprite.originY)
            .setCrop(0, visual.cockpitRimY, visual.canvasWidth, visual.canvasHeight - visual.cockpitRimY);
        this.percentage.setAngle(layer.percentageAngle);
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.updateBounds();
        body.setSize(WojakSettings.hitboxWidth / scale, WojakSettings.hitboxHeight / scale, false);
        body.setOffset(layer.anchorX - WojakSettings.hitboxWidth / scale / 2,
            layer.anchorY - WojakSettings.hitboxHeight / scale / 2);
    }

    private characterPose() {
        const direction = this.direction > 0 ? 'right' : 'left';
        if (this.phase === WojakPhase.Complete) return WojakRektPoses[direction];
        // Check from lowest to highest: the clamped fractional endpoint stays
        // in the -70% pose, without integer casts or equality comparisons.
        if (this.portfolio <= WojakSettings.minus70PoseThreshold) return WojakMinus70Poses[direction];
        if (this.portfolio <= WojakSettings.minus30PoseThreshold) return WojakMinus30Poses[direction];
        if (this.portfolio <= 0) return Wojak0Poses[direction];
        return this.portfolio <= WojakSettings.poseThreshold ? Wojak25Poses[direction] : WojakLayers[direction];
    }

    private updatePercentage() {
        const visual = WojakVisualSettings;
        const red = this.portfolio <= 0;
        const defeated = this.phase === WojakPhase.Complete;
        this.percentage.setText(defeated ? 'REKT' : formatWojakPortfolio(this.portfolio))
            .setColor(red ? visual.percentageRedColor : visual.percentageColor)
            .setStroke(red ? visual.percentageRedStroke : visual.percentageStroke, 3)
            .setShadow(0, 0, red ? visual.percentageRedGlow : visual.percentageGlow,
                defeated ? 0 : visual.percentageGlowBlur, !defeated, !defeated);
        // Keep placement/perspective; only shrink values that need extra room.
        this.percentage.setScale(WojakSettings.displayScale *
            Math.min(1, visual.percentageMaxWidth / this.percentage.width));
    }

    private applyLighting() {
        this.lighting.setVisible(this.phase !== WojakPhase.Complete);
        this.lighting.setOrigin(this.sprite.originX, this.sprite.originY).setScale(WojakSettings.displayScale)
            .setPosition(this.sprite.x, this.sprite.y);
        if (this.phase === WojakPhase.Complete) return;
        const direction = this.direction > 0 ? 'right' : 'left';
        const key = WojakLighting[this.portfolio > 0 ? 'green' : 'red'][direction];
        if (this.visualLighting !== key) {
            this.lighting.setTexture(key);
            this.visualLighting = key;
        }
    }

    private applyCharacterPose() {
        const pose = this.characterPose();
        if (this.visualCharacter === pose.character) return;
        this.visualCharacter = pose.character;
        this.character.setTexture(pose.character).setOrigin(0, 0)
            .setScale(WojakSettings.displayScale * pose.characterScale)
            .setCrop(0, 0, WojakVisualSettings.canvasWidth,
                (WojakVisualSettings.cockpitRimY - pose.characterY) / pose.characterScale);
    }

    // Three distinct 100ms ON / 100ms OFF pulses; no combat gates or timers.
    private updateFlash(delta: number) {
        if (this.flashElapsed >= WojakSettings.milestoneFlashDuration) return;
        this.flashElapsed += Math.max(0, delta);
        while (this.flashElapsed >= WojakSettings.milestoneFlashDuration && this.pendingFlashes > 0) {
            this.flashElapsed -= WojakSettings.milestoneFlashDuration;
            this.pendingFlashes--;
        }
        this.flashElapsed = Math.min(WojakSettings.milestoneFlashDuration, this.flashElapsed);
        const layers = [this.sprite, this.character, this.foreground];
        const cycle = WojakSettings.milestoneFlashOnDuration + WojakSettings.milestoneFlashOffDuration;
        if (this.flashElapsed === WojakSettings.milestoneFlashDuration ||
            this.flashElapsed % cycle >= WojakSettings.milestoneFlashOnDuration) {
            layers.forEach(layer => layer.clearTint());
            return;
        }
        layers.forEach(layer => layer.setTint(WojakSettings.milestoneFlashTint));
    }

    // One logical boss owns every layer; only the ship has an Arcade body.
    private syncLayers() {
        this.applyDirection();
        this.applyCharacterPose();
        this.applyLighting();
        const pose = this.characterPose();
        const layer = this.direction > 0 ? WojakLayers.right : WojakLayers.left;
        const scale = WojakSettings.displayScale;
        const left = this.sprite.x - layer.anchorX * scale;
        const top = this.sprite.y - layer.anchorY * scale;
        if (this.charts) this.charts.sync(left, top, scale, this.direction > 0 ? 'right' : 'left');
        this.foreground.setPosition(this.sprite.x, this.sprite.y);
        this.character.setPosition(left + pose.characterX * scale, top + pose.characterY * scale);
        this.percentage.setPosition(left + layer.percentageX * scale, top + layer.percentageY * scale);
    }

    private syncBody() {
        this.syncLayers();
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.reset(this.sprite.x, this.sprite.y);
        body.preUpdate(false, 0);
    }

    private remove() {
        this.clearPump();
        if (this.godCandle) this.godCandle.destroy();
        if (this.godCandleBody) this.godCandleBody.destroy();
        this.godCandle = undefined;
        this.godCandleBody = undefined;
        this.defeatY = this.candleContactY = this.defeatExitY = 0;
        if (this.charts) this.charts.destroy();
        this.charts = undefined;
        this.candles.clear();
        this.tears.clear();
        if (this.sprite) this.sprite.destroy();
        if (this.character) this.character.destroy();
        if (this.foreground) this.foreground.destroy();
        if (this.percentage) this.percentage.destroy();
        if (this.lighting) this.lighting.destroy();
        this.character = this.foreground = undefined;
        this.percentage = undefined;
        this.lighting = undefined;
        this.visualDirection = 0;
        this.visualCharacter = this.visualLighting = undefined;
        this.flashElapsed = WojakSettings.milestoneFlashDuration;
        this.pendingFlashes = 0;
        this.sprite = undefined;
        this.phase = WojakPhase.Removed;
    }

    clear() {
        this.remove();
        this.portfolio = 50;
        this.direction = 1;
        this.entranceElapsed = this.patrolElapsed = this.completionElapsed = 0;
    }
}
