import { DurableObject } from "cloudflare:workers";

const CLIENT_HTML = "<!doctype html>\n<html lang=\"ru\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<title>Room Chat</title>\n<style>\n*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0e1621;color:#eef6ff}body{padding:10px}.app{max-width:850px;margin:auto}.card{background:#172536;border:1px solid #294158;border-radius:16px;padding:14px;margin-bottom:12px}h1{font-size:22px;margin:0}.muted{color:#aabed0;font-size:14px}.row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.grid{display:grid;grid-template-columns:1fr 2fr;gap:9px}.buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}button{border:0;border-radius:10px;padding:11px 14px;font-size:15px;font-weight:750;background:#54b8ef;color:#07141e;cursor:pointer}button.secondary{background:#2d455c;color:#eef6ff}button.danger{background:#d8646e;color:#fff}button:disabled{opacity:.45}input{width:100%;margin-top:5px;border:1px solid #38566f;background:#0d1924;color:#fff;border-radius:9px;padding:11px;font-size:16px;outline:none}label{font-size:13px;color:#b8ccdc}.pill{background:#2b4054;border-radius:99px;padding:7px 10px;font-size:13px}.ok{color:#82e99a}.bad{color:#ff8d8d}.rooms{display:grid;gap:8px;margin-top:10px}.room{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:11px;background:#0f1c29;border-radius:11px}.roomTitle{font-weight:800}.roomMeta{font-size:13px;color:#9eb5c8;margin-top:3px}.chat{height:330px;overflow:auto;background:#0b1620;border-radius:12px;padding:10px;margin:10px 0}.msg{background:#16283a;border-radius:9px;padding:8px 10px;margin-bottom:8px;word-break:break-word}.msg b{color:#67c8ff}.composer{display:flex;gap:8px}.composer input{margin:0;flex:1;min-width:0}@media(max-width:620px){.grid{grid-template-columns:1fr}.chat{height:42vh}}\n</style>\n</head>\n<body>\n<div class=\"app\">\n <div class=\"card\">\n  <div class=\"row\">\n   <div><h1>Room Chat</h1><div class=\"muted\">Комнаты через интернет</div></div>\n   <div id=\"status\" class=\"pill\">подключение...</div>\n  </div>\n </div>\n\n <div class=\"card\">\n  <div class=\"grid\">\n   <label>Ваше имя<input id=\"name\" maxlength=\"32\" placeholder=\"Игрок\"></label>\n   <label>Название комнаты<input id=\"roomName\" maxlength=\"48\" placeholder=\"Комната игрока\"></label>\n  </div>\n  <div class=\"buttons\">\n   <button id=\"create\">Создать комнату</button>\n   <button id=\"search\" class=\"secondary\">Поиск комнат</button>\n   <button id=\"leave\" class=\"danger\">Выйти</button>\n  </div>\n  <div id=\"current\" class=\"muted\" style=\"margin-top:9px\">Не в комнате</div>\n </div>\n\n <div class=\"card\">\n  <div class=\"row\"><b>Комнаты</b><span id=\"hint\" class=\"muted\"></span></div>\n  <div id=\"rooms\" class=\"rooms\"></div>\n </div>\n\n <div class=\"card\">\n  <b>Чат</b>\n  <div id=\"chat\" class=\"chat\"></div>\n  <div class=\"composer\"><input id=\"message\" maxlength=\"800\" placeholder=\"Сообщение...\" autocomplete=\"off\"><button id=\"send\">➤</button></div>\n </div>\n</div>\n<script>\nconst $=s=>document.querySelector(s);\nconst isYandex=location.hostname==='functions.yandexcloud.net';\nconst yandexBase=isYandex ? (location.origin+location.pathname.replace(/\\/+$/,'')) : '';\nfunction endpoint(route){\n  if(isYandex) return yandexBase+'?route='+encodeURIComponent(route);\n  return route;\n}\nconst clientId=localStorage.getItem('room_client_id')||(crypto.randomUUID?crypto.randomUUID():(Date.now()+'-'+Math.random()));\nlocalStorage.setItem('room_client_id',clientId);\nconst nameEl=$('#name'),roomNameEl=$('#roomName');\nnameEl.value=localStorage.getItem('room_name')||'';\nroomNameEl.value=localStorage.getItem('room_title')||'';\nnameEl.oninput=()=>localStorage.setItem('room_name',nameEl.value);\nroomNameEl.oninput=()=>localStorage.setItem('room_title',roomNameEl.value);\nlet roomId=localStorage.getItem('room_id')||'', lastSeq=0, busy=false;\n\nfunction status(t,ok){const e=$('#status');e.textContent=t;e.className='pill '+(ok===true?'ok':ok===false?'bad':'')}\nfunction render(){ $('#current').textContent=roomId?'Комната: '+roomId:'Не в комнате'; $('#leave').disabled=!roomId; }\nasync function api(route,opt={}){\n const r=await fetch(endpoint(route),opt);\n const j=await r.json().catch(()=>({}));\n if(!r.ok) throw new Error(j.error||('HTTP '+r.status));\n return j;\n}\nasync function ping(){const j=await api('/api/ping');status('🟢 '+(j.provider||'online'),true)}\nfunction add(m){const d=document.createElement('div');d.className='msg';const b=document.createElement('b');b.textContent=(m.name||'Игрок')+': ';const s=document.createElement('span');s.textContent=m.text||'';d.append(b,s);$('#chat').append(d);$('#chat').scrollTop=$('#chat').scrollHeight}\nasync function rooms(){\n $('#hint').textContent='поиск...';$('#rooms').textContent='';\n try{\n  const j=await api('/api/rooms'); $('#hint').textContent=j.rooms.length?'найдено: '+j.rooms.length:'нет комнат';\n  for(const r of j.rooms){\n   const row=document.createElement('div');row.className='room';\n   const left=document.createElement('div'),t=document.createElement('div'),m=document.createElement('div');\n   t.className='roomTitle';t.textContent=r.name;m.className='roomMeta';m.textContent=r.members+'/'+r.max+' • '+r.id;left.append(t,m);\n   const btn=document.createElement('button');btn.textContent=roomId===r.id?'Открыто':'Войти';if(roomId===r.id)btn.className='secondary';btn.onclick=()=>join(r.id);\n   row.append(left,btn);$('#rooms').append(row);\n  }\n }catch(e){status('🔴 нет связи',false);$('#hint').textContent='ошибка'}\n}\nasync function createRoom(){\n const name=nameEl.value.trim()||'Игрок', roomName=roomNameEl.value.trim()||('Комната '+name);\n const j=await api('/api/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,name,roomName,max:8})});\n roomId=j.room.id;localStorage.setItem('room_id',roomId);lastSeq=0;$('#chat').textContent='';render();await rooms()\n}\nasync function join(id){\n const name=nameEl.value.trim()||'Игрок';\n const j=await api('/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,name,roomId:id})});\n roomId=j.room.id;localStorage.setItem('room_id',roomId);lastSeq=0;$('#chat').textContent='';render();await rooms();await poll()\n}\nasync function leave(){\n if(!roomId)return;\n try{await api('/api/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,roomId})})}catch{}\n roomId='';localStorage.removeItem('room_id');lastSeq=0;$('#chat').textContent='';render();await rooms()\n}\nasync function heart(){\n if(!roomId)return;\n try{await api('/api/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,name:nameEl.value.trim()||'Игрок',roomId})})}catch{}\n}\nasync function poll(){\n if(!roomId||busy)return;busy=true;\n try{\n  const j=await api('/api/messages?roomId='+encodeURIComponent(roomId)+'&after='+lastSeq+'&clientId='+encodeURIComponent(clientId));\n  if(j.closed){roomId='';localStorage.removeItem('room_id');render();return}\n  for(const m of j.messages||[]){add(m);lastSeq=Math.max(lastSeq,Number(m.seq)||0)}\n }catch{}finally{busy=false}\n}\nasync function send(){\n const i=$('#message'),text=i.value.trim();if(!text||!roomId)return;\n try{await api('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,name:nameEl.value.trim()||'Игрок',roomId,text})});i.value='';await poll()}catch(e){alert(e.message)}\n}\n$('#create').onclick=createRoom;$('#search').onclick=rooms;$('#leave').onclick=leave;$('#send').onclick=send;$('#message').onkeydown=e=>{if(e.key==='Enter')send()};\nsetInterval(heart,8000);setInterval(poll,1200);setInterval(()=>{if(!roomId)rooms()},10000);\nrender();ping().then(rooms).catch(()=>status('🔴 сервер недоступен',false));\n</script>\n</body>\n</html>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function j(data,status=200){
  return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
}
function cleanText(v,n=800){ return String(v??"").trim().replace(/[\r\n\t]+/g," ").slice(0,n); }
function roomId(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s=""; const a=new Uint32Array(6); crypto.getRandomValues(a);
  for(const x of a)s+=chars[x%chars.length]; return s;
}
function freshState(x){
  if(!x||typeof x!=="object")x={};
  if(!x.rooms||typeof x.rooms!=="object")x.rooms={};
  return x;
}

