import { FinalRunStats, renderFlexCard, downloadFlexCard, flexCardPng, GameLink } from './flex-card-renderer';

interface ShareData { title: string; text: string; url: string; files?: File[]; }
interface ShareNavigator {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: { files: File[] }) => boolean;
}

const icons = {
    Share: 'flex-card-share.png',
    Download: 'flex-card-download.png',
    Website: 'flex-card-website.png',
    Close: 'flex-card-close.png'
};

export class FlexCardPreview {
    constructor(private onClose: () => void = () => {}) {}
    private overlay: HTMLDivElement;
    private previousFocus: HTMLElement;
    private cachedStats: FinalRunStats;
    private cachedCanvas: HTMLCanvasElement;
    private keyHandler: (event: KeyboardEvent) => void;
    get isOpen() { return !!this.overlay; }

    async open(stats: FinalRunStats) {
        if (this.isOpen) return;
        const overlay = document.createElement('div');
        this.overlay = overlay;
        this.previousFocus = document.activeElement as HTMLElement;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'NFD Flex Card');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,4,14,.94);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;overflow:auto;color:#ffe361;font-family:Arial,sans-serif;';
        const panel = document.createElement('div');
        panel.style.cssText = 'width:min(1100px,100%);max-height:100%;overflow:auto;text-align:center;';
        const imageArea = document.createElement('div');
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        status.style.cssText = 'min-height:24px;margin:12px 0;';
        status.textContent = 'Generating Flex Card…';
        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;justify-content:center;gap:16px;padding:8px 0;';
        const style = document.createElement('style');
        style.textContent = '.nfd-flex-action{position:relative;box-sizing:border-box;flex:0 0 58px;width:58px;height:58px;padding:0;border:0;outline:none;background:transparent;box-shadow:none;overflow:visible;cursor:pointer;transition:transform .15s}.nfd-flex-action img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}.nfd-flex-action:hover:not(:disabled){transform:scale(1.04)}.nfd-flex-keyboard-navigation .nfd-flex-action:focus-visible{outline:2px solid #ffe4a1;outline-offset:4px}.nfd-flex-action:disabled{opacity:.4;cursor:wait}';
        overlay.appendChild(style);
        // Initial programmatic focus must not look like keyboard navigation.
        // A real Tab restores the indicator; pointer interaction clears it.
        overlay.addEventListener('pointerdown', () => overlay.classList.remove('nfd-flex-keyboard-navigation'));
        const button = (name: keyof typeof icons, label: string, action: () => void) => {
            const el = document.createElement('button');
            el.type = 'button'; el.className = 'nfd-flex-action';
            el.setAttribute('aria-label', label); el.title = label;
            for (const file of ['flex-card-circle-button.png', icons[name]]) {
                const image = document.createElement('img');
                image.src = `assets/flex-card/${file}`;
                image.alt = ''; image.setAttribute('aria-hidden', 'true');
                image.draggable = false;
                el.appendChild(image);
            }
            el.onclick = action; controls.appendChild(el); return el;
        };
        let canvas: HTMLCanvasElement;
        let shareFile: File;
        const shareText = `I reached Wave ${stats.wave} and scored ${stats.score.toLocaleString('en-US')} in Space Invaders NFD! Can you beat me?`;
        const fallback = async (reason: string) => {
            let result = 'Use Download to save the PNG.';
            try { await downloadFlexCard(canvas, stats); result = 'PNG downloaded separately; attach it manually.'; }
            catch (_) { /* Keep share text and the download retry available. */ }
            if (this.overlay !== overlay) return;
            status.textContent = `${reason} ${result} Copy this message to share: `;
            const field = document.createElement('textarea');
            field.readOnly = true; field.value = `${shareText}\n${GameLink}`;
            field.setAttribute('aria-label', 'Share message to copy');
            field.style.cssText = 'display:block;box-sizing:border-box;width:500px;max-width:100%;height:78px;margin:8px auto;font:14px Arial,sans-serif;';
            status.appendChild(field); field.focus(); field.select();
        };
        const share = button('Share', 'Share Flex Card', async () => {
            share.disabled = true;
            const api = navigator as Navigator & ShareNavigator;
            try {
                if (!api.share) { await fallback('Native sharing is unavailable.'); return; }
                const files = shareFile ? [shareFile] : [];
                const attach = files.length > 0 && !!api.canShare && api.canShare({ files });
                // No awaited work before share(): preserve the click's user activation.
                await api.share({ title: 'NFD Flex Card', text: shareText, url: GameLink,
                    ...(attach ? { files } : {}) });
                if (this.overlay !== overlay) return;
                if (attach) status.textContent = 'Flex Card shared!';
                else await fallback('Text and game link shared. The PNG was not attached.');
            } catch (error) {
                if (this.overlay !== overlay) return;
                if (error.name === 'AbortError') status.textContent = 'Sharing cancelled.';
                else await fallback('Native sharing failed.');
            } finally { share.disabled = false; }
        });
        share.disabled = true;
        const download = button('Download', 'Download PNG', async () => {
            download.disabled = true;
            try { await downloadFlexCard(canvas, stats); }
            catch (error) { console.error('Flex Card PNG download failed.', error); }
            finally { download.disabled = false; }
        });
        download.disabled = true;
        button('Website', 'Open game website', () => window.open(GameLink, '_blank', 'noopener,noreferrer'));
        const close = button('Close', 'Close', () => this.close());
        panel.appendChild(imageArea); panel.appendChild(status); panel.appendChild(controls);
        overlay.appendChild(panel); document.body.appendChild(overlay);
        // Capture before Phaser's document listeners. Keep button keyboard activation
        // native while isolating every modal key from game bindings, including keyup.
        this.keyHandler = (event: KeyboardEvent) => {
            event.stopImmediatePropagation();
            if (event.type !== 'keydown') return;
            if (event.key === 'Escape') { event.preventDefault(); this.close(); }
            if (event.key === 'Tab') {
                overlay.classList.add('nfd-flex-keyboard-navigation');
                const focusable = Array.from(overlay.querySelectorAll<HTMLElement>('button:not(:disabled),textarea'));
                const index = focusable.indexOf(document.activeElement as HTMLElement);
                const next = (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
                event.preventDefault(); focusable[next].focus();
            }
            if (event.repeat && (event.key === 'Enter' || event.code === 'Space')) event.preventDefault();
        };
        window.addEventListener('keydown', this.keyHandler, true);
        window.addEventListener('keyup', this.keyHandler, true);
        close.focus();
        try {
            canvas = this.cachedStats === stats && this.cachedCanvas ? this.cachedCanvas : await renderFlexCard(stats);
            if (this.overlay !== overlay) return;
            this.cachedStats = stats; this.cachedCanvas = canvas;
            canvas.style.cssText = 'display:block;width:100%;height:auto;max-height:calc(100vh - 170px);max-height:calc(100dvh - 170px);object-fit:contain;';
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', `Wave ${stats.wave}, Score ${stats.score.toLocaleString('en-US')}, Invaders killed ${stats.invadersKilled.toLocaleString('en-US')}`);
            imageArea.appendChild(canvas); download.disabled = false; status.textContent = '';
            // Prepare the file while idle, before any share click needs activation.
            try {
                const blob = await flexCardPng(canvas);
                if (this.overlay !== overlay) return;
                shareFile = new File([blob], `NFD-Flex-Wave${stats.wave}-Score${stats.score}.png`, { type: 'image/png' });
            } catch (_) { /* Text/link sharing and PNG download retry remain available. */ }
            if (this.overlay === overlay) share.disabled = false;
        } catch (error) {
            if (this.overlay === overlay) status.textContent = error.message;
        }
    }

    close() {
        if (!this.overlay) return;
        window.removeEventListener('keydown', this.keyHandler, true);
        window.removeEventListener('keyup', this.keyHandler, true);
        this.overlay.remove(); this.overlay = undefined;
        this.onClose();
        if (this.previousFocus && this.previousFocus.isConnected) this.previousFocus.focus();
    }
}
