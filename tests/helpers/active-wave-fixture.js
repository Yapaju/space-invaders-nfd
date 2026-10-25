// Legacy movement/combat suites exercise active waves. Entrance behavior has its
// own real-scene suite; finish it here without simulating patrol or weapons.
function installActiveWaveFixture(scene) {
    const manager = scene.alienManager;
    if (manager.activeWaveFixture) return;
    manager.activeWaveFixture = true;
    const finish = () => {
        if (manager.isEntering) {
            manager.update(manager.entranceRemaining /
                load('src/interface/wave-director').WaveDirectorConfig.formation.entrance.speed * 1000 + 1e-5, Infinity);
            scene.firingTimer = scene.time.now + load('src/interface/wave-director').firingIntervalForWave(scene.wave);
        }
    };
    const reset = manager.reset.bind(manager);
    manager.reset = (wave, seed) => { reset(wave, seed); finish(); };
    const restart = scene.restart.bind(scene);
    scene.restart = () => {
        // These legacy fixtures explicitly assign manager.seed before restart.
        const url = new URL(location.href);
        url.searchParams.set('waveSeed', String(manager.seed));
        history.replaceState({}, '', url);
        restart();
    };
    finish();
}
