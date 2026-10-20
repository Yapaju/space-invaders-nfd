// Default backing-buffer / explicit 1x override regression. Requires Playwright + Chrome.
// node tests/render-buffer-browser.cjs <absolute screenshot output directory>
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
    const file = url.pathname === '/phaser.js' ? path.join(root, 'node_modules/phaser/dist/phaser.js') :
        path.resolve(root, 'dist', '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) { await route.fulfill({ status: 403 }); return; }
    if (!fs.existsSync(file)) { await route.fulfill({ status: 404 }); return; }
    await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' :
        file.endsWith('.png') ? 'image/png' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const report = { runs: [], differences: [], performance: [] };
    try {
        const geometryByDpr = {};
        const bossByDpr = {};
        for (const dpr of [1, 2]) {
            const pictures = {};
            let regions;
            for (const mode of ['baseline', '2x', 'reference']) {
                const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
                const page = await context.newPage(), errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.route('http://wojak.test/**', serve);
                await page.route('https://www.googletagmanager.com/**', route => route.abort());
                await page.goto('http://wojak.test/' + (mode === 'baseline' ? '?renderBuffer=1' : mode === 'reference' ? '?reference' : ''));
                await page.waitForFunction(() => window.testGame && testGame.scene.scenes[0].player);
                const state = await page.evaluate(() => {
                    testGame.loop.stop(); window.s = testGame.scene.scenes[0]; s.restart();
                    s.starfield.tilePositionY = 0;
                    s.alienManager.aliens.getChildren().forEach((v,i) => { v.configure(i%2 ? 'pepe' : 'ponke',1); v.y += 50; v.body.reset(v.x,v.y); });
                    const ally = s.elonAlly;
                    ally.pending = true; ally.direction = 1; ally.targetDescent = 2; ally.onDescent(2); ally.sprite.x = 400;
                    window.snapshot = () => JSON.stringify(s.children.list.filter(v => v.active).map(v =>
                        [v.x,v.y,v.scaleX,v.scaleY,v.texture && v.texture.key,v.body && [v.body.width,v.body.height,v.body.offset.x,v.body.offset.y]])
                        .sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
                    window.draw = () => { testGame.renderer.preRender(); s.sys.render(testGame.renderer); testGame.renderer.postRender(); };
                    const pepe=s.alienManager.aliens.getChildren()[1];
                    const geometry=()=>{
                        const b=pepe.body;
                        return JSON.stringify([pepe.x,pepe.y,pepe.width,pepe.height,pepe.scaleX,pepe.scaleY,
                            pepe.originX,pepe.originY,b.left,b.top,b.width,b.height,b.offset.x,b.offset.y,
                            b.velocity.x,b.velocity.y]);
                    };
                    pepe.body.preUpdate(false,0);
                    const before=geometry();
                    for(const direction of [-1,1,-1,1]) {
                        pepe.setDirection(direction);pepe.body.preUpdate(false,0);
                        if(pepe.texture.key!==(direction<0?'pepe-left':'alien'))throw Error('PEPE directional texture');
                        if(geometry()!==before)throw Error('PEPE reversal changed frame, transform or collision');
                    }
                    for(const key of ['pepe-left','alien']) {
                        const t=s.textures.get(key);
                        if(t.source[0].width!==337 || t.source[0].height!==282)throw Error('PEPE prepared frame');
                    }
                    draw();
                    const region = v => { const b=v.getBounds(); return {x:b.x,y:b.y,width:b.width,height:b.height}; };
                    const gl=testGame.renderer.gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
                    return { geometry:snapshot(), regions:{player:region(s.player),ponke:region(s.alienManager.aliens.getChildren()[0]),
                        pepe:region(s.alienManager.aliens.getChildren()[1]),ally:region(ally.sprite),
                        hud:{x:15,y:5,width:145,height:65},lives:{x:670,y:5,width:120,height:65}},
                        gpu:debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                        textures:['ship','ponke-right','alien','elon-ally-right','nfd-hud-score'].map(key=>{
                            const t=s.textures.get(key);return {key,width:t.source[0].width,height:t.source[0].height};}) };
                });
                regions = state.regions;
                if (mode === 'baseline') geometryByDpr[dpr] = state.geometry;
                else assert.equal(state.geometry, geometryByDpr[dpr], 'geometry differs between A/B/reference');
                const factor = mode === 'baseline' ? 1 : mode === '2x' ? 2 : 4;
                for (const [width,height] of [[1920,1080],[1366,768],[640,480],[1920,1080]]) {
                    await page.setViewportSize({width,height});
                    await page.waitForFunction(({width,height}) => {
                        testGame.scale.step(0,16);
                        return Math.abs(testGame.canvas.getBoundingClientRect().height-600*Math.min(width/800,height/600))<1;
                    },{width,height});
                    await page.evaluate(({factor,width,height}) => {
                        draw();
                        const g=testGame,r=g.canvas.getBoundingClientRect();
                        const check=(ok,msg)=>{if(!ok)throw Error(msg);};
                        check(g.canvas.width===800*factor && g.canvas.height===600*factor,'buffer dimensions');
                        check(g.scale.gameSize.width===800 && g.scale.baseSize.width===800,'scale dimensions');
                        check(s.cameras.main.width===800 && s.cameras.main.height===600 && s.cameras.main.zoom===1,'camera changed');
                        check(s.physics.world.bounds.width===800 && s.physics.world.bounds.height===600,'world changed');
                        check(document.documentElement.scrollWidth===width && document.documentElement.scrollHeight===height,'scrollbars');
                        for (const [x,y] of [[0,0],[800,0],[0,600],[800,600],[400,300],[200,450]]) {
                            g.input.transformPointer(g.input.activePointer,r.left+r.width*x/800,r.top+r.height*y/600,false);
                            check(Math.abs(g.input.activePointer.x-x)<0.001 && Math.abs(g.input.activePointer.y-y)<0.001,'pointer mapping');
                        }
                        check(Math.abs(s.scoreManager.waveText.options.x-400)<0.001 && s.scoreManager.livesLabel.x===780,'HUD shifted');
                    },{factor,width,height});
                    assert.equal(await page.evaluate(()=>snapshot()),state.geometry,'resize moved scene');
                }
                if(mode==='2x') for(const direction of [-1,1]) {
                    await page.evaluate(direction=>{
                        s.alienManager.aliens.getChildren().filter(v=>v.enemyType==='pepe').forEach(v=>v.setDirection(direction));draw();
                    },direction);
                    await page.locator('canvas').screenshot({path:path.join(output,`pepe-${direction<0?'left':'right'}-dpr${dpr}.png`)});
                }
                pictures[mode] = await page.locator('canvas').screenshot({path:path.join(output,`${mode}-dpr${dpr}.png`)});
                const performance = await page.evaluate(() => {
                    const gl=testGame.renderer.gl, samples=[], synchronized=[];
                    for(let i=0;i<20;i++){draw();gl.finish();}
                    for(let i=0;i<120;i++){const start=window.performance.now();draw();gl.finish();samples.push(window.performance.now()-start);}
                    // Include a readback to prevent driver command queuing from
                    // making submission timing look like completed GPU timing.
                    const pixel=new Uint8Array(4);
                    for(let i=0;i<50;i++){
                        const start=window.performance.now();draw();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
                        if(i>=10)synchronized.push(window.performance.now()-start);
                    }
                    samples.sort((a,b)=>a-b);
                    synchronized.sort((a,b)=>a-b);
                    return {submissionMedianMs:samples[60],submissionP95Ms:samples[114],submissionMeanMs:samples.reduce((a,b)=>a+b,0)/samples.length,
                        synchronizedMedianMs:synchronized[20],synchronizedP95Ms:synchronized[38],synchronizedMeanMs:synchronized.reduce((a,b)=>a+b,0)/40,
                        submissionSamples:120,synchronizedSamples:40};
                });
                report.performance.push({mode,dpr,...performance});
                report.runs.push({mode,dpr,buffer:[800*factor,600*factor],css:[1440,1080],gpu:state.gpu,textures:state.textures});
                await page.keyboard.down('ArrowRight');
                await page.evaluate(()=>{s._shipKeyboardHandler();if(s.player.body.velocity.x!==200)throw Error('movement');});
                await page.keyboard.up('ArrowRight');
                await page.keyboard.down('Space');
                await page.evaluate(()=>{s.bulletTime=-1;s._shipKeyboardHandler();const b=s.assetManager.bullets.getChildren().find(v=>v.active);if(!b||b.body.velocity.y!==-400)throw Error('shooting');});
                await page.keyboard.up('Space');
                const bossStages = [];
                await page.evaluate(()=>{s.restart();s.wave=10;s.scoreManager.setWave(10);s._startWojak();s.wojak.update(1500);for(let i=0;i<150;i++)s.wojak.hit();});
                for (const [name,delta] of [['pump',2900],['launch',1200],['contact',1200],['push',1000],['pre-exit',999]]) {
                    bossStages.push(await page.evaluate(delta=>{
                        const b=s.wojak;if(b.update(delta))throw Error('premature completion');draw();
                        if(b.completionElapsed>=5300 && Math.abs(b.godCandle.y+134*b.godCandle.scaleY-b.weaponGeometry().candles.y)>0.001)throw Error('contact');
                        return snapshot();
                    },delta));
                    if (name==='pump' || name==='push') await page.locator('canvas').screenshot({path:path.join(output,`${mode}-dpr${dpr}-${name}.png`)});
                }
                if(mode==='baseline')bossByDpr[dpr]=bossStages;
                else assert.deepEqual(bossStages,bossByDpr[dpr],'boss geometry differs');
                await page.evaluate(()=>{
                    const ship=s.wojak.sprite;s.update(s.time.now,1);
                    if(ship.active || ship.getBounds().bottom>=0 || s.state!=='waveTransition')throw Error('completion');
                    s._startNextWave();if(s.wave!==11 || s.state!=='playing')throw Error('wave progression');
                    for(const time of [2900,5300,6300,7299]){
                        s.restart();s._startWojak();const b=s.wojak;b.update(1500);for(let i=0;i<150;i++)b.hit();b.update(time);s.restart();
                        if(b.sprite || b.godCandle || b.pumpCharacter)throw Error('restart cleanup');
                    }
                });
                assert.deepEqual(errors,[]);
                await context.close();
            }
            // Pixel error against a diagnostic 4x render of the SAME prepared textures.
            // This isolates the backing buffer; it is not a source-art quality score.
            const metricPage = await browser.newPage();
            const differences = await metricPage.evaluate(async ({images,regions,dpr})=>{
                const decoded={};
                for(const [key,b64] of Object.entries(images)){
                    const i=new Image();i.src='data:image/png;base64,'+b64;await i.decode();
                    const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);
                    decoded[key]={data:x.getImageData(0,0,c.width,c.height).data,width:c.width};
                }
                return Object.entries(regions).map(([name,r])=>{
                    const scale=1.8*dpr,x0=Math.floor(r.x*scale),y0=Math.floor(r.y*scale),x1=Math.ceil((r.x+r.width)*scale),y1=Math.ceil((r.y+r.height)*scale);
                    const error=key=>{let sum=0,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)for(let ch=0;ch<3;ch++){
                        const i=(y*decoded[key].width+x)*4+ch,d=decoded[key].data[i]-decoded.reference.data[i];sum+=d*d;n++;
                    }return Math.sqrt(sum/n);};
                    const baselineRmse=error('baseline'),highRmse=error('2x');
                    return {name,baselineRmse,highRmse,errorReductionPercent:100*(1-highRmse/baselineRmse)};
                });
            },{images:Object.fromEntries(Object.entries(pictures).map(([key,b])=>[key,b.toString('base64')])),regions,dpr});
            report.differences.push({dpr,regions:differences});
            await metricPage.close();
        }
        // Canvas must retain its original buffer, with or without an override.
        const page=await browser.newPage({viewport:{width:1366,height:768}});
        await page.route('http://wojak.test/**',serve);
        await page.route('https://www.googletagmanager.com/**',r=>r.abort());
        for (const query of ['?canvas','?canvas&renderBuffer=1','?canvas&renderBuffer=2']) {
            await page.goto('http://wojak.test/'+query);
            await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
            assert.deepEqual(await page.evaluate(()=>[testGame.renderer.type,testGame.canvas.width,testGame.canvas.height]),[1,800,600]);
        }
        for (const query of ['?limited','?limited&renderBuffer=2']) {
            await page.goto('http://wojak.test/'+query);
            await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
            assert.deepEqual(await page.evaluate(()=>[testGame.renderer.type,testGame.canvas.width,testGame.canvas.height]),[2,800,600]);
        }
        for (const [query,width,height] of [['?renderBuffer=2',1600,1200],['?comparison=true&renderBuffer=1',800,600]]) {
            await page.goto('http://wojak.test/'+query);
            await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
            assert.deepEqual(await page.evaluate(()=>[testGame.renderer.type,testGame.canvas.width,testGame.canvas.height]),[2,width,height]);
        }
        await page.close();
        fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify(report));
        console.log('PASS: default 2x and explicit 1x/2x, A/B logical geometry, sprite sizes, physics bodies, camera, input, keyboard, HUD, resize, REKT/PUMP IT/God Candle, restart, wave progression, Canvas and device-limit fallback.');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

