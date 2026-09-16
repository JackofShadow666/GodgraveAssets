#!/usr/bin/env node
'use strict';
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),{exec,execSync}=require('child_process');
const ROOT=__dirname, CONFIG=path.join(ROOT,'relay-config.json'), PORT=Number(process.env.PORT||3000);
const HTML="<!doctype html>\n<html lang=\"ru\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Room Chat Launcher</title>\n<style>\n*{box-sizing:border-box}body{margin:0;padding:10px;background:#0e1621;color:#eef6ff;font-family:system-ui,Segoe UI,Arial}.app{max-width:850px;margin:auto}.card{background:#172536;border:1px solid #294158;border-radius:16px;padding:14px;margin-bottom:12px}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.pill{background:#2b4054;border-radius:99px;padding:7px 10px}.ok{color:#82e99a}.bad{color:#ff8d8d}.url{word-break:break-all;font-family:Consolas,monospace;background:#0b1620;padding:9px;border-radius:9px;margin-top:8px}.qr{width:150px;height:150px;background:white;border-radius:10px;padding:5px;margin-top:10px}.grid{display:grid;grid-template-columns:1fr 2fr;gap:9px}.buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}button{border:0;border-radius:10px;padding:11px 14px;font-size:15px;font-weight:750;background:#54b8ef;color:#07141e;cursor:pointer}button.secondary{background:#2d455c;color:#eef6ff}button.danger{background:#d8646e;color:#fff}button:disabled{opacity:.45}input{width:100%;margin-top:5px;border:1px solid #38566f;background:#0d1924;color:#fff;border-radius:9px;padding:11px;font-size:16px}label{font-size:13px;color:#b8ccdc}.muted{color:#aabed0;font-size:14px}.rooms{display:grid;gap:8px;margin-top:10px}.room{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:11px;background:#0f1c29;border-radius:11px}.roomTitle{font-weight:800}.roomMeta{font-size:13px;color:#9eb5c8}.chat{height:320px;overflow:auto;background:#0b1620;border-radius:12px;padding:10px;margin:10px 0}.msg{background:#16283a;border-radius:9px;padding:8px 10px;margin-bottom:8px}.msg b{color:#67c8ff}.composer{display:flex;gap:8px}.composer input{margin:0;flex:1}@media(max-width:620px){.grid{grid-template-columns:1fr}.chat{height:38vh}}\n</style></head><body><div class=\"app\">\n<div class=\"card\"><div class=\"row\"><div><b style=\"font-size:22px\">Room Chat</b><div class=\"muted\">Адрес relay вводить больше не нужно</div></div><div id=\"status\" class=\"pill\">поиск облака...</div></div>\n<div id=\"provider\" class=\"muted\" style=\"margin-top:8px\"></div><div id=\"publicUrl\" class=\"url\"></div><img id=\"qr\" class=\"qr\" style=\"display:none\"></div>\n<div class=\"card\"><div class=\"grid\"><label>Ваше имя<input id=\"name\" maxlength=\"32\"></label><label>Название комнаты<input id=\"roomName\" maxlength=\"48\"></label></div><div class=\"buttons\"><button id=\"create\">Создать комнату</button><button id=\"search\" class=\"secondary\">Поиск комнат</button><button id=\"leave\" class=\"danger\">Выйти</button></div><div id=\"current\" class=\"muted\" style=\"margin-top:9px\">Не в комнате</div></div>\n<div class=\"card\"><div class=\"row\"><b>Комнаты</b><span id=\"hint\" class=\"muted\"></span></div><div id=\"rooms\" class=\"rooms\"></div></div>\n<div class=\"card\"><b>Чат</b><div id=\"chat\" class=\"chat\"></div><div class=\"composer\"><input id=\"message\" maxlength=\"800\" placeholder=\"Сообщение...\"><button id=\"send\">➤</button></div></div>\n</div><script>\nconst $=s=>document.querySelector(s);\nconst clientId=localStorage.getItem('room_client_id')||(crypto.randomUUID?crypto.randomUUID():(Date.now()+'-'+Math.random()));localStorage.setItem('room_client_id',clientId);\nconst nameEl=$('#name'),roomNameEl=$('#roomName');nameEl.value=localStorage.getItem('room_name')||'';roomNameEl.value=localStorage.getItem('room_title')||'';nameEl.oninput=()=>localStorage.setItem('room_name',nameEl.value);roomNameEl.oninput=()=>localStorage.setItem('room_title',roomNameEl.value);\nlet roomId=localStorage.getItem('room_id')||'',lastSeq=0,busy=false;\nfunction render(){ $('#current').textContent=roomId?'Комната: '+roomId:'Не в комнате';$('#leave').disabled=!roomId}\nasync function api(route,opt={}){const r=await fetch(route,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j}\nasync function meta(){try{const m=await api('/meta');$('#status').textContent='🟢 '+m.provider;$('#status').className='pill ok';$('#provider').textContent='Автоматически выбран: '+m.provider;$('#publicUrl').textContent='Телефон: '+m.publicUrl;if(m.publicUrl){$('#qr').src='/qr?url='+encodeURIComponent(m.publicUrl);$('#qr').style.display='block'}}catch(e){$('#status').textContent='🔴 облако не настроено';$('#status').className='pill bad';$('#provider').textContent='Запусти SETUP.bat один раз'}}\nfunction add(m){const d=document.createElement('div');d.className='msg';const b=document.createElement('b');b.textContent=(m.name||'Игрок')+': ';const s=document.createElement('span');s.textContent=m.text||'';d.append(b,s);$('#chat').append(d);$('#chat').scrollTop=$('#chat').scrollHeight}\nasync function rooms(){try{$('#hint').textContent='поиск...';$('#rooms').textContent='';const j=await api('/api/rooms');$('#hint').textContent=j.rooms.length?'найдено: '+j.rooms.length:'нет комнат';for(const r of j.rooms){const row=document.createElement('div');row.className='room';const l=document.createElement('div'),t=document.createElement('div'),m=document.createElement('div');t.className='roomTitle';t.textContent=r.name;m.className='roomMeta';m.textContent=r.members+'/'+r.max+' • '+r.id;l.append(t,m);const b=document.createElement('button');b.textContent=roomId===r.id?'Открыто':'Войти';b.onclick=()=>join(r.id);row.append(l,b);$('#rooms').append(row)}}catch(e){$('#hint').textContent='ошибка'}}\nasync function createRoom(){const name=nameEl.value.trim()||'Игрок',roomName=roomNameEl.value.trim()||('Комната '+name);const j=await api('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,name,roomName,max:8})});roomId=j.room.id;localStorage.setItem('room_id',roomId);lastSeq=0;$('#chat').textContent='';render();await rooms()}\nasync function join(id){const name=nameEl.value.trim()||'Игрок';const j=await api('/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,name,roomId:id})});roomId=j.room.id;localStorage.setItem('room_id',roomId);lastSeq=0;$('#chat').textContent='';render();await rooms();await poll()}\nasync function leave(){if(!roomId)return;try{await api('/api/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,roomId})})}catch{}roomId='';localStorage.removeItem('room_id');lastSeq=0;$('#chat').textContent='';render();await rooms()}\nasync function heart(){if(!roomId)return;try{await api('/api/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,name:nameEl.value.trim()||'Игрок',roomId})})}catch{}}\nasync function poll(){if(!roomId||busy)return;busy=true;try{const j=await api('/api/messages?roomId='+encodeURIComponent(roomId)+'&after='+lastSeq+'&clientId='+encodeURIComponent(clientId));if(j.closed){roomId='';localStorage.removeItem('room_id');render();return}for(const m of j.messages||[]){add(m);lastSeq=Math.max(lastSeq,Number(m.seq)||0)}}catch{}finally{busy=false}}\nasync function send(){const i=$('#message'),text=i.value.trim();if(!text||!roomId)return;try{await api('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,name:nameEl.value.trim()||'Игрок',roomId,text})});i.value='';await poll()}catch(e){alert(e.message)}}\n$('#create').onclick=createRoom;$('#search').onclick=rooms;$('#leave').onclick=leave;$('#send').onclick=send;$('#message').onkeydown=e=>{if(e.key==='Enter')send()};setInterval(heart,8000);setInterval(poll,1200);setInterval(()=>{if(!roomId)rooms()},10000);render();meta().then(rooms);\n</script></body></html>";

