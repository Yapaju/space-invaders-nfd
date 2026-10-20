// Popcat real Web Audio / HTML5 playback and gameplay-event integration.
// node tests/popcat-audio-browser.cjs <absolute screenshot output directory>
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
modules['src/game'] = modules['src/game'].replace('const game =', 'window.testGame =')
    .replace('const config = {', 'const config = { audio: {disableWebAudio: location.search.includes("html5")},');
const bootstrap = '<script src="/phaser.js"></script><script>' +
    'const modules=' + JSON.stringify(modules).replace(/</g, '\\u003c') + ',cache={};' +
    'function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};' +
    'new Function("module","exports","require",modules[id])(m,m.exports,name=>{' +
    'if(name==="phaser")return Phaser;const p=id.split("/");p.pop();' +
    'name.split("/").forEach(v=>{if(v==="..")p.pop();else if(v!==".")p.push(v)});return load(p.join("/"))});return m.exports;}' +
    // This suite checks the normal WD1 path; Premium has its own default-on integration suite.
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
        file.endsWith('.mp3') ? 'audio/mpeg' : file.endsWith('.png') ? 'image/png' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
}

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=user-gesture-required']});
 const reports=[];
 try{
  for(const backend of ['webaudio','html5']){
   const page=await browser.newPage({viewport:{width:1200,height:900},hasTouch:backend==='html5'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://wojak.test/**',serve);
   await page.route('https://www.googletagmanager.com/**',r=>r.abort());
   const externalAudio=[];page.on('request',request=>{if(/myinstants|pop-cat-original-meme/.test(request.url()))externalAudio.push(request.url());});
   await page.goto('http://wojak.test/'+(backend==='html5'?'?html5':''));
   await page.waitForFunction(()=>window.testGame&&testGame.scene.scenes[0].player);
   const initial=await page.evaluate(async()=>{
    window.s=testGame.scene.scenes[0];window.audio=load('src/interface/popcat-audio');
    s.firingTimer=Infinity;s.alienManager.stopMovement();window.manager=s.sound;
    if(manager.context){await manager.context.suspend();manager.locked=true;manager.unlock();}
    const locked=manager.locked,muted=manager.mute;
    manager.locked=true;
    if(audio.playPopcatSound(s)!==false)throw Error('locked event must be dropped');
    manager.locked=locked;
    return {locked,muted,context:manager.context&&manager.context.state};
   });
   // Trusted browser gesture: Phaser performs its normal unlock without our code resuming audio.
   if(backend==='html5')await page.touchscreen.tap(600,450);else await page.mouse.click(600,450);
   await page.waitForFunction(()=>!s.sound.locked&&(!s.sound.context||s.sound.context.state==='running'));
   if(backend==='webaudio'){
    await page.evaluate(async()=>{await manager.context.suspend();manager.locked=false;});
    await page.mouse.click(600,450);
    await page.waitForFunction(()=>manager.context.state==='running');
   }
   const report=await page.evaluate(async()=>{
    testGame.loop.stop();
    const check=(ok,label)=>{if(!ok)throw Error(label);};
    const near=(a,b,label)=>check(Math.abs(a-b)<0.0001,label+': '+a+' != '+b);
    const w=load('src/interface/popcat-weapons'),key=load('src/interface/assets').SoundType.PopcatPop;
    window.popEvents=[];const add=manager.add;
    const observe=voice=>voice.on('play',()=>popEvents.push({rate:voice.rate,volume:voice.currentConfig.volume}));
    manager.sounds.filter(v=>v.key===key).forEach(observe);
    manager.add=function(soundKey,...args){const voice=add.call(this,soundKey,...args);
     if(soundKey===key)observe(voice);return voice;};
    const clear=()=>{audio.stopPopcatSounds(s);s.assetManager.enemyBullets.clear(true,true);popEvents.length=0;};
    const aliens=s.alienManager.aliens.getChildren();
    const fire=(direction,special=false,x=400,who=aliens[0])=>{
     who.configure('popcat',direction);who.setPosition(x,140);who.body.preUpdate(false,0);
     s.alienManager.getRandomAliveEnemy=()=>who;
     const frac=Phaser.Math.RND.frac;Phaser.Math.RND.frac=()=>special?0.8:0.1;
     try{s._enemyFires();}finally{Phaser.Math.RND.frac=frac;}s.firingTimer=Infinity;
     return s.assetManager.enemyBullets.getChildren().slice();
    };
    for(const direction of [-1,1]){
     clear();let shots=fire(direction);
     check(shots.length===5&&popEvents.length===1,'one mouth pop per shotgun');
     check(aliens[0].texture.key===`popcat-open-${direction<0?'left':'right'}`,'mouth direction');
     near(popEvents[0].rate,1,'normal rate');near(popEvents[0].volume,0.66,'balanced normal volume');
     for(let frame=0;frame<20;frame++)aliens[0].preUpdate(frame*16,16);
     check(popEvents.length===1,'no mouth frame repeats');
     clear();shots=fire(direction,true);check(shots.length===1&&popEvents.length===1,'kernel mouth pop');
     const kernel=shots[0];kernel.y=322;kernel.body.velocity.y=140;kernel.preUpdate(100,16);
     check(popEvents.length===2,'one transformation pop');
     near(popEvents[1].rate,0.85,'deeper transformation');near(popEvents[1].volume,0.625,'balanced transformation');
     for(let frame=0;frame<30;frame++)kernel.preUpdate(116+frame*16,16);
     check(popEvents.length===2,'no transformation repeats');
     clear();fire(direction,false,direction>0?770:30);
     check(s.assetManager.enemyBullets.getLength()===0&&popEvents.length===0,'blocked attack silent');
     check(aliens[0].texture.key===`popcat-${direction<0?'left':'right'}`,'blocked mouth closed');
    }
    clear();const important=manager.add('shoot');important.play();
    for(let i=0;i<3;i++)fire(1,false,400,aliens[i]);
    check(s.assetManager.enemyBullets.getLength()===15,'three whole shotguns fit the director budget');
    check(!audio.playPopcatSound(s),'audio pool independently caps a third overlapping pop');
    check(popEvents.length===2,'global two-voice cap');
    check(important.isPlaying,'important player sound not interrupted');
    audio.stopPopcatSounds(s);check(important.isPlaying,'cleanup affects only Popcat');important.stop();
    const voices=manager.sounds.filter(v=>v.key===key);check(voices.length===2,'bounded reusable pool');
    clear();audio.playPopcatSound(s);manager.mute=true;
    await new Promise(resolve=>setTimeout(resolve,20));
    if(manager.context)near(manager.masterMuteNode.gain.value,0,'global mute node');
    else check(voices.some(v=>v.audio&&v.audio.muted),'HTML5 global mute');
    const count=popEvents.length;check(!audio.playPopcatSound(s,true)&&popEvents.length===count,'muted events dropped');
    manager.mute=false;await new Promise(resolve=>setTimeout(resolve,20));clear();manager.volume=0;
    await new Promise(resolve=>setTimeout(resolve,20));
    check(!audio.playPopcatSound(s)&&popEvents.length===0,'zero volume events dropped');
    manager.volume=0.2;await new Promise(resolve=>setTimeout(resolve,20));check(audio.playPopcatSound(s),'unmuted playback');
    near(manager.volume,0.2,'master volume preserved');
    const active=voices.find(v=>v.isPlaying);near(active.currentConfig.volume,0.66,'local gain preserved');
    if(active.audio)near(active.audio.volume,0.132,'HTML5 multiplied master volume');
    if(manager.context){
     clear();await manager.context.suspend();check(!audio.playPopcatSound(s),'suspended context drops event');
     await manager.context.resume();
    }
    clear();let peak=null,decodedPeak=null,decodedDuration=null;
    if(manager.context){
     const buffer=s.cache.audio.get(key);decodedDuration=buffer.duration;
     decodedPeak=Math.max(...buffer.getChannelData(0).map(Math.abs));
     check(decodedPeak>=0.65&&decodedPeak<1,'normalized decoded sample level');
     check(decodedDuration>0.02&&decodedDuration<0.15,'short single-pop sample');
    }
    if(manager.context){
     const analyser=manager.context.createAnalyser();analyser.fftSize=2048;load('src/interface/audio-balance').installAudioHeadroom(s).connect(analyser);
     check(audio.playPopcatSound(s),'decoded MP3 plays');
     const waveform=new Float32Array(2048);peak=0;
     const until=performance.now()+180;
     while(performance.now()<until){
      await new Promise(resolve=>setTimeout(resolve,5));analyser.getFloatTimeDomainData(waveform);
      peak=Math.max(peak,...waveform.map(Math.abs));
     }
     check(peak>=0.03,'clearly measurable Popcat output, not merely nonzero');
     load('src/interface/audio-balance').installAudioHeadroom(s).disconnect(analyser);analyser.disconnect();
    }else check(audio.playPopcatSound(s),'HTML5 MP3 plays');
    // HTML5 decoding/startup may lag wall-clock timers. Advance the normal
    // sound-manager update until native playback completes, with a bounded wait.
    const completionDeadline=performance.now()+2000;
    while(voices.some(v=>v.isPlaying)&&performance.now()<completionDeadline){
     await new Promise(resolve=>setTimeout(resolve,20));manager.update(performance.now(),16);
    }
    check(voices.every(v=>!v.isPlaying),'voices release after native sample completion');
    check(audio.playPopcatSound(s,true),'voice reusable after natural completion');
    check(manager.sounds.filter(v=>v.key===key).length===2,'pool never grows');
    s.restart();check(voices.every(v=>!v.isPlaying),'restart stops Popcat voices');
    check(audio.playPopcatSound(s),'reuse after restart');s._gameOver();
    check(voices.every(v=>!v.isPlaying),'game over stops Popcat voices');
    s.restart();audio.playPopcatSound(s);s.scene.stop();testGame.scene.processQueue();
    check(voices.every(v=>!v.isPlaying),'shutdown stops Popcat voices');
    return {backend:manager.context?'webaudio':'html5',voices:2,normalVolume:0.66,giantVolume:0.625,giantRate:0.85,outputPeak:peak,decodedPeak,decodedDuration};
   });
   assert.deepEqual(errors,[]);assert.deepEqual(externalAudio,[],'no external audio requests');reports.push({...report,initial});await page.close();
  }
  fs.writeFileSync(path.join(output,'popcat-audio-measurements.json'),JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports));
  console.log('PASS: real WebAudio/HTML5 MP3 loading/playback, both attacks/facings, single transformation event, blocked attacks silent, global cap, player audio preserved, mute/unmute/master volume, gesture unlock/suspended context, natural voice reuse, restart/game-over/shutdown cleanup.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
