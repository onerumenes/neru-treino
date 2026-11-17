// Treino: biblioteca de exercícios, plano, sessões e a sugestão de carga para a próxima vez.
// Aqui só tem dados e regras; as telas ficam em tela-treino.js.

import { S, salvar, novoId, hoje } from "./store.js";

export const GRUPOS = {
  peito: "Peito", costas: "Costas", ombros: "Ombros", biceps: "Bíceps", triceps: "Tríceps",
  quadriceps: "Quadríceps", posterior: "Posterior de coxa", gluteos: "Glúteos",
  panturrilha: "Panturrilha", abdomen: "Abdômen", antebraco: "Antebraço",
};

// passo: quanto subir de carga quando a faixa de repetições é fechada (kg; em halteres, por mão)
const e = (nome, g, passo = 2.5) => ({ nome, g, passo });
export const EXERCICIOS = {
  supino_reto: e("Supino reto com barra", "peito"),
  supino_inclinado: e("Supino inclinado com barra", "peito"),
  supino_reto_halteres: e("Supino reto com halteres", "peito", 2),
  supino_inclinado_halteres: e("Supino inclinado com halteres", "peito", 2),
  supino_maquina: e("Supino na máquina", "peito", 5),
  crucifixo_maquina: e("Crucifixo na máquina (peck deck)", "peito", 5),
  crucifixo_halteres: e("Crucifixo com halteres", "peito", 2),
  crossover: e("Crossover na polia", "peito"),
  flexao: e("Flexão de braço", "peito"),
  paralelas: e("Paralelas", "peito"),

  barra_fixa: e("Barra fixa", "costas"),
  puxada_frente: e("Puxada frente na polia", "costas", 5),
  puxada_triangulo: e("Puxada com triângulo", "costas", 5),
  remada_curvada: e("Remada curvada com barra", "costas"),
  remada_baixa: e("Remada baixa na polia", "costas", 5),
  remada_unilateral: e("Remada unilateral com halter", "costas", 2),
  remada_maquina: e("Remada na máquina", "costas", 5),
  remada_cavalinho: e("Remada cavalinho", "costas"),
  pulldown: e("Pulldown com braços estendidos", "costas"),
  levantamento_terra: e("Levantamento terra", "costas", 5),

  desenvolvimento_halteres: e("Desenvolvimento com halteres", "ombros", 2),
  desenvolvimento_barra: e("Desenvolvimento com barra", "ombros"),
  desenvolvimento_maquina: e("Desenvolvimento na máquina", "ombros", 5),
  elevacao_lateral: e("Elevação lateral", "ombros", 1),
  elevacao_lateral_polia: e("Elevação lateral na polia", "ombros"),
  elevacao_frontal: e("Elevação frontal", "ombros", 1),
  crucifixo_inverso: e("Crucifixo inverso", "ombros"),
  face_pull: e("Face pull", "ombros"),
  encolhimento: e("Encolhimento de ombros", "ombros"),

  rosca_direta: e("Rosca direta com barra", "biceps"),
  rosca_alternada: e("Rosca alternada com halteres", "biceps", 1),
  rosca_martelo: e("Rosca martelo", "biceps", 1),
  rosca_scott: e("Rosca Scott", "biceps"),
  rosca_polia: e("Rosca na polia", "biceps"),
  rosca_inclinada: e("Rosca inclinada com halteres", "biceps", 1),

  triceps_corda: e("Tríceps na polia com corda", "triceps"),
  triceps_barra: e("Tríceps na polia com barra", "triceps"),
  triceps_frances: e("Tríceps francês", "triceps"),
  triceps_testa: e("Tríceps testa", "triceps"),
  triceps_banco: e("Tríceps no banco", "triceps"),
  supino_fechado: e("Supino fechado", "triceps"),

  agachamento: e("Agachamento livre", "quadriceps", 5),
  agachamento_smith: e("Agachamento no Smith", "quadriceps", 5),
  agachamento_hack: e("Agachamento hack", "quadriceps", 5),
  leg_press: e("Leg press", "quadriceps", 10),
  cadeira_extensora: e("Cadeira extensora", "quadriceps", 5),
  afundo: e("Afundo", "quadriceps", 2),
  agachamento_bulgaro: e("Agachamento búlgaro", "quadriceps", 2),

  stiff: e("Stiff (terra romeno)", "posterior", 5),
  mesa_flexora: e("Mesa flexora", "posterior", 5),
  cadeira_flexora: e("Cadeira flexora", "posterior", 5),
  bom_dia: e("Bom dia com barra", "posterior"),

  elevacao_pelvica: e("Elevação pélvica", "gluteos", 5),
  cadeira_abdutora: e("Cadeira abdutora", "gluteos", 5),
  cadeira_adutora: e("Cadeira adutora", "gluteos", 5),
  gluteo_polia: e("Glúteo na polia", "gluteos"),

  panturrilha_em_pe: e("Panturrilha em pé", "panturrilha", 5),
  panturrilha_sentado: e("Panturrilha sentado", "panturrilha", 5),
  panturrilha_leg: e("Panturrilha no leg press", "panturrilha", 10),

  abdominal_polia: e("Abdominal na polia", "abdomen", 5),
  abdominal_maquina: e("Abdominal na máquina", "abdomen", 5),
  elevacao_pernas: e("Elevação de pernas", "abdomen"),
  prancha: e("Prancha", "abdomen"),
  abdominal_supra: e("Abdominal supra", "abdomen"),

  rosca_punho: e("Rosca de punho", "antebraco"),
  rosca_inversa: e("Rosca inversa", "antebraco"),
};

