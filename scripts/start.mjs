import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {publicSettings} from './public-settings.mjs';
import {serve} from './serve.mjs';
const root=new URL('../',import.meta.url);
try{
 if(Number(process.versions.node.split('.')[0])<22)throw new Error('Установите Node.js LTS 22 или новее с https://nodejs.org/');
 const settings=publicSettings(root);
 const info=JSON.parse(await readFile(new URL('dist/BUILD-INFO.json',root),'utf8'));
 if(info.version!=='2.2.3'||info.storage!=='supabase'||info.project_url!==settings.VITE_SUPABASE_URL||info.public_settings_sha256!==createHash('sha256').update(JSON.stringify(settings)).digest('hex'))throw new Error('Сборка не соответствует Supabase. Запустите BUILD-WINDOWS.cmd для пересборки.');
 for(const [name,hash] of Object.entries(info.assets)){
  if(name.includes('..')||!name.match(/^[A-Za-z0-9_.\/-]+$/))throw new Error('Повреждён список файлов сборки.');
  if(createHash('sha256').update(await readFile(new URL('dist/'+name,root))).digest('hex')!==hash)throw new Error('Файлы сборки изменены. Пересоберите через BUILD-WINDOWS.cmd.');
 }
 const port=Number(process.env.CRM_PORT??5192);
 if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Некорректный CRM_PORT');
 const server=await serve({root:new URL('dist/',root),port});
 const url='http://127.0.0.1:'+server.address().port+'/';
 console.log('\nExtreme Kids CRM 2.2.3\nОбщая база: существующий Supabase\nОткройте '+url+'\nДля остановки: Ctrl+C. Интернет нужен для входа и работы с базой.\n');
 if(process.env.CRM_NO_OPEN!=='1'){
  const command=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['/d','/s','/c',`start "" "${url}"`]:[url];
  const child=spawn(command,args,{stdio:'ignore',windowsHide:true,windowsVerbatimArguments:process.platform==='win32'});child.on('error',()=>{});child.unref();
 }
 const close=()=>server.close(()=>process.exit(0));process.on('SIGINT',close);process.on('SIGTERM',close);
}catch(error){
 console.error(error.code==='EADDRINUSE'?'Порт 5192 уже занят. Если CRM уже открыта, используйте её вкладку; иначе закройте прежний запуск.':error.code==='ENOENT'?'Не хватает файлов комплекта. Полностью распакуйте ZIP; если dist отсутствует, запустите BUILD-WINDOWS.cmd.':error.message);
 process.exitCode=1;
}
