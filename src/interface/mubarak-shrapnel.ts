import { BananaBombs } from './banana-bomb';
import { EnemyBulletSettings } from './enemy-bullet';
import { AnimationType } from './factory/animation-factory';
import { Kaboom } from './kaboom';
import { MubarakRect, circleOverlapsRect, rectsOverlap } from './mubarak-barrels';

export type DiamondKind = 'gold' | 'black' | 'red';
export const MubarakDiamondAssets = ['gold', 'black', 'red'].map(kind => ({
    key: `mubarak-diamond-${kind}`, path: `weapons/mubarak-diamonds/mubarak-diamond-${kind}.png`
}));
export const MubarakShrapnelSettings = {
    counts: { gold: 70, black: 15, red: 15 },
    goldPoints: 200, displayWidth: 39, hitboxRatio: 0.8,
    releaseWindowMs: 240, originSpread: 20, stepMs: 1000 / 120,
    spreadTimeMs: 1000, spreadHeightRatio: 0.85,
    fallSpeed: EnemyBulletSettings.speed * 0.70, gravity: 240, horizontalDrag: 1.6,
    redBlastRadius: 140
};

interface Fragment {
    kind: DiamondKind; sprite: Phaser.GameObjects.Sprite; vx: number; vy: number;
}
interface Effect { sprite: Kaboom; elapsed: number; duration: number; }

// Encounter-owned clocks and sprites; no timers or persistent Arcade colliders.
export class MubarakShrapnel {
    readonly flights: Fragment[] = [];
    readonly effects: Effect[] = [];
    emitted = 0;
    private queue: DiamondKind[] = [];
    private origin = { x: 0, y: 0 };
    private targets: { x: number; y: number }[] = [];
    private elapsed = 0;
    private accumulator = 0;
    private active = false;
    private impacts: BananaBombs;
    private damagePlayer: () => void;

