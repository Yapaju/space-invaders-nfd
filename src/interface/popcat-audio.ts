import { SoundType } from './assets';
import { AudioBalance } from './audio-balance';

export const PopcatAudioSettings = {
    path: 'sounds/popcat/popcat-pop.mp3?v=2',
    maxVoices: 2,
    mouthVolume: AudioBalance.gains[SoundType.PopcatPop],
    giantVolume: AudioBalance.giantVolume,
    giantRate: AudioBalance.giantRate
};

const pools = new WeakMap<Phaser.Sound.BaseSoundManager, Phaser.Sound.BaseSound[]>();
const reported = new WeakMap<Phaser.Sound.BaseSoundManager, Set<string>>();
type ContextManager = Phaser.Sound.BaseSoundManager & { context?: AudioContext };

function debug(event: string, details: any) {
    if (typeof __NFD_DEV__ !== 'undefined' && __NFD_DEV__ &&
        typeof location !== 'undefined' && new URLSearchParams(location.search).has('popcatAudioDebug')) {
        console.info('[Popcat audio] ' + event, JSON.stringify(details));
    }
}

function warn(manager: Phaser.Sound.BaseSoundManager, reason: string, error?: any) {
    let reasons = reported.get(manager);
    if (!reasons) { reasons = new Set<string>(); reported.set(manager, reasons); }
    if (!reasons.has(reason)) {
        reasons.add(reason);
        console.warn('[Popcat audio] ' + reason, error || PopcatAudioSettings.path);
    }
}

export function preloadPopcatAudio(scene: Phaser.Scene) {
    scene.load.audio(SoundType.PopcatPop, PopcatAudioSettings.path, { instances: PopcatAudioSettings.maxVoices });
    if (typeof scene.load.on !== 'function') return;
    const failed = (file: Phaser.Loader.File) => {
        if (file.key === SoundType.PopcatPop) warn(scene.sound, 'Asset load/decode failed', file.src);
    };
    scene.load.on('loaderror', failed);
    scene.load.once('complete', () => scene.load.off('loaderror', failed));
}

export function installPopcatAudio(scene: Phaser.Scene) {
    const manager = scene.sound as ContextManager;
    const decoded = scene.cache.audio.get(SoundType.PopcatPop) as AudioBuffer;
    debug('ready', { duration: decoded && decoded.duration, path: PopcatAudioSettings.path, loaded: scene.cache.audio.exists(SoundType.PopcatPop),
        locked: manager.locked, context: manager.context && manager.context.state, mute: manager.mute, volume: manager.volume });
    const resume = () => {
        const context = manager.context;
        debug('user gesture', { locked: manager.locked, context: context && context.state });
        // Phaser handles initial unlock. Also recover its SAME context if a
        // browser suspends it later, after Phaser's one-shot unlock listener left.
        // This callback runs only in response to real pointer/keyboard input.
        if (context && context.state !== 'running' && context.state !== 'closed') {
            context.resume().then(() => debug('context resumed', { state: context.state }))
                .catch(error => warn(manager, 'Audio context resume failed', error));
        }
    };
    scene.input.on('pointerdown', resume);
    if (scene.input.keyboard) scene.input.keyboard.on('keydown', resume);
    scene.events.once('shutdown', () => {
        scene.input.off('pointerdown', resume);
        if (scene.input.keyboard) scene.input.keyboard.off('keydown', resume);
    });
}

export function playPopcatSound(scene: Phaser.Scene, giant = false): boolean {
    const manager = scene.sound as ContextManager;
    const event = giant ? 'giant' : 'mouth';
    if (!manager) return false;
    if (manager.locked || manager.mute || manager.volume <= 0) {
        debug('skipped ' + event, { locked: manager.locked, mute: manager.mute, volume: manager.volume });
        return false;
    }
    if (!scene.cache) return false;
    if (!scene.cache.audio.exists(SoundType.PopcatPop)) {
        warn(manager, 'Popcat sample missing from audio cache'); return false;
    }
    if (manager.context && manager.context.state !== 'running') {
        debug('skipped ' + event, { context: manager.context.state, reason: 'awaiting user gesture' }); return false;
    }
    let voice: Phaser.Sound.BaseSound;
    try {
        let voices = pools.get(manager);
        if (!voices) { voices = []; pools.set(manager, voices); }
        voice = voices.find(sound => !sound.isPlaying && !sound.isPaused);
        if (!voice && voices.length < PopcatAudioSettings.maxVoices) {
            voice = manager.add(SoundType.PopcatPop); voices.push(voice);
        }
        if (!voice) { debug('skipped ' + event, { reason: 'voice cap', voices: voices.length }); return false; }
        const config = { volume: giant ? PopcatAudioSettings.giantVolume : PopcatAudioSettings.mouthVolume,
            rate: giant ? PopcatAudioSettings.giantRate : 1, detune: 0, seek: 0, loop: false };
        const played = voice.play(config);
        debug('play ' + event, { played, ...config, masterVolume: manager.volume,
            context: manager.context && manager.context.state, voices: voices.length });
        if (!played) { voice.stop(); warn(manager, 'Popcat playback was rejected'); }
        return played;
    } catch (error) {
        // Failed playback must not permanently occupy a voice and exhaust the cap.
        if (voice) {
            try { voice.stop(); } catch (stopError) { warn(manager, 'Failed voice cleanup', stopError); }
        }
        warn(manager, 'Popcat playback failed', error); return false;
    }
}

export function stopPopcatSounds(scene: Phaser.Scene) {
    const voices = scene.sound && pools.get(scene.sound);
    if (voices) voices.forEach(sound => sound.stop());
}
