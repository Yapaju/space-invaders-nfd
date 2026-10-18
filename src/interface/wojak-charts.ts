// A single damage-driven, seeded OHLC history feeds both monitors.
export interface ChartCandle {
    open: number; close: number; high: number; low: number;
    crash?: number;
    portfolio?: number;
}
// Dimensions are fractions of each monitor's glass, not game-canvas pixels.
// Fixed spacing leaves over half the monitor empty at entry. The lower chart
// margin also keeps the first candles above the armrest occlusion on either art.
export const WojakChartLayout = {
    capacity: 11, firstX: 0.16, pitch: 0.075,
    bodyWidth: 0.058, wickWidth: 0.013,
    baseline: 0.80, priceScale: 0.006,
    crash30Drop: 18, crash70Drop: 36
};
export function chartScroll(shown: number, formation: number): number {
    return Math.max(0, shown - WojakChartLayout.capacity - (1 - formation));
}
export class WojakChartHistory {
    candles: ChartCandle[] = [];
    shown = 4;
    formation = 1;
    frozen = false;
    private loss = 0;
    private nextEvent = 0;
    private events: Array<{ loss: number; candle: ChartCandle }> = [];
    private randomState: number;
    constructor(seed = 0x574f4a41) {
        this.randomState = seed >>> 0 || 1;
        let price = 10;
        // Increasing bodies (14, 20, 30, 46) produce a steep pump to 120.
        for (const rise of [14, 20, 30, 46]) {
            const close = price + rise;
            this.candles.push({ open: price, close, high: close + 3, low: price - 3 });
            price = close;
        }
        // Price anchors reserve headroom for both crashes, regardless of seed.
        // Plans are private: only actual portfolio crossings publish candles.
        this.planPhase(25, 50, 120, 106, 5, 7, 2, 4.5);
        this.planPhase(50, 79, 106, 94, 5, 8, 1.5, 3.5);
        const after30 = 94 - WojakChartLayout.crash30Drop;
        this.planCandle(80, 94, after30, 1, -30);
        this.planPhase(80, 119, after30, 50, 5, 8, 1, 3);
        const after70 = 50 - WojakChartLayout.crash70Drop;
        this.planCandle(120, 50, after70, 1, -70);
        this.planBleed(after70);
    }
    private random() {
        let value = this.randomState;
        value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
        this.randomState = value >>> 0;
        return this.randomState / 4294967296;
    }
    private crossings(start: number, end: number, min: number, max: number) {
        const losses: number[] = [];
        let loss = start;
        while (end - loss > max + min / 2) {
            loss += min + Math.floor(this.random() * (max - min + 1));
            losses.push(loss);
        }
        losses.push(end);
        return losses;
    }
    private planCandle(loss: number, open: number, close: number, volatility: number, crash?: number) {
        const body = Math.abs(close - open);
        const upper = (0.6 + this.random() * 3 + body * this.random() * 0.18) * volatility;
        const lower = (0.6 + this.random() * 3 + body * this.random() * 0.22) * volatility;
        this.events.push({ loss, candle: { open, close,
            high: Math.max(open, close) + upper,
            low: Math.max(0, Math.min(open, close) - lower),
            portfolio: 50 - loss, crash } });
    }
    private planPhase(start: number, end: number, from: number, to: number,
        minGap: number, maxGap: number, minRecovery: number, maxRecovery: number) {
        const losses = this.crossings(start, end, minGap, maxGap);
        const bounce = 1 + Math.floor(this.random() * (losses.length - 2));
        const gains = losses.map((_, i) => i === bounce ?
            minRecovery + this.random() * (maxRecovery - minRecovery) : 0);
        const weights = losses.map((_, i) => i === bounce ? 0 : 0.7 + this.random() * 1.2);
        // Short candles, chosen procedurally, give consolidation between
        // selloffs. Rebounds are internal to the phase and never finish it.
        const quiet = weights.map((_, i) => i).filter(i => i > 0 && i !== bounce && i < losses.length - 1);
        const quietCount = Math.min(losses.length >= 5 ? 2 : 1, quiet.length);
        for (let i = 0; i < quietCount; i++) {
            const selected = quiet.splice(Math.floor(this.random() * quiet.length), 1)[0];
            weights[selected] *= 0.18;
        }
        let price = from;
        losses.forEach((loss, i) => {
            let close: number;
            if (gains[i]) close = price + Math.min(gains[i], Math.max(0, from - 0.5 - price));
            else {
                const futureGains = gains.slice(i + 1).reduce((sum, gain) => sum + gain, 0);
                const remainingWeight = weights.slice(i).reduce((sum, weight) => sum + weight, 0);
                close = price - (price - to + futureGains) * weights[i] / remainingWeight;
            }
            if (i === losses.length - 1) close = to;
            this.planCandle(loss, price, close, 1);
            price = close;
        });
    }
    private planBleed(from: number) {
        const losses = this.crossings(120, 149.9, 4, 6);
        let price = from;
        losses.forEach((loss, i) => {
            const t = (loss - 120) / 29.9;
            // A decaying price envelope makes both bodies and recoveries
            // shrink in absolute units, ending exactly at the zero baseline.
            const rebound = i > 0 && i < losses.length - 1 && i % 2 === 1;
            const close = i === losses.length - 1 ? 0 : rebound ?
                price * (1.035 + this.random() * 0.09) :
                Math.min(price * 0.85, from * Math.pow(1 - t, 2.8) * (0.85 + this.random() * 0.25));
            this.planCandle(loss, price, close, Math.max(0.008, price / 30));
            price = close;
        });
    }
    damage(portfolio: number) {
        if (this.frozen) return;
        const loss = Math.max(this.loss, Math.min(149.9, 50 - portfolio));
        // Ordered event crossings include the fractional liquidation endpoint.
        // Upward fluctuations cannot rewind the seeded stream or repeat crashes.
        while (this.nextEvent < this.events.length && this.events[this.nextEvent].loss <= loss + 1e-9) {
            this.candles.push(this.events[this.nextEvent++].candle);
        }
        this.loss = loss;
    }
    update(delta: number) {
        if (this.frozen) return;
        let remaining = Math.max(0, Math.min(delta, 250));
        while (remaining > 0) {
            if (this.formation === 1) {
                if (this.shown === this.candles.length) break;
                this.shown++; this.formation = 0;
            }
            const duration = this.candles[this.shown - 1].crash ? 240 : 110;
            const consumed = Math.min(remaining, (1 - this.formation) * duration);
            this.formation = Math.min(1, this.formation + consumed / duration);
            remaining -= consumed;
        }
    }
    freeze() {
        this.shown = this.candles.length;
        this.formation = 1;
        this.frozen = true;
    }
}

