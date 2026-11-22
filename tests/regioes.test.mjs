// Testes das partes do músculo: o que cada exercício trabalha e as lacunas que viram sugestão.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { S } from "../www/store.js";
import { EXERCICIOS } from "../www/treino.js";
import { REGIOES, ENFASE, regioesDoPlano, lacunasDoPlano } from "../www/regioes.js";

const dia = (...ex) => ({ id: "d" + Math.random(), nome: "D", ex: ex.map(([id, series]) => ({ ex: id, series, min: 8, max: 12 })) });

beforeEach(() => {
  S.personal = { avaliacao: null };
  S.treino = { plano: [], custom: {}, sessoes: [], atual: null, cardio: [] };
});

test("cada ligação aponta para exercício e parte que existem, com nível conhecido", () => {
  for (const [id, lista] of Object.entries(ENFASE)) {
    assert.ok(EXERCICIOS[id], `exercício ${id}`);
    for (const [g, reg, peso, nivel] of lista) {
      assert.ok(REGIOES[g]?.[reg], `${id}: ${g}.${reg}`);
      assert.ok(peso > 0);
      assert.ok(["medido", "provavel", "teoria"].includes(nivel), `${id}: ${nivel}`);
    }
  }
});

test("supino inclinado puxa o peito para cima; reto fica no meio", () => {
  const r = regioesDoPlano([dia(["supino_inclinado", 3], ["supino_reto", 3])]);
  assert.equal(r.peito.superior, 4.5);
  assert.equal(r.peito.medio, 4.5);
  const so = regioesDoPlano([dia(["supino_inclinado_halteres", 4]), dia(["crossover", 2])]);
  assert.ok(so.peito.superior > so.peito.medio);
});

test("panturrilha sentado não conta gastrocnêmio", () => {
  const r = regioesDoPlano([dia(["panturrilha_sentado", 4])]);
  assert.equal(r.panturrilha.soleo, 4);
  assert.equal(r.panturrilha.gastrocnemio, undefined);
});

test("lacunas: tríceps só na polia, quadríceps sem extensora, sem posterior, panturrilha só sentado", () => {
  const ids = lacunasDoPlano([dia(["triceps_corda", 4], ["agachamento", 4], ["leg_press", 3], ["panturrilha_sentado", 4])]).map((l) => l.id);
  assert.deepEqual(ids.sort(), ["panturrilha-gastro", "posterior-sem", "quadriceps-reto", "triceps-longa"]);
});

test("plano equilibrado não gera lacuna", () => {
  const plano = [
    dia(["supino_reto", 3], ["triceps_frances", 3], ["triceps_corda", 3]),
    dia(["agachamento", 4], ["cadeira_extensora", 3], ["cadeira_flexora", 3], ["stiff", 3], ["panturrilha_em_pe", 4]),
  ];
  assert.deepEqual(lacunasDoPlano(plano), []);
});

test("stiff sem flexora: falta a cabeça curta", () => {
  const l = lacunasDoPlano([dia(["stiff", 4])]);
  assert.equal(l[0]?.id, "posterior-curta");
  assert.equal(l[0].sugestao, "cadeira_flexora");
});
