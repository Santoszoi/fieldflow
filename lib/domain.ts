export type User = {id:string;name:string;role:'MANAGER'|'TECH';specialty:string};
export type Client = {id:string;name:string;contact:string;phone:string;address:string};
export type Visit = {id:string;clientId:string;techId:string;title:string;kind:string;priority:'Normal'|'Alta';start:string;end:string;status:'Agendado'|'Em campo'|'Concluído'|'Cancelado';checks:boolean[];notes:string;photo:string;history:{at:string;text:string}[]};
export type State = {users:User[];clients:Client[];visits:Visit[]};
export const checklist=['Confirmar serviço com o cliente','Inspecionar equipamento e conexões','Executar e testar o atendimento','Orientar o cliente e revisar o local'];
export class RuleError extends Error {constructor(message:string,public status=400){super(message)}}
export const dateKey=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export function seed(today=dateKey()):State {
 const at=(hour:string)=>`${today}T${hour}`;
 return {users:[{id:'marcos',name:'Marcos',role:'MANAGER',specialty:'Gestão da operação'},{id:'ana',name:'Ana Costa',role:'TECH',specialty:'Redes e conectividade'},{id:'lucas',name:'Lucas Silva',role:'TECH',specialty:'Instalação e manutenção'},{id:'bruno',name:'Bruno Lima',role:'TECH',specialty:'Infraestrutura'}],clients:[
 {id:'c1',name:'Café Aurora',contact:'Beatriz',phone:'(61) 0000-0101',address:'Asa Norte, Brasília · endereço fictício'},
 {id:'c2',name:'Clínica Horizonte',contact:'Rafael',phone:'(61) 0000-0102',address:'Asa Sul, Brasília · endereço fictício'},
 {id:'c3',name:'Mercado Raiz',contact:'Joana',phone:'(61) 0000-0103',address:'Guará, Brasília · endereço fictício'},
 {id:'c4',name:'Estúdio Forma',contact:'Pedro',phone:'(61) 0000-0104',address:'Sudoeste, Brasília · endereço fictício'}],visits:[
 ['v101','c1','ana','Revisão da rede Wi-Fi','Rede / Wi-Fi','Alta','08:00','09:30','Concluído'],
 ['v102','c2','lucas','Instalação de ponto de rede','Instalação','Normal','09:00','11:00','Em campo'],
 ['v103','c3','ana','Manutenção do link principal','Manutenção','Alta','11:00','12:30','Agendado'],
 ['v104','c4','bruno','Vistoria de infraestrutura','Vistoria','Normal','14:00','15:00','Agendado'],
 ['v105','c1','lucas','Configuração de equipamento','Configuração','Normal','15:00','16:30','Agendado']
 ].map(([id,clientId,techId,title,kind,priority,start,end,status])=>({id,clientId,techId,title,kind,priority,start:at(start),end:at(end),status,checks:Array(4).fill(status==='Concluído'),notes:status==='Concluído'?'Conectividade testada e orientações entregues ao cliente.':'',photo:'',history:[{at:at('07:00'),text:'Visita agendada por Marcos'}]})) as Visit[]};
}
function text(value:unknown,label:string,max=200,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new RuleError(`${label}: preencha um valor válido (até ${max} caracteres).`);return value.trim()}
function wallTime(value:unknown){const s=text(value,'Data',16);if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(s)||!Number.isFinite(Date.parse(s+'Z'))||new Date(s+'Z').toISOString().slice(0,16)!==s)throw new RuleError('Informe uma data e um horário válidos.');return s}
function manager(user:User){if(user.role!=='MANAGER')throw new RuleError('Somente o gestor pode realizar esta ação.',403)}
export function visible(state:State,user:User):State {const visits=state.visits.filter(v=>user.role==='MANAGER'||v.techId===user.id);return {...state,visits,clients:state.clients.filter(c=>user.role==='MANAGER'||visits.some(v=>v.clientId===c.id)),users:state.users.filter(u=>user.role==='MANAGER'||u.id===user.id)}}
export function apply(state:State,user:User,action:string,p:any,now=new Date().toISOString()):State {
 const s=structuredClone(state);const id=()=>globalThis.crypto.randomUUID();
 if(action==='client'){manager(user);s.clients.push({id:id(),name:text(p.name,'Nome',100),contact:text(p.contact,'Contato',100),phone:text(p.phone,'Telefone',30),address:text(p.address,'Endereço',200)});return s}
 if(action==='schedule'){
  manager(user);const start=wallTime(p.start),end=wallTime(p.end);
  if(end<=start||start.slice(0,10)!==end.slice(0,10))throw new RuleError('O término deve ser após o início, no mesmo dia.');
  if(!s.clients.some(c=>c.id===p.clientId)||!s.users.some(u=>u.id===p.techId&&u.role==='TECH'))throw new RuleError('Escolha um cliente e um técnico válidos.');
  if(s.visits.some(v=>v.techId===p.techId&&v.status!=='Cancelado'&&v.start<end&&v.end>start))throw new RuleError('Conflito de agenda: esse técnico já tem uma visita neste horário.',409);
  if(!['Normal','Alta'].includes(p.priority))throw new RuleError('Prioridade inválida.');
  s.visits.push({id:id(),clientId:p.clientId,techId:p.techId,title:text(p.title,'Serviço',120),kind:text(p.kind,'Categoria',50),priority:p.priority,start,end,status:'Agendado',checks:[false,false,false,false],notes:'',photo:'',history:[{at:now,text:`Visita agendada por ${user.name}`}]});return s;
 }
 const v=s.visits.find(v=>v.id===p.id);if(!v)throw new RuleError('Visita não encontrada.',404);
 if(user.role!=='MANAGER'&&v.techId!==user.id)throw new RuleError('Esta visita pertence a outro técnico.',403);
 const event=(message:string)=>v.history.push({at:now,text:`${message} · ${user.name}`});
 if(action==='start'){if(v.status!=='Agendado')throw new RuleError('Só é possível iniciar uma visita agendada.');v.status='Em campo';event('Atendimento iniciado');}
 else if(action==='cancel'){manager(user);if(v.status==='Concluído'||v.status==='Cancelado')throw new RuleError('Esta visita já foi encerrada.');v.status='Cancelado';event('Visita cancelada');}
 else if(action==='report'){
  if(v.status!=='Em campo')throw new RuleError('Inicie o atendimento antes de registrar a execução.');
  if(!Array.isArray(p.checks)||p.checks.length!==4||p.checks.some((c:unknown)=>typeof c!=='boolean'))throw new RuleError('Checklist inválido.');
  v.checks=p.checks;v.notes=text(p.notes,'Relato',2000,false);
  const photo=text(p.photo,'Foto',1400000,false);
  if(photo&&!/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.test(photo))throw new RuleError('Use uma imagem JPEG ou PNG válida.');
  if(photo&&!photo.startsWith('data:image/png;base64,iVBORw0KGgo')&&!photo.startsWith('data:image/jpeg;base64,/9j/'))throw new RuleError('O conteúdo da imagem não corresponde ao formato.');
  v.photo=photo;
  if(p.complete){if(!v.checks.every(Boolean)||v.notes.length<10)throw new RuleError('Conclua o checklist e escreva um relato de pelo menos 10 caracteres.');v.status='Concluído';event('Atendimento concluído');}else event('Relato salvo');
 }else throw new RuleError('Ação desconhecida.');
 return s;
}