export class Hub extends DurableObject {
  async load(){ return freshState(await this.ctx.storage.get("state")); }
  async save(s){ await this.ctx.storage.put("state",s); }
  cleanup(s){
    const now=Date.now();
    for(const [id,r] of Object.entries(s.rooms)){
      if(!r || now-(r.lastSeen||0)>35000){ delete s.rooms[id]; continue; }
      r.members=r.members||{};
      for(const [cid,m] of Object.entries(r.members)){
        if(now-(m.lastSeen||0)>30000) delete r.members[cid];
      }
      if(!r.members[r.hostId]){ delete s.rooms[id]; continue; }
      r.messages=(r.messages||[]).slice(-120);
    }
    const ids=Object.keys(s.rooms);
    if(ids.length>60) ids.sort((a,b)=>(s.rooms[a].lastSeen||0)-(s.rooms[b].lastSeen||0)).slice(0,ids.length-60).forEach(id=>delete s.rooms[id]);
  }
  summary(r){ return {id:r.id,name:r.name,members:Object.keys(r.members||{}).length,max:r.max||8}; }

  async fetch(req){
    if(req.method==="OPTIONS") return new Response("",{headers:cors});
    const url=new URL(req.url), path=url.pathname;
    let s=await this.load(); this.cleanup(s);
    try{
      if(path==="/api/ping") return j({ok:true,provider:"Cloudflare"});
      if(path==="/api/rooms" && req.method==="GET"){
        await this.save(s);
        return j({rooms:Object.values(s.rooms).sort((a,b)=>b.created-a.created).map(r=>this.summary(r))});
      }
      if(path==="/api/create" && req.method==="POST"){
        const b=await req.json(), clientId=cleanText(b.clientId,80), name=cleanText(b.name,32)||"Игрок";
        if(!clientId)return j({error:"clientId required"},400);
        for(const [id,r] of Object.entries(s.rooms)) if(r.hostId===clientId) delete s.rooms[id];
        let id; do{id=roomId()}while(s.rooms[id]);
        const now=Date.now();
        const r={id,name:cleanText(b.roomName,48)||("Комната "+name),hostId:clientId,hostName:name,max:Math.max(2,Math.min(16,Number(b.max)||8)),created:now,lastSeen:now,members:{},messages:[],seq:0};
        r.members[clientId]={name,lastSeen:now}; s.rooms[id]=r; await this.save(s);
        return j({room:this.summary(r)});
      }
      if(path==="/api/join" && req.method==="POST"){
        const b=await req.json(), r=s.rooms[cleanText(b.roomId,16)], clientId=cleanText(b.clientId,80), name=cleanText(b.name,32)||"Игрок";
        if(!r)return j({error:"Комната уже закрыта"},404);
        if(!r.members[clientId] && Object.keys(r.members).length>=r.max)return j({error:"Комната заполнена"},409);
        r.members[clientId]={name,lastSeen:Date.now()}; await this.save(s); return j({room:this.summary(r)});
      }
      if(path==="/api/heartbeat" && req.method==="POST"){
        const b=await req.json(), r=s.rooms[cleanText(b.roomId,16)], cid=cleanText(b.clientId,80);
        if(!r)return j({error:"room closed"},404);
        r.members[cid]={name:cleanText(b.name,32)||"Игрок",lastSeen:Date.now()};
        if(r.hostId===cid)r.lastSeen=Date.now();
        await this.save(s); return j({ok:true});
      }
      if(path==="/api/send" && req.method==="POST"){
        const b=await req.json(), r=s.rooms[cleanText(b.roomId,16)], cid=cleanText(b.clientId,80);
        if(!r)return j({error:"Комната закрыта"},404);
        if(!r.members[cid])return j({error:"Сначала войди в комнату"},403);
        const text=cleanText(b.text,800); if(!text)return j({error:"Пустое сообщение"},400);
        const m={seq:++r.seq,name:cleanText(b.name,32)||r.members[cid].name||"Игрок",text,ts:Date.now()};
        r.messages.push(m); r.messages=r.messages.slice(-120); r.members[cid].lastSeen=Date.now();
        await this.save(s); return j({ok:true,seq:m.seq});
      }
      if(path==="/api/messages" && req.method==="GET"){
        const r=s.rooms[cleanText(url.searchParams.get("roomId"),16)];
        if(!r)return j({closed:true,messages:[]});
        const after=Number(url.searchParams.get("after")||0), cid=cleanText(url.searchParams.get("clientId"),80);
        if(cid && r.members[cid])r.members[cid].lastSeen=Date.now();
        await this.save(s);
        return j({closed:false,messages:(r.messages||[]).filter(m=>m.seq>after)});
      }
      if(path==="/api/leave" && req.method==="POST"){
        const b=await req.json(), id=cleanText(b.roomId,16), cid=cleanText(b.clientId,80), r=s.rooms[id];
        if(r){ if(r.hostId===cid) delete s.rooms[id]; else delete r.members[cid]; await this.save(s); }
        return j({ok:true});
      }
      return j({error:"Not found"},404);
    }catch(e){ return j({error:e?.message||String(e)},500); }
  }
}

export default {
  async fetch(request,env){
    const u=new URL(request.url);
    if(request.method==="OPTIONS") return new Response("",{headers:cors});
    if(u.pathname==="/" || u.pathname==="/index.html"){
      return new Response(CLIENT_HTML,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
    }
    const id=env.HUB.idFromName("global");
    return env.HUB.get(id).fetch(request);
  }
};
