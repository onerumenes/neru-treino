// Partes de cada músculo e qual parte cada exercício trabalha mais, com o nível de evidência de cada ligação.
// Fonte: relatório "Ciência do treino para o app" (2026-11). Fica por dentro: serve para o app entender o treino
// e só vira sugestão na tela quando a evidência é de crescimento medido.
//
// Níveis:
//   medido   crescimento medido por ressonância ou ultrassom em estudo longitudinal
//   provavel um estudo pequeno, iniciantes, ou inferência direta de dado medido
//   teoria   só EMG, anatomia ou direção das fibras: o app não afirma

import { T, exercicio, nomeEx } from "./treino.js";

export const REGIOES = {
  peito: { superior: "Peitoral superior", medio: "Peitoral médio e inferior" },
  ombros: { anterior: "Deltoide anterior", lateral: "Deltoide lateral", posterior: "Deltoide posterior" },
  triceps: { longa: "Cabeça longa", lateral: "Cabeças lateral e medial" },
  biceps: { proximal: "Parte perto do ombro", distal: "Parte perto do cotovelo" },
  costas: { latissimo: "Latíssimo", meio: "Meio das costas", trapezio: "Trapézio superior" },
  quadriceps: { reto: "Reto femoral", vastos: "Vastos" },
  posterior: { biarticular: "Posteriores que cruzam o quadril", curta: "Cabeça curta do bíceps femoral" },
  gluteos: { maximo: "Glúteo máximo", medio: "Glúteo médio", adutores: "Adutores" },
  panturrilha: { gastrocnemio: "Gastrocnêmio", soleo: "Sóleo" },
};

// exercício → [[grupo, região, peso, nível]]
const r = (g, reg, peso, nivel) => [g, reg, peso, nivel];
const SUPINO_RETO = [r("peito", "medio", 1, "provavel"), r("peito", "superior", 0.5, "provavel"), r("ombros", "anterior", 0.5, "teoria"), r("triceps", "lateral", 0.25, "provavel")];
const SUPINO_INCL = [r("peito", "superior", 1, "provavel"), r("peito", "medio", 0.5, "provavel"), r("ombros", "anterior", 0.5, "teoria"), r("triceps", "lateral", 0.25, "provavel")];
const CRUCIFIXO = [r("peito", "medio", 1, "teoria"), r("peito", "superior", 0.5, "teoria")];
const DESENV = [r("ombros", "anterior", 1, "teoria"), r("ombros", "lateral", 0.5, "teoria"), r("triceps", "lateral", 0.5, "teoria")];
const PUXADA = [r("costas", "latissimo", 1, "teoria"), r("costas", "meio", 0.5, "teoria")];
const REMADA = [r("costas", "meio", 1, "teoria"), r("costas", "latissimo", 0.75, "teoria"), r("ombros", "posterior", 0.5, "teoria")];
const AGACHA = (nivel) => [r("quadriceps", "vastos", 1, nivel), r("gluteos", "maximo", 0.5, nivel), r("gluteos", "adutores", 0.5, nivel)];
const ROSCA = [r("biceps", "proximal", 0.75, "teoria"), r("biceps", "distal", 0.75, "teoria")];
const FLEXORA = [r("posterior", "biarticular", 1, "medido"), r("posterior", "curta", 1, "medido")];
const PANT_PE = [r("panturrilha", "gastrocnemio", 1, "medido"), r("panturrilha", "soleo", 1, "medido")];

