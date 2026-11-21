// Testes do treino: 1RM com RIR, séries efetivas, recuperação, série principal, descanso e semana leve.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { S, hoje, somaDias } from "../www/store.js";
import { GANCHOS, iniciar } from "../www/treino.js";
import {
  e1rm, sugerirPrincipal, descansoPara, cargaRecuo, ajusteDeload, iniciarSemanaLeve, emRecuperacao, semanaLeve,
} from "../www/personal.js";
import {
  volumeFeito, estimuloSerie, recuperacao, forcaPorMusculo, faixaVolume, sinaisSemanaLeve, aplicarSugestaoVolume,
} from "../www/musculos.js";

const h = hoje();
const sessao = (d, ex, fim = Date.now()) => ({ id: "s" + Math.random(), d, nome: "T", ini: fim - 3600e3, fim, ex });

beforeEach(() => {
  S.user = { sexo: "m", nascimento: "1997-03-12", altura: 178, peso: 82.4 };
  S.dias = {};
  S.corpo = { dores: {}, exames: [], calibrar: false, pressao: [], fc: [], sangue: [] };
  S.personal = { avaliacao: { foco: "forca", nivel: "avancado", lesoes: [], prioridades: [] }, bloco: null };
  S.nutri = { checkins: [] };
  S.treino = { plano: [], custom: {}, sessoes: [], atual: null, cardio: [] };
});

test("1RM conta as repetições que sobraram; sem RIR, conta como falha", () => {
  assert.equal(Math.round(e1rm(100, 5, 2) * 100) / 100, 123.33);
  assert.equal(Math.round(e1rm(100, 5) * 100) / 100, 116.67);
  assert.equal(e1rm(0, 5, 2), 0);
});

test("série efetiva: perto da falha vale 1, longe vale menos, sem RIR conta como 2", () => {
  assert.equal(estimuloSerie({ reps: 8, rir: 1 }), 1);
  assert.equal(estimuloSerie({ reps: 8, rir: 5 }), 0.5);
  assert.equal(estimuloSerie({ reps: 8 }), 0.95);
  assert.equal(estimuloSerie({ reps: 3, rir: 0 }), 0.7, "série muito curta rende um pouco menos");
});

test("supino conta meia série para tríceps e ombro", () => {
  S.treino.sessoes = [sessao(h, [{ ex: "supino_reto", series: [1, 2, 3].map(() => ({ kg: 100, reps: 5, rir: 0, ok: true })) }])];
  const v = volumeFeito();
  assert.equal(v.peito, 2.6);
  assert.equal(v.triceps, 1.3);
  assert.equal(v.ombros, 1.3);
});

test("recuperação: baixa logo depois do treino, volta com os dias", () => {
  const series = [1, 2, 3, 4].map(() => ({ kg: 100, reps: 5, rir: 0, ok: true }));
  S.treino.sessoes = [sessao(h, [{ ex: "supino_reto", series }])];
  const agora = recuperacao(Date.now());
  const depois = recuperacao(Date.now() + 4 * 864e5);
  assert.ok(agora.peito < 50, `peito agora ${agora.peito}%`);
  assert.ok(depois.peito > 85, `peito em 4 dias ${depois.peito}%`);
});

test("força por músculo compara as 2 últimas semanas com as 2 anteriores", () => {
  S.treino.sessoes = [
    sessao(somaDias(h, -20), [{ ex: "agachamento", series: [{ kg: 140, reps: 3, rir: 1 }] }]),
    sessao(somaDias(h, -3), [{ ex: "agachamento", series: [{ kg: 147.5, reps: 3, rir: 1 }] }]),
  ];
  const f = forcaPorMusculo().quadriceps;
  assert.equal(f.tendencia, "subindo");
  assert.equal(f.exemplo.ex, "agachamento");
});

