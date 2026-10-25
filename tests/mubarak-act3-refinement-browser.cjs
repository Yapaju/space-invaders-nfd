// Act III half-size CZ, damage feedback, black drops, and real-art alpha blocking.
// node tests/mubarak-act3-refinement-browser.cjs <absolute screenshot output directory>
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
   reports.push(await page.evaluate(({renderer,seed})=>{
    testGame.loop.stop();const s=testGame.scene.scenes[0],M=load('src/interface/mubarak'),C=M.MubarakAct3Settings;
    const D=load('src/interface/mubarak-shrapnel'),check=(v,l)=>{if(!v)throw Error(l)},near=(a,b,l,tol=1e-6)=>check(Math.abs(a-b)<tol,l+': '+a+' / '+b);
    const shoot=(x,y,rapid=false,previousY)=>{
     const b=s.assetManager.bullets.get();b.enableBody(true,x,y,true,true);b.shoot(x,y,rapid);b.body.preUpdate(false,0);
     if(previousY!==undefined)b.body.prev.y=previousY;s.update(undefined,0);return b;
    };
    const enter=()=>{
     s.restart();s.waveSeed=seed;s.alienManager.aliens.clear(true,true);s.state='waveTransition';s._startMubarak();
     const p=s.mubarak;p.update(M.MubarakSettings.entranceMs);for(let i=0;i<4;i++){check(p.hit(),'Act I tip');if(i<3)p.update(800)}
     p.update(0);p.update(M.mubarakFinalDuration());check(p.phase==='act2','Act II entry');p.shrapnel.clear();
     for(let i=0;i<3;i++){p.barrels.random=()=>0;p.barrels.spawn();const f=p.barrels.flights[p.barrels.flights.length-1];f.sprite.setPosition(p.sprite.x,p.sprite.y);p.tryHitBarrel(p.barrels.bounds(f.sprite));p.update(800)}
     check(p.phase==='act3'&&p.act3Diamonds,'refined Act III entry');return p;
    };
    const expose=p=>{p.sprite.x=24+p.sprite.displayWidth/2;p.cz.x=650;p.czDirection=1;p.update(0);const r=p.czBounds();return {x:r.x+r.width/2,y:r.y+r.height/2}};
    let p=enter(),root=p.sprite,cz=p.cz,base=root.scaleX;
    near(cz.displayWidth,130,'half prior260px width');near(cz.scaleX,130/1536,'new uniform CZ scale');near(cz.scaleX,cz.scaleY,'aspect ratio');near(root.y,260,'higher Mubarak lane');near(cz.y,100,'upper CZ lane below HUD');
    check(cz.getBounds().bottom<p.bodyBounds().y,'base visible artwork separated');near(p.czBounds().width,130,'full artwork broad phase');
    let target=expose(p);check(!shoot(target.x,target.y).active&&p.czHits===1&&p.czInvulnerable,'first CZ hit');
    check(cz.texture.key==='mubarak-cz-2-right'&&cz.tintTopLeft!==0xffffff&&cz.visible&&cz.alpha===1,'Frame2 red flash without hiding');
    const afterHit={x:cz.x,y:cz.y},pumps=p.act3Pumps;
    check(!shoot(target.x,target.y,true).active&&p.czHits===1,'rapid follow-up consumed without damage');
    p.pumpElapsed=2999;p.update(1);check(p.bnbCoins.length===1&&p.phase==='act3'&&p.czInvulnerable,'pumping continues during immunity');
    p.update(98);check(cz.tintTopLeft!==0xffffff&&cz.x!==afterHit.x,'first flash and continued patrol');p.update(1);check(cz.tintTopLeft===0xffffff,'100ms off phase');
    p.update(100);check(cz.tintTopLeft!==0xffffff,'second red pulse');p.update(599);check(p.czInvulnerable,'immune at799ms');
    target=expose(p);shoot(target.x,target.y);check(p.czHits===1,'799ms repeat cannot reset flash');p.update(1);check(!p.czInvulnerable&&cz.tintTopLeft===0xffffff,'800ms expiry');
    target=expose(p);const drops=p.act3Diamonds;shoot(target.x,target.y,true);
    check(p.phase==='escape'&&p.czHits===2&&cz.texture.key==='mubarak-cz-3-right'&&cz.tintTopLeft!==0xffffff,'Frame3 flashes and escapes immediately');
    testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();window.redEscapePreview=testGame.canvas.toDataURL('image/png');
    const escapedX=cz.x;p.update(50);check(cz.visible&&cz.alpha===1&&cz.x>escapedX&&cz.tintTopLeft!==0xffffff,'escape remains visible under red tint');
    check(!drops.flights.length&&!p.bnbCoins.length,'defeat clears active attacks');
    while(p.phase==='escape')p.update(10);check(p.phase==='collapse','full exit collapse');p.update(2000);check(p.phase==='complete'&&!p.update(10000),'collapse completion once');

    // Alpha oracle uses the real registered pixels and Phaser's inverse matrix.
    // Integral sums permit independent full-beam coverage checks in the fixtures.
    p=enter();root=p.sprite;base=root.scaleX;C.bnbPumpIntervalMs=Infinity;
    const summaries=[];
    for(const multiplier of [1,1.24,1.48])for(const direction of [-1,1])for(const flip of [false,true]){
     p.clearCoins();p.growthFrom=p.growthTo=multiplier;p.growthElapsed=200;p.update(0);root.x=400;p.cz.x=711;p.direction=direction;p.syncArtwork();root.setFlipX(flip);
     const canvas=root.texture.getSourceImage(),w=canvas.width,h=canvas.height,data=canvas.getContext('2d').getImageData(0,0,w,h).data;
     const stride=w+1,prefix=new Uint32Array(stride*(h+1));
     for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=data[(y*w+x)*4+3]>=128?1:0;prefix[(y+1)*stride+x+1]=prefix[y*stride+x+1]+row}}
     const occupied=(left,top,right,bottom)=>{
      left=Math.max(0,Math.floor(left));right=Math.min(w,Math.ceil(right));top=Math.max(0,Math.floor(top));bottom=Math.min(h,Math.ceil(bottom));
      if(left>=right||top>=bottom)return 0;return prefix[bottom*stride+right]-prefix[top*stride+right]-prefix[bottom*stride+left]+prefix[top*stride+left];
     };
     const oracle=body=>{
      const matrix=root.getWorldTransformMatrix(),a=matrix.applyInverse(body.x,body.y),b=matrix.applyInverse(body.x+body.width,body.y+body.height);
      let left=Math.min(a.x,b.x)+root.displayOriginX,right=Math.max(a.x,b.x)+root.displayOriginX;
      let top=Math.min(a.y,b.y)+root.displayOriginY,bottom=Math.max(a.y,b.y)+root.displayOriginY;
      if(root.flipX){const l=w-right;right=w-left;left=l}if(root.flipY){const t=h-bottom;bottom=h-top;top=t}
      return occupied(left,top,right,bottom)>0;
     };
     let opaque=0,transparentInside=0,carpet=0;
     for(let y=140;y<=1085;y+=135)for(let x=110;x<=1540;x+=130){
      const wx=root.x+(x-w/2)*root.scaleX,wy=root.y+(y-h/2)*root.scaleY;
      const b=s.assetManager.bullets.get();b.enableBody(true,wx,wy,true,true);b.shoot(wx,wy,(x+y)%2===0);b.body.preUpdate(false,0);
      const expected=oracle(b.body),contact=M.mubarakOpaqueContact(root,b.body);
      check((contact!==Infinity)===expected,'alpha oracle '+[multiplier,direction,flip,x,y]);
      const old=p.bodyBounds();if(expected){opaque++;if(y>900)carpet++}else if(b.body.x>=old.x&&b.body.x+b.body.width<=old.x+old.width&&b.body.y>=old.y&&b.body.y+b.body.height<=old.y+old.height)transparentInside++;
      s.update(undefined,0);check(b.active===!expected,'actual projectile path '+[multiplier,direction,flip,x,y]);if(b.active)b.destroy();
     }
     check(opaque>0&&transparentInside>0&&carpet>0,'body/carpet blocked, invisible rectangle removed');
     // Find a beam whose center column is transparent but an occupied edge clips art.
     let edge;
     const bw=6/root.scaleX,bh=36/root.scaleY;
     for(let y=100;y<1100-bh&&!edge;y+=20)for(let x=90;x<1550-bw;x+=4){
      if(occupied(x,y,x+bw,y+bh)>0&&occupied(x+bw/2,y,x+bw/2+1,y+bh)===0){edge={x,y};break}
     }
     check(edge,'non-center edge fixture exists');
     const lx=flip?w-edge.x-bw:edge.x,wx=root.x+(lx-w/2)*root.scaleX,wy=root.y+(edge.y-h/2)*root.scaleY;
     check(!shoot(wx+3,wy+18).active,'beam edge blocks even with clear center');
     // Origin and explicit flips are accounted for without changing source pixels.
     root.setOrigin(.35,.6).setFlipY(true);
     const body={x:root.x,y:root.y,width:6,height:36};check((M.mubarakOpaqueContact(root,body)!==Infinity)===oracle(body),'origin/Y-flip transform');
     root.setOrigin(.5).setFlip(false,false);
     summaries.push({multiplier,direction,flip,opaque,transparentInside,carpet});
    }
    // A beam can cross a transparent old-hitbox corner and still hit CZ above it.
    p=enter();root=p.sprite;root.x=400;p.direction=1;p.syncArtwork();
    const emptyX=root.x+(120-832)*root.scaleX,emptyY=root.y+(260-608)*root.scaleY;
    const laser=shoot(emptyX,emptyY);check(laser.active,'transparent corner does not consume laser');laser.destroy();
    p.cz.x=emptyX;p.update(0);const r=p.czBounds();const hitX=r.x+r.width/2;
    check(!shoot(hitX,r.y+r.height/2,true,emptyY).active&&p.czHits===1,'laser reaches CZ through transparent path');
    // Direct body shots remain blocked at the moving, scaled artwork.
    p.sprite.x+=35;check(!shoot(p.sprite.x,p.sprite.y).active&&p.act2Health===0,'opaque moving shield invulnerable');

    C.bnbPumpIntervalMs=3000;
    // Black-only drop timing tiers reuse the existing falling black projectile.
    const tiers=[];
    for(const [pumps,interval] of [[0,2500],[1,2500],[2,2000],[3,2000],[4,1500],[5,1500],[6,1000],[9,1000]]){
     p=enter();p.act3Pumps=pumps;p.pumpElapsed=0;const owner=p.act3Diamonds;owner.random=()=>0.5;
     p.update(interval-1);check(owner.flights.length===0,'no early drop tier '+pumps);p.update(1);check(owner.flights.length===1,'due single shot tier '+pumps);
     const f=owner.flights[0],o=C.blackDiamondOrigin;
     check(f.kind==='black'&&f.sprite.texture.key==='mubarak-diamond-black','existing black artwork only');near(f.sprite.displayWidth,D.MubarakShrapnelSettings.displayWidth,'existing size');near(f.vy,D.MubarakShrapnelSettings.fallSpeed,'existing fall speed');near(f.vx,0,'vertical drop');
     near(f.sprite.x,p.sprite.x,'Mubarak owns spawn X');near(f.sprite.y,p.sprite.y+(o.y-p.sprite.height/2)*p.sprite.scaleY,'lower carpet spawn Y');
     check(!owner.tryShoot(owner.bounds(f))&&f.sprite.active,'existing black laser immunity');
     const oldY=f.sprite.y;p.update(100);near(f.sprite.y-oldY,8.4,'black falls at84px/s');tiers.push({pumps,interval});
     if(pumps===0){p.update(300);testGame.renderer.preRender();s.sys.render(testGame.renderer);testGame.renderer.postRender();window.blackDropPreview=testGame.canvas.toDataURL('image/png')}
    }
    // Use the real scene damage callback, including normal last-life cleanup.
    p=enter();const owner=p.act3Diamonds;owner.fireBlack(s.player.x,s.player.y-1,[0]);const f=owner.flights[0],lives=s.scoreManager.lives.countActive(true);
    s.update(undefined,20);check(!f.sprite.active&&s.scoreManager.lives.countActive(true)===lives-1,'same black impact player damage');
    const hp=s.scoreManager.lives.countActive(true);s.update(undefined,20);check(s.scoreManager.lives.countActive(true)===hp,'one impact not duplicated');
    while(s.scoreManager.lives.countActive(true)>1)s.scoreManager.lives.getFirstAlive().setActive(false).setVisible(false);
    owner.fireBlack(s.player.x,s.player.y-1,[0]);s.update(undefined,20);check(s.state==='gameOver'&&!p.sprite&&!p.cz&&!p.act3Diamonds&&!owner.flights.length,'last-life black impact cleans encounter');
    // Escape clears existing diamonds and both cinematics stop the attack clock.
    p=enter();p.act3Diamonds.fireBlack(400,450,[0]);const drop=p.act3Diamonds.flights[0].sprite;
    target=expose(p);shoot(target.x,target.y);p.update(800);target=expose(p);shoot(target.x,target.y);
    check(!drop.active&&!p.act3Diamonds.flights.length,'escape removes active black attacks');
    const emitted=p.act3Diamonds.emitted;p.diamondElapsed=10000;
    while(p.phase==='escape'){p.update(10);check(p.act3Diamonds.emitted===emitted&&!p.act3Diamonds.flights.length,'no escape spawns even with overdue attack')}
    p.update(1000);check(p.phase==='collapse'&&p.act3Diamonds.emitted===emitted&&!p.act3Diamonds.flights.length,'no cinematic spawns');
    p.update(1000);check(p.phase==='complete'&&!p.act3Diamonds,'final diamond owner removed');
    for(const reason of ['restart','shutdown']){
     p=enter();p.act3Diamonds.fireBlack(400,450,[0]);const diamond=p.act3Diamonds.flights[0].sprite;
     if(reason==='restart')s.restart();else{testGame.scene.stop(s.sys.settings.key);testGame.scene.processQueue()}
     check(!diamond.active&&!p.act3Diamonds&&!p.sprite&&!p.cz,'diamond cleanup '+reason);
    }
    return {renderer,seed,alpha:summaries,tiers};
   },{renderer,seed}));
   for(const [name,property] of [['red-escape','redEscapePreview'],['black-drop','blackDropPreview']]){
    const preview=await page.evaluate(property=>window[property],property);
    fs.writeFileSync(path.join(output,`${name}-${renderer}-${seed}.png`),Buffer.from(preview.split(',')[1],'base64'));
   }
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-act3-refinement-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL both directions;half-scale lanes,800ms red flash/immunity/pumping, visible red escape, real-art full-beam alpha/body/carpet/transparent corners at100/124/148% with facings/flips/origin, growth-aware shield, black tiers/speed/laser immunity/player damage, cinematic gates and lifecycle.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

