// K-weighted maximum 400 ms event loudness, including silence for short effects.
// This is an ungated comparison metric, not integrated programme LUFS.
const fs = require('fs'), path = require('path'), assert = require('assert');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const ts = require('typescript');
const balanceCode = ts.transpileModule(fs.readFileSync(path.join(root,'src/interface/audio-balance.ts'),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2015}}).outputText;
const soundTypes = {Shoot:'shoot',Kaboom:'kaboom',InvaderKilled:'invaderKilled',PopcatPop:'popcat-pop'};
const effects = [
 ['shoot', 'dist/assets/audio/shoot.wav', 1, 1],
 ['explosion', 'dist/assets/audio/explosion.wav', 1, 1],
 ['invaderKilled', 'dist/assets/audio/invaderkilled.wav', 1, 1],
 ['mouth', 'dist/assets/sounds/popcat/popcat-pop.mp3', 1, .45],
 ['giant', 'dist/assets/sounds/popcat/popcat-pop.mp3', .85, .60]
];
(async()=>{
 const browser = await chromium.launch({channel:'chrome', headless:true});
 try {
  const page = await browser.newPage();
  await page.evaluate(({balanceCode,soundTypes})=>{
   const module={exports:{}};
   new Function('module','exports','require',balanceCode)(module,module.exports,()=>({SoundType:soundTypes}));
   window.balance=module.exports;
  },{balanceCode,soundTypes});
  const results = [];
  for (const [effect,file,rate,previousGain] of effects) {
   results.push(await page.evaluate(async ({effect,base64,rate,previousGain})=>{
    const context = new OfflineAudioContext(2, 48000, 48000);
    const decoded = await context.decodeAudioData(Uint8Array.from(atob(base64), c=>c.charCodeAt(0)).buffer);
    const render = new OfflineAudioContext(2, Math.ceil((decoded.duration/rate+.4)*48000),48000);
    const source = render.createBufferSource(); source.buffer=decoded; source.playbackRate.value=rate;
    source.connect(render.destination); source.start(); const buffer = await render.startRendering();
    function filter(input,b,a) {
     const out=new Float64Array(input.length);let x1=0,x2=0,y1=0,y2=0;
     for(let i=0;i<input.length;i++) {const x=input[i],y=b[0]*x+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2;
      out[i]=y;x2=x1;x1=x;y2=y1;y1=y;}
     return out;
    }
    const energy=new Float64Array(buffer.length);let peak=0;
    for(let ch=0;ch<2;ch++) {
     const pcm=buffer.getChannelData(ch);
     for(const x of pcm)peak=Math.max(peak,Math.abs(x));
     // ITU-R BS.1770 K weighting at 48 kHz (shelf followed by RLB high pass).
     const shelf=filter(pcm,[1.53512485958697,-2.69169618940638,1.19839281085285],[1,-1.69065929318241,.73248077421585]);
     const weighted=filter(shelf,[1,-2,1],[1,-1.99004745483398,.99007225036621]);
     for(let i=0;i<weighted.length;i++)energy[i]+=weighted[i]*weighted[i];
    }
    const windowSamples=19200;let sum=0,max=0;
    for(let i=0;i<energy.length;i++){sum+=energy[i];if(i>=windowSamples)sum-=energy[i-windowSamples];max=Math.max(max,sum);}
    const loudness=-.691+10*Math.log10(max/windowSamples);
    const settings=window.balance.AudioBalance;
    const gain=effect==='giant'?settings.giantVolume:settings.gains[effect==='mouth'?'popcat-pop':effect==='explosion'?'kaboom':effect];
    return {effect,duration:decoded.duration/rate,channels:decoded.numberOfChannels,rate,peak,
     kWeighted400ms:loudness,previousGain,previousLevel:loudness+20*Math.log10(previousGain),
     gain,newLevel:loudness+20*Math.log10(gain),newPeak:peak*gain};
   },{effect,base64:fs.readFileSync(path.join(root,file)).toString('base64'),rate,previousGain}));
  }
  for(const row of results)assert(Number.isFinite(row.kWeighted400ms));
  assert(Math.max(...results.map(r=>r.newLevel))-Math.min(...results.map(r=>r.newLevel))<.15,'effects within 0.15 dB on the common event metric');
  const mixed=await page.evaluate(async files=>{
   const reports=[];
   for(const master of [1,.5,.2,0]) {
    const context=new OfflineAudioContext(2,96000,48000),volume=context.createGain();volume.gain.value=master;
    volume.connect(context.destination);
    const manager={context,masterVolumeNode:volume};
    const scene={sound:manager,game:{events:{once(){}}}};
    const limiter=window.balance.installAudioHeadroom(scene);
    if(window.balance.installAudioHeadroom(scene)!==limiter)throw Error('restart stacked limiters');
    for(const {base64,key,count} of files) {
     const buffer=await context.decodeAudioData(Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer);
     for(let i=0;i<count;i++) {
      const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
      gain.gain.value=window.balance.AudioBalance.gains[key];source.connect(gain);gain.connect(volume);
      // Simultaneous wave clear + rapid fire + player explosion + both Popcat voices.
      source.start(.05);
     }
    }
    const rendered=await context.startRendering();let peak=0;
    for(let c=0;c<rendered.numberOfChannels;c++)for(const x of rendered.getChannelData(c))peak=Math.max(peak,Math.abs(x));
    const oversampled=new OfflineAudioContext(2,rendered.length*4,192000),probe=oversampled.createBufferSource();
    probe.buffer=rendered;probe.connect(oversampled.destination);probe.start();
    const interpolated=await oversampled.startRendering();let truePeak=0;
    for(let c=0;c<2;c++)for(const x of interpolated.getChannelData(c))truePeak=Math.max(truePeak,Math.abs(x));
    reports.push({master,peak,peakDb:peak?20*Math.log10(peak):null,truePeak4x:truePeak});
   }
   return reports;
  },[
   {file:'dist/assets/audio/invaderkilled.wav',key:'invaderKilled',count:55},
   {file:'dist/assets/audio/shoot.wav',key:'shoot',count:10},
   {file:'dist/assets/audio/explosion.wav',key:'kaboom',count:1},
   {file:'dist/assets/sounds/popcat/popcat-pop.mp3',key:'popcat-pop',count:2}
  ].map(({file,...row})=>({...row,base64:fs.readFileSync(path.join(root,file)).toString('base64')})));
  for(const row of mixed)assert(row.truePeak4x<.95,'stress mix retains oversampled headroom: '+JSON.stringify(row));
  assert.equal(mixed[3].peak,0,'zero master volume is silent');
  if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({effects:results,mixed},null,2));
  console.table(results);
  console.table(mixed);
  console.log('PASS: decoded event loudness within 0.15 dB; 68 overlapping voices retain headroom at full/default/low volume; zero volume silent; restarts do not stack compressors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

