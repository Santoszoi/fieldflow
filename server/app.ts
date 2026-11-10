import express from 'express';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {apply,visible,RuleError,type State,type User} from '../lib/domain';
export type Repository={read:()=>Promise<State>;change:(fn:(state:State)=>State)=>Promise<State>;credentials:(email:string)=>Promise<{id:string;hash:string}|null>};
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')}
export function verifyPassword(password:string,hash:string){const [salt,key]=hash.split(':');return !!salt&&!!key&&timingSafeEqual(Buffer.from(key,'hex'),scryptSync(password,salt,64))}
export function createApp(repo:Repository,{origin='',secure=false}:{origin?:string;secure?:boolean}={}){
 const app=express();app.disable('x-powered-by');
 const sessions=new Map<string,{userId:string;expires:number}>(),attempts=new Map<string,{count:number;until:number}>();
 app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');if(req.path.startsWith('/api'))res.setHeader('Cache-Control','no-store');if(origin&&req.headers.origin===origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS')}if(req.method==='OPTIONS'){res.sendStatus(204);return;}next()});
 app.use(express.json({limit:'2mb'}));
 app.get('/api/health',async(_req,res)=>{await repo.read();res.json({ok:true,service:'FieldFlow'})});
 app.post('/api/login',async(req,res)=>{
  const now=Date.now(),ip=req.ip||'unknown';for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
  const limit=attempts.get(ip)||{count:0,until:now+900000};limit.count++;attempts.set(ip,limit);if(limit.count>15){res.status(429).json({message:'Muitas tentativas. Aguarde 15 minutos.'});return;}
  const {email,password}=req.body||{};if(typeof email!=='string'||typeof password!=='string'||email.length>150||password.length>256){res.status(400).json({message:'Informe e-mail e senha válidos.'});return;}
  const account=await repo.credentials(email.toLowerCase().trim());
  if(!account||!verifyPassword(password,account.hash)){res.status(401).json({message:'E-mail ou senha inválidos.'});return;}
  const state=await repo.read(),user=state.users.find(u=>u.id===account.id);if(!user){res.sendStatus(401);return;}
  for(const [key,value] of sessions)if(value.expires<now)sessions.delete(key);
  const token=randomBytes(32).toString('hex');sessions.set(token,{userId:user.id,expires:now+8*3600000});attempts.delete(ip);
  res.json({token,user,state:visible(state,user)});
 });
 app.use('/api',async(req,res,next)=>{const token=req.headers.authorization?.replace(/^Bearer /,'')||'',session=sessions.get(token);if(!session||session.expires<Date.now()){sessions.delete(token);res.status(401).json({message:'Sua sessão expirou. Entre novamente.'});return;}const state=await repo.read();const user=state.users.find(u=>u.id===session.userId);if(!user){res.sendStatus(401);return;}res.locals.user=user;res.locals.token=token;next();});
 app.post('/api/logout',(_req,res)=>{sessions.delete(res.locals.token);res.sendStatus(204)});
 app.get('/api/state',async(_req,res)=>res.json(visible(await repo.read(),res.locals.user)));
 app.post('/api/actions',async(req,res)=>{const {action,payload}=req.body||{};if(typeof action!=='string'||!payload||typeof payload!=='object'||Array.isArray(payload))throw new RuleError('Requisição inválida.');const actor=res.locals.user as User;const updated=await repo.change(state=>{const canonical=state.users.find(u=>u.id===actor.id);if(!canonical)throw new RuleError('Usuário não encontrado.',403);return apply(state,canonical,action,payload)});res.json(visible(updated,actor));});
 app.use('/api',(_req,res)=>res.status(404).json({message:'Rota não encontrada.'}));
 app.use(express.static('out'));
 app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=err instanceof RuleError?err.status:err.type==='entity.too.large'?413:err.type==='entity.parse.failed'?400:500;if(status===500)console.error(err);res.status(status).json({message:status===500?'Não foi possível concluir. Tente novamente.':status===413?'Arquivo muito grande. Use uma foto de até 1 MB.':err.message})});
 return app;
}