// Modelo de partida: divisão em 5 dias. É só um ponto de início; o plano é todo editável.
const MODELO = [
  ["A", "Peito e tríceps", [["supino_reto", 4, 6, 10], ["supino_inclinado_halteres", 3, 8, 12], ["crucifixo_maquina", 3, 10, 15], ["triceps_corda", 3, 10, 15], ["triceps_frances", 3, 10, 12]]],
  ["B", "Costas e bíceps", [["puxada_frente", 4, 8, 12], ["remada_curvada", 3, 8, 10], ["remada_baixa", 3, 10, 12], ["rosca_direta", 3, 8, 12], ["rosca_martelo", 3, 10, 12]]],
  ["C", "Quadríceps e panturrilha", [["agachamento", 4, 6, 10], ["leg_press", 3, 10, 12], ["cadeira_extensora", 3, 12, 15], ["panturrilha_em_pe", 4, 10, 15]]],
  ["D", "Ombros e abdômen", [["desenvolvimento_halteres", 4, 8, 10], ["elevacao_lateral", 4, 12, 15], ["crucifixo_inverso", 3, 12, 15], ["encolhimento", 3, 10, 12], ["abdominal_polia", 3, 12, 15]]],
  ["E", "Posterior e glúteos", [["stiff", 4, 8, 10], ["mesa_flexora", 3, 10, 12], ["elevacao_pelvica", 3, 8, 12], ["cadeira_abdutora", 3, 12, 15], ["panturrilha_sentado", 3, 12, 15]]],
];

export function T() {
  if (!S.treino) S.treino = { plano: [], custom: {}, sessoes: [], atual: null };
  return S.treino;
}
export const temPlano = () => !!S.treino?.plano?.length;

export function usarModelo() {
  T().plano = MODELO.map(([letra, nome, lista]) => ({
    id: novoId("d"), nome: `${letra}: ${nome}`,
    ex: lista.map(([ex, series, min, max]) => ({ ex, series, min, max })),
  }));
  salvar();
}

