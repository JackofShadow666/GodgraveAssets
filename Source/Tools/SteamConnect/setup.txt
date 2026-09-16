#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),readline=require('readline');
const ROOT=__dirname, CONFIG=path.join(ROOT,'relay-config.json');
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=q=>new Promise(r=>rl.question(q,r));
function exe(name){return process.platform==='win32'?name+'.cmd':name}
function run(cmd,args=[],opt={}){
 let file=cmd, finalArgs=args;
 if(process.platform==='win32' && /\.(cmd|bat)$/i.test(cmd)){
   const comspec=process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
   const quote=v => '"' + String(v).replace(/"/g,'\\"') + '"';
   const line=[quote(cmd),...args.map(quote)].join(' ');
   file=comspec;
   finalArgs=['/d','/s','/c',line];
 }
 const r=spawnSync(file,finalArgs,{cwd:opt.cwd||ROOT,encoding:'utf8',stdio:opt.capture?'pipe':'inherit',shell:false,env:process.env});
 if(opt.capture){if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr)}
 if(r.error)throw r.error;
 if(r.status!==0 && !opt.allowFail)throw new Error(cmd+' завершился с кодом '+r.status);
 return {ok:r.status===0,out:(r.stdout||'')+(r.stderr||''),stdout:r.stdout||''};
}
function capture(cmd,args=[],allowFail=false){return run(cmd,args,{capture:true,allowFail})}
async function waitPing(provider,url){
 for(let i=0;i<18;i++){
  try{
   const target=provider==='yandex'?url+'?route='+encodeURIComponent('/api/ping'):url.replace(/\/+$/,'')+'/api/ping';
   const r=await fetch(target); if(r.ok){const j=await r.json();if(j.ok)return true}
  }catch{}
  await new Promise(r=>setTimeout(r,3000));
 }
 return false;
}
function save(part){
 let old={};try{old=JSON.parse(fs.readFileSync(CONFIG,'utf8'))}catch{}
 const next={...old,...part,updatedAt:new Date().toISOString()};
 fs.writeFileSync(CONFIG,JSON.stringify(next,null,2));
 console.log('\nСохранено: '+CONFIG);
}
async function setupCloudflare(){
 console.log('\n=== Cloudflare ===');
 const npx=process.platform==='win32'?'npx.cmd':'npx';
 console.log('Сейчас откроется авторизация Cloudflare (если еще не выполнена).');
 run(npx,['--yes','wrangler@latest','login']);
 console.log('Разворачиваю relay...');
 const r=capture(npx,['--yes','wrangler@latest','deploy','--config',path.join(ROOT,'cloudflare','wrangler.toml')]);
 const m=r.out.match(/https:\/\/[^\s"'<>]+\.workers\.dev(?:\/[^\s"'<>]*)?/i);
 if(!m)throw new Error('Не удалось автоматически найти workers.dev URL в выводе Wrangler.');
 const url=m[0].replace(/[),.;]+$/,'').replace(/\/+$/,'');
 if(!await waitPing('cloudflare',url))throw new Error('Worker развернут, но /api/ping пока не отвечает: '+url);
 console.log('Cloudflare готов: '+url);
 return url;
}
function findYc(){
 const direct=capture(process.platform==='win32'?'yc.exe':'yc',['--version'],true);
 if(direct.ok)return process.platform==='win32'?'yc.exe':'yc';
 if(process.platform==='win32'){
   const p=path.join(process.env.USERPROFILE||'','yandex-cloud','bin','yc.exe');
   if(fs.existsSync(p))return p;
 }
 return null;
}
async function ensureYc(){
 let yc=findYc(); if(yc)return yc;
 if(process.platform!=='win32')throw new Error('Yandex Cloud CLI (yc) не найден. Установи yc и снова запусти SETUP.');
 const a=(await ask('Yandex Cloud CLI не найден. Установить автоматически официальным скриптом? [Y/n]: ')).trim().toLowerCase();
 if(a && a!=='y' && a!=='yes' && a!=='д' && a!=='да')throw new Error('Установка yc отменена');
 const ps=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 run(ps,['-NoProfile','-Command',"Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://storage.yandexcloud.net/yandexcloud-yc/install.ps1')"]);
 yc=findYc(); if(!yc)throw new Error('yc установился, но не найден. Закрой окно и запусти SETUP.bat еще раз.');
 return yc;
}
function ycJson(yc,args,allowFail=false){
 const r=capture(yc,[...args,'--format','json'],allowFail);
 if(!r.ok)return null;
 try{return JSON.parse(r.stdout)}catch{return null}
}
async function setupYandex(){
 console.log('\n=== Yandex Cloud ===');
 const yc=await ensureYc();
 let folder=capture(yc,['config','get','folder-id'],true);
 if(!folder.ok || !folder.stdout.trim()){
   console.log('Нужно один раз войти в Yandex Cloud и выбрать cloud/folder.');
   run(yc,['init']);
   folder=capture(yc,['config','get','folder-id']);
 }
 const folderId=folder.stdout.trim();
 console.log('Folder: '+folderId);

 const saName='dual-cloud-chat-sa';
 let sa=ycJson(yc,['iam','service-account','get',saName],true);
 if(!sa){console.log('Создаю service account...');run(yc,['iam','service-account','create','--name',saName]);sa=ycJson(yc,['iam','service-account','get',saName]);}
 if(!sa?.id)throw new Error('Не удалось получить service account id');
 run(yc,['resource-manager','folder','add-access-binding',folderId,'--role','ydb.editor','--service-account-id',sa.id],{allowFail:true});

 const dbName='dual-cloud-chat-db';
 let db=ycJson(yc,['ydb','database','get',dbName],true);
 if(!db){console.log('Создаю Serverless YDB...');run(yc,['ydb','database','create',dbName,'--serverless']);}
 for(let i=0;i<40;i++){
   db=ycJson(yc,['ydb','database','get',dbName],true);
   if(db?.status==='RUNNING')break;
   process.stdout.write('.'); await new Promise(r=>setTimeout(r,3000));
 }
 console.log('');
 if(!db?.endpoint)throw new Error('Не удалось получить YDB endpoint');

 const fnName='dual-cloud-room-chat';
 let fn=ycJson(yc,['serverless','function','get',fnName],true);
 if(!fn){console.log('Создаю Cloud Function...');run(yc,['serverless','function','create','--name',fnName]);fn=ycJson(yc,['serverless','function','get',fnName]);}
 console.log('Создаю/обновляю версию функции...');
 run(yc,['serverless','function','version','create',
   '--function-name',fnName,
   '--runtime','nodejs22',
   '--entrypoint','index.main',
   '--memory','256m',
   '--execution-timeout','15s',
   '--source-path',path.join(ROOT,'yandex'),
   '--service-account-id',sa.id,
   '--environment','YDB_CONNECTION_STRING='+db.endpoint
 ]);
 run(yc,['serverless','function','allow-unauthenticated-invoke',fnName],{allowFail:true});
 fn=ycJson(yc,['serverless','function','get',fnName]);
 const url=(fn?.http_invoke_url||fn?.httpInvokeUrl||'').replace(/\/+$/,'');
 if(!url)throw new Error('Не удалось получить http_invoke_url функции');
 console.log('Жду запуск функции: '+url);
 if(!await waitPing('yandex',url))throw new Error('Функция создана, но /api/ping пока не отвечает. Посмотри логи функции: '+url);
 console.log('Yandex готов: '+url);
 return url;
}
(async()=>{
 console.log('ROOM CHAT — автоматическая настройка');
 console.log('1 — Yandex Cloud');
 console.log('2 — Cloudflare');
 console.log('3 — оба (Yandex основной, Cloudflare резервный)');
 const choice=(await ask('Выбор [1/2/3]: ')).trim()||'3';
 const cfg={};
 try{
  if(choice==='1'||choice==='3')cfg.yandex=await setupYandex();
  if(choice==='2'||choice==='3')cfg.cloudflare=await setupCloudflare();
  cfg.preferred=choice==='2'?'cloudflare':'yandex';
  save(cfg);
  console.log('\nГОТОВО. Теперь просто запускай START.bat.');
  if(choice==='3')console.log('При старте программа проверит Yandex, а если он недоступен — Cloudflare.');
 }catch(e){console.error('\nОШИБКА: '+e.message);process.exitCode=1}
 finally{rl.close()}
})();
