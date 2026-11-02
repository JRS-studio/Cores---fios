// Embaralha (ofusca) o código JavaScript da versão web publicada, para dificultar cópias.
// Não muda o funcionamento: só troca nomes e esconde os textos do código num formato difícil de ler.
// Uso: node tools/web/proteger.mjs <pasta-exportada>   (ex.: dist-pages)
import fs from 'node:fs';
import path from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const AVISO =
  '/*! Cores & Fios © ' +
  new Date().getFullYear() +
  ' — Todos os direitos reservados. Cópia, redistribuição ou uso deste código sem autorização é proibido. */\n';

// Cada arquivo ganha um prefixo próprio nos nomes globais que o embaralhador cria (os arquivos dividem o mesmo escopo global).
// Configuração leve: protege sem deixar o app mais lento (sem "achatamento" de fluxo nem código falso).
const OPCOES = {
  compact: true,
  target: 'browser',
  sourceMap: false,
  identifierNamesGenerator: 'mangled-shuffled',
  renameGlobals: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 1,
  stringArrayWrappersType: 'variable',
  splitStrings: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  numbersToExpressions: false,
  simplify: true,
};

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivos(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

const raiz = process.argv[2];
if (!raiz || !fs.existsSync(raiz)) {
  console.error('Informe a pasta exportada, ex.: node tools/web/proteger.mjs dist-pages');
  process.exit(1);
}
// Só o código do app (pasta _expo); o service worker (sw.js) fica como está.
const alvo = path.join(raiz, '_expo');
const lista = arquivos(fs.existsSync(alvo) ? alvo : raiz);
let antes = 0;
let depois = 0;
for (const [i, f] of lista.entries()) {
  const codigo = fs.readFileSync(f, 'utf8');
  if (codigo.startsWith('/*! Cores & Fios')) continue; // já protegido
  const saida = JavaScriptObfuscator.obfuscate(codigo, { ...OPCOES, identifiersPrefix: `cf${i.toString(36)}_` }).getObfuscatedCode();
  fs.writeFileSync(f, AVISO + saida);
  antes += codigo.length;
  depois += saida.length + AVISO.length;
}
// Mapas de código-fonte revelariam o original: nunca publicar.
for (const f of fs.readdirSync(raiz, { recursive: true })) {
  if (String(f).endsWith('.map')) fs.rmSync(path.join(raiz, String(f)));
}
console.log(`Protegidos ${lista.length} arquivos (${(antes / 1024).toFixed(0)} KB -> ${(depois / 1024).toFixed(0)} KB)`);
