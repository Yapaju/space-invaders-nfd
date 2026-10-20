// Popcat artwork registration, gameplay and static light regression.
// node tests/popcat-browser.cjs <absolute screenshot output directory>
// NODE_PATH may point to a separately installed Playwright package directory.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2]);
fs.mkdirSync(output, { recursive: true });

// Compile the real source modules in memory. Production sources and the built
// game stay untouched; only this test page exposes the scene for inspection.
const modules = {};
function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(file);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            modules[path.relative(root, file).replace(/\\/g, '/').replace(/\.ts$/, '')] =
                ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
                    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2015
                } }).outputText;
        }
    }
}
collect(path.join(root, 'src'));
modules['src/game'] = modules['src/game'].replace('const game =', 'window.testGame =');
const bootstrap = '<script src="/phaser.js"></script><script>' +
    'const modules=' + JSON.stringify(modules).replace(/</g, '\\u003c') + ',cache={};' +
    'function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};' +
    'new Function("module","exports","require",modules[id])(m,m.exports,name=>{' +
    'if(name==="phaser")return Phaser;const p=id.split("/");p.pop();' +
    'name.split("/").forEach(v=>{if(v==="..")p.pop();else if(v!==".")p.push(v)});return load(p.join("/"))});return m.exports;}' +
    'load("src/game");</script>';
const html = fs.readFileSync(path.join(root,'dist/index.html'),'utf8')
    .replace('<script src="game.js"></script>', bootstrap);
