// Default 2x backing buffer for the current Phaser 3.22 WebGL pipeline.
// Keep ScaleManager, camera projection and input in logical game pixels. Do
// not use Phaser's resolution option: this version fixes scale.resolution at 1.
export function installRenderBufferExperiment(game: Phaser.Game) {
    if (new URLSearchParams(window.location.search).get('renderBuffer') === '1') return;
    const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    if (renderer.type !== Phaser.WEBGL) return; // Canvas remains the baseline.

    const factor = 2;
    const gl = renderer.gl;
    const size = game.scale.gameSize;
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const maxBuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number;
    if (size.width * factor > Math.min(viewport[0], maxBuffer) ||
        size.height * factor > Math.min(viewport[1], maxBuffer)) return;
    const preRender = renderer.preRender;
    const setScissor = renderer.setScissor;
    const syncBuffer = () => {
        const size = game.scale.gameSize;
        const width = size.width * factor, height = size.height * factor;
        if (game.canvas.width !== width) game.canvas.width = width;
        if (game.canvas.height !== height) game.canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.scissor(0, 0, width, height);
    };

    renderer.preRender = function () {
        syncBuffer();
        preRender.call(this);
        // Also cover Phaser's direct scissor call for custom camera viewports.
        gl.scissor(0, 0, game.canvas.width, game.canvas.height);
    };
    // This game draws to the main framebuffer, with no render-to-texture cameras.
    // Phaser's scissor stack stays logical; only the GL calls are physical.
    renderer.setScissor = function (x, y, width, height, _drawingBufferHeight?) {
        return setScissor.call(this, x * factor, y * factor, width * factor, height * factor,
            game.canvas.height);
    };
    game.scale.on('resize', syncBuffer);
    syncBuffer();
    game.events.once('destroy', () => {
        game.scale.off('resize', syncBuffer);
        renderer.preRender = preRender;
        renderer.setScissor = setScissor;
    });
}
