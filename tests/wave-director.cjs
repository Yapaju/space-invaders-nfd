const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ts = require('typescript'), cache = {};
function load(file) {
 file=path.resolve(__dirname,'..',file);
 if(cache[file])return cache[file].exports;
 const module=cache[file]={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2015}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(file),name+'.ts')))});
 return module.exports;
}
const {getWavePlan,firingIntervalForWave,isBossMilestone,waveSeedFromSearch,WaveDirectorConfig:c}=load('src/interface/wave-director.ts');
const canonical=value=>JSON.stringify(value);
const intro={1:'pepe',2:'ponke',6:'popcat'},seen=new Set(),combinations=new Set();
// Exact original 6x4 formation, independent of any generated plan/configuration.
const originalSlots=Array.from({length:24},(_,i)=>({x:180+(i%6)*88,y:100+Math.floor(i/6)*74}));
for(let seed=0;seed<100;seed++){
 let previous;
 for(let wave=1;wave<=100;wave++){
  const plan=getWavePlan(wave,seed),pool=wave<2?['pepe']:wave<6?['pepe','ponke']:['pepe','ponke','popcat'];
  assert.equal(canonical(plan),canonical(getWavePlan(wave,seed)),'reproducible, independent of request order');
  assert.equal(plan.enemies.length,24);assert.equal(plan.slots.length,24);
  assert.equal(plan.formation,'grid');
  assert.equal(canonical(plan.slots),canonical(originalSlots),'every original slot occupied, with exact original geometry');
  assert(plan.enemies.every(type=>pool.includes(type)),'locked enemies excluded');
  const types=[...new Set(plan.enemies)];
  if(intro[wave])assert.equal(canonical(types),canonical([intro[wave]]));
  else {assert(types.length>=2&&types.length<=3);if(wave<6)assert.equal(types.length,2);}
  assert.equal(plan.speedMultiplier,[1,1.1,1.25,1.4,1.5][(wave-1)%5]);
  assert.equal(plan.baselineMultiplier,Math.pow(1.02,Math.floor((wave-1)/5)));
  assert.equal(plan.movementSpeed,100*plan.baselineMultiplier*plan.speedMultiplier);
  assert.equal(plan.firingIntervalMs,1610*Math.pow(.98,Math.floor((wave-1)/5))*[1,.9,.75,.6,.5][(wave-1)%5]);
  if(previous){
   if((wave-1)%5!==0)assert(plan.firingIntervalMs<previous.firingIntervalMs);
  }
  assert.equal(plan.bossAfter,wave%10===0);
  for(let i=0;i<24;i++){
   const a=plan.slots[i];assert(a.x-87.36/2>=0&&a.x+87.36/2<=800&&a.y-73.11/2>=0&&a.y+73.11/2<=600);
   for(let j=i+1;j<24;j++){const b=plan.slots[j];assert(Math.abs(a.x-b.x)>=87.36||Math.abs(a.y-b.y)>=73.11,'safe artwork spacing');}
  }
  seen.add(plan.formation);if(wave>6)combinations.add(types.slice().sort().join(','));previous=plan;
 }
}
assert.equal(seen.size,1);assert.equal(combinations.size,4,'all three pairs and triple are selectable');
assert.notEqual(canonical(getWavePlan(25,1)),canonical(getWavePlan(25,2)),'seed changes plan');
for(const wave of [1,5,6,10,11,15,16,20,30,50,100,1000,100001]){
 const plan=getWavePlan(wave);
 assert.equal(plan.movementSpeed,100*Math.pow(1.02,Math.floor((wave-1)/5))*[1,1.1,1.25,1.4,1.5][(wave-1)%5]);
 assert.equal(plan.movementSpeed,getWavePlan(wave).movementSpeed,'repeated planning never compounds again');
 assert.equal(plan.firingIntervalMs,firingIntervalForWave(wave));
 assert(plan.enemies.every(type=>['pepe','ponke','popcat'].includes(type)));
 assert.equal(canonical(plan.slots),canonical(originalSlots),'late waves retain original geometry');
}
for(const wave of [6,11,16,21,101,1001])assert.equal(getWavePlan(wave).movementSpeed,100*Math.pow(1.02,(wave-1)/5));
assert(getWavePlan(1000).movementSpeed>1000,'baseline growth has no gameplay cap');
assert.throws(()=>getWavePlan(Number.MAX_SAFE_INTEGER),/finite Number range/,'numeric overflow is explicit, not clamped');
const expectedTimers={1:1610,2:1449,3:1207.5,4:966,5:805,6:1577.8,7:1420.02,8:1183.35,9:946.68,10:788.9,11:1546.244,15:773.122};
for(const [wave,timer] of Object.entries(expectedTimers))assert(Math.abs(firingIntervalForWave(+wave)-timer)<1e-9,'specified timer at '+wave);
for(const wave of [1,2,3,4,5,6,7,8,9,10,11,15,20,50,100]){
 const expected=1610*Math.pow(.98,Math.floor((wave-1)/5))*[1,.9,.75,.6,.5][(wave-1)%5];
 assert.equal(firingIntervalForWave(wave),expected);
 assert.equal(firingIntervalForWave(wave),expected,'repeat calls do not compound');
 assert.equal(firingIntervalForWave(wave),getWavePlan(wave).firingIntervalMs,'same plan and scheduler formula');
}
for(const wave of [6,11,16,21,51,101]){
 assert.equal(firingIntervalForWave(wave),1610*Math.pow(.98,(wave-1)/5));
 assert(firingIntervalForWave(wave)>firingIntervalForWave(wave-1),'cycle position resets to longer timer');
}
assert(firingIntervalForWave(1000)<20,'no minimum timer cap');
assert.equal(c.firing.maxHostileThreats,15);
assert(!('minimumIntervalMs' in c.firing)&&!('halfProgressWaveOffset' in c.firing),'old progression removed');
for(const wave of [10,20,30])assert(isBossMilestone(wave));assert(!isBossMilestone(0));assert(!isBossMilestone(11));
assert.equal(waveSeedFromSearch('?waveSeed=0'),0);assert.equal(waveSeedFromSearch('?x=1&waveSeed=42'),42);
for(const query of ['', '?waveSeed=no', '?waveSeed=-1','?waveSeed=4294967296'])assert.equal(waveSeedFromSearch(query),c.seed);
assert.throws(()=>getWavePlan(0));assert.throws(()=>getWavePlan(1.5));assert.throws(()=>getWavePlan(Infinity));
// Adding an existing implemented enemy to a new registry slot needs no director logic.
const old=c.introductions.slice();c.introductions.push({type:'future-implemented-type',wave:11});
assert.equal(canonical(getWavePlan(11).enemies),canonical(Array(24).fill('future-implemented-type')));
assert(getWavePlan(12).unlocked.includes('future-implemented-type'));c.introductions=old;
assert.equal(canonical(getWavePlan(4,123,{left:100,right:900}).slots),canonical(originalSlots.map(s=>({x:s.x+100,y:s.y}))),'original centering formula respects world bounds');
console.log('PASS: 10,000 plans; anchored movement/grid, exact five-wave firing cycle with compounded reduction, no double compounding/minimum cap, old curve removed, threat cap 15, unlocks, bosses and seed handling.');
