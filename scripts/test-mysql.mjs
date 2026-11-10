import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

// Run only against the disposable Compose environment created by CI.
assert.equal(process.env.FIELDFLOW_INTEGRATION, '1', 'Set FIELDFLOW_INTEGRATION=1 for the disposable test stack');
assert.ok(process.env.SEED_PASSWORD);
const base = 'http://127.0.0.1:3333';
async function ready() {
  for (let i=0;i<90;i++) {
    try { if ((await fetch(base+'/api/health', {signal:AbortSignal.timeout(2000)})).ok) return; } catch {}
    await delay(1000);
  }
  throw Error('API/MySQL did not become healthy');
}
async function req(path, token='', body) {
  const r=await fetch(base+'/api'+path, {method:body===undefined?'GET':'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const text=await r.text();return {status:r.status, data:text?JSON.parse(text):null};
}
async function login(name) {
  const r=await req('/login','',{email:name+'@fieldflow.local',password:process.env.SEED_PASSWORD});
  assert.equal(r.status,200);return r.data;
}
await ready();
const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/FieldFlow/);
assert.equal((await req('/state')).status,401);
assert.equal((await req('/login','',{email:'marcos@fieldflow.local',password:'incorrect-password'})).status,401);
const admin=await login('marcos'),ana=await login('ana'),bruno=await login('bruno');
assert.ok(ana.state.visits.length>0);assert.ok(ana.state.visits.every(v=>v.techId==='ana'));
assert.equal((await req('/actions',ana.token,{action:'client',payload:{}})).status,403);
const payload={title:'MySQL concurrent integration',clientId:'c1',techId:'bruno',kind:'Rede',priority:'Normal',start:'2035-02-05T16:00',end:'2035-02-05T17:00'};
const concurrent=await Promise.all(Array.from({length:5},()=>req('/actions',admin.token,{action:'schedule',payload})));
assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409,409,409,409]);
let state=(await req('/state',admin.token)).data;
const visits=state.visits.filter(v=>v.title===payload.title);assert.equal(visits.length,1);
const id=visits[0].id;
assert.equal((await req('/actions',ana.token,{action:'start',payload:{id}})).status,403);
assert.equal((await req('/actions',bruno.token,{action:'start',payload:{id}})).status,200);
const before=(await req('/state',admin.token)).data;
assert.equal((await req('/actions',bruno.token,{action:'report',payload:{id,checks:[true,false,false,false],notes:'Insufficient checklist',photo:'',complete:true}})).status,400);
assert.deepEqual((await req('/state',admin.token)).data,before,'rejected transaction must not persist partial changes');
assert.equal((await req('/actions',bruno.token,{action:'report',payload:{id,checks:[true,true,true,true],notes:'MySQL integration completed successfully.',photo:'',complete:true}})).status,200);
const saved=(await req('/state',admin.token)).data;
assert.equal(saved.visits.find(v=>v.id===id).status,'Concluído');
assert.equal((await req('/logout',ana.token,{})).status,204);
assert.equal((await req('/state',ana.token)).status,401);
console.log('PASS: login, permissions, five concurrent bookings, rollback, completion and logout');
execFileSync('docker',['compose','stop','app'],{stdio:'inherit'});
execFileSync('docker',['compose','restart','db'],{stdio:'inherit'});
execFileSync('docker',['compose','up','-d','app'],{stdio:'inherit'});
await ready();
assert.equal((await req('/state',admin.token)).status,401,'restart must invalidate in-memory sessions');
const reauthenticated=await login('marcos');
assert.deepEqual(reauthenticated.state,saved,'state must survive app and MySQL restart without reseeding');
console.log('PASS: MySQL volume persistence, account preservation and session invalidation after restart');
