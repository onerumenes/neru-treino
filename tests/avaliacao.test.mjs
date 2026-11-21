// Testes da avaliação corporal: dobras, calibração, pós-treino, dores e lesões.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { S, medidasAte } from "../www/store.js";
import {
  gorduraDobras, gorduraEm, composicao, registrarExame, registrarDor, nivelDor, situacaoDor, lesoesAtivas, dobrasAte,
} from "../www/corpo.js";
import { exerciciosEvitados } from "../www/personal.js";

const SETE = { peitoral: 10, axilar: 13, triceps: 11, subescapular: 15, abdominal: 26, suprailiaca: 18, coxa: 15 };
const hoje = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  S.user = { sexo: "m", nascimento: "1997-03-12", altura: 178, peso: 82.4, atividade: "moderado", objetivo: "perder" };
  S.dias = {};
  S.corpo = { dores: {}, exames: [], calibrar: false, pressao: [], fc: [], sangue: [] };
  S.personal = { avaliacao: { lesoes: [] }, bloco: null };
  S.cfg = { ...S.cfg };
});

test("Jackson-Pollock de 7 e de 3 dobras (homem)", () => {
  assert.equal(gorduraDobras(SETE, "m", 29, true), 15.6);
  assert.equal(gorduraDobras(SETE, "m", 29, false), 15.3);
  assert.equal(gorduraDobras({ peitoral: 10 }, "m", 29, true), null, "falta dobra: não calcula");
});

test("Jackson-Pollock de 3 dobras (mulher) usa tríceps, suprailíaca e coxa", () => {
  const bf = gorduraDobras({ triceps: 18, suprailiaca: 15, coxa: 25 }, "f", 30, false);
  assert.ok(bf > 18 && bf < 28, `gordura ${bf}`);
});

test("as dobras viram a fonte da gordura por 60 dias; depois, volta a fita", () => {
  S.dias[hoje] = { itens: [], med: { pescoco: 39, cintura: 86 }, dobras: SETE };
  assert.equal(gorduraEm(hoje).metodo, "dobras7");
  assert.equal(composicao({ d: hoje, pescoco: 39, cintura: 86 }).bf, 15.6);
  const depois = new Date(Date.now() + 61 * 864e5).toISOString().slice(0, 10);
  assert.equal(dobrasAte(depois), null);
  assert.equal(gorduraEm(depois).metodo, "fita");
});

test("calibrar desconta a diferença para o exame, só quando ligado", () => {
  S.dias[hoje] = { itens: [], med: { pescoco: 39, cintura: 86 } };
  const fita = gorduraEm(hoje).bf;
  registrarExame({ tipo: "dexa", bf: fita - 2, d: hoje });
  assert.equal(gorduraEm(hoje).bf, fita);
  S.corpo.calibrar = true;
  assert.equal(gorduraEm(hoje).bf, Math.round((fita - 2) * 10) / 10);
});

test("avaliação pós-treino tira as medidas que incham das comparações", () => {
  S.dias["2026-01-10"] = { itens: [], med: { braco: 35, cintura: 90 } };
  S.dias["2026-02-10"] = { itens: [], med: { braco: 37, cintura: 88 }, avaliacao: { condicoes: {}, posTreino: true } };
  const m = medidasAte("2026-03-01");
  assert.equal(m.braco.v, 35, "braço inchado não conta");
  assert.equal(m.cintura.v, 88, "cintura conta");
});

test("dor: uma anotação por dia, situação e lesões que tiram exercícios", () => {
  registrarDor("joelho_d", 6, "2026-10-02");
  registrarDor("joelho_d", 4, "2026-11-06");
  registrarDor("joelho_d", 5, "2026-11-06");
  assert.equal(S.corpo.dores.joelho_d.hist.length, 2);
  assert.equal(nivelDor("joelho_d"), 5);
  assert.equal(situacaoDor("joelho_d"), "melhorando");
  assert.ok(lesoesAtivas().has("joelho"));
  assert.ok(exerciciosEvitados().has("agachamento"));
  registrarDor("joelho_d", 0, "2026-11-20");
  assert.equal(situacaoDor("joelho_d"), "resolvida");
  assert.equal(lesoesAtivas().size, 0);
  assert.equal(registrarDor("ombro_d", 0), null, "sem dor nova, não cria o ponto");
});
