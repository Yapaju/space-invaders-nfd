// Act III rendered layer order, shield priority, and foreground effects.
// node tests/mubarak-act3-layering-browser.cjs <absolute screenshot output directory>
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
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#202428}canvas{display:block}</style>
<script src="/phaser.js"></script><script>
const __NFD_DEV__ = location.search.includes('development');
const modules = ${JSON.stringify(modules).replace(/</g, '\\u003c')}, cache = {};
function load(id) {
    if(cache[id]) return cache[id].exports;
    const module = cache[id] = {exports:{}};
    new Function('module','exports','require',modules[id])(module,module.exports, name => {
        const parts = id.split('/'); parts.pop();
        name.split('/').forEach(p => {if(p==='..')parts.pop();else if(p!=='.')parts.push(p)});
        return load(parts.join('/'));
    });
    return module.exports;
}
// Isolate original boss presentation; Premium has its own default-on suite.
load('src/interface/wave-director').WaveDirectorConfig.premiumInvaders.testMode.enabled=false;
// Explicit early-boss override for isolated combat fixtures only.
load('src/interface/mubarak').MubarakSettings.testSpawn.enabled=true;
window.testGame = new Phaser.Game({type:location.search.includes('canvas')?Phaser.CANVAS:Phaser.WEBGL,
    width:800,height:600,backgroundColor:'rgb(47,52,55)',
    audio:{noAudio:true},physics:{default:'arcade'},scene:load('src/scenes/main').MainScene});
