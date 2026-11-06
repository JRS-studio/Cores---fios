// Testa a regra da semana do aniversário (desconto do Premium). Uso: node tools/test/aniversario.test.js
const ts = require('typescript');
const fs = require('fs'); const assert = require('assert/strict');
const src = fs.readFileSync(require('path').join(__dirname, '../../src/data/loyalty.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} }; new Function('module', 'exports', 'require', js)(m, m.exports, require);
const { birthdayWeekOf: w, birthdayWeekContaining: c } = m.exports;
const b = (d, mo) => new Date(1995, mo - 1, d);
// 14/03/2026 é sábado -> semana 09/03 (seg) a 15/03 (dom)
assert.deepEqual(w(b(14, 3), 2026), { start: '2026-03-09', end: '2026-03-15' });
assert.ok(c(b(14, 3), '2026-03-09')); assert.ok(c(b(14, 3), '2026-03-15'));
assert.equal(c(b(14, 3), '2026-03-08'), null); assert.equal(c(b(14, 3), '2026-03-16'), null); assert.equal(c(b(14, 3), '2026-03-31'), null);
// 31/12/2026 é quinta -> 28/12/2026 a 03/01/2027; vale em 02/01/2027
assert.deepEqual(c(b(31, 12), '2027-01-02'), { start: '2026-12-28', end: '2027-01-03' });
// 01/01/2027 é sexta -> semana começa 28/12/2026
assert.deepEqual(c(b(1, 1), '2026-12-29'), { start: '2026-12-28', end: '2027-01-03' });
// 29/02 em 2027 (não bissexto) -> 01/03/2027 (segunda) -> 01/03 a 07/03
assert.deepEqual(w(new Date(2000, 1, 29), 2027), { start: '2027-03-01', end: '2027-03-07' });
// Aniversário num domingo: 08/11/2026 -> 02/11 a 08/11
assert.deepEqual(w(b(8, 11), 2026), { start: '2026-11-02', end: '2026-11-08' });
console.log('ok: semana do aniversário (segunda a domingo), viradas de ano e 29/02');
