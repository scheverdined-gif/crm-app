import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export async function serve({root,port=5192,host='127.0.0.1'}){
 const directory=fileURLToPath(root);
 const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const target=path.resolve(directory,'.'+(pathname==='/'?'/index.html':pathname));
   if(!target.startsWith(directory.endsWith(path.sep)?directory:directory+path.sep)){res.writeHead(403);res.end();return;}
   const data=await readFile(target);
   const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'}[path.extname(target)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Not found');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve)});
 return server;
}
