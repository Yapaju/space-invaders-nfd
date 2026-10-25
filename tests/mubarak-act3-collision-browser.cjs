// Act III actual-PNG alpha collision and isolated contact-only diamonds.
// node tests/mubarak-act3-collision-browser.cjs <absolute screenshot output directory>
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
    let p=enter();const summaries=[];
    check(C.czAlphaThreshold===16&&C.blockingAlphaThreshold===128,'CZ low alpha threshold; shield unchanged');
    const regions={clothing:[450,250,900,480],camel:[1150,220,1400,480],glass:[450,80,900,200],rocket:[400,620,950,760],flame:[60,650,300,770]};
    for(const frame of [1,2,3])for(const direction of [-1,1]){
     p=enter();p.sprite.x=204;p.cz.x=650;p.czDirection=direction;p.cz.setTexture(M.mubarakCZTexture(frame,direction));
     const sprite=p.cz,source=sprite.texture.getSourceImage(),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);
     const w=canvas.width,h=canvas.height,data=canvas.getContext('2d').getImageData(0,0,w,h).data;
     const opaque=(x,y)=>data[(y*w+x)*4+3]>=16;
     const world=(x,y)=>({x:sprite.x+((sprite.flipX?w-x:x)-sprite.originX*w)*sprite.scaleX,y:sprite.y+((sprite.flipY?h-y:y)-sprite.originY*h)*sprite.scaleY});
     const pixelBody=(x,y)=>{const a=world(x+.25,y+.25),b=world(x+.75,y+.75);return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)}};
     let yes=0,no=0,faint=0;
     // Sample actual source alpha with independent single-pixel expectations under transforms.
     for(const transform of [0,1,2]){
      sprite.setScale(C.czDisplayWidth/w*[1,1.5,.7][transform]);sprite.setOrigin(transform===1?.3:.5,transform===1?.6:.5).setFlip(transform===2,transform===1);sprite.x+=7;sprite.y+=3;
      for(let y=0;y<h;y+=23)for(let x=0;x<w;x+=19){const b=pixelBody(x,y),hit=M.mubarakOpaqueContact(sprite,b,16)!==Infinity;check(hit===opaque(x,y),'PNG alpha oracle '+[frame,direction,transform,x,y]);if(hit)yes++;else no++}
     }
     sprite.setScale(C.czDisplayWidth/w).setOrigin(.5).setFlip(false,false);sprite.setPosition(650,100);
     // Find real faint edge pixels: >=16 remains hittable; 1..15 does not.
     for(const range of [[1,15],[16,127]]){let point;for(let y=0;y<h&&!point;y++)for(let x=0;x<w;x++){const a=data[(y*w+x)*4+3];if(a>=range[0]&&a<=range[1]){point={x,y};break}}check(point,'antialiased edge exists');check((M.mubarakOpaqueContact(sprite,pixelBody(point.x,point.y),16)!==Infinity)===(range[0]===16),'threshold boundary');faint++}
     // Full occupied laser rectangle, including edges and vertical sweep, against independent source scan.
     const oracle=b=>{const previous=b.prev?b.prev.y:b.y,left=Math.max(0,Math.floor((b.x-sprite.x)/sprite.scaleX+w/2)),right=Math.min(w,Math.ceil((b.x+b.width-sprite.x)/sprite.scaleX+w/2)),top=Math.max(0,Math.floor((b.y-sprite.y)/sprite.scaleY+h/2)),bottom=Math.min(h,Math.ceil((previous+b.height-sprite.y)/sprite.scaleY+h/2));for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(opaque(x,y))return true;return false};
     let edge=false;
     for(let y=50;y<1000;y+=75)for(let x=0;x<1500;x+=50){const at=world(x,y),b={x:at.x,y:at.y,width:6,height:12};const expected=oracle(b);check((M.mubarakOpaqueContact(sprite,b,16)!==Infinity)===expected,'full beam oracle');if(expected){const thin={...b,x:b.x+b.width/2,width:.001};if(!oracle(thin))edge=true}const swept={...b,prev:{y:b.y+15},velocity:{y:-400}};check((M.mubarakOpaqueContact(sprite,swept,16)!==Infinity)===oracle(swept),'swept beam oracle')}
     check(yes>0&&no>0&&edge,'opaque, transparent, noncenter edge fixtures');
     // Every named component is included in actual encounter targeting, including exhaust.
     const parts=[];
     for(const [name,box] of Object.entries(regions)){let point;for(let y=box[1];y<box[3]&&!point;y+=3)for(let x=box[0];x<box[2];x+=3){const sx=direction<0?w-1-x:x;if(opaque(sx,y)){point={x:sx,y};break}}check(point,'component exists '+name);check(p.act3Target(pixelBody(point.x,point.y)).kind==='cz','component targeted '+name);parts.push(name)}
     // Real lasers through completely transparent upper corner remain active in every texture.
     const transparent=shoot(sprite.getBounds().left+1,sprite.getBounds().top-17);check(transparent.active,'transparent corner passes actual laser '+[frame,direction]);transparent.destroy();
     // Opaque lasers during immunity are consumed once without hit/explosion or resetting immunity.
     p.czFlashElapsed=123;const before=p.czHits,effects=p.czHitExplosions.length;check(!shoot(sprite.x,sprite.y).active&&p.czHits===before&&p.czHitExplosions.length===effects&&p.czFlashElapsed===123,'immune opaque laser consumed once');
     // Escaping Frame 3 follows its current position without allowing further damage.
     p.cz.setTexture(M.mubarakCZTexture(3,direction));p.phase='escape';p.czHits=2;p.czFlashElapsed=800;p.update(10);check(!shoot(p.cz.x,p.cz.y).active&&p.czHits===2&&!p.czHitExplosions.length,'moving escape collision without third hit');
     summaries.push({frame,direction,yes,no,faint,parts});
    }
    // Actual PNG data is cached: precision queries must not request another image read.
    p=enter();const read=CanvasRenderingContext2D.prototype.getImageData;CanvasRenderingContext2D.prototype.getImageData=function(){throw Error('uncached alpha read')};try{for(const frame of [1,2,3])for(const direction of [-1,1]){p.cz.setTexture(M.mubarakCZTexture(frame,direction));M.mubarakOpaqueContact(p.cz,{x:p.cz.x,y:p.cz.y,width:6,height:36},16)}}finally{CanvasRenderingContext2D.prototype.getImageData=read}
    // Act III contact damages once without a blast, visual, sound, or landing hit.
    p=enter();let owner=p.act3Diamonds,impacts=0;const oldImpact=owner.impacts.impact;owner.impacts.impact=()=>{impacts++;throw Error('Act III explosion')};
    owner.fireBlack(s.player.x,s.player.y-1,[0]);const diamond=owner.flights[0],lives=s.scoreManager.lives.countActive(true);s.update(undefined,20);check(!diamond.sprite.active&&owner.flights.length===0&&s.scoreManager.lives.countActive(true)===lives-1,'direct damage removes projectile once');check(impacts===0&&!owner.effects.length&&owner.impacts.activeThreatCount===0,'no blast or area damage');s.update(undefined,200);check(s.scoreManager.lives.countActive(true)===lives-1,'no damage after removal');
    // A near miss crosses player Y within the old blast radius and keeps flying.
    owner.fireBlack(s.player.x+60,s.player.y-1,[0]);const miss=owner.flights[0];s.update(undefined,40);check(miss.sprite.active&&s.scoreManager.lives.countActive(true)===lives-1&&impacts===0,'near miss does not land or cause area damage');owner.step(2000,s.player,()=>{throw Error('miss damage')});check(!miss.sprite.active&&!owner.flights.length&&impacts===0,'miss exits world without explosion');
    // Damage protections remain owned by the scene: paused encounters reject damage.
    owner.fireBlack(s.player.x,s.player.y,[0]);const protectedShot=owner.flights[0];const state=s.state;s.state='paused';owner.step(20,s.player,()=>s._damagePlayer());check(!protectedShot.sprite.active&&s.scoreManager.lives.countActive(true)===lives-1,'scene damage protection respected');s.state=state;
    owner.impacts.impact=oldImpact;
    // Legacy Act II black projectiles still use the shared landing explosion path.
    const legacy=new D.MubarakShrapnel(s,()=>.5,()=>{});let legacyImpacts=0;legacy.impacts.impact=()=>legacyImpacts++;legacy.dropBlack(s.player.x+60,s.player.y-1);legacy.step(40,s.player,()=>{});check(legacyImpacts===1&&!legacy.flights.length,'Act II landing behavior preserved');legacy.clear();
    return {renderer,seed,summaries};
   },{renderer,seed}));
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'mubarak-act3-collision-browser.json'),JSON.stringify(reports,null,2));
  console.log('PASS: Canvas/WebGL both seeds; all six CZ PNG alpha masks, transparent/opaque/antialiased pixels, body/camel/glass/rocket/flame, origin/scale/flips, full beam/sweep/edge coverage, cached reads, immune and escaping lasers; contact-only Act III damage, no impacts/area damage, misses, player protection, legacy Act II explosions.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