interface Point { x: number; y: number; }
const points = (values: number[][]): Point[] => values.map(p => ({ x: p[0], y: p[1] }));
// Inset source-art glass corners: TL, TR, BR, BL. The extra clip vertices
// exclude the solid armrests which intrude over the lower screen corners.
const rightMonitors = [
    { quad: points([[183, 101], [481, 192], [505, 419], [214, 356]]),
        clip: points([[183, 101], [481, 192], [483, 300], [410, 384], [214, 356]]) },
    { quad: points([[1049, 237], [1396, 151], [1361, 386], [1015, 443]]),
        clip: points([[1049, 237], [1396, 151], [1361, 386], [1085, 430], [1020, 350]]) }
];
export const WojakMonitors = {
    right: rightMonitors,
    // Mirror the glass geometry, then restore TL/TR order so time still runs
    // left-to-right; the chart itself is never mirrored with the spaceship.
    left: rightMonitors.map(m => ({
        quad: [m.quad[1], m.quad[0], m.quad[3], m.quad[2]].map(p => ({ x: 1536 - p.x, y: p.y })),
        clip: m.clip.slice().reverse().map(p => ({ x: 1536 - p.x, y: p.y }))
    }))
};

// Unit-square homography, shared by Canvas and WebGL Graphics renderers.
export function projectChartPoint(q: Point[], x: number, y: number): Point {
    const dx1 = q[1].x - q[2].x, dx2 = q[3].x - q[2].x;
    const dy1 = q[1].y - q[2].y, dy2 = q[3].y - q[2].y;
    const dx3 = q[0].x - q[1].x + q[2].x - q[3].x;
    const dy3 = q[0].y - q[1].y + q[2].y - q[3].y;
    const det = dx1 * dy2 - dx2 * dy1;
    const g = (dx3 * dy2 - dx2 * dy3) / det;
    const h = (dx1 * dy3 - dx3 * dy1) / det;
    const d = g * x + h * y + 1;
    return { x: ((q[1].x - q[0].x + g * q[1].x) * x +
        (q[3].x - q[0].x + h * q[3].x) * y + q[0].x) / d,
        y: ((q[1].y - q[0].y + g * q[1].y) * x +
        (q[3].y - q[0].y + h * q[3].y) * y + q[0].y) / d };
}