    constructor(private scene: Phaser.Scene, private random: () => number,
        private awardScore: (points: number) => void) {
        this.impacts = new BananaBombs(scene, undefined, () => { if (this.damagePlayer) this.damagePlayer(); });
    }
    begin(x: number, y: number) {
        this.clear();
        this.active = true;
        this.emitted = this.elapsed = this.accumulator = 0;
        this.origin = { x, y };
        const counts = MubarakShrapnelSettings.counts;
        (['gold', 'black', 'red'] as DiamondKind[]).forEach(kind => {
            for (let i = 0; i < counts[kind]; i++) this.queue.push(kind);
        });
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1)), kind = this.queue[i];
            this.queue[i] = this.queue[j]; this.queue[j] = kind;
        }
        const c = MubarakShrapnelSettings, world = this.scene.physics.world.bounds;
        const half = c.displayWidth / 2, count = this.queue.length;
        // Jittered horizontal strata cover the whole width; independent random Y
        // and shuffled release order prevent a grid or a diagonal stream.
        for (let i = 0; i < count; i++) this.targets.push({
            x: world.left + half + (i + this.random()) / count * (world.width - 2 * half),
            y: world.top + half + this.random() * (world.height * c.spreadHeightRatio - 2 * half)
        });
        for (let i = count - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1)), target = this.targets[i];
            this.targets[i] = this.targets[j]; this.targets[j] = target;
        }
        this.emitDue();
    }
    get readyForBarrels() {
        const world = this.scene.physics.world.bounds;
        const threshold = world.top + world.height * 2 / 3;
        return this.emitted >= this.queue.length && this.flights.every(f => f.sprite.y >= threshold);
    }
    private emitDue() {
        const c = MubarakShrapnelSettings;
        while (this.emitted < this.queue.length &&
            this.elapsed + 1e-7 >= this.emitted * c.releaseWindowMs / (this.queue.length - 1)) {
            const target = this.targets[this.emitted], kind = this.queue[this.emitted++];
            const sprite = this.scene.add.sprite(this.origin.x + (this.random() - 0.5) * c.originSpread,
                this.origin.y + (this.random() - 0.5) * c.originSpread, `mubarak-diamond-${kind}`)
                .setOrigin(0.5).setDepth(12);
            sprite.setScale(c.displayWidth / sprite.width);
            // Solve the existing damped movement for a screen-wide burst roughly
            // one second after launch. Fragments still physically leave the origin.
            const seconds = c.spreadTimeMs / 1000, settleRate = c.gravity / c.fallSpeed;
            const vx = (target.x - sprite.x) * c.horizontalDrag / (1 - Math.exp(-c.horizontalDrag * seconds));
            const vy = c.fallSpeed + (target.y - sprite.y - c.fallSpeed * seconds) * settleRate /
                (1 - Math.exp(-settleRate * seconds));
            this.flights.push({ kind, sprite, vx, vy });
        }
    }
    bounds(fragment: Fragment): MubarakRect {
        const width = fragment.sprite.displayWidth * MubarakShrapnelSettings.hitboxRatio;
        const height = fragment.sprite.displayHeight * MubarakShrapnelSettings.hitboxRatio;
        return { x: fragment.sprite.x - width / 2, y: fragment.sprite.y - height / 2, width, height };
    }
    step(delta: number, player?: Phaser.Physics.Arcade.Sprite, damagePlayer?: () => void) {
        if (!this.active) return;
        this.damagePlayer = damagePlayer;
        this.accumulator += Math.max(0, delta);
        const c = MubarakShrapnelSettings, step = c.stepMs, seconds = step / 1000;
        const drag = Math.exp(-c.horizontalDrag * seconds), world = this.scene.physics.world.bounds;
        const settleRate = c.gravity / c.fallSpeed, settle = Math.exp(-settleRate * seconds);
        while (this.active && this.accumulator + 1e-7 >= step) {
            this.accumulator = Math.max(0, this.accumulator - step);
            this.elapsed += step;
            for (let i = this.flights.length - 1; i >= 0; i--) {
                const f = this.flights[i], sprite = f.sprite, oldY = sprite.y;
                sprite.x += f.vx * (1 - drag) / c.horizontalDrag;
                f.vx *= drag;
                sprite.y += c.fallSpeed * seconds + (f.vy - c.fallSpeed) * (1 - settle) / settleRate;
                f.vy = c.fallSpeed + (f.vy - c.fallSpeed) * settle;
                const half = sprite.displayWidth / 2;
                if (sprite.x < world.left + half) { sprite.x = world.left + half; f.vx = Math.abs(f.vx) * 0.5; }
                if (sprite.x > world.right - half) { sprite.x = world.right - half; f.vx = -Math.abs(f.vx) * 0.5; }
                if (sprite.y < world.top + half) { sprite.y = world.top + half; f.vy = Math.abs(f.vy) * 0.5; }
                if (f.kind === 'black' && player && sprite.y >= player.y) {
                    const fraction = Math.max(0, Math.min(1, (player.y - oldY) / (sprite.y - oldY || 1)));
                    this.impacts.impact(sprite.x, player.y, this.elapsed - step * (1 - fraction));
                    this.remove(f);
                } else if (f.kind === 'black' && player && player.active &&
                    rectsOverlap(this.bounds(f), player.body as Phaser.Physics.Arcade.Body)) {
                    this.impacts.impact(sprite.x, sprite.y, this.elapsed);
                    this.remove(f);
                } else if (sprite.y - sprite.displayHeight / 2 > world.bottom) this.remove(f);
            }
            // Chain blasts have a visual lifetime; radial destruction happens once at detonation.
            for (let i = this.effects.length - 1; i >= 0; i--) {
                const effect = this.effects[i];
                effect.elapsed += step;
                if (effect.elapsed + 1e-7 >= effect.duration) {
                    effect.sprite.destroy(); this.effects.splice(i, 1);
                } else {
                    const animation = effect.sprite.anims.currentAnim;
                    effect.sprite.anims.setCurrentFrame(animation.frames[Math.min(animation.frames.length - 1,
                        Math.floor(effect.elapsed / animation.msPerFrame))]);
                }
            }
            this.emitDue();
            if (player) this.impacts.update(player, this.elapsed);
        }
    }
    tryShoot(body: MubarakRect): boolean {
        const fragment = this.flights.find(f => f.kind !== 'black' && rectsOverlap(this.bounds(f), body));
        if (!fragment) return false;
        if (fragment.kind === 'gold') {
            this.remove(fragment);
            this.awardScore(MubarakShrapnelSettings.goldPoints);
        } else this.detonate(fragment);
        return true;
    }
    private detonate(first: Fragment) {
        const pending = [{ x: first.sprite.x, y: first.sprite.y }];
        this.remove(first);
        const radius = MubarakShrapnelSettings.redBlastRadius;
        for (let cursor = 0; cursor < pending.length; cursor++) {
            const center = pending[cursor], sprite = new Kaboom(this.scene);
            this.scene.add.existing(sprite);
            // The existing fireball occupies about 96px of each 128px frame.
            sprite.setPosition(center.x, center.y).setScale(radius * 2 / 96).setDepth(13);
            sprite.play(AnimationType.PonkeExplosion); sprite.anims.pause();
            this.effects.push({ sprite, elapsed: 0, duration: sprite.anims.currentAnim.duration });
            for (let i = this.flights.length - 1; i >= 0; i--) {
                const f = this.flights[i];
                if (!circleOverlapsRect(center.x, center.y, radius, this.bounds(f))) continue;
                const kind = f.kind;
                if (kind === 'red') pending.push({ x: f.sprite.x, y: f.sprite.y });
                this.remove(f); // Remove before scoring/queuing: each diamond is processed once.
                if (kind === 'gold') this.awardScore(MubarakShrapnelSettings.goldPoints);
            }
        }
    }
    private remove(fragment: Fragment) {
        const index = this.flights.indexOf(fragment);
        if (index < 0) return;
        this.flights.splice(index, 1); fragment.sprite.destroy();
    }
    clear() {
        this.active = false;
        this.flights.forEach(f => f.sprite.destroy()); this.flights.length = 0;
        this.effects.forEach(effect => effect.sprite.destroy()); this.effects.length = 0;
        this.impacts.clear(); this.queue = []; this.targets = [];
    }
}