export const ENFASE = {
  supino_reto: SUPINO_RETO, supino_reto_halteres: SUPINO_RETO, supino_maquina: SUPINO_RETO, flexao: SUPINO_RETO,
  supino_inclinado: SUPINO_INCL, supino_inclinado_halteres: SUPINO_INCL,
  crucifixo_maquina: CRUCIFIXO, crucifixo_halteres: CRUCIFIXO, crossover: CRUCIFIXO,
  paralelas: [r("peito", "medio", 1, "teoria"), r("triceps", "lateral", 0.5, "provavel"), r("ombros", "anterior", 0.5, "teoria")],

  desenvolvimento_halteres: DESENV, desenvolvimento_barra: DESENV, desenvolvimento_maquina: DESENV,
  elevacao_lateral: [r("ombros", "lateral", 1, "medido")], elevacao_lateral_polia: [r("ombros", "lateral", 1, "medido")],
  elevacao_frontal: [r("ombros", "anterior", 1, "teoria")],
  crucifixo_inverso: [r("ombros", "posterior", 1, "teoria"), r("costas", "meio", 0.5, "teoria")],
  face_pull: [r("ombros", "posterior", 1, "teoria"), r("costas", "meio", 0.5, "teoria")],
  encolhimento: [r("costas", "trapezio", 1, "teoria")],

  // Maeo 2023: acima da cabeça cresce mais o tríceps inteiro, sobretudo a cabeça longa
  triceps_frances: [r("triceps", "longa", 1, "medido"), r("triceps", "lateral", 0.75, "medido")],
  triceps_corda: [r("triceps", "lateral", 1, "provavel"), r("triceps", "longa", 0.5, "provavel")],
  triceps_barra: [r("triceps", "lateral", 1, "provavel"), r("triceps", "longa", 0.5, "provavel")],
  triceps_testa: [r("triceps", "longa", 1, "provavel"), r("triceps", "lateral", 0.75, "teoria")],
  triceps_banco: [r("triceps", "lateral", 1, "teoria"), r("triceps", "longa", 0.25, "teoria")],
  supino_fechado: [r("triceps", "lateral", 1, "teoria"), r("triceps", "longa", 0.25, "provavel"), r("peito", "medio", 0.5, "teoria")],

  // Kassiano 2025, Pedrosa 2023: Scott favorece perto do cotovelo, inclinada perto do ombro
  rosca_scott: [r("biceps", "distal", 1, "medido"), r("biceps", "proximal", 0.5, "medido")],
  rosca_inclinada: [r("biceps", "proximal", 1, "medido"), r("biceps", "distal", 0.5, "medido")],
  rosca_direta: ROSCA, rosca_alternada: ROSCA, rosca_polia: ROSCA, rosca_martelo: ROSCA,

  barra_fixa: PUXADA, puxada_frente: PUXADA, puxada_triangulo: PUXADA, pulldown: [r("costas", "latissimo", 1, "teoria")],
  remada_curvada: REMADA, remada_baixa: REMADA, remada_unilateral: REMADA, remada_maquina: REMADA, remada_cavalinho: REMADA,
  levantamento_terra: [r("posterior", "biarticular", 0.5, "teoria"), r("gluteos", "maximo", 0.5, "teoria"), r("costas", "trapezio", 0.5, "teoria")],

  // Kubo 2019, Kinoshita/Maeo: agachamento e leg press crescem vastos, glúteo e adutores; reto femoral quase nada
  agachamento: AGACHA("medido"), agachamento_smith: AGACHA("provavel"), leg_press: AGACHA("medido"),
  agachamento_hack: AGACHA("teoria"), afundo: AGACHA("teoria"), agachamento_bulgaro: AGACHA("teoria"),
  // Zabaleta-Korta 2021, Kinoshita/Maeo: a extensora cresce o reto femoral
  cadeira_extensora: [r("quadriceps", "reto", 1, "medido"), r("quadriceps", "vastos", 1, "medido")],

  // Maeo 2021: flexora sentada cresce mais que a deitada nos que cruzam o quadril; a cabeça curta igual nas duas
  cadeira_flexora: [r("posterior", "biarticular", 1.2, "medido"), r("posterior", "curta", 1, "medido")],
  mesa_flexora: FLEXORA,
  stiff: [r("posterior", "biarticular", 1, "provavel"), r("gluteos", "maximo", 0.5, "provavel"), r("gluteos", "adutores", 0.5, "teoria")],
  bom_dia: [r("posterior", "biarticular", 1, "teoria"), r("gluteos", "maximo", 0.5, "teoria")],

  // Plotkin 2023: hip thrust cresce o glúteo máximo como o agachamento, não mais
  elevacao_pelvica: [r("gluteos", "maximo", 1, "medido")],
  cadeira_abdutora: [r("gluteos", "medio", 1, "teoria")], gluteo_polia: [r("gluteos", "maximo", 1, "teoria")],
  cadeira_adutora: [r("gluteos", "adutores", 1, "teoria")],

  // Kinoshita 2023: em pé cresce o gastrocnêmio; sentado quase só o sóleo
  panturrilha_em_pe: PANT_PE, panturrilha_leg: PANT_PE,
  panturrilha_sentado: [r("panturrilha", "soleo", 1, "medido")],
};

