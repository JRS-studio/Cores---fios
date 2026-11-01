// Confere a atualização automática do app instalado: mesma versão não recarrega, versão nova recarrega ao voltar
// para o app, e não fica recarregando sem parar. Uso: python3 tools/web/build-pages.py && node tools/web/check-update.js
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');const {chromium}=require('playwright');
const D=path.resolve(__dirname,'../../dist-pages'),B='/Cores---fios';const T={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.ttf':'font/ttf'};
const srv=http.createServer((q,r)=>{const u=decodeURIComponent(new URL(q.url,'http://x').pathname);const f=u.startsWith(B)?path.join(D,u.slice(B.length)):null;const ok=f&&fs.existsSync(f)&&fs.statSync(f).isFile();const t=ok?f:path.join(D,'404.html');r.writeHead(ok?200:404,{'Content-Type':T[path.extname(t)]||'application/octet-stream'});fs.createReadStream(t).pipe(r);});
const CURRENT=JSON.parse(fs.readFileSync(D+'/version.json')).version;
(async()=>{await new Promise(r=>srv.listen(0,r));const site=`http://localhost:${srv.address().port}${B}/`;
const b=await chromium.launch({proxy:process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY,bypass:'localhost'}:undefined});const ctx=await b.newContext({ignoreHTTPSErrors:true});const p=await ctx.newPage();
let published=CURRENT, checks=0, loads=0;
await ctx.route('https://jefersonroodrigo-cmyk.github.io/Cores---fios/version.json*',(route)=>{checks++;route.fulfill({contentType:'application/json',body:JSON.stringify({version:published})});});
p.on('load',()=>loads++);
await p.goto(site,{waitUntil:'networkidle'});await p.waitForTimeout(3000);
assert.ok(checks>=1,'confere a versão ao abrir');assert.equal(loads,1,'mesma versão: não recarrega');console.log('ok mesma versão: abre normal, sem recarregar');
// Publica uma versão nova e "volta para o app".
published='99999999999999';
await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
await p.waitForTimeout(4000);
assert.equal(loads,2,'versão nova: recarrega ao voltar para o app');console.log('ok versão nova: recarrega sozinho ao voltar para o app');
// Se a página nova ainda não chegou (GitHub publicando), não fica recarregando sem parar.
await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(3000);
assert.equal(loads,2);console.log('ok não entra em repetição de recarregar');
await b.close();srv.close();})().catch(e=>{console.error(e);process.exit(1)});
