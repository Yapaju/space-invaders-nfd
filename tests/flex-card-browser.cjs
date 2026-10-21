// Flex Card integration, actual enemy defeats, input isolation and PNG pixel identity.
// node tests/flex-card-browser.cjs <absolute screenshot output directory>
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
    // This suite checks the normal WD1 path; Premium progression/combat has its own suite.
    'load("src/interface/wave-director").WaveDirectorConfig.premiumInvaders.testMode.enabled=false;load("src/game");</script>';
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
    if (!file.startsWith(root + path.sep)) { await route.fulfill({ status: 403 }); return; }
    if (!fs.existsSync(file)) { await route.fulfill({ status: 404 }); return; }
    await route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' :
        file.endsWith('.png') ? 'image/png' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
}

(async () => {
 const server = require('http').createServer((request,response)=>serve({
  request:()=>({url:()=>`http://127.0.0.1:${server.address().port}${request.url}`}),
  fulfill:async({status=200,body='',contentType='text/plain'})=>{
   response.writeHead(status,{'Content-Type':contentType});response.end(body);
  }
 }));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser = await chromium.launch({channel:'chrome', headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1200,height:900}, acceptDownloads:true});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.googletagmanager.com/**',r=>r.abort());
  for (const mode of ['webgl','canvas']) {
   console.log('starting '+mode);
   await page.goto(origin+'/?waveSeed=12345'+(mode==='canvas'?'&canvas':''));
   await page.waitForFunction(()=>window.testGame && testGame.scene.scenes[0].player);
   await page.evaluate(()=>{
    const s=testGame.scene.scenes[0],check=(ok,label)=>{if(!ok)throw Error(label);};
    s.alienManager.stopMovement();s.firingTimer=Infinity;
    const shot=a=>{const b=s.assetManager.bullets.get();b.enableBody(true,a.x,a.y,true,true);b.shoot(a.x,a.y);s._bulletHitAliens(b,a);return b;};
    const a=s.alienManager.aliens.getChildren()[0],b=shot(a);
    check(s.invadersKilled===1,'regular defeat counted');
    s._bulletHitAliens(b,a);shot(a);check(s.invadersKilled===1,'duplicate and inactive enemy ignored');
    s.pendingCleanup.splice(0).forEach(f=>f());s.restart();check(s.invadersKilled===0,'restart resets kills');
    load('src/interface/wave-director').WaveDirectorConfig.premiumInvaders.testMode.enabled=true;
    s.restart();const premium=s.alienManager.aliens.getChildren().find(a=>a.premium),p=premium.premium;
    for(let i=0;i<4;i++) {const bullet=shot(premium);s._bulletHitAliens(bullet,premium);check(s.invadersKilled===0,'premium damage is not defeat');p.update(800);}
    const last=shot(premium);check(s.invadersKilled===1,'premium final defeat counts once');
    s._bulletHitAliens(last,premium);check(s.invadersKilled===1,'premium duplicate ignored');
    s.pendingCleanup.splice(0).forEach(f=>f());
    load('src/interface/wave-director').WaveDirectorConfig.premiumInvaders.testMode.enabled=false;
    s.restart();s.wave=10;s._startWojak();s.wojak.update(1500);
    for(let i=0;i<150;i++)s.wojak.hit();s.update(undefined,10000);
    check(s.invadersKilled===0,'full boss excluded');
    s.restart();s.wave=17;s.scoreManager.setWave(17);s.scoreManager.score=128450;
    s.scoreManager.print();s.invadersKilled=386;s._gameOver();
    check(Object.isFrozen(s.finalRunStats),'completed stats immutable');
    const image=s.scoreManager.gameOverImage,instruction=s.scoreManager.flexCardInstruction;
    const originalScale=.70*Math.min((s.scale.gameSize.width-40)/image.width,(s.scale.gameSize.height-80)/image.height);
    check(image.x===s.scale.gameSize.width/2&&image.y===s.scale.gameSize.height/2&&image.scaleX===originalScale,'Game Over and baked-in restart line stay fixed');
    const oldInstructionY=image.y-image.displayHeight/2+677*image.scaleX;
    check(Math.abs(instruction.y-oldInstructionY-18)<.001,'Enter instruction moves down 18 game pixels');
    check(instruction.x===s.scale.gameSize.width/2&&instruction.scaleX===image.scaleX*.76,'Enter instruction centering and size preserved');
    // The shared compositor refactor must leave the Game Over texture identical.
    const original=document.createElement('canvas');original.height=100;
    const glyphs='ENTER FOR FLEX CARD'.split('').map(letter=>letter===' '?null:s.textures.get('nfd-flex-letter-'+letter).getSourceImage());
    const widths=glyphs.map(image=>image?image.width/image.height*100:36);
    original.width=Math.ceil(widths.reduce((sum,width)=>sum+width,0));
    const context=original.getContext('2d');let x=0;
    glyphs.forEach((glyph,i)=>{if(glyph)context.drawImage(glyph,x,0,widths[i],100);x+=widths[i];});
    check(original.toDataURL()===s.textures.get('nfd-flex-card-instruction-v1').getSourceImage().toDataURL(),'Game Over instruction pixels preserved');
    window.artBounds={x:image.x,y:image.y,scale:image.scaleX};
   });
   await page.screenshot({path:path.join(output,`game-over-${mode}.png`)});
   let downloads=0;const onDownload=()=>downloads++;page.on('download',onDownload);
   await page.locator('#SpaceInvaders canvas').click({position:{x:10,y:10}});
   await page.keyboard.press('Enter');
   await page.getByRole('button',{name:'Download PNG'}).waitFor();
   await page.waitForFunction(()=>document.querySelector('[role=dialog] canvas'));
   await page.waitForFunction(()=>!document.querySelector('[aria-label="Share Flex Card"]').disabled);
   assert.equal(downloads,0,'Enter never downloads');
   assert.deepEqual(await page.evaluate(()=>{const image=testGame.scene.scenes[0].scoreManager.gameOverImage;return {x:image.x,y:image.y,scale:image.scaleX};}),
    await page.evaluate(()=>window.artBounds),'original Game Over artwork is unchanged');
   await page.screenshot({path:path.join(output,`flex-card-preview-${mode}.png`)});
   const expected=await page.evaluate(()=>document.querySelector('[role=dialog] canvas').toDataURL());
   fs.writeFileSync(path.join(output,`flex-card-sample-${mode}.png`),Buffer.from(expected.split(',')[1],'base64'));
   // Space and Enter operate focused buttons only; they cannot reach restart.
   await page.evaluate(()=>{
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.sharedData=data});
   });
   await page.getByRole('button',{name:'Share Flex Card'}).focus();
   await page.keyboard.press('Space');await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>testGame.scene.scenes[0].state),'gameOver');
   await page.evaluate(()=>{testGame.scene.scenes[0].restart();});
   assert.equal(await page.evaluate(()=>testGame.scene.scenes[0].wave),17);
   const statusBeforeDownload=await page.getByRole('status').textContent();
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download PNG'}).click()]);
   const downloaded=fs.readFileSync(await download.path());
   assert.equal(download.suggestedFilename(),'NFD-Flex-Wave17-Score128450.png');
   assert.equal(downloaded.readUInt32BE(16),1672);assert.equal(downloaded.readUInt32BE(20),941);
   assert.deepEqual(downloaded,Buffer.from(expected.split(',')[1],'base64'),'download is the preview canvas');
   assert.equal(await page.getByRole('status').textContent(),statusBeforeDownload,'download adds no visible confirmation');
   await page.getByRole('button',{name:'Close',exact:true}).click();
   assert.equal(await page.evaluate(()=>testGame.scene.scenes[0].state),'gameOver');
   // A firing key held on death may be released inside the modal, where Phaser
   // cannot see its keyup. Closing must clear that stale key state.
   await page.evaluate(()=>testGame.scene.scenes[0].fireKey.isDown=true);
   await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[role=dialog] canvas'));
   await page.keyboard.up('Space');
   assert.equal(await page.evaluate(()=>document.querySelector('[role=dialog] canvas').toDataURL()),expected,'reopen same final stats');
   await page.keyboard.press('Escape');await page.keyboard.press('Space');
   assert.deepEqual(await page.evaluate(()=>{const s=testGame.scene.scenes[0];return [s.state,s.wave,s.invadersKilled,s.scoreManager.score];}),['playing',1,0,0]);
   await page.evaluate(async()=>{
    const r=load('src/interface/flex-card-renderer');
    const background=new Image();background.src=r.FlexCardBackground;await background.decode();
    const frame=new Image();frame.src=r.FlexCardFrame;await frame.decode();
    let previousPanel,previousWaveHeight=Infinity;
    for(const wave of [1,17,100]){
     const ctx=document.createElement('canvas').getContext('2d'),stats={wave,score:128450,invadersKilled:386};
     const l=r.flexCardLayout(ctx,stats);
     if(previousPanel&&JSON.stringify(l.panel)!==previousPanel)throw Error('frame must stay fixed for every wave');
     previousPanel=JSON.stringify(l.panel);
     if(Math.abs(l.panel.width/l.panel.height-frame.naturalWidth/frame.naturalHeight)>1e-9)throw Error('frame aspect ratio');
     if(Math.abs(l.panel.x+100*360/1939-75)>.01||Math.abs(l.panel.y+110*360/1939-206.91)>.01)throw Error('visible frame top-left anchor');
     const oldHeight=r.measureFlexText(ctx,'WAVE '+wave,76,686).height+24;
     if(l.score.x!==75||l.score.y!==209+oldHeight+22)throw Error('approved score position moved');
     const images=await Promise.all(['assets/texts/nfd-hud-wave.png',...String(wave).split('').map(d=>'assets/font/nfd-font-'+d+'.png')].map(async src=>{
      const image=new Image();image.src=src;await image.decode();return image;
     }));
     const glyphCanvas=document.createElement('canvas');glyphCanvas.width=900;glyphCanvas.height=400;
     const glyphCtx=glyphCanvas.getContext('2d'),text=r.drawFlexWave(glyphCtx,images,l.wave);
     if(text.height<l.wave.height-.01&&text.width<l.wave.width-.01)throw Error('Wave lettering must fill target height or outer-frame width limit');
     if(Math.abs(text.x+text.width/2-l.wave.x)>.01||Math.abs(text.y+text.height/2-l.wave.y)>.01)throw Error('complete text not centered in frame');
     if(text.x<l.panel.x||text.x+text.width>l.panel.x+l.panel.width||text.y<l.panel.y||text.y+text.height>l.panel.y+l.panel.height)throw Error('lettering exceeds outer frame');
     const ink=load('src/interface/flex-card-instruction').nfdInkBounds(glyphCanvas);
     if(Math.abs(ink.width-text.width)>3||Math.abs(ink.height-text.height)>3)throw Error('wave artwork clipped');
     const row=load('src/interface/flex-card-instruction').composeNfdLettering(images,380,images.map((_,i)=>380*(i===0?20/96:4/96)));
     const sourceInk=load('src/interface/flex-card-instruction').nfdInkBounds(row);
     if(Math.abs(text.width/text.height-sourceInk.width/sourceInk.height)>1e-9)throw Error('wave glyph proportions changed');
     const frameScale=360/1939,outerLeft=l.panel.x+134*frameScale,outerRight=l.panel.x+1808*frameScale;
     const outerTop=l.panel.y+144*frameScale,outerBottom=l.panel.y+661*frameScale;
     const minInset=(outerRight-outerLeft)*.06;
     if(ink.left<outerLeft+minInset||ink.right>outerRight-minInset)throw Error('painted lettering violates 6% horizontal outer-border inset');
     if(ink.top<=outerTop||ink.bottom>=outerBottom)throw Error('painted lettering touches outer border');
     if(Math.abs(l.wave.x-(outerLeft+outerRight)/2)>.01||Math.abs(l.wave.y-(outerTop+outerBottom)/2)>.01)throw Error('lettering container not centered on visible frame');
     const previousScale=Math.min(l.panel.height*.44/sourceInk.height,l.panel.width*.84/sourceInk.width);
     const reduction=1-text.scale/previousScale;
     if(reduction<.15||reduction>.20)throw Error('requested 15–20% lettering reduction: '+reduction);
     if(text.height>=previousWaveHeight)throw Error('additional digits must reduce lettering proportionally');
     previousWaveHeight=text.height;
     const pixels=glyphCtx.getImageData(0,0,900,400).data;let top=400,bottom=0;
     for(let y=0;y<400;y++)for(let x=0;x<900;x++){
      const i=(y*900+x)*4;
      if(pixels[i+3]>128&&pixels[i]>150&&pixels[i+1]>90&&pixels[i]>pixels[i+2]*1.2){top=Math.min(top,y);bottom=Math.max(bottom,y);}
     }
     if(Math.abs((top+bottom+1)/2-l.wave.y)>2)throw Error('painted golden pixels not centered in dark interior');
     if(l.score.x!==l.label.x||l.label.x!==l.kills.x)throw Error('statistics left anchors');
     const actual=await r.renderFlexCard(stats),expected=document.createElement('canvas');expected.width=1672;expected.height=941;
     const ec=expected.getContext('2d');ec.drawImage(background,0,0);ec.drawImage(frame,l.panel.x,l.panel.y,l.panel.width,l.panel.height);
     const a=actual.getContext('2d').getImageData(40,175,410,160).data,b=ec.getImageData(40,175,410,160).data;
     for(let y=175;y<335;y++)for(let x=40;x<450;x++){
      if(x>=text.x-4&&x<=text.x+text.width+4&&y>=text.y-4&&y<=text.y+text.height+4)continue;
      // Compare only frame artwork; the score glow can begin below the frame.
      if(y>=l.wave.y+l.wave.height/2+8)continue;
      const i=((y-175)*410+x-40)*4;
      for(let c=0;c<4;c++)if(a[i+c]!==b[i+c])throw Error('frame is not the unmodified PNG composite');
     }
     if(Math.abs(l.kills.y-l.label.y-r.measureFlexText(ctx,'INVADERS KILLED',43,470).height-5)>.01)throw Error('kill section gap');
     const oldLabel=Math.max(518,l.score.y+r.measureFlexText(ctx,'128,450',194,730).height+24);
     if(Math.abs(l.label.y-(oldLabel-35)-24)>.01)throw Error('kill block must move down exactly 24 native pixels');
     if(l.kills.y+r.measureFlexText(ctx,'386',144,465).height>=770)throw Error('kills need at least 20px clearance above tagline');
    }
    for(const stats of [{wave:1,score:0,invadersKilled:0},{wave:999999,score:Number.MAX_SAFE_INTEGER,invadersKilled:999999999}]){
     const canvas=await r.renderFlexCard(stats),ctx=canvas.getContext('2d');
     const original=document.createElement('canvas');original.width=1672;original.height=941;
     const c=original.getContext('2d');c.drawImage(background,0,0);
     // Entire right-side artwork remains identical, including with huge scores.
     const a=ctx.getImageData(830,0,842,941).data,b=c.getImageData(830,0,842,941).data;
     if(!a.every((v,i)=>v===b[i]))throw Error('statistics overlap right artwork');
    }
    for(const score of [2660,128450]){
     const scoreCanvas=document.createElement('canvas'),labelCanvas=document.createElement('canvas');
     scoreCanvas.width=labelCanvas.width=900;scoreCanvas.height=labelCanvas.height=750;
     const scoreCtx=scoreCanvas.getContext('2d'),labelCtx=labelCanvas.getContext('2d');
     const l=r.flexCardLayout(scoreCtx,{wave:3,score,invadersKilled:66});
     r.glossyText(scoreCtx,score.toLocaleString('en-US'),l.score.x,l.score.y,194,730,['#d4ffba','#8bff64','#4bff2c','#20e719'],true);
     const glyphs=await Promise.all(r.FlexCardKillLabel.split('').map(async letter=>{
      if(letter===' ')return null;
      const image=new Image();image.src='assets/font/nfd-font-'+letter+'.png';await image.decode();return image;
     }));
     const label=r.drawFlexKillLabel(labelCtx,glyphs,l.label);
     if(label.x!==l.label.x||label.y<l.label.y||label.width>470||label.width<400)throw Error('approved label position/approximate width');
     if(label.y+label.height>=l.kills.y-4)throw Error('NFD label overlaps kill count');
     const fillText=CanvasRenderingContext2D.prototype.fillText,strokeText=CanvasRenderingContext2D.prototype.strokeText,strings=[];
     try{
      CanvasRenderingContext2D.prototype.fillText=function(text,...args){strings.push(text);return fillText.call(this,text,...args);};
      CanvasRenderingContext2D.prototype.strokeText=function(text,...args){strings.push(text);return strokeText.call(this,text,...args);};
      await r.renderFlexCard({wave:3,score,invadersKilled:66});
     }finally{CanvasRenderingContext2D.prototype.fillText=fillText;CanvasRenderingContext2D.prototype.strokeText=strokeText;}
     if(strings.some(text=>/[A-Z]/.test(text)))throw Error('Wave and kill label must use PNG artwork, never a system font');
     const a=scoreCtx.getImageData(0,0,900,750).data,b=labelCtx.getImageData(0,0,900,750).data;
     let strongestOverlap=0;
     for(let i=3;i<a.length;i+=4)if(b[i]>128)strongestOverlap=Math.max(strongestOverlap,a[i]);
     // Ignore the very faint outer blur tail; the score's outline and visible
     // glow core must remain separate from the label's painted pixels.
     if(strongestOverlap>48)throw Error('score outline/glow overlaps kill label: '+JSON.stringify({score,alpha:strongestOverlap}));
    }
   });
   page.off('download',onDownload);
   console.log(mode+': kills, full boss exclusion, modal input, snapshot, restart, native PNG and pixel identity passed');
  }
  for(const wave of [1,17,100]){
   await page.evaluate(wave=>{const s=testGame.scene.scenes[0];s.restart();s.wave=wave;s.scoreManager.score=2660;s.invadersKilled=66;s._gameOver();},wave);
   await page.keyboard.press('Enter');
   await page.waitForFunction(()=>document.querySelector('[role=dialog] canvas')&&!document.querySelector('[aria-label="Share Flex Card"]').disabled);
   const png=await page.evaluate(()=>document.querySelector('[role=dialog] canvas').toDataURL());
   fs.writeFileSync(path.join(output,`flex-card-wave${wave}-frame.png`),Buffer.from(png.split(',')[1],'base64'));
   await page.screenshot({path:path.join(output,`flex-card-wave${wave}-preview.png`)});
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download PNG'}).click()]);
   assert.deepEqual(fs.readFileSync(await download.path()),Buffer.from(png.split(',')[1],'base64'),`Wave ${wave} preview/download typography identical`);
   assert.equal(await page.getByRole('status').textContent(),'','download stays visually silent');
   if(wave===100){
    const controlsBefore=await page.getByRole('dialog').getByRole('button').evaluateAll(es=>es.map(e=>({x:e.offsetLeft,y:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight})));
    await page.evaluate(()=>{
     const c=document.querySelector('[role=dialog] canvas');
     c.toBlob=callback=>callback(null);
    });
    const logged=page.waitForEvent('console',{predicate:m=>m.type()==='error'&&m.text().includes('Flex Card PNG download failed.')});
    await page.getByRole('button',{name:'Download PNG'}).click();await logged;
    assert.equal(await page.getByRole('status').textContent(),'','download errors stay non-visual');
    assert.equal(await page.getByRole('button',{name:'Download PNG'}).isEnabled(),true,'failed download allows retry');
    assert.deepEqual(await page.getByRole('dialog').getByRole('button').evaluateAll(es=>es.map(e=>({x:e.offsetLeft,y:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight}))),controlsBefore,'download feedback never moves buttons');
    await page.evaluate(()=>delete document.querySelector('[role=dialog] canvas').toBlob);
   }
   await page.getByRole('button',{name:'Close',exact:true}).click();
  }
  // Requested final visual sample; keep all four controls in their normal state.
  await page.goto(origin+'/');await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
  await page.evaluate(()=>{
   const s=testGame.scene.scenes[0];s.wave=3;s.scoreManager.score=2660;s.invadersKilled=66;s._gameOver();
   window.open=()=>null;
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('[role=dialog] canvas')&&!document.querySelector('[aria-label="Share Flex Card"]').disabled);
  const normalBorders=await page.getByRole('dialog').getByRole('button').evaluateAll(elements=>elements.map(e=>{
   const s=getComputedStyle(e);return {width:s.width,height:s.height,border:s.border,outline:s.outlineStyle,shadow:s.boxShadow,background:s.backgroundColor};
  }));
  normalBorders.forEach(style=>{assert.deepEqual(style,normalBorders[0]);assert.equal(style.outline,'none');assert.equal(style.shadow,'none');assert.equal(style.background,'rgba(0, 0, 0, 0)');assert(style.border.startsWith('0px'));});
  // Decode the actual shipped PNGs, then measure the shared two-layer layout.
  await page.getByRole('dialog').locator('button img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  const artwork=await page.getByRole('dialog').getByRole('button').evaluateAll(elements=>elements.map(e=>{
   const b=e.getBoundingClientRect();
   return {x:b.x,y:b.y,width:b.width,height:b.height,images:Array.from(e.querySelectorAll('img')).map(image=>{
    const r=image.getBoundingClientRect(),s=getComputedStyle(image);
    return {file:image.src.split('/').pop(),width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2,
     naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,fit:s.objectFit,transform:s.transform};
   })};
  }));
  assert.equal(artwork.length,4);
  artwork.forEach((b,i)=>{
   assert.equal(b.width,58);assert.equal(b.height,58);assert.equal(b.y,artwork[0].y);
   if(i)assert.equal(b.x-artwork[i-1].x,74,'original 16px gap');
   assert.equal(b.images.length,2);
   assert.equal(b.images[0].file,'flex-card-circle-button.png');
   assert.equal(b.images[1].file,['flex-card-share.png','flex-card-download.png','flex-card-website.png','flex-card-close.png'][i]);
   b.images.forEach(image=>{
    assert.equal(image.naturalWidth,512);assert.equal(image.naturalHeight,512);
    assert.equal(image.width,58);assert.equal(image.height,58);
    assert.equal(image.cx,b.x+b.width/2);assert.equal(image.cy,b.y+b.height/2);
    assert.equal(image.fit,'contain');assert.equal(image.transform,'none');
   });
  });
  assert.equal((artwork[0].x+artwork[3].x+58)/2,600,'row centered under card');
  await page.screenshot({path:path.join(output,'flex-card-wave3-final.png')});
  const finalCard=await page.evaluate(()=>document.querySelector('[role=dialog] canvas').toDataURL());
  fs.writeFileSync(path.join(output,'flex-card-wave3-native.png'),Buffer.from(finalCard.split(',')[1],'base64'));
  await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('button',{name:'Close',exact:true}).evaluate(e=>getComputedStyle(e).outlineWidth),'2px','real keyboard focus stays visible');
  await page.getByRole('button',{name:'Open game website'}).click();
  assert.equal(await page.getByRole('button',{name:'Open game website'}).evaluate(e=>getComputedStyle(e).outlineStyle),'none','pointer click does not retain a focus ring');
  // Web Share payloads and unsupported/denied/cancelled branches on a secure origin.
  await page.goto(origin+'/');await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
  await page.evaluate(()=>{
   const s=testGame.scene.scenes[0];s.wave=17;s.scoreManager.score=128450;s.invadersKilled=386;s._gameOver();
   Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>data.files[0].type==='image/png'});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.sharedData=data});
  });
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Share Flex Card'}).click();
  await page.getByRole('status').filter({hasText:'Flex Card shared!'}).waitFor();
  const payload=await page.evaluate(async()=>{
   const d=window.sharedData,file=d.files[0];
   const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});
   return {text:d.text,url:d.url,name:file.name,type:file.type,data,preview:document.querySelector('[role=dialog] canvas').toDataURL()};
  });
  assert.equal(payload.text,'I reached Wave 17 and scored 128,450 in Space Invaders NFD! Can you beat me?');
  assert.equal(payload.url,'https://space-invaders-nfd.vercel.app');assert.equal(payload.type,'image/png');
  assert.equal(payload.name,'NFD-Flex-Wave17-Score128450.png');assert.equal(payload.data,payload.preview);
  const buttons=await page.getByRole('dialog').getByRole('button').evaluateAll(elements=>elements.map(e=>{
   return [e.offsetWidth,e.offsetHeight,e.title,e.querySelectorAll('img').length,!!e.querySelector('svg')];
  }));
  assert.equal(buttons.length,4);buttons.forEach(b=>{assert.equal(b[0],58);assert.equal(b[1],58);assert(b[2]);assert.equal(b[3],2);assert.equal(b[4],false);});
  await page.evaluate(()=>window.open=(...args)=>{window.openArgs=args;return null;});
  await page.getByRole('button',{name:'Open game website'}).click();
  assert.deepEqual(await page.evaluate(()=>window.openArgs),['https://space-invaders-nfd.vercel.app','_blank','noopener,noreferrer']);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Close',exact:true}).focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Share Flex Card','modal focus wraps');
  assert(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.screenshot({path:path.join(output,'flex-card-mobile.png')});
  await page.setViewportSize({width:844,height:390});
  for(const b of await page.getByRole('dialog').getByRole('button').all()){
   const box=await b.boundingBox();assert(box.y>=0&&box.y+box.height<=390,'landscape controls visible');
  }
  await page.setViewportSize({width:1200,height:900});
  let fallbackDownloads=0;page.on('download',()=>fallbackDownloads++);
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancelled','AbortError');}}));
  await page.getByRole('button',{name:'Share Flex Card'}).click();
  await page.getByRole('status').filter({hasText:'Sharing cancelled.'}).waitFor();assert.equal(fallbackDownloads,0);
  await page.evaluate(()=>{
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
   Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.sharedData=data});
  });
  await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Share Flex Card'}).click()]);
  await page.getByRole('status').filter({hasText:'The PNG was not attached.'}).waitFor();
  assert.equal(await page.evaluate(()=>window.sharedData.files),undefined);
  assert((await page.getByRole('textbox',{name:'Share message to copy'}).inputValue()).includes(payload.text));
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
  await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Share Flex Card'}).click()]);
  await page.getByRole('status').filter({hasText:'Native sharing is unavailable.'}).waitFor();
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('denied','NotAllowedError');}}));
  await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Share Flex Card'}).click()]);
  await page.getByRole('status').filter({hasText:'Native sharing failed.'}).waitFor();
  await page.keyboard.press('Escape');
  // Use an uncached missing asset to exercise the actual Image.onerror path.
  await page.evaluate(()=>{
   load('src/interface/flex-card-renderer').FlexCardBackground='assets/flex-card/missing-artwork.png';
   const s=testGame.scene.scenes[0];s.finalRunStats=Object.freeze({...s.finalRunStats});
  });
  await page.keyboard.press('Enter');
  await page.getByRole('status').filter({hasText:'Could not load'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Download PNG'}).isDisabled(),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>testGame.scene.scenes[0].state),'gameOver','artwork load failure leaves final run intact');
  assert.deepEqual(errors,[]);console.log('measured layout, four circular controls, share file/text/unsupported/cancel/denied, responsive layout and no browser exceptions passed');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});