// Séries por semana em cada parte, pelo plano (sem contar proximidade da falha: é a distribuição que importa aqui)
export function regioesDoPlano(plano = T().plano) {
  const out = {};
  for (const d of plano) for (const x of d.ex) {
    for (const [g, reg, peso] of ENFASE[x.ex] || []) {
      out[g] ||= {};
      out[g][reg] = Math.round(((out[g][reg] || 0) + x.series * peso) * 10) / 10;
    }
  }
  return out;
}

// Séries diretas no plano por músculo principal do exercício
function seriesDiretas(plano) {
  const out = {};
  for (const d of plano) for (const x of d.ex) { const g = exercicio(x.ex).g; if (g) out[g] = (out[g] || 0) + x.series; }
  return out;
}
const tem = (plano, ids) => plano.some((d) => d.ex.some((x) => ids.includes(x.ex)));

// Lacunas que viram sugestão: só as de crescimento medido, e só quando o músculo é treinado mas uma parte dele
// fica quase sem estímulo. Cada uma traz o exercício que resolve (o que estiver fora do plano).
export function lacunasDoPlano(plano = T().plano) {
  const reg = regioesDoPlano(plano), dir = seriesDiretas(plano), out = [];
  const fora = (ids) => ids.find((id) => !tem(plano, [id])) || null;
  const ql = (g, k) => reg[g]?.[k] || 0;

  // tríceps treinado sem nenhum exercício com o braço acima da cabeça (a testa já leva o braço para trás: não cobra)
  if ((dir.triceps || 0) >= 3 && !tem(plano, ["triceps_frances", "triceps_testa"])) {
    out.push({ id: "triceps-longa", g: "triceps", regiao: "longa", nivel: "medido", sugestao: "triceps_frances",
      titulo: "Cabeça longa do tríceps", texto: "O tríceps cresce mais, sobretudo a cabeça longa, com o braço acima da cabeça do que na polia ou no supino." });
  }
  if (ql("quadriceps", "vastos") >= 3 && ql("quadriceps", "reto") === 0) {
    out.push({ id: "quadriceps-reto", g: "quadriceps", regiao: "reto", nivel: "medido", sugestao: "cadeira_extensora",
      titulo: "Reto femoral", texto: "Agachamento e leg press quase não fazem crescer o reto femoral. A cadeira extensora faz." });
  }
  if (ql("quadriceps", "vastos") >= 3 && !dir.posterior && !tem(plano, ["levantamento_terra"])) {
    out.push({ id: "posterior-sem", g: "posterior", regiao: "biarticular", nivel: "medido", sugestao: fora(["cadeira_flexora", "mesa_flexora"]),
      titulo: "Posterior de coxa", texto: "Agachamento e leg press não fazem crescer o posterior de coxa. Ele precisa de exercício próprio." });
  } else if (ql("posterior", "biarticular") >= 3 && ql("posterior", "curta") === 0) {
    out.push({ id: "posterior-curta", g: "posterior", regiao: "curta", nivel: "medido", sugestao: fora(["cadeira_flexora", "mesa_flexora"]),
      titulo: "Cabeça curta do posterior", texto: "Stiff e exercícios de quadril não alcançam a cabeça curta do bíceps femoral. A flexora alcança; a sentada cresce mais que a deitada." });
  }
  if ((dir.panturrilha || 0) >= 3 && ql("panturrilha", "gastrocnemio") === 0) {
    out.push({ id: "panturrilha-gastro", g: "panturrilha", regiao: "gastrocnemio", nivel: "medido", sugestao: fora(["panturrilha_em_pe", "panturrilha_leg"]),
      titulo: "Gastrocnêmio", texto: "Panturrilha sentado trabalha quase só o sóleo. Com o joelho esticado, em pé, cresce o gastrocnêmio, a parte maior." });
  }
  return out.map((l) => ({ ...l, nomeSugestao: l.sugestao ? nomeEx(l.sugestao) : null }));
}
