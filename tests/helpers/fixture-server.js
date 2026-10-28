// LOCAL TEST FIXTURE ONLY. Not Supabase Auth/PostgREST. No real information or keys.
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {database,actors,staff,asUser,snapshot,reset} from './database.js';
export const TEST_PASSWORD='FixtureOnly-2026!';
export const accounts={
  'owner@example.invalid':actors.owner,'coach@example.invalid':actors.coach,
  'other@example.invalid':actors.other,'admin@example.invalid':actors.admin,
};
export async function fixtureServer(port=0) {
  const db=await database(), tokens=new Map(),refreshes=new Map();let failWrites=false;
  const user=id=>({id,aud:'authenticated',role:'authenticated',email:Object.keys(accounts).find(e=>accounts[e]===id),app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-10-17T00:00:00Z'});
  const issue=id=>{
    const access=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})).toString('base64url'),'LOCAL_FIXTURE_NOT_A_SIGNATURE'].join('.');
    const refresh=randomUUID();tokens.set(access,id);refreshes.set(refresh,id);
    return {access_token:access,refresh_token:refresh,token_type:'bearer',expires_in:3600,user:user(id)};
  };
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const respond=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      const url=new URL(req.url,'http://127.0.0.1');
      let data='';for await(const chunk of req)data+=chunk;
      const body=data?JSON.parse(data):{};
      if(url.pathname==='/auth/v1/token'){
        const id=url.searchParams.get('grant_type')==='refresh_token'?refreshes.get(body.refresh_token):accounts[body.email];
        if(!id || (url.searchParams.get('grant_type')!=='refresh_token' && body.password!==TEST_PASSWORD)){respond(400,{error:'invalid_grant',error_description:'Invalid login credentials'});return;}
        respond(200,issue(id));return;
      }
      const token=req.headers.authorization?.replace(/^Bearer /,'');const id=tokens.get(token);
      if(!id){respond(401,{message:'No valid fixture session',code:'401'});return;}
      if(url.pathname==='/auth/v1/user'){respond(200,user(id));return;}
      if(url.pathname==='/auth/v1/logout'){tokens.delete(token);respond(200,{});return;}
      if(url.pathname==='/rest/v1/rpc/crm_snapshot'){respond(200,await snapshot(db,id));return;}
      if(url.pathname==='/rest/v1/rpc/crm_mutate'){
        if(failWrites){respond(503,{message:'TEST connection unavailable',code:'503'});return;}
        const result=await asUser(db,id,async tx=>(await tx.query('select public.crm_mutate($1,$2::jsonb,$3::jsonb) as data',[body.p_command,JSON.stringify(body.p_payload),JSON.stringify(body.p_expected)])).rows[0].data);
        respond(200,result);return;
      }
      if(url.pathname==='/rest/v1/rpc/crm_delete_session_scope'){
        if(failWrites){respond(503,{message:'TEST connection unavailable',code:'503'});return;}
        const result=await asUser(db,id,async tx=>(await tx.query('select public.crm_delete_session_scope($1::jsonb,$2::jsonb) as data',
          [JSON.stringify(body.p_payload),JSON.stringify(body.p_expected)])).rows[0].data);
        respond(200,result);return;
      }
      respond(404,{message:'Fixture route not found'});
    } catch(error){respond(400,{message:error.message,code:error.code || 'P0001'});}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {db,staff,url:'http://127.0.0.1:'+server.address().port,setFailWrites:value=>{failWrites=value;},reset:()=>reset(db),
    close:async()=>{await new Promise(resolve=>server.close(resolve));await db.close();}};
}
