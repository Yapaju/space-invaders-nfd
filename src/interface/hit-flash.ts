// Shared by Wojak's layered presentation and single-sprite encounters.
// Call after changing textures so feedback always applies to the current frame.
export function applyHitFlash(layers: Array<Phaser.GameObjects.Sprite | Phaser.GameObjects.Image>, elapsed: number,
    duration: number, onMs: number, offMs: number, tint: number) {
    const red = elapsed < duration && elapsed % (onMs + offMs) < onMs;
    layers.forEach(layer => red ? layer.setTint(tint) : layer.clearTint());
}
