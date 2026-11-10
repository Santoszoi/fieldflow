import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp,hashPassword,type Repository} from '../server/app';
import {seed} from '../lib/domain';
test('real HTTP: authentication, role enforcement and serialized scheduling',async()=>{
 let state=seed('2026-11-09');let queue=Promise.resolve();const hash=hashPassword('test-password-only');
 const repo:Repository={async read(){return structuredClone(state)},async credentials(email){const u=state.users.find(u=>u.id+'@fieldflow.local'===email);return u?{id:u.id,hash}:null},change(fn){const run=queue.then(()=>{state=fn(state);return structuredClone(state)});queue=run.then(()=>{},()=>{});return run}};
 const server=createApp(repo).listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const address=server.address() as {port:number};const base=`http://127.0.0.1:${address.port}/api`;
 async function req(route:string,token='',body?:unknown){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 try{
 assert.equal((await req('/state')).status,401);
 assert.equal((await req('/login','',{email:'ana@fieldflow.local',password:'wrong'})).status,401);
 const login=async(name:string)=>(await req('/login','',{email:name+'@fieldflow.local',password:'test-password-only'})).data;
 const [admin,ana,lucas]=await Promise.all(['marcos','ana','lucas'].map(login));
 assert.ok(ana.state.visits.every((v:any)=>v.techId==='ana'));
 assert.equal((await req('/actions',ana.token,{action:'start',payload:{id:'v104'}})).status,403);
 assert.equal((await req('/actions',ana.token,{action:'client',payload:{}})).status,403);
 const payload={title:'Concurrent test',clientId:'c1',techId:'bruno',kind:'Rede',priority:'Normal',start:'2026-11-09T16:00',end:'2026-11-09T17:00'};
 const results=await Promise.all([1,2].map(()=>req('/actions',admin.token,{action:'schedule',payload})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal((await req('/actions',lucas.token,{action:'report',payload:{id:'v102',checks:[true,true,true,true],notes:'Instalação concluída e validada.',photo:'',complete:true}})).status,200);
 const refreshed=await req('/state',ana.token);assert.ok(refreshed.data.visits.every((v:any)=>v.techId==='ana'));
 const logout=await fetch(base+'/logout',{method:'POST',headers:{Authorization:'Bearer '+ana.token}});assert.equal(logout.status,204);assert.equal((await req('/state',ana.token)).status,401);
 }finally{await new Promise<void>((r,j)=>server.close(e=>e?j(e):r()))}
});