function readConfig(){try{return JSON.parse(fs.readFileSync(CONFIG,'utf8'))}catch{return {}}}
let config=readConfig(), active=null;

function reqPkg(name){try{return require(name)}catch{}try{console.log('[first run] installing '+name);execSync('npm install --no-save '+name,{cwd:ROOT,stdio:'inherit'});return require(name)}catch{return null}}
const QRCode=reqPkg('qrcode');

function candidates(){
 const arr=[]; const preferred=config.preferred||'yandex';
 for(const p of [preferred,preferred==='yandex'?'cloudflare':'yandex']){
   const url=config[p]; if(url && !arr.some(x=>x.url===url)) arr.push({provider:p,url:String(url).replace(/\/+$/,'')});
 }
 return arr;
}
function targetUrl(c,route){
 if(c.provider==='yandex') return c.url+'?route='+encodeURIComponent(route);
 return c.url+route;
}
async function ping(c){
 const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),5000);
 try{const r=await fetch(targetUrl(c,'/api/ping'),{signal:ctrl.signal});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();return !!j.ok}finally{clearTimeout(t)}
}
async function choose(){
 config=readConfig();
 for(const c of candidates()){try{if(await ping(c)){active=c;console.log('[cloud] '+c.provider+' '+c.url);return c}}catch(e){console.log('[cloud] '+c.provider+' unavailable: '+e.message)}}
 active=null; return null;
}
async function proxy(req,res){
 if(!active) await choose();
 if(!active){res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:'Облако не настроено. Запусти SETUP.bat'}))}
 const chunks=[];for await(const ch of req)chunks.push(ch);const body=Buffer.concat(chunks);
 let t=targetUrl(active,req.url);
 try{
   const headers={}; if(req.headers['content-type'])headers['content-type']=req.headers['content-type'];
   const opt={method:req.method,headers}; if(body.length && req.method!=='GET'&&req.method!=='HEAD')opt.body=body;
   let r=await fetch(t,opt);
   const buf=Buffer.from(await r.arrayBuffer());
   res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json; charset=utf-8','Cache-Control':'no-store'});
   return res.end(buf);
 }catch(e){
   // Try to pick another provider for subsequent requests.
   const old=active; await choose();
   res.writeHead(502,{'Content-Type':'application/json; charset=utf-8'});
   return res.end(JSON.stringify({error:'Потеряна связь с '+(old?old.provider:'relay')+'. Сервер переключен; повтори действие.'}));
 }
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(HTML)}
 if(u.pathname==='/meta'){if(!active)await choose();res.writeHead(active?200:503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify(active?{provider:active.provider,publicUrl:active.url}:{error:'not configured'}))}
 if(u.pathname==='/qr'){if(!QRCode){res.writeHead(500);return res.end('qrcode unavailable')}const url=u.searchParams.get('url')||'';if(!/^https:\/\//i.test(url)){res.writeHead(400);return res.end('bad url')}const svg=await QRCode.toString(url,{type:'svg',margin:1,width:220});res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store'});return res.end(svg)}
 if(u.pathname.startsWith('/api/'))return proxy(req,res);
 res.writeHead(404);res.end('not found');
});
choose().finally(()=>server.listen(PORT,'127.0.0.1',()=>{const url='http://localhost:'+PORT;console.log('Room Chat: '+url);setTimeout(()=>{try{if(process.platform==='win32')exec('start "" "'+url+'"');else if(process.platform==='darwin')exec('open "'+url+'"');else exec('xdg-open "'+url+'"')}catch{}},300)}));