test("série principal: cumpriu o alvo, sobe um passo; recuo 10% mais leve", () => {
  S.treino.sessoes = [sessao(somaDias(h, -7), [{ ex: "supino_reto", series: [{ kg: 100, reps: 4, rir: 1, tipo: "principal" }] }])];
  assert.equal(sugerirPrincipal("supino_reto", 4).kg, 102.5);
  S.treino.sessoes = [sessao(somaDias(h, -7), [{ ex: "supino_reto", series: [{ kg: 100, reps: 2, rir: 0, tipo: "principal" }] }])];
  assert.equal(sugerirPrincipal("supino_reto", 4).kg, 97.5, "ficou 2 abaixo: desce");
  assert.equal(cargaRecuo(102.5, 2.5), 92.5);
});

test("foco em força: composto vira principal + recuo; isolado não", () => {
  S.treino.plano = [{ id: "d1", nome: "A", ex: [{ ex: "supino_reto", series: 3, min: 4, max: 6 }, { ex: "elevacao_lateral", series: 3, min: 10, max: 15 }] }];
  const a = iniciar("d1");
  assert.deepEqual(a.ex[0].series.map((s) => s.tipo), ["principal", "recuo", "recuo"]);
  assert.equal(a.ex[1].series[0].tipo, undefined);
  S.personal.avaliacao.foco = "hipertrofia";
  assert.equal(GANCHOS.principal("supino_reto", 3, 6, 10), null);
});

test("descanso pelo tipo de série", () => {
  assert.equal(descansoPara("supino_reto", { tipo: "principal" }), 180);
  assert.equal(descansoPara("agachamento", { reps: 5 }), 180);
  assert.equal(descansoPara("agachamento", { reps: 8 }), 120);
  assert.equal(descansoPara("elevacao_lateral", { reps: 12 }), 90);
});

test("faixa de volume muda com o foco", () => {
  assert.deepEqual(faixaVolume("peito"), [4, 12]);
  S.personal.avaliacao.foco = "hipertrofia";
  assert.deepEqual(faixaVolume("peito"), [10, 20]);
});

test("semana leve: proposta com 3 sinais e, aceita, reduz séries e carga", () => {
  // dor nova, sono ruim e força caindo em 2 músculos
  S.corpo.dores = { joelho_d: { desde: somaDias(h, -3), quando: [], hist: [[somaDias(h, -3), 4]] } };
  for (let n = 0; n < 5; n++) S.dias[somaDias(h, -n)] = { itens: [], sono: 5.5 };
  const ex = (kg) => [{ ex: "agachamento", series: [{ kg, reps: 3, rir: 1 }] }, { ex: "supino_reto", series: [{ kg: kg - 50, reps: 3, rir: 1 }] }];
  S.treino.sessoes = [sessao(somaDias(h, -20), ex(150)), sessao(somaDias(h, -18), ex(150)), sessao(somaDias(h, -5), ex(140)), sessao(somaDias(h, -2), ex(140))];
  const s = sinaisSemanaLeve();
  assert.ok(s.ativos >= 3, `sinais ativos: ${s.ativos}`);
  assert.equal(s.propor, true);
  assert.deepEqual(ajusteDeload(4, 100), { nSeries: 4, kg: 100 });
  iniciarSemanaLeve();
  assert.ok(semanaLeve() && emRecuperacao());
  assert.deepEqual(ajusteDeload(4, 100), { nSeries: 2, kg: 90 });
  assert.equal(sinaisSemanaLeve().propor, false, "não propõe de novo durante a semana leve");
});

test("aplicar sugestão de volume mexe nas séries do músculo no plano", () => {
  S.treino.plano = [{ id: "d1", nome: "B", ex: [{ ex: "stiff", series: 3, min: 6, max: 8 }, { ex: "mesa_flexora", series: 3, min: 8, max: 10 }] }];
  aplicarSugestaoVolume("posterior", 2);
  assert.deepEqual(S.treino.plano[0].ex.map((x) => x.series), [4, 4]);
  aplicarSugestaoVolume("posterior", -2);
  assert.deepEqual(S.treino.plano[0].ex.map((x) => x.series), [3, 3]);
});
