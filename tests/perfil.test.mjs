// Testes do perfil: idade pela data de nascimento e medidas completadas com as anteriores.
import { test } from "node:test";
import assert from "node:assert/strict";
import { idadeDe, idadeAtual, calcMetas } from "../www/metas.js";
import { S, medidasAte, MEDIDAS } from "../www/store.js";

test("idade pela data de nascimento, contando o aniversário", () => {
  assert.equal(idadeDe("1997-03-12", new Date(2026, 10, 20)), 29);
  assert.equal(idadeDe("1997-03-12", new Date(2026, 2, 11)), 28);
  assert.equal(idadeDe("1997-03-12", new Date(2026, 2, 12)), 29);
  assert.equal(idadeDe("", new Date()), null);
  assert.equal(idadeDe("abc", new Date()), null);
});

test("perfil antigo sem data continua usando a idade digitada", () => {
  assert.equal(idadeAtual({ idade: 31 }), 31);
  assert.equal(idadeAtual(null), null);
});

test("as metas saem com a idade calculada", () => {
  const u = { sexo: "m", nascimento: "1997-03-12", altura: 178, peso: 82.4, atividade: "moderado", objetivo: "manter" };
  const m = calcMetas(u);
  const idade = idadeDe(u.nascimento);
  assert.equal(m.tmb, Math.round(10 * 82.4 + 6.25 * 178 - 5 * idade + 5));
});

test("são 9 medidas, de cima para baixo", () => {
  assert.deepEqual(MEDIDAS.map((m) => m.id), ["pescoco", "ombros", "peito", "braco", "antebraco", "cintura", "quadril", "coxa", "panturrilha"]);
});

test("medidas parciais se completam com as anteriores", () => {
  S.dias = {
    "2026-03-12": { itens: [], med: { cintura: 91, braco: 35 } },
    "2026-05-14": { itens: [], med: { cintura: 89.5 } },
    "2026-11-18": { itens: [], med: { braco: 36.5, ombros: 118 } },
  };
  assert.deepEqual(medidasAte("2026-06-01"), { cintura: { v: 89.5, d: "2026-05-14" }, braco: { v: 35, d: "2026-03-12" } });
  const hoje = medidasAte("2026-11-20");
  assert.equal(hoje.braco.v, 36.5);
  assert.equal(hoje.cintura.v, 89.5);
  assert.equal(hoje.ombros.d, "2026-11-18");
});