export function clipChartPolygon(polygon: Point[], clip: Point[]): Point[] {
    let output = polygon;
    clip.forEach((a, i) => {
        const b = clip[(i + 1) % clip.length], input = output;
        output = [];
        const side = (p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        input.forEach((p, j) => {
            const previous = input[(j + input.length - 1) % input.length];
            const s = side(p), t = side(previous);
            if ((s >= 0) !== (t >= 0)) {
                const ratio = t / (t - s);
                output.push({ x: previous.x + (p.x - previous.x) * ratio,
                    y: previous.y + (p.y - previous.y) * ratio });
            }
            if (s >= 0) output.push(p);
        });
    });
    return output;
}

export class WojakCharts {
    readonly history = new WojakChartHistory();
    private graphics: Phaser.GameObjects.Graphics;
    constructor(scene: Phaser.Scene) {
        this.graphics = scene.add.graphics().setDepth(2.5);
    }
    sync(left: number, top: number, scale: number, direction: 'left' | 'right') {
        const g = this.graphics, history = this.history;
        g.setPosition(left, top).setScale(scale).clear();
        const polygon = (p: Point[], color: number) => {
            if (p.length < 3) return;
            g.fillStyle(color, 1).beginPath().moveTo(p[0].x, p[0].y);
            p.slice(1).forEach(v => g.lineTo(v.x, v.y));
            g.closePath().fillPath();
        };
        const count = history.shown;
        const layout = WojakChartLayout;
        const scroll = chartScroll(count, history.formation);
        WojakMonitors[direction].forEach(monitor => {
            polygon(monitor.clip, 0x08121c);
            const rect = (x: number, y: number, w: number, h: number, color: number) => {
                const x0 = Math.max(0.025, x), x1 = Math.min(0.975, x + w);
                const y0 = Math.max(0.025, y), y1 = Math.min(0.975, y + h);
                if (x0 >= x1 || y0 >= y1) return;
                polygon(clipChartPolygon(points([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
                    .map(p => projectChartPoint(monitor.quad, p.x, p.y)), monitor.clip), color);
            };
            // Keep departing candles until clipping takes them off the glass;
            // do not pop them away while they are still inside the left margin.
            for (let i = 0; i < count; i++) {
                const c = history.candles[i];
                const t = i === count - 1 ? history.formation : 1;
                const close = c.open + (c.close - c.open) * t;
                const high = c.open + (c.high - c.open) * t;
                const low = c.open + (c.low - c.open) * t;
                const x = layout.firstX + (i - scroll) * layout.pitch;
                // One immutable price-to-height mapping for the whole encounter.
                const y = (price: number) => layout.baseline - price * layout.priceScale;
                const color = c.close >= c.open ? 0x36ff80 : 0xff354d;
                // True OHLC extents: no body-height floor that would make a
                // tiny final-bleed candle look as strong as an early selloff.
                const height = Math.abs(close - c.open) * layout.priceScale;
                const bodyTop = y(Math.max(c.open, close));
                const wickTop = y(high), wickBottom = y(low);
                rect(x - layout.wickWidth / 2, wickTop, layout.wickWidth, wickBottom - wickTop, color);
                rect(x - layout.bodyWidth / 2, bodyTop, layout.bodyWidth, height, color);
            }
        });
    }
    destroy() { this.graphics.destroy(); }
}
