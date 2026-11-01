// Confere o cartão "Instalar app" da tela inicial em iPhone, Android, navegador do Instagram e computador.
// Uso: python3 tools/web/build-pages.py && node tools/web/check-install.js
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');const {chromium}=require('playwright');
const D=path.resolve(__dirname,'../../dist-pages'),B='/Cores---fios';const T={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(new URL(q.url,'http://x').pathname);const f=u.startsWith(B)?path.join(D,u.slice(B.length)):null;const ok=f&&fs.existsSync(f)&&fs.statSync(f).isFile();const t=ok?f:path.join(D,'404.html');r.writeHead(ok?200:404,{'Content-Type':T[path.extname(t)]||'application/octet-stream'});fs.createReadStream(t).pipe(r);});
const IOS='Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1';
const AND='Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36';
const IG=AND+' Instagram 300.0.0.0';
(async()=>{await new Promise(r=>srv.listen(0,r));const site=`http://localhost:${srv.address().port}${B}/`;
const b=await chromium.launch({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'localhost'}:undefined});
const errs=[];
async function open(ua,init){const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,userAgent:ua,ignoreHTTPSErrors:true});if(init)await ctx.addInitScript(init);const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(site,{waitUntil:'networkidle'});await p.waitForTimeout(2500);return p;}
const card=p=>p.getByText('Instale o app no celular');
// iPhone no Safari
let p=await open(IOS);await card(p).waitFor();await p.screenshot({path:path.resolve(__dirname,'../../dist-teste/i1-card.png')});
await p.getByLabel('Instalar app').click();await p.getByText('Instalar no iPhone').waitFor();await p.getByText('Adicionar à Tela de Início',{exact:false}).first().waitFor();await p.waitForTimeout(800);await p.screenshot({path:path.resolve(__dirname,'../../dist-teste/i2-ios.png')});
await p.getByText('Entendi').click();await p.waitForTimeout(400);
await p.getByLabel('Agora não').click();await p.waitForTimeout(300);assert.equal(await card(p).count(),0);
await p.reload({waitUntil:'networkidle'});await p.waitForTimeout(2000);assert.equal(await card(p).count(),0,'dispensado continua escondido');console.log('ok iPhone: cartão, passo a passo e "agora não"');
// iPhone já pela Tela de Início
p=await open(IOS,()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));assert.equal(await card(p).count(),0);console.log('ok iPhone instalado: sem cartão');
// Android sem aviso do navegador -> passo a passo
p=await open(AND);await card(p).waitFor();await p.getByLabel('Instalar app').click();await p.getByText('Instalar no celular').waitFor();await p.getByText('já está instalado',{exact:false}).waitFor();await p.waitForTimeout(800);await p.screenshot({path:path.resolve(__dirname,'../../dist-teste/a1-android-passos.png')});console.log('ok Android sem aviso: passo a passo');
// Android com aviso do navegador -> janela de instalação
p=await open(AND);await p.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.__prompted=true};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);});
await p.waitForTimeout(300);await p.getByLabel('Instalar app').click();await p.waitForTimeout(500);assert.equal(await p.evaluate(()=>window.__prompted),true);assert.equal(await card(p).count(),0);assert.equal(await p.getByText('Instalar no celular').count(),0);console.log('ok Android com aviso: abre a janela do Chrome e o cartão some');
// Instagram -> abrir no navegador
p=await open(IG);await p.getByLabel('Instalar app').click();await p.getByText('Abrir no navegador',{exact:false}).waitFor();console.log('ok navegador do Instagram: orienta abrir no navegador');
// Computador sem aviso -> sem cartão
p=await open(undefined);assert.equal(await card(p).count(),0);console.log('ok computador: sem cartão');
console.log('erros:',errs.length?errs:'nenhum');await b.close();srv.close();})().catch(e=>{console.error(e);process.exit(1)});
