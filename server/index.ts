import mysql,{type RowDataPacket} from 'mysql2/promise';
import {seed,type State} from '../lib/domain';
import {createApp,hashPassword,type Repository} from './app';
if(!process.env.DB_PASSWORD)throw Error('Configure DB_PASSWORD.');
const pool=mysql.createPool({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'fieldflow',password:process.env.DB_PASSWORD,database:process.env.DB_NAME||'fieldflow',connectionLimit:8});
await pool.execute('CREATE TABLE IF NOT EXISTS operation (id INT PRIMARY KEY, document JSON NOT NULL) ENGINE=InnoDB');
await pool.execute('CREATE TABLE IF NOT EXISTS accounts (id VARCHAR(80) PRIMARY KEY,email VARCHAR(150) UNIQUE NOT NULL,password_hash VARCHAR(200) NOT NULL) ENGINE=InnoDB');
const conn=await pool.getConnection();
try{await conn.beginTransaction();const [existing]=await conn.query<RowDataPacket[]>('SELECT id FROM operation WHERE id=1 FOR UPDATE');if(!existing.length){const password=process.env.SEED_PASSWORD;if(!password||password.length<12)throw Error('No primeiro início, configure SEED_PASSWORD com pelo menos 12 caracteres.');const state=seed();await conn.execute('INSERT INTO operation (id,document) VALUES (1,?)',[JSON.stringify(state)]);for(const user of state.users)await conn.execute('INSERT INTO accounts (id,email,password_hash) VALUES (?,?,?)',[user.id,`${user.id}@fieldflow.local`,hashPassword(password)]);}await conn.commit()}catch(e){await conn.rollback();throw e}finally{conn.release()}
const parse=(document:unknown):State=>typeof document==='string'?JSON.parse(document):document as State;
const repo:Repository={
 async read(){const [rows]=await pool.query<RowDataPacket[]>('SELECT document FROM operation WHERE id=1');return parse(rows[0].document)},
 async credentials(email){const [rows]=await pool.query<RowDataPacket[]>('SELECT id,password_hash FROM accounts WHERE email=?',[email]);return rows.length?{id:rows[0].id,hash:rows[0].password_hash}:null},
 async change(fn){const c=await pool.getConnection();try{await c.beginTransaction();const [rows]=await c.query<RowDataPacket[]>('SELECT document FROM operation WHERE id=1 FOR UPDATE');const next=fn(parse(rows[0].document));await c.execute('UPDATE operation SET document=? WHERE id=1',[JSON.stringify(next)]);await c.commit();return next;}catch(e){await c.rollback();throw e;}finally{c.release()}}
};
const server=createApp(repo,{origin:process.env.FRONTEND_ORIGIN,secure:process.env.HTTPS==='true'}).listen(Number(process.env.PORT||3333),'0.0.0.0',()=>console.log('FieldFlow API ready'));
process.on('SIGTERM',()=>server.close(()=>{void pool.end()}));
