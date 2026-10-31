const assert=require('assert/strict');const {Engine,merge}=require('../sync-engine.js');
const copy=x=>JSON.parse(JSON.stringify(x));const item=(id,name)=>({id,name,url:'https://example.com/'+id,category:'工具与网络'});
const valid=a=>Array.isArray(a)&&new Set(a.map(x=>x.id)).size===a.length;
class Storage{constructor(){this.data={};this.fail=false;}getItem(k){return this.data[k]||null;}setItem(k,v){if(this.fail)throw Error('quota');this.data[k]=v;}}
let db={entries:[],revision:null},offline=false;
const remote={async read(){if(offline)throw Error('offline');return copy(db);},async write(entries,revision){if(offline)throw Error('offline');if(revision!==db.revision)return null;db={entries:copy(entries),revision:(revision||0)+1};return copy(db);}};
function engine(storage=new Storage(),userId='u1'){const e=new Engine({userId,storage,remote,validate:valid});e.schedule=()=>{};return e;}
(async()=>{
const a=engine(),b=engine();await a.sync();await b.sync();assert(a.ready&&b.ready);
assert(a.commit([item('a','A')]));await a.sync();assert.equal(db.revision,1);
assert(b.commit([item('b','B')]));await b.sync();assert.deepEqual(db.entries.map(x=>x.id),['a','b']);
await a.sync();assert.equal(a.state.entries.length,2);
assert(a.commit(a.state.entries.map(x=>x.id==='a'?{...x,name:'A1'}:x)));await a.sync();
assert(b.commit(b.state.entries.map(x=>x.id==='a'?{...x,category:'校园与课程'}:x)));await b.sync();assert.equal(db.entries[0].name,'A1');assert.equal(db.entries[0].category,'校园与课程');
await a.sync();a.commit(a.state.entries.map(x=>x.id==='a'?{...x,name:'from A'}:x));b.commit(b.state.entries.map(x=>x.id==='a'?{...x,name:'from B'}:x));await a.sync();assert.equal(await b.sync(),false);assert(b.conflict);assert.equal(db.entries[0].name,'from A');b.resolve('local');await b.sync();assert.equal(db.entries[0].name,'from B');
await a.sync();assert(a.commit(a.state.entries.filter(x=>x.id!=='a')));b.commit(b.state.entries.map(x=>x.id==='a'?{...x,name:'edit during deletion'}:x));await a.sync();await b.sync();assert(b.conflict);b.resolve('remote');await b.sync();assert.equal(db.entries.some(x=>x.id==='a'),false);
const store=new Storage(),c=engine(store);await c.sync();offline=true;c.commit([...c.state.entries,item('c','offline C')]);await c.sync();assert(c.state.dirty);const restored=engine(store);assert.equal(restored.state.entries.at(-1).name,'offline C');offline=false;await restored.sync();assert(db.entries.some(x=>x.id==='c'));assert(!restored.state.dirty);
store.fail=true;const before=copy(c.state.entries);assert.equal(c.commit([]),false);assert.deepEqual(c.state.entries,before);store.fail=false;
const anotherUser=engine(store,'u2');assert.equal(anotherUser.state.entries.length,0);
const d=engine();await d.sync();d.commit([...d.state.entries,item('d','D')]);await d.sync();d.undo();await d.sync();assert.equal(db.entries.some(x=>x.id==='d'),false);
let unblock;const gate=new Promise(r=>unblock=r);let first=true;const slow=engine();slow.remote={...remote,async write(entries,version){if(first){first=false;await gate;}return remote.write(entries,version);}};
await slow.sync();slow.commit([...slow.state.entries,item('slow','before')]);const pending=slow.sync();await new Promise(r=>setImmediate(r));slow.commit(slow.state.entries.map(x=>x.id==='slow'?{...x,name:'during flight'}:x));unblock();await pending;assert.equal(db.entries.find(x=>x.id==='slow').name,'during flight');
const stopped=engine();let resolveRead;stopped.remote={read:()=>new Promise(r=>resolveRead=r)};const inFlight=stopped.sync();stopped.stop();resolveRead(copy(db));await inFlight;assert.equal(stopped.state.entries.length,0);
for(const e of [a,b,c,restored,anotherUser,d,slow,stopped])e.stop();
console.log('PASS: two-device additions, field merge, edit/edit and delete/edit conflicts, CAS revisions, offline/reload, quota failure, account separation, undo, in-flight edits and sign-out isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
