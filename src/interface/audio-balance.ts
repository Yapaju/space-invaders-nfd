import { SoundType } from './assets';

// Calibrated from decoded assets using BS.1770 K weighting over a common
// 400 ms window (short effects include silence). See docs/audio-balance.md.
export const AudioBalance = {
    targetEventLoudness: -24,
    gains: {
        [SoundType.Shoot]: 0.093,
        [SoundType.Kaboom]: 0.082,
        [SoundType.InvaderKilled]: 0.069,
        [SoundType.PopcatPop]: 0.66
    },
    giantVolume: 0.625,
    giantRate: 0.85,
    outputHeadroom: 0.8,
    limiter: { threshold: -6, knee: 0, ratio: 20, attack: 0, release: 0.08 }
};

const installed = new WeakMap<Phaser.Sound.BaseSoundManager, GainNode>();

// Stay inside Phaser's existing graph, AFTER its master mute and volume nodes.
// The compressor catches busy mixes; ordinary individual effects retain their
// calibrated gains. No second AudioContext or separate volume control is used.
export function installAudioHeadroom(scene: Phaser.Scene) {
    const manager = scene.sound as Phaser.Sound.BaseSoundManager & {
        context?: AudioContext; masterVolumeNode?: GainNode;
    };
    if (!manager.context || !manager.masterVolumeNode) return;
    if (installed.has(manager)) return installed.get(manager);
    const limiter = manager.context.createDynamicsCompressor();
    const output = manager.context.createGain();
    output.gain.value = AudioBalance.outputHeadroom;
    const settings = AudioBalance.limiter;
    limiter.threshold.value = settings.threshold;
    limiter.knee.value = settings.knee;
    limiter.ratio.value = settings.ratio;
    limiter.attack.value = settings.attack;
    limiter.release.value = settings.release;
    manager.masterVolumeNode.disconnect(manager.context.destination);
    manager.masterVolumeNode.connect(limiter);
    limiter.connect(output);
    output.connect(manager.context.destination);
    installed.set(manager, output);
    // The manager is game-wide; scene restarts must not stack compressors.
    scene.game.events.once('destroy', () => { limiter.disconnect(); output.disconnect(); });
    return output;
}
