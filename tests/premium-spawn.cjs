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
const {getWavePlan,randomForWave,WaveDirectorConfig:c}=load('src/interface/wave-director.ts');
const {PremiumProgress,planPremiumFormation:plan}=load('src/interface/premium-spawn.ts');
const progress=new PremiumProgress(), positions={grid:new Set(),diamond:new Set(),TWIN_SQUADS:new Set()};
const legacyClassic=require('crypto').createHash('sha256');
const classicSlots=Array.from({length:24},(_,i)=>({x:180+i%6*88,y:100+Math.floor(i/6)*74}));
const canonical=x=>JSON.stringify(x);
function verify(p,base) {
 const slots=[];
 p.premiums.forEach(premium=>{
  assert.equal(premium.slots.length,4);
  const expected=[];
  const squad=base.squads&&base.squads.find(s=>s.id===premium.squad);
  const origin=squad?Math.min(...squad.slots.map(i=>base.slots[i].x)):180;
  if(base.squads)assert(squad,'Premium has exactly one squad owner');
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const x=origin+(premium.column+dx)*88,y=100+(premium.row+dy)*74;
   const slot=base.slots.findIndex(s=>s.x===x&&s.y===y);
   assert(slot>=0,'footprint never occupies missing diamond corners');expected.push(slot);
  }
  assert.equal(canonical(premium.slots),canonical(expected),'four actually adjacent occupied cells');
  assert(premium.column>=0&&premium.column<=(squad?2:4)&&premium.row>=0&&premium.row<=(base.formation==='grid'?2:1));
  if(squad)assert(premium.slots.every(index=>squad.slots.includes(index)),'footprint cannot span squads');
  if(base.formation==='diamond')assert(premium.slots.every(index=>base.slots[index].y<=248),'whole footprint restricted to rows 1–3');
  const first=base.slots[expected[0]],last=base.slots[expected[3]];
  assert.equal(premium.x,(first.x+last.x)/2);assert.equal(premium.y,(first.y+last.y)/2);
  assert.equal(premium.width,175.36);assert.equal(premium.height,74+87.36*282/337);
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
 verify(p,base);assert.equal(p.premiums.length,0,'locked until completed full boss defeat');
 assert.equal(p.regulars.length,24);
 assert.equal(canonical(p.regulars),canonical(base.enemies.map((type,slot)=>({slot,type}))),'no-Premium plans preserve exact WD1 placement');
}
// The retained debug switch still forces one Wojak from Wave 1.
c.premiumInvaders.testMode.enabled=true;
for(let seed=0;seed<100;seed++)for(let wave=1;wave<=100;wave++){
 const base=getWavePlan(wave,seed),p=plan(base,progress);
 verify(p,base);assert.equal(p.premiums.length,base.formation==='SNAKE'?0:1);assert.equal(p.regulars.length,base.formation==='SNAKE'?24:20);
 legacyClassic.update(JSON.stringify(plan({...base,squads:undefined,formation:'grid',slots:classicSlots},progress)));
 assert.equal(canonical(p),canonical(plan(base,progress)),'seed determinism');
 assert.equal(canonical([...new Set(p.regulars.map(r=>r.type))].sort()),canonical(base.composition.slice().sort()));
 if(p.premiums.length)positions[base.formation].add((p.premiums[0].squad||'')+p.premiums[0].row+','+p.premiums[0].column);
}
assert.equal(legacyClassic.digest('hex'),'a8feff015dc24ebfcfb516f161be6bbb3e7bf419186cf8434b7b4951421457bb','all 10,000 classic Premium plans match the original rectangular algorithm');
assert.equal(positions.grid.size,15,'all classic positions selected');
assert.equal(positions.diamond.size,4,'all four upper-half diamond anchors selected');
assert.equal(canonical([...positions.diamond].sort()),canonical(['0,2','1,1','1,2','1,3']),'exact geometrically valid upper-half anchors');
assert.equal(positions.TWIN_SQUADS.size,12,'six anchors in each squad selected');
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
let appearances=0,compatibleWaves=0,excludedSnakeHits=0;const normalPositions={grid:new Set(),diamond:new Set(),TWIN_SQUADS:new Set()};
for(let seed=0;seed<10000;seed++){
 const base=getWavePlan(14,seed),p=plan(base,progress);verify(p,base);appearances+=p.premiums.length;
 if(base.formation!=='SNAKE')compatibleWaves++;
 else if(randomForWave(seed^0x5052454d,14)()<.10)excludedSnakeHits++;
 assert.equal(p.premiums.length,base.formation!=='SNAKE'&&randomForWave(seed^0x5052454d,14)()<.10?1:0,'approved Snake exclusion; unchanged compatible 10% roll');
 if(p.premiums.length)normalPositions[base.formation].add((p.premiums[0].squad||'')+p.premiums[0].row+','+p.premiums[0].column);
 else assert.equal(p.regulars.length,24,'failed roll retains 24 regulars');
}
assert(appearances/compatibleWaves>.085&&appearances/compatibleWaves<.115,'10% measured sample among compatible waves: '+appearances+'/'+compatibleWaves);
assert(excludedSnakeHits>0,'Snake exclusion covers otherwise successful Premium rolls');
assert.equal(normalPositions.grid.size,15,'normal spawning reaches all classic positions');
assert.equal(normalPositions.diamond.size,4,'normal spawning reaches all upper-half diamond positions');
assert.equal(normalPositions.TWIN_SQUADS.size,12,'normal spawning reaches both squads');
let consecutive=false,longMiss=false;
for(let seed=0;seed<25;seed++){
 let previous=false,misses=0;
 for(let wave=14;wave<=200;wave++){
  const base=getWavePlan(wave,seed),p=plan(base,progress),spawned=p.premiums.length>0;
  const expectedRoll=base.formation!=='SNAKE'&&randomForWave(seed^0x5052454d,wave)()<.10;
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
for(let wave=14;wave<=100;wave++)assert.equal(plan(getWavePlan(wave),progress).premiums.length,getWavePlan(wave).formation==='SNAKE'?0:1,'compatible appearances, no cooldown or lifetime cap');
progress.reset();assert.equal(plan(getWavePlan(100),progress).premiums.length,0,'run reset');
// Future implemented types use the same planner; capacity depends on occupied cells.
c.premiumInvaders.types=Array.from({length:7},(_,i)=>({bossType:'future'+i,spawnProbability:1,columns:2,rows:2}));
c.premiumInvaders.types.forEach(t=>progress.recordDefeat(t.bossType,10));
for(let seed=0;seed<40;seed++){
 const base=getWavePlan(14,seed),p=plan(base,progress);verify(p,base);
 const capacity=base.formation==='SNAKE'?0:base.formation==='diamond'?2:base.formation==='TWIN_SQUADS'?4:6;
 assert.equal(p.premiums.length,capacity,'maximize actual footprint capacity');
 assert.equal(p.regulars.length,24-capacity*4);
 assert.equal(canonical(p),canonical(plan(getWavePlan(14,seed),progress)),'deterministic overflow');
}
c.premiumInvaders.types=c.premiumInvaders.types.slice(0,2);
for(let seed=0;seed<40;seed++){const base=getWavePlan(14,seed),p=plan(base,progress);verify(p,base);const count=base.formation==='SNAKE'?0:2;assert.equal(p.premiums.length,count);assert.equal(p.regulars.length,24-count*4);}
c.premiumInvaders.types[0].spawnProbability=0;
for(let seed=0;seed<40;seed++){
 const base=getWavePlan(14,seed),p=plan(base,progress);verify(p,base);
 assert.equal(p.premiums.length,base.formation==='SNAKE'?0:1);if(p.premiums.length)assert.equal(p.premiums[0].bossType,'future1','each type uses its own probability');
}
console.log('PASS: four formations, explicit Snake exclusion ('+excludedSnakeHits+' otherwise-successful hits), valid 15/4/12 compatible footprints, unchanged classic Premium hash, balanced regulars, unlock/wait/reset, '+appearances+'/'+compatibleWaves+' compatible normal rolls and valid packing.');
