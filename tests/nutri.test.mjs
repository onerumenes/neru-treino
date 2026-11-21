// Testes do nutri: ritmo automático, proteína pela massa magra, atividade pelos treinos, gasto misturado,
// ciclo menstrual e a dica de proteína por refeição.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
// nutri.js chega à tabela de alimentos, que traz a moldura da interface: basta um document de mentira
globalThis.document ??= { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
const { S, hoje, somaDias } = await import("../www/store.js");
const { ritmoAutomatico, calcMetas } = await import("../www/metas.js");
const { aplicarMetas, atividadeEstimada, gastoEstimado, emRetencao, dicaProteina, ritmoEfetivo } = await import("../www/nutri.js");

const h = hoje();
beforeEach(() => {
  S.user = { sexo: "m", nascimento: "1997-03-12", altura: 178, peso: 82.4, atividade: "moderado", trabalho: "sentado", objetivo: "perder", ritmo: 0.5 };
  S.dias = {};
  S.metas = null; S.metasManuais = false;
  S.nutri = { modo: "flexivel", plano: null, checkins: [], consultas: [] };
  S.personal = { avaliacao: { nivel: "avancado", foco: "forca", lesoes: [], prioridades: [] }, bloco: null };
  S.corpo = { dores: {}, exames: [], calibrar: false, pressao: [], fc: [], sangue: [] };
  S.treino = { plano: [], custom: {}, sessoes: [], atual: null, cardio: [] };
  S.perfil = null;
});

test("ritmo automático: avançado mais devagar; gordura alta mais rápido; magro bem devagar", () => {
  const u = S.user;
  assert.deepEqual([ritmoAutomatico(u, { nivel: "avancado", bf: 16 }).pct, ritmoAutomatico(u, { nivel: "avancado", bf: 16 }).kg], [0.5, 0.41]);
  assert.equal(ritmoAutomatico(u, { nivel: "avancado", bf: 28 }).pct, 0.7);
  assert.equal(ritmoAutomatico(u, { nivel: "intermediario", bf: 10 }).pct, 0.4);
  assert.equal(ritmoAutomatico({ ...u, objetivo: "ganhar" }, { nivel: "avancado" }).pct, 0.2);
  assert.equal(ritmoAutomatico({ ...u, objetivo: "manter" }, {}).pct, 0);
});

test("proteína pela massa magra quando ela é conhecida", () => {
  assert.equal(calcMetas(S.user, { magra: 68.9 }).protein, 170);
  assert.equal(calcMetas(S.user, { magra: 68.9 }).proteinaPela, "magra");
  assert.equal(calcMetas(S.user).proteinaPela, "peso");
});

test("atividade estimada pelos treinos das últimas 4 semanas", () => {
  assert.equal(atividadeEstimada().fonte, "declarado");
  S.treino.sessoes = Array.from({ length: 16 }, (_, i) => ({ id: "s" + i, d: somaDias(h, -i * 1.7 | 0), ex: [] }));
  const a = atividadeEstimada();
  assert.equal(a.fonte, "estimado");
  assert.equal(a.fator, 1.46);
  assert.equal(atividadeEstimada({ ...S.user, trabalho: "bracal" }).fator, 1.71);
});

test("meta com ritmo automático e proteína pela massa magra", () => {
  S.user.ritmoAuto = true;
  S.dias[h] = { itens: [], med: { pescoco: 39, cintura: 86 } };
  const m = aplicarMetas();
  assert.equal(m.ritmoAuto.pct, 0.5);
  assert.equal(ritmoEfetivo(), m.ritmoAuto.kg);
  assert.equal(m.proteinaPela, "magra");
  assert.ok(m.protein >= 165 && m.protein <= 180, `proteína ${m.protein}`);
});

test("gasto: fórmula sem dados; com o medido, mistura pela confiança", () => {
  aplicarMetas();
  assert.equal(gastoEstimado().fonte, "declarado");
  // 21 dias comendo 2400 kcal e perdendo 0,05 kg por dia, pesando todo dia
  for (let n = 21; n >= 1; n--) {
    S.dias[somaDias(h, -n)] = { itens: [{ id: "i" + n, ref: "almoco", nome: "x", kcal: 2400, protein: 150, carbs: 250, fat: 80 }], peso: 84 - (21 - n) * 0.05 };
  }
  const g = gastoEstimado();
  assert.ok(g.real.ok, "gasto real medido");
  assert.ok(g.peso > 0, "mistura com o medido");
  const entre = (x, a, b) => x >= Math.min(a, b) - 10 && x <= Math.max(a, b) + 10;
  assert.ok(entre(g.kcal, g.formula, g.real.tdee), `${g.kcal} entre ${g.formula} e ${g.real.tdee}`);
});

test("ciclo: a semana antes da menstruação é de retenção", () => {
  S.user = { ...S.user, sexo: "f", ciclo: { ultima: "2026-11-01", duracao: 28 } };
  assert.equal(emRetencao("2026-11-10"), false);
  assert.equal(emRetencao("2026-11-25"), true);
  assert.equal(emRetencao("2026-11-29"), true, "primeiros dias da próxima");
  S.user.sexo = "m";
  assert.equal(emRetencao("2026-11-25"), false);
});

test("dica de proteína aponta a refeição fraca e um alimento para ela", () => {
  aplicarMetas();
  for (let n = 1; n <= 8; n++) {
    S.dias[somaDias(h, -n)] = { itens: [
      { id: `a${n}`, ref: "almoco", nome: "Frango", kcal: 900, protein: 60, carbs: 80, fat: 30 },
      { id: `c${n}`, ref: "ceia", nome: "Biscoito", kcal: 200, protein: 3, carbs: 30, fat: 8 },
    ] };
  }
  const d = dicaProteina();
  assert.equal(d.ref, "ceia");
  assert.equal(d.media, 3);
  assert.ok(d.sugestao?.total > 3, "sugere algo com mais proteína");
});
