import {spawn} from 'node:child_process';
const args=process.argv.slice(2).filter(v=>v!=='--strictPort').map(v=>v==='--host'?'--hostname':v);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...args],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??1));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
