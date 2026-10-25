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
const {getWavePlan,firingIntervalForWave,isBossMilestone,waveSeedFromSearch,randomForWave,formationFromRoll,WaveDirectorConfig:c}=load('src/interface/wave-director.ts');
const canonical=value=>JSON.stringify(value);
const legacyPlans=require('crypto').createHash('sha256'),directions=new Set();
const intro={1:'pepe',2:'ponke',6:'popcat'},seen=new Set(),combinations=new Set();
// Exact original 6x4 formation, independent of any generated plan/configuration.
const originalSlots=Array.from({length:24},(_,i)=>({x:180+(i%6)*88,y:100+Math.floor(i/6)*74}));
const diamondSlots=[2,4,6,6,4,2].flatMap((count,row)=>Array.from({length:count},(_,column)=>({x:400-(count-1)*44+column*88,y:100+row*74})));
const twinSlots=[68,468].flatMap(start=>Array.from({length:12},(_,i)=>({x:start+i%4*88,y:100+Math.floor(i/4)*74})));
const snakeSlots=Array.from({length:24},(_,i)=>({x:158+Math.floor(i/6)%2*44+i%6*88,y:100+Math.floor(i/6)*74}));
const expectedSlots=plan=>plan.formation==='grid'?originalSlots:plan.formation==='diamond'?diamondSlots:plan.formation==='SNAKE'?snakeSlots:twinSlots;
assert.equal(c.formation.twinSquads.descentIntervalMs,4000);assert.equal(c.formation.twinSquads.descentPixels,25);
assert.equal(canonical(c.formation.choices),canonical(['grid','diamond','TWIN_SQUADS','SNAKE']));
for(const [roll,expected] of [[0,'grid'],[.25-Number.EPSILON,'grid'],[.25,'diamond'],[.5-Number.EPSILON,'diamond'],[.5,'TWIN_SQUADS'],[.75-Number.EPSILON,'TWIN_SQUADS'],[.75,'SNAKE'],[1-Number.EPSILON,'SNAKE']])assert.equal(formationFromRoll(roll),expected,'exact quarter interval boundary');
for(let seed=0;seed<100;seed++){
 let previous;
 for(let wave=1;wave<=100;wave++){
  const plan=getWavePlan(wave,seed),pool=wave<2?['pepe']:wave<6?['pepe','ponke']:['pepe','ponke','popcat'];
  const {initialDirection,squads,rowGroups,...legacy}=plan;
  // Compare all pre-existing V2 rules/composition with geometry normalized to classic.
  legacy.formation='grid';legacy.slots=originalSlots;
  legacyPlans.update(JSON.stringify(legacy));
  assert.equal(initialDirection,randomForWave(seed^0x444952,wave)()<.5?-1:1,'formation never shifts the existing direction stream');
  assert([-1,1].includes(initialDirection));directions.add(initialDirection);
  assert.equal(canonical(plan),canonical(getWavePlan(wave,seed)),'reproducible, independent of request order');
  assert.equal(plan.enemies.length,24);assert.equal(plan.slots.length,24);
  assert(['grid','diamond','TWIN_SQUADS','SNAKE'].includes(plan.formation));
  assert.equal(canonical(plan.slots),canonical(expectedSlots(plan)),'exact classic or centered six-row diamond geometry');
  for(const slot of plan.slots){
   if(plan.formation==='SNAKE'){
    assert(plan.slots.some(other=>other.x===800-slot.x&&other.y===422-slot.y),'centered staggered pattern');continue;
   }
   assert(plan.slots.some(other=>other.y===slot.y&&other.x===800-slot.x),'horizontal symmetry');
   const midY=plan.formation==='diamond'?285:plan.formation==='grid'?211:174;
   assert(plan.slots.some(other=>other.x===slot.x&&other.y===2*midY-slot.y),'vertical symmetry');
  }
  if(rowGroups&&plan.formation==='SNAKE'){
   assert.equal(canonical(rowGroups.map(g=>g.slots.length)),canonical([6,6,6,6]));
   assert.equal(canonical(rowGroups.map(g=>g.initialDirection)),canonical([initialDirection,-initialDirection,initialDirection,-initialDirection]));
   assert(rowGroups.every(g=>g.bounds.left===0&&g.bounds.right===800));
  }
  if(squads){
   assert.equal(canonical(rowGroups.map(g=>g.slots.length)),canonical([4,4,4,4,4,4]));
   assert.equal(canonical(rowGroups.flatMap(g=>g.slots)),canonical(Array.from({length:24},(_,i)=>i)));
   rowGroups.forEach((g,i)=>{assert.equal(g.squad,i<3?'left':'right');assert.equal(g.row,i%3);assert.equal(g.initialDirection,i<3?initialDirection:-initialDirection);assert(g.bounds.left===0&&g.bounds.right===800);});
   assert.equal(canonical(squads.map(s=>s.slots.length)),canonical([12,12]));
   assert.equal(squads[0].initialDirection,-squads[1].initialDirection);
   assert(squads.every(g=>g.bounds.left===0&&g.bounds.right===800),'both squads patrol full playable width');
   for(const squad of squads)for(const index of squad.slots){const slot=plan.slots[index];assert(slot.x-43.68>=squad.bounds.left&&slot.x+43.68<=squad.bounds.right);}
  }
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
assert.equal(legacyPlans.digest('hex'),'b230d861bfe380ed6756e760995f88e85ced25c8fb22c1b36f521d639703a8a4',
 'all 10,000 V2 rules/composition remain identical with geometry normalized and direction omitted');
assert.equal(directions.size,2,'both starting directions available');
for(const wave of [1,2,6,14,100]){
 let left=0;const joint={},counts={grid:0,diamond:0,TWIN_SQUADS:0,SNAKE:0};
 for(let seed=0;seed<10000;seed++){
  const p=getWavePlan(wave,seed);left+=p.initialDirection===-1;counts[p.formation]++;
  const key=p.formation+':'+p.initialDirection;joint[key]=(joint[key]||0)+1;
 }
 assert(left>4700&&left<5300,'approximately 50/50 at wave '+wave+': '+left);
 Object.values(counts).forEach(count=>assert(count>2200&&count<2800,'quarter formation sampling'));
 assert.equal(Object.keys(joint).length,8);
 Object.values(joint).forEach(count=>assert(count>1000&&count<1500,'independent formation/direction distribution'));
}
const sequence=Array.from({length:100},(_,i)=>getWavePlan(i+1).initialDirection);
assert(sequence.some((direction,i)=>i>0&&direction===sequence[i-1]),'independent choices allow repeats, not forced alternation');
const formations=Array.from({length:10000},(_,i)=>getWavePlan(i+1).formation);
const counts=Object.fromEntries(['grid','diamond','TWIN_SQUADS','SNAKE'].map(f=>[f,formations.filter(x=>x===f).length]));
const diamonds=counts.diamond;
Object.values(counts).forEach(count=>assert(count>2200&&count<2800,'quarters across many waves'));
assert(formations.some((f,i)=>i>0&&f===formations[i-1]),'formation repeats allowed');
console.log('PASS: independent formation/direction distributions, four layouts, exact geometry/no overlap and unchanged V2 rules/composition hash. Counts: '+JSON.stringify(counts));
assert.equal(seen.size,4);assert.equal(combinations.size,4,'all three pairs and triple are selectable');
assert.notEqual(canonical(getWavePlan(25,1)),canonical(getWavePlan(25,2)),'seed changes plan');
for(const wave of [1,5,6,10,11,15,16,20,30,50,100,1000,100001]){
 const plan=getWavePlan(wave);
 assert.equal(plan.movementSpeed,100*Math.pow(1.02,Math.floor((wave-1)/5))*[1,1.1,1.25,1.4,1.5][(wave-1)%5]);
 assert.equal(plan.movementSpeed,getWavePlan(wave).movementSpeed,'repeated planning never compounds again');
 assert.equal(plan.firingIntervalMs,firingIntervalForWave(wave));
 assert(plan.enemies.every(type=>['pepe','ponke','popcat'].includes(type)));
 assert.equal(canonical(plan.slots),canonical(expectedSlots(plan)),'late waves retain selected geometry');
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
for(const query of ['', '?waveSeed=no', '?waveSeed=-1','?waveSeed=4294967296'])assert.equal(waveSeedFromSearch(query,()=>123),123);
assert.throws(()=>getWavePlan(0));assert.throws(()=>getWavePlan(1.5));assert.throws(()=>getWavePlan(Infinity));
// Adding an existing implemented enemy to a new registry slot needs no director logic.
const old=c.introductions.slice();c.introductions.push({type:'future-implemented-type',wave:11});
assert.equal(canonical(getWavePlan(11).enemies),canonical(Array(24).fill('future-implemented-type')));
assert(getWavePlan(12).unlocked.includes('future-implemented-type'));c.introductions=old;
for(const formation of ['grid','diamond','TWIN_SQUADS','SNAKE']){
 c.formation.choices=[formation];
 assert.equal(canonical(getWavePlan(4,123,{left:100,right:900}).slots),canonical(expectedSlots({formation}).map(s=>({x:s.x+100,y:s.y}))),'centering respects actual shifted playable bounds');
 assert.throws(()=>getWavePlan(1,123,{left:0,right:500}),/cannot fit/);
}
c.formation.choices=['grid','diamond','TWIN_SQUADS','SNAKE'];
console.log('PASS: anchored movement, exact five-wave firing cycle, unchanged threat cap, unlocks, bosses and seed handling.');

// Fresh-run entropy is controlled in tests; explicit seeds never consume it.
let entropyCalls=0;const entropy=()=>++entropyCalls*101;
assert.equal(waveSeedFromSearch('',entropy),101);assert.equal(waveSeedFromSearch('',entropy),202);
assert.equal(waveSeedFromSearch('?waveSeed=0',entropy),0);assert.equal(entropyCalls,2);
assert.equal(waveSeedFromSearch('?waveSeed=4294967295',entropy),4294967295);
const streams=[101,202].map(seed=>Array.from({length:100},(_,i)=>getWavePlan(i+1,seed).formation));
assert.notEqual(JSON.stringify(streams[0]),JSON.stringify(streams[1]));
assert.equal(JSON.stringify(streams[0]),JSON.stringify(Array.from({length:100},(_,i)=>getWavePlan(i+1,101).formation)));
assert.equal(c.formation.entrance.speed,180);assert.equal(c.formation.entrance.clearance,1);
console.log('PASS: fresh injectable run seeds; explicit zero/max seeds, no entropy draw on replay, distinct/reproducible plans, entrance constants.');

// Exercise both entropy-provider branches without relying on random outcomes.
const directorCode=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/interface/wave-director.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2015}}).outputText;
const entropyModule={exports:{}},entropyContext={module:entropyModule,exports:entropyModule.exports,require:()=>({EnemyType:{Pepe:'pepe',Ponke:'ponke',Popcat:'popcat'}}),crypto:{getRandomValues(values){assert.equal(values.length,1);values[0]=0xfedcba98;return values}}};
vm.runInNewContext(directorCode,entropyContext);assert.equal(entropyModule.exports.createGameplaySeed(),0xfedcba98);
delete entropyContext.crypto;entropyContext.Math=Object.create(Math);entropyContext.Math.random=()=>.25;
assert.equal(entropyModule.exports.createGameplaySeed(),1073741824);
console.log('PASS: Web Crypto seed provider and dependency-free fallback with controlled entropy.');