</script>`;
async function serve(route) {
    const url = new URL(route.request().url());
    if (url.pathname === '/') { await route.fulfill({ contentType: 'text/html', body: html }); return; }
    const file = url.pathname === '/phaser.js' ? path.join(root, 'node_modules/phaser/dist/phaser.js') :
        path.resolve(root, 'dist', '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) { await route.fulfill({ status: 403 }); return; }
    if (!fs.existsSync(file)) { await route.fulfill({ status: 404 }); return; }
    await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' :
        file.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
}

(async () => {
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],reports=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('http://mubarak.test/**',serve);
  for(const renderer of ['canvas','webgl'])for(const seed of [0,3]){
   await page.goto('http://mubarak.test/?'+renderer);
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0]&&testGame.scene.scenes[0].alienManager);
   reports.push(await page.evaluate(async({renderer,seed})=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],M=load('src/interface/mubarak'),C=M.MubarakAct3Settings;
    const D=load('src/interface/mubarak-shrapnel'),A=load('src/interface/assets'),K=load('src/interface/factory/animation-factory'),B=load('src/interface/mubarak-barrels');
    const gain=load('src/interface/audio-balance').AudioBalance.gains[A.SoundType.InvaderKilled];
    const check=(v,l)=>{if(!v)throw Error(l)},near=(a,b,l,tol=1e-6)=>check(Math.abs(a-b)<tol,l+': '+a+' / '+b);
    const shoot=(x,y,rapid=false)=>{
     const b=s.assetManager.bullets.get();b.enableBody(true,x,y,true,true);b.shoot(x,y,rapid);b.body.preUpdate(false,0);s.update(undefined,0);return b;
    };
    const enter=()=>{
     s.restart();s.waveSeed=seed;s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();
     const p=s.mubarak;p.update(M.MubarakSettings.entranceMs);for(let i=0;i<4;i++){check(p.hit(),'Act I hit');if(i<3)p.update(800)}
     p.update(0);p.update(M.mubarakFinalDuration());check(p.phase==='act2','Act II entry');p.shrapnel.clear();
     for(let i=0;i<3;i++){p.barrels.random=()=>0;p.barrels.spawn();const f=p.barrels.flights[p.barrels.flights.length-1];f.sprite.setPosition(p.sprite.x,p.sprite.y);p.tryHitBarrel(p.barrels.bounds(f.sprite));p.update(800)}
     check(p.phase==='act3'&&!p.czHitExplosions.length,'Act III clean entry');return p;
    };
    let p=enter();const reports=[];
    const render=async()=>{
     s.children.depthSort();testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();
     const url=testGame.canvas.toDataURL('image/png'),image=new Image();image.src=url;await image.decode();
     const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const context=canvas.getContext('2d');context.drawImage(image,0,0,800,600);
     return {data:context.getImageData(0,0,800,600).data,url};
    };
    const mask=sprite=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const ctx=canvas.getContext('2d');ctx.drawImage(sprite.texture.getSourceImage(),sprite.x-sprite.displayOriginX*sprite.scaleX,sprite.y-sprite.displayOriginY*sprite.scaleY,sprite.displayWidth,sprite.displayHeight);return ctx.getImageData(0,0,800,600).data};
    const same=(a,b,i)=>[0,1,2].every(c=>Math.abs(a[i+c]-b[i+c])<=6);
    let overlapCases=0,transparentCases=0;
    for(const growth of [1,1.24,1.48])for(const frame of [1,2,3])for(const direction of [-1,1]){
     p=enter();p.growthFrom=p.growthTo=growth;p.growthElapsed=200;p.update(0);p.sprite.x=400;p.direction=direction;p.syncArtwork();p.cz.x=400;p.czDirection=direction;p.cz.setTexture(M.mubarakCZTexture(frame,direction));
     const root=p.sprite,cz=p.cz;check(cz.depth===9&&root.depth===10,'stable CZ9 behind Mubarak10');
     const lowerMask=mask(root),upperMask=mask(cz),both=await render();
     cz.setVisible(false);const rootOnly=await render();cz.setVisible(true);root.setVisible(false);const czOnly=await render();root.setVisible(true);
     let covered=0,holes=0;
     for(let y=60;y<145;y++)for(let x=335;x<465;x++){
      const i=(y*800+x)*4;if(upperMask[i+3]<250)continue;
      let solid=true,empty=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const alpha=lowerMask[((y+dy)*800+x+dx)*4+3];solid=solid&&alpha>=250;empty=empty&&alpha===0}
      if(solid){check(same(both.data,rootOnly.data,i),'rendered opaque Mubarak covers CZ '+[growth,frame,direction,x,y]);covered++}
      if(empty){check(same(both.data,czOnly.data,i),'CZ visible through transparent Mubarak '+[growth,frame,direction,x,y]);holes++}
     }
     if(growth===1.48){check(covered>20,'real opaque overlap fixture '+[growth,frame,direction,covered,holes]);overlapCases++}
     if(growth<1.48)check(holes>20,'CZ visible through clear areas');if(holes)transparentCases++;
     s.children.depthSort();check(s.children.list.indexOf(cz)<s.children.list.indexOf(root),'actual display list order');
     // The same opaque and transparent geometry drives current and swept projectile targeting.
     let overlap,clear;
     for(let y=60;y<145;y+=2)for(let x=335;x<465;x+=2){const b={x,y,width:1,height:1},m=M.mubarakOpaqueContact(root,b),c=M.mubarakOpaqueContact(cz,b,16);if(c===Infinity)continue;if(m!==Infinity&&!overlap)overlap=b;if(m===Infinity&&!clear)clear=b}
     if(overlap){check(p.act3Target(overlap).kind==='mubarak','overlapping opaque sprites prioritize shield');const before=p.czHits;p.receiveLaser(overlap,undefined,s.player.y);check(p.czHits===before,'opaque shield prevents CZ damage');const sweep={...overlap,prev:{y:450},velocity:{y:-400}};check(p.act3Target(sweep).kind==='mubarak','swept shield contact wins')}
     if(!clear){cz.x=650;for(let y=70;y<135&&!clear;y+=2)for(let x=600;x<700;x+=2){const b={x,y,width:1,height:1};if(M.mubarakOpaqueContact(root,b)===Infinity&&M.mubarakOpaqueContact(cz,b,16)!==Infinity){clear=b;break}}}
     check(clear&&p.act3Target(clear).kind==='cz','transparent shield reaches pixel-accurate CZ');
     // Horizontally separated CZ is still rendered at unchanged size/depth.
     cz.x=650;const separate=await render();let visible=0;for(let y=70;y<135;y++)for(let x=600;x<700;x++){const i=(y*800+x)*4;if(!same(separate.data,rootOnly.data,i))visible++}check(visible>100,'separated CZ remains visible');
     if(growth===1.48&&frame===1&&direction===1){window.overlapPreview=both.url;window.separatePreview=separate.url}
     reports.push({growth,frame,direction,covered,holes});
    }
    // Damage feedback and attack effects retain foreground depths after moving CZ back.
    p=enter();p.sprite.x=204;p.cz.x=650;p.update(0);check(!shoot(p.cz.x,p.cz.y).active&&p.czHits===1,'first accepted CZ hit');
    check(p.cz.tintTopLeft!==0xffffff&&p.cz.visible&&p.cz.depth===9,'red flash stays on visible CZ');
    check(p.czHitExplosions.length===1&&p.czHitExplosions[0].depth===13&&p.czHitExplosions[0].depth>p.sprite.depth,'hit explosion remains above both bosses');
    const normal=s.assetManager.explosions.get();near(p.czHitExplosions[0].displayWidth,normal.displayWidth*1.5,'preserved150percent explosion');normal.destroy();
    p.pumpElapsed=2999;p.diamondElapsed=2499;p.update(1);check(p.bnbCoins.length===1&&p.bnbCoins[0].sprite.depth===12,'BNB foreground depth12');check(p.act3Diamonds.flights.length===1&&p.act3Diamonds.flights[0].sprite.depth===12,'diamond foreground depth12');
    p.update(799);p.sprite.x=204;p.cz.x=650;p.update(0);check(!shoot(p.cz.x,p.cz.y).active&&p.phase==='escape'&&p.czHits===2,'second accepted hit escapes');
    let steps=0;while(p.phase==='escape'&&steps++<500){check(p.cz.depth===9&&p.sprite.depth===10,'stable escape layering');p.update(10)}check(p.phase==='collapse'&&!p.cz,'full escape enters collapse');
    const scale=p.sprite.scaleX;p.update(1000);check(p.phase==='collapse'&&p.sprite.scaleX<scale&&p.sprite.depth===10,'foreground shrink');p.update(1000);check(p.phase==='complete'&&!p.sprite,'collapse completes');
    return {renderer,seed,overlapCases,transparentCases,cases:reports};
   },{renderer,seed}));
   for(const [name,property] of [['overlap','overlapPreview'],['separated','separatePreview']]){const preview=await page.evaluate(property=>window[property],property);fs.writeFileSync(path.join(output,name+'-'+renderer+'-'+seed+'.png'),Buffer.from(preview.split(',')[1],'base64'))}
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-act3-layering-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL both seeds; rendered opaque coverage and transparent pass-through, all CZ frames/directions and1/1.24/1.48growth, separated visibility, stable9/10/12/13depths, opaque/swept shield priority, alpha CZ targeting, red flash/150percent explosions, BNB/diamonds, escape and collapse.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
