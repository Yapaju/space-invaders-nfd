// Focused error recovery, shared pool and user-gesture tests, without audio hardware.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const ts=require('typescript'),{EventEmitter}=require('events');
const balanceModule={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/interface/audio-balance.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
 {module:balanceModule,exports:balanceModule.exports,WeakMap,require:()=>({SoundType:{PopcatPop:'popcat-pop',Shoot:'shoot',Kaboom:'kaboom',InvaderKilled:'invaderKilled'}})});
const balance=balanceModule.exports;
const warnings=[],moduleCopy={exports:{}};
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/interface/popcat-audio.ts'),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2015}}).outputText;
vm.runInNewContext(code,{module:moduleCopy,exports:moduleCopy.exports,WeakMap,Set,
 console:{warn:(...args)=>warnings.push(args)},require:name=>name==='./audio-balance'?balance:{SoundType:{PopcatPop:'popcat-pop'}}});
const {playPopcatSound,stopPopcatSounds,preloadPopcatAudio,installPopcatAudio}=moduleCopy.exports;
(async()=>{
 const voices=[];let fail='false',resumes=0,loaded=true;
 const manager={locked:false,mute:false,volume:0.5,context:{state:'running',resume(){resumes++;this.state='running';return Promise.resolve();}},
  add(){const voice={isPlaying:false,isPaused:false,stops:0,
   play(config){this.isPlaying=true;this.config=config;if(fail==='throw')throw Error('test device failure');return fail!=='false';},
   stop(){this.stops++;this.isPlaying=false;}};voices.push(voice);return voice;}};
 const input=new EventEmitter();input.keyboard=new EventEmitter();
 const loader=new EventEmitter();loader.audio=(key,url,config)=>{assert.equal(key,'popcat-pop');assert(url.startsWith('sounds/popcat/popcat-pop.mp3'));assert.equal(config.instances,2);};
 const scene={sound:manager,cache:{audio:{exists:()=>loaded,get:()=>({duration:0.072})}},input,load:loader,events:new EventEmitter()};
 assert.equal(playPopcatSound(scene),false);assert.equal(voices[0].isPlaying,false);assert.equal(warnings.length,1);
 assert.equal(playPopcatSound(scene),false);assert.equal(warnings.length,1,'rejection warning once');
 fail='throw';assert.equal(playPopcatSound(scene),false);assert.equal(voices[0].isPlaying,false);assert.equal(warnings.length,2);
 fail='ok';assert(playPopcatSound(scene));assert(playPopcatSound({...scene},true));
 assert.equal(voices.length,2);assert.equal(voices[0].config.volume,0.66);assert.equal(voices[1].config.volume,0.625);assert.equal(voices[1].config.rate,0.85);
 assert.equal(playPopcatSound(scene),false,'third concurrent voice dropped');stopPopcatSounds(scene);
 manager.mute=true;assert.equal(playPopcatSound(scene),false);manager.mute=false;
 manager.context.state='suspended';assert.equal(playPopcatSound(scene),false);
 installPopcatAudio(scene);input.emit('pointerdown');await Promise.resolve();assert.equal(resumes,1);assert.equal(manager.context.state,'running');
 manager.context.state='suspended';input.keyboard.emit('keydown');await Promise.resolve();assert.equal(resumes,2);
 scene.events.emit('shutdown');manager.context.state='suspended';input.emit('pointerdown');input.keyboard.emit('keydown');assert.equal(resumes,2,'listeners cleaned up');
 manager.context.state='running';loaded=false;assert.equal(playPopcatSound(scene),false);assert(warnings.some(args=>String(args[0]).includes('missing from audio cache')));
 preloadPopcatAudio(scene);loader.emit('loaderror',{key:'popcat-pop',src:'local sample'});assert(warnings.some(args=>String(args[0]).includes('load/decode failed')));
 loader.emit('complete');assert.equal(loader.listenerCount('loaderror'),0);
 console.log('PASS: rejected/throwing playback warns and frees voices, recovery reuses pool, global cap, mute/cache guards, loader errors, pointer/keyboard context resume and shutdown cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
