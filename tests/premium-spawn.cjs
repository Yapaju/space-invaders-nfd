// Pure seeded occupancy, unlock and probability regression checks.
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
const {getWavePlan,WaveDirectorConfig:c}=load('src/interface/wave-director.ts');
const {PremiumProgress,planPremiumFormation:plan}=load('src/interface/premium-spawn.ts');
const progress=new PremiumProgress(), positions=new Set();
const canonical=x=>JSON.stringify(x);
function verify(p) {
 const slots=[];
 p.premiums.forEach(premium=>{
  assert.equal(premium.slots.length,4);
  assert.equal(canonical(premium.slots),canonical([premium.row*6+premium.column,premium.row*6+premium.column+1,(premium.row+1)*6+premium.column,(premium.row+1)*6+premium.column+1]));
  assert(premium.column>=0&&premium.column<=4&&premium.row>=0&&premium.row<=2);
  slots.push(...premium.slots);
 });
 slots.push(...p.regulars.map(r=>r.slot));
 assert.equal(slots.length,24);assert.equal(new Set(slots).size,24,'no overlap, no holes');
 assert(slots.every(slot=>slot>=0&&slot<24));
 const counts={};p.regulars.forEach(r=>counts[r.type]=(counts[r.type]||0)+1);
 if(Object.keys(counts).length)assert(Math.max(...Object.values(counts))-Math.min(...Object.values(counts))<=1,'balanced remaining normals');
}
assert.equal(c.premiumInvaders.testMode.enabled,false,'normal spawning is the production default');
assert.equal(c.premiumInvaders.testMode.forceWojakEveryRegularWave,true);
for(let seed=0;seed<100;seed++)for(let wave=1;wave<=100;wave++){
 const base=getWavePlan(wave,seed),p=plan(base,progress);
 verify(p);assert.equal(p.premiums.length,0,'locked until completed full boss defeat');
 assert.equal(p.regulars.length,24);
 assert.equal(canonical(p.regulars),canonical(base.enemies.map((type,slot)=>({slot,type}))),'no-Premium plans preserve exact WD1 placement');
}
// The retained debug switch still forces one Wojak from Wave 1.
c.premiumInvaders.testMode.enabled=true;
for(let seed=0;seed<100;seed++)for(let wave=1;wave<=100;wave++){
 const base=getWavePlan(wave,seed),p=plan(base,progress);
 verify(p);assert.equal(p.premiums.length,1);assert.equal(p.regulars.length,20);
 assert.equal(canonical(p),canonical(plan(base,progress)),'seed determinism');
 assert.equal(canonical([...new Set(p.regulars.map(r=>r.type))].sort()),canonical(base.composition.slice().sort()));
 positions.add(p.premiums[0].row+','+p.premiums[0].column);
}
assert.equal(positions.size,15,'every possible top-left position selected');
c.premiumInvaders.testMode.enabled=false;
for(let wave=1;wave<=100;wave++)assert.equal(plan(getWavePlan(wave),progress).premiums.length,0,'locked boss');
progress.recordDefeat('wojak',10);
for(const wave of [10,11,12,13])assert.equal(progress.eligible('wojak',wave),false);
assert.equal(progress.eligible('wojak',14),true);
assert.equal(progress.eligible('futureBoss',100),false,'unlock tracked per boss type');
progress.recordDefeat('futureBoss',20);
assert.equal(progress.eligible('futureBoss',23),false);
assert.equal(progress.eligible('futureBoss',24),true,'each type has its own three-wave wait');
progress.recordDefeat('wojak',20);assert.equal(progress.eligible('wojak',14),true,'only first defeat controls unlock');
assert.equal(c.premiumInvaders.types[0].spawnProbability,.10);
let appearances=0;const normalPositions=new Set();
for(let seed=0;seed<10000;seed++){
 const p=plan(getWavePlan(14,seed),progress);verify(p);appearances+=p.premiums.length;
 if(p.premiums.length)normalPositions.add(p.premiums[0].row+','+p.premiums[0].column);
 else assert.equal(p.regulars.length,24,'failed roll retains 24 regulars');
}
assert(appearances>850&&appearances<1150,'10% measured sample: '+appearances);
assert.equal(normalPositions.size,15,'normal 10% spawning reaches all 15 positions');
let consecutive=false,longMiss=false;
for(let seed=0;seed<25;seed++){
 let previous=false,misses=0;
 for(let wave=14;wave<=200;wave++){
  const base=getWavePlan(wave,seed),p=plan(base,progress),spawned=p.premiums.length>0;
  const expectedRoll=load('src/interface/wave-director.ts').randomForWave(seed^0x5052454d,wave)()<.10;
  assert.equal(spawned,expectedRoll,'one independent seeded chance, no history or pity adjustment');
  assert.equal(canonical(p),canonical(plan(base,progress)),'repeat planning never rerolls');
  if(spawned&&previous)consecutive=true;
  misses=spawned?0:misses+1;if(misses>=10)longMiss=true;
  previous=spawned;
 }
}
assert(consecutive,'consecutive appearances occur at actual 10%');
assert(longMiss,'no guarantee every ten eligible waves');
c.premiumInvaders.types[0].spawnProbability=1;
for(const wave of [11,12,13])assert.equal(plan(getWavePlan(wave),progress).premiums.length,0);
for(let wave=14;wave<=100;wave++)assert.equal(plan(getWavePlan(wave),progress).premiums.length,1,'consecutive appearances, no cooldown or lifetime cap');
progress.reset();assert.equal(plan(getWavePlan(100),progress).premiums.length,0,'run reset');
// Future implemented types use the same planner; physical capacity is six 2x2 footprints.
c.premiumInvaders.types=Array.from({length:7},(_,i)=>({bossType:'future'+i,spawnProbability:1,columns:2,rows:2}));
c.premiumInvaders.types.forEach(t=>progress.recordDefeat(t.bossType,10));
for(let seed=0;seed<40;seed++){
 const p=plan(getWavePlan(14,seed),progress);verify(p);
 assert.equal(p.premiums.length,6,'maximize physical capacity, not one-per-wave');
 assert.equal(p.regulars.length,0);
 assert.equal(canonical(p),canonical(plan(getWavePlan(14,seed),progress)),'deterministic overflow');
}
c.premiumInvaders.types=c.premiumInvaders.types.slice(0,2);
for(let seed=0;seed<40;seed++){const p=plan(getWavePlan(14,seed),progress);verify(p);assert.equal(p.premiums.length,2);assert.equal(p.regulars.length,16);}
c.premiumInvaders.types[0].spawnProbability=0;
for(let seed=0;seed<40;seed++){
 const p=plan(getWavePlan(14,seed),progress);verify(p);
 assert.equal(p.premiums.length,1);assert.equal(p.premiums[0].bossType,'future1','each type uses its own probability');
}
console.log('PASS: default OFF, 10,000 locked and forced plans, exact 24 regulars on misses, all 15 normal footprints, balanced 20 normals, per-type unlock/wait/reset, '+appearances+'/10000 normal 10% rolls, independent consecutive spawns/no pity and deterministic multi-Premium packing/overflow.');