async function serve(route) {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
        let body = html;
        if (url.searchParams.has('reference')) body = body.replace('const factor = 2', 'const factor = 4');
        if (url.searchParams.has('canvas')) body = body.replace('type: Phaser.AUTO', 'type: Phaser.CANVAS');
        if (url.searchParams.has('limited')) body = body.replace('load("src/game");',
            'const getParameter=WebGLRenderingContext.prototype.getParameter;' +
            'WebGLRenderingContext.prototype.getParameter=function(p){' +
            'if(p===this.MAX_VIEWPORT_DIMS)return new Int32Array([1024,1024]);' +
            'if(p===this.MAX_RENDERBUFFER_SIZE)return 1024;return getParameter.call(this,p);};load("src/game");');
        await route.fulfill({ contentType: 'text/html', body }); return;
    }
    let file = url.pathname === '/phaser.js' ? path.join(root, 'node_modules/phaser/dist/phaser.js') :
        path.resolve(root, 'dist', '.' + decodeURIComponent(url.pathname));
    if (url.pathname.startsWith('/assets/') && fs.existsSync(path.join(root, url.pathname.slice(1)))) file = path.join(root, url.pathname.slice(1));
    if (!file.startsWith(root + path.sep)) { await route.fulfill({ status: 403 }); return; }
    if (!fs.existsSync(file)) { await route.fulfill({ status: 404 }); return; }
    await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' :
        file.endsWith('.png') ? 'image/png' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('http://wojak.test/**', serve);
        await page.route('https://www.googletagmanager.com/**', route => route.abort());
        await page.goto('http://wojak.test/');
        await page.waitForFunction(() => window.testGame && testGame.scene.scenes[0].player);
        const report = await page.evaluate(() => {
            testGame.loop.stop();
            const s = testGame.scene.scenes[0]; s.restart();
            const settings = load('src/interface/popcat-lights');
            const poses = load('src/interface/enemy-skins').PopcatPoses;
            const check = (condition, message) => { if (!condition) throw Error(message); };
            const result = { poses: [], waves: [], timings: [] };
            for (let wave = 1; wave <= 31; wave++) {
                s.alienManager.reset(wave);
                const aliens = s.alienManager.aliens.getChildren();
                const type = ['popcat','pepe','ponke'][(wave-1)%3];
                check(aliens.length === 24 && aliens.every(a=>a.enemyType===type), `wave ${wave}`);
                result.waves.push(type);
            }
            s.restart();
            const aliens = s.alienManager.aliens.getChildren();
            const a = aliens[0], b = aliens[1];
            const geometry = () => JSON.stringify([a.x,a.y,a.scaleX,a.scaleY,a.originX,a.originY,
                a.body.width,a.body.height,a.body.offset.x,a.body.offset.y]);
            const before = geometry();
            const choose = s.alienManager.getRandomAliveEnemy;
            s.alienManager.getRandomAliveEnemy = () => a;
            const shots = s.assetManager.enemyBullets.countActive(true);
            const lives = s.scoreManager.lives;
            s._enemyFires();
            check(a.texture.key.startsWith('popcat-open-right'), 'attack mouth');
            const fired = s.assetManager.enemyBullets.countActive(true) - shots;
            check(fired === 1 || fired === 5, 'mutually exclusive popcorn attack');
            a.setDirection(-1);
            check(a.texture.key.startsWith('popcat-open-left'), 'open reversal');
            a.preUpdate(179,179); b.preUpdate(179,179);
            check(a.texture.key.startsWith('popcat-open-left') && b.texture.key.startsWith('popcat-right'), 'independent mouth');
            a.preUpdate(180,1);
            check(a.texture.key.startsWith('popcat-left'), 'close at deadline');
            check(before === geometry(), 'mouth/lights/direction preserve geometry');
            check(s.scoreManager.lives === lives, 'no attack damage');
            s.alienManager.getRandomAliveEnemy = choose;

            // Original scaled PNG pixels remain unmodified in every static pose.
            for(const pose of poses) {
                const base=s.textures.get(pose.asset).getSourceImage();
                const source=s.textures.get(pose.asset+'-source').getSourceImage();
                const expected=document.createElement('canvas');expected.width=base.width;expected.height=base.height;
                const ctx=expected.getContext('2d'),scale=Math.min(base.width/source.width,base.height/source.height);
                ctx.drawImage(source,(base.width-source.width*scale)/2,(base.height-source.height*scale)/2,
                    source.width*scale,source.height*scale);
                const original=ctx.getImageData(0,0,base.width,base.height).data;
                const actual=base.getContext('2d').getImageData(0,0,base.width,base.height).data;
                check(original.every((v,i)=>v===actual[i]),'static PNG pixels '+pose.asset);
                check(!s.textures.exists(settings.popcatLightTexture(pose.asset,0)),'no experimental light textures');
                a.configure('popcat',pose.asset.includes('left')?-1:1);
                if(pose.asset.includes('open'))a.pop();
                check(a.texture.key===pose.asset,'static pose selected');
                a.preUpdate(1200,1200);
                check(a.texture.key===(pose.asset.includes('left')?'popcat-left':'popcat-right'),'static after updates');
                result.poses.push({pose:pose.asset,staticPixels:true});
            }
            // Full 24-alien formation and drawing.
            s.restart();
            const gl=testGame.renderer.gl,pixel=new Uint8Array(4);
            for (let sample=0;sample<120;sample++) {
                const start=performance.now();
                s.alienManager.update(16.67,10000);
                s.alienManager.aliens.getChildren().forEach(a=>a.preUpdate(sample*16.67,16.67));
                testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
                // Complete GPU work to measure more than command submission.
                if(gl)gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
                result.timings.push(performance.now()-start);
            }
            result.timings.sort((a,b)=>a-b);
            result.frameMedianMs=result.timings[60];result.frameP95Ms=result.timings[114];delete result.timings;
            window.s=s;
            window.draw=()=>{testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();};
            return result;
        });
        // Inspect the actual cached artwork at a generous size in all poses.
        await page.evaluate(()=>{
            const poses=load('src/interface/enemy-skins').PopcatPoses;
            s.children.list.forEach(v=>v.setVisible&&v.setVisible(false));
            window.previews=poses.map((pose,i)=>s.add.image(200+(i%2)*400,155+Math.floor(i/2)*290,
                pose.asset).setDisplaySize(400,400*282/337));draw();
        });
        await page.screenshot({path:path.join(output,'popcat-four-poses.png')});
        await page.evaluate(()=>{previews.forEach(v=>v.destroy());s.children.list.forEach(v=>v.setVisible&&v.setVisible(true));s.restart();draw();});
        await page.screenshot({path:path.join(output,'popcat-formation.png')});
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(output,'popcat-measurements.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report));
        console.log('PASS: 31 waves, directional independent mouth poses, popcorn spawn without immediate damage, geometry, unchanged original PNG pixels/static lights in all poses, full formation rendering.');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