export const exercicio = (id) => EXERCICIOS[id] || S.treino?.custom?.[id] || { nome: id, g: "", passo: 2.5 };
export const nomeEx = (id) => exercicio(id).nome;
export function biblioteca() {
  return Object.entries({ ...EXERCICIOS, ...(S.treino?.custom || {}) })
    .map(([id, x]) => ({ id, ...x }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
export function criarExercicio(nome, g) {
  const id = novoId("x");
  T().custom[id] = { nome: String(nome).trim().slice(0, 60) || "Exercício", g: GRUPOS[g] ? g : "", passo: 2.5 };
  salvar();
  return id;
}

// ---------- plano ----------
export const diaDoPlano = (id) => T().plano.find((d) => d.id === id) || null;
export function addDia() {
  const dia = { id: novoId("d"), nome: `Treino ${T().plano.length + 1}`, ex: [] };
  T().plano.push(dia);
  salvar();
  return dia;
}
export function mover(lista, i, delta) {
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  salvar();
}

// ---------- histórico e sugestão ----------
const feitas = (series) => series.filter((s) => s.ok && s.reps > 0);

// Última sessão concluída em que o exercício teve séries feitas
export function ultimaVez(exId) {
  const ss = T().sessoes;
  for (let i = ss.length - 1; i >= 0; i--) {
    const x = ss[i].ex.find((y) => y.ex === exId);
    if (x && feitas(x.series).length) return { d: ss[i].d, series: feitas(x.series) };
  }
  return null;
}

// Progressão dupla: fecha a faixa de repetições em todas as séries, sobe a carga; senão, mantém e busca mais repetições.
// Devolve { kg, motivo, ultima } ou { kg: null, ... } quando ainda não há histórico.
export function sugerir(exId, min, max) {
  const ult = ultimaVez(exId);
  if (!ult) return { kg: null, ultima: null, motivo: `Primeira vez: escolhe uma carga que deixe fazer de ${min} a ${max} repetições.` };

  // carga de trabalho: a mais usada na última vez (em empate, a maior)
  const conta = new Map();
  for (const s of ult.series) conta.set(s.kg, (conta.get(s.kg) || 0) + 1);
  const kg = [...conta.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const naCarga = ult.series.filter((s) => s.kg === kg);
  const passo = exercicio(exId).passo || 2.5;

  if (kg > 0 && naCarga.every((s) => s.reps >= max)) {
    return { kg: kg + passo, ultima: ult, motivo: `Fechou ${max} em todas as séries: sobe para ${fmtKg(kg + passo)}.` };
  }
  // RIR (repetições que ainda sobravam): dentro da faixa, mas leve demais em todas as séries
  const comRir = naCarga.filter((s) => s.rir != null);
  if (kg > 0 && comRir.length === naCarga.length && comRir.every((s) => s.rir >= 4 && s.reps >= min)) {
    return { kg: kg + passo, ultima: ult, motivo: `Sobraram 4 ou mais repetições em todas as séries: sobe para ${fmtKg(kg + passo)}.` };
  }
  if (kg > 0 && naCarga[0].reps < min) {
    const menos = Math.max(0, kg - passo);
    return { kg: menos, ultima: ult, motivo: `Ficou abaixo de ${min} repetições: desce para ${fmtKg(menos)}.` };
  }
  return { kg, ultima: ult, motivo: kg > 0 ? `Mantém ${fmtKg(kg)} e busca mais repetições.` : "Busca mais repetições que da última vez." };
}

export const fmtKg = (kg) => `${(Math.round(kg * 100) / 100).toLocaleString("pt-BR")} kg`;
export function resumoSeries(series) {
  const fs = feitas(series);
  if (!fs.length) return "";
  const mesmaCarga = fs.every((s) => s.kg === fs[0].kg);
  if (mesmaCarga) return `${fs[0].kg > 0 ? fmtKg(fs[0].kg) + " × " : ""}${fs.map((s) => s.reps).join(", ")}`;
  return fs.map((s) => `${s.kg > 0 ? fmtKg(s.kg) + " × " : ""}${s.reps}`).join("; ");
}

// Dia do plano que vem depois do último treinado
export function proximoDia() {
  const { plano, sessoes } = T();
  if (!plano.length) return null;
  for (let i = sessoes.length - 1; i >= 0; i--) {
    const k = plano.findIndex((d) => d.id === sessoes[i].dia);
    if (k >= 0) return plano[(k + 1) % plano.length];
  }
  return plano[0];
}

// ---------- sessão ----------
// Ganchos do personal (personal.js), sem import circular: deload ajusta séries e carga da semana de recuperação
export const GANCHOS = { deload: null };
function exDaSessao(exId, nSeries, min, max) {
  const sug = sugerir(exId, min, max);
  let n = nSeries, kg = sug.kg ?? "";
  if (GANCHOS.deload) ({ nSeries: n, kg } = GANCHOS.deload(nSeries, kg, exercicio(exId).passo || 2.5));
  return {
    ex: exId, nome: nomeEx(exId), min, max,
    series: Array.from({ length: n }, () => ({ kg, reps: "", rir: "", ok: false })),
  };
}

export function iniciar(diaId) {
  const dia = diaDoPlano(diaId), t = T();
  t.atual = {
    id: novoId("s"), d: hoje(), dia: dia?.id || null, nome: dia?.nome || "Treino livre", ini: Date.now(),
    ex: (dia?.ex || []).map((x) => exDaSessao(x.ex, x.series, x.min, x.max)),
  };
  salvar();
  return t.atual;
}
export function addExNaSessao(exId) {
  const t = T();
  if (!t.atual) return;
  t.atual.ex.push(exDaSessao(exId, 3, 8, 12));
  salvar();
}

// Guarda a sessão só com as séries feitas. Devolve a sessão salva ou null se nada foi feito.
export function concluir() {
  const t = T(), a = t.atual;
  if (!a) return null;
  const ex = a.ex
    .map((x) => ({
      ex: x.ex, nome: x.nome, min: x.min, max: x.max,
      series: feitas(x.series).map((s) => ({ kg: Number(s.kg) || 0, reps: Number(s.reps), ...(s.rir === "" || s.rir == null ? {} : { rir: Number(s.rir) }), ok: true })),
    }))
    .filter((x) => x.series.length);
  t.atual = null;
  if (!ex.length) { salvar(); return null; }
  const sessao = { id: a.id, d: a.d, dia: a.dia, nome: a.nome, ini: a.ini, fim: Date.now(), ex };
  t.sessoes.push(sessao);
  salvar();
  return sessao;
}
export function descartar() { T().atual = null; salvar(); }
export function removerSessao(id) {
  const t = T(), i = t.sessoes.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const [fora] = t.sessoes.splice(i, 1);
  salvar();
  return { fora, i };
}

export const volume = (sessao) => sessao.ex.reduce((v, x) => v + x.series.reduce((a, s) => a + s.kg * s.reps, 0), 0);
export const totalSeries = (sessao) => sessao.ex.reduce((n, x) => n + x.series.length, 0);

// Evolução por exercício: primeira e última carga de trabalho registradas
export function evolucao() {
  const mapa = new Map();
  for (const s of T().sessoes) {
    for (const x of s.ex) {
      const topo = x.series.reduce((m, y) => (y.kg > m.kg || (y.kg === m.kg && y.reps > m.reps) ? y : m), x.series[0]);
      const reg = mapa.get(x.ex) || { ex: x.ex, nome: nomeEx(x.ex), primeiro: topo, vezes: 0 };
      reg.ultimo = topo; reg.d = s.d; reg.vezes++;
      mapa.set(x.ex, reg);
    }
  }
  return [...mapa.values()].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : a.nome.localeCompare(b.nome, "pt-BR")));
}
