// Motor do personal: monta o programa pela avaliação (dias, tempo, nível, lesões, prioridades), confere o volume
// por músculo, acha recordes e exercícios parados e controla os blocos de treino com semana de recuperação (deload).

import { S, salvar, hoje, somaDias, novoId } from "./store.js";
import { T, GRUPOS, EXERCICIOS, exercicio, nomeEx, GANCHOS } from "./treino.js";

// ---------- metadados dos exercícios ----------
const COMPOSTOS = new Set([
  "supino_reto", "supino_inclinado", "supino_reto_halteres", "supino_inclinado_halteres", "supino_maquina", "flexao", "paralelas",
  "barra_fixa", "puxada_frente", "puxada_triangulo", "remada_curvada", "remada_baixa", "remada_unilateral", "remada_maquina",
  "remada_cavalinho", "levantamento_terra", "desenvolvimento_halteres", "desenvolvimento_barra", "desenvolvimento_maquina",
  "agachamento", "agachamento_smith", "agachamento_hack", "leg_press", "afundo", "agachamento_bulgaro", "stiff", "bom_dia",
  "elevacao_pelvica", "supino_fechado",
]);
export const ehComposto = (id) => COMPOSTOS.has(id);

export const LESOES = {
  ombro: { nome: "Ombro", evita: ["supino_reto", "supino_inclinado", "desenvolvimento_barra", "paralelas", "triceps_banco", "elevacao_frontal"] },
  joelho: { nome: "Joelho", evita: ["agachamento", "agachamento_hack", "afundo", "agachamento_bulgaro", "cadeira_extensora", "agachamento_smith"] },
  lombar: { nome: "Lombar", evita: ["levantamento_terra", "remada_curvada", "bom_dia", "stiff", "agachamento", "remada_cavalinho"] },
  cotovelo: { nome: "Cotovelo", evita: ["triceps_testa", "triceps_frances", "supino_fechado", "rosca_direta"] },
  punho: { nome: "Punho", evita: ["rosca_direta", "rosca_punho", "rosca_inversa", "flexao", "supino_fechado"] },
};

// Preferência por músculo e tipo de movimento (C = composto, I = isolado, V = puxada vertical, R = remada)
const PREF = {
  "peito:C": ["supino_reto", "supino_inclinado_halteres", "supino_reto_halteres", "supino_inclinado", "supino_maquina", "paralelas", "flexao"],
  "peito:I": ["crucifixo_maquina", "crossover", "crucifixo_halteres"],
  "costas:V": ["puxada_frente", "barra_fixa", "puxada_triangulo"],
  "costas:R": ["remada_curvada", "remada_baixa", "remada_unilateral", "remada_maquina", "remada_cavalinho"],
  "costas:I": ["pulldown", "remada_baixa"],
  "ombros:C": ["desenvolvimento_halteres", "desenvolvimento_maquina", "desenvolvimento_barra"],
  "ombros:I": ["elevacao_lateral", "elevacao_lateral_polia"],
  "ombros:P": ["crucifixo_inverso", "face_pull"],
  "biceps:I": ["rosca_direta", "rosca_alternada", "rosca_martelo", "rosca_scott", "rosca_inclinada", "rosca_polia"],
  "triceps:I": ["triceps_corda", "triceps_frances", "triceps_barra", "triceps_testa", "supino_fechado"],
  "quadriceps:C": ["agachamento", "leg_press", "agachamento_hack", "agachamento_smith", "agachamento_bulgaro", "afundo"],
  "quadriceps:I": ["cadeira_extensora", "afundo", "leg_press"],
  "posterior:C": ["stiff", "levantamento_terra", "bom_dia", "mesa_flexora"],
  "posterior:I": ["mesa_flexora", "cadeira_flexora"],
  "gluteos:I": ["elevacao_pelvica", "cadeira_abdutora", "gluteo_polia"],
  "panturrilha:I": ["panturrilha_em_pe", "panturrilha_sentado", "panturrilha_leg"],
  "abdomen:I": ["abdominal_polia", "elevacao_pernas", "abdominal_maquina", "prancha"],
};

// Dias de cada divisão: lista de vagas [músculo:tipo], na ordem de importância
const DIAS = {
  full: ["quadriceps:C", "peito:C", "costas:R", "posterior:C", "costas:V", "ombros:I", "biceps:I", "triceps:I", "abdomen:I"],
  upper: ["peito:C", "costas:R", "ombros:C", "costas:V", "peito:I", "ombros:I", "biceps:I", "triceps:I"],
  lower: ["quadriceps:C", "posterior:C", "quadriceps:I", "posterior:I", "gluteos:I", "panturrilha:I", "abdomen:I"],
  push: ["peito:C", "ombros:C", "peito:C", "ombros:I", "peito:I", "triceps:I", "triceps:I"],
  pull: ["costas:V", "costas:R", "costas:R", "ombros:P", "biceps:I", "biceps:I", "abdomen:I"],
  legs: ["quadriceps:C", "posterior:C", "quadriceps:C", "posterior:I", "gluteos:I", "panturrilha:I", "abdomen:I"],
};
const NOMES_DIA = { full: "Corpo todo", upper: "Superior", lower: "Inferior", push: "Empurrar (peito, ombro, tríceps)", pull: "Puxar (costas, bíceps)", legs: "Pernas" };
export const DIVISOES = {
  2: { nome: "Corpo todo 2x", dias: ["full", "full"] },
  3: { nome: "Corpo todo 3x", dias: ["full", "full", "full"], avancado: { nome: "Empurrar, puxar e pernas", dias: ["push", "pull", "legs"] } },
  4: { nome: "Superior e inferior 2x", dias: ["upper", "lower", "upper", "lower"] },
  5: { nome: "Superior, inferior, empurrar, puxar e pernas", dias: ["upper", "lower", "push", "pull", "legs"] },
  6: { nome: "Empurrar, puxar e pernas 2x", dias: ["push", "pull", "legs", "push", "pull", "legs"] },
};
const POR_TEMPO = { 45: 5, 60: 6, 75: 7, 90: 8 };

export function divisaoPara(av) {
  const d = DIVISOES[Math.min(6, Math.max(2, Number(av.dias) || 4))];
  return d.avancado && av.nivel !== "iniciante" ? d.avancado : d;
}

function escolher(vaga, usados, evita, variante) {
  const lista = (PREF[vaga] || []).filter((id) => !usados.has(id) && !evita.has(id) && EXERCICIOS[id]);
  if (!lista.length) return null;
  return lista[variante % lista.length];
}

// av: { nivel: iniciante|intermediario|avancado, dias, tempo, lesoes: [], prioridades: [grupo], foco: hipertrofia|forca|ambos }
export function gerarPrograma(av) {
  const div = divisaoPara(av), evita = new Set((av.lesoes || []).flatMap((l) => LESOES[l]?.evita || []));
  const max = POR_TEMPO[av.tempo] || 6, prior = new Set(av.prioridades || []);
  const contagem = {}; // variação entre dias do mesmo tipo (A e B)
  const plano = div.dias.map((tipo, k) => {
    const v = (contagem[tipo] = (contagem[tipo] ?? -1) + 1);
    let vagas = [...DIAS[tipo]];
    // prioridade: uma vaga extra de isolado logo depois dos compostos
    for (const g of prior) {
      if (vagas.some((x) => x.startsWith(g + ":"))) {
        const extra = PREF[`${g}:I`] ? `${g}:I` : `${g}:C`;
        const pos = vagas.findIndex((x) => x.endsWith(":I"));
        vagas.splice(pos < 0 ? vagas.length : pos, 0, extra);
      }
    }
    vagas = vagas.slice(0, max);
    const usados = new Set(), ex = [];
    for (const vaga of vagas) {
      const id = escolher(vaga, usados, evita, v + (vaga.endsWith(":C") && ex.some((x) => exercicio(x.ex).g === vaga.split(":")[0]) ? 1 : 0));
      if (!id) continue;
      usados.add(id);
      const g = vaga.split(":")[0], comp = ehComposto(id);
      let series = comp ? (av.nivel === "iniciante" ? 3 : 4) : 3;
      if (prior.has(g)) series = Math.min(5, series + 1);
      let [min, maxR] = comp ? (av.foco === "forca" ? [4, 6] : av.foco === "ambos" ? [5, 8] : [6, 10]) : [10, 15];
      if (g === "panturrilha" || g === "abdomen") [min, maxR] = [12, 20];
      ex.push({ ex: id, series, min, max: maxR });
    }
    const letra = String.fromCharCode(65 + k);
    return { id: novoId("d"), nome: `${letra}: ${NOMES_DIA[tipo]}`, ex };
  });
  return { divisao: div.nome, plano };
}

export function aplicarPrograma(prog) {
  const t = T();
  t.plano = prog.plano;
  S.personal.bloco = { ini: hoje(), semanas: 5, divisao: prog.divisao };
  salvar();
}

// ---------- volume ----------
// Séries por semana em cada músculo pelo plano (cada dia do plano acontece uma vez por semana)
export function volumePlanejado(plano = T().plano) {
  const v = {};
  for (const d of plano) for (const x of d.ex) { const g = exercicio(x.ex).g; if (g) v[g] = (v[g] || 0) + x.series; }
  return v;
}
// Séries feitas nos últimos 7 dias
export function volumeFeito(ate = hoje(), dias = 7) {
  const v = {}, ini = somaDias(ate, -dias);
  for (const s of T().sessoes) if (s.d > ini && s.d <= ate) for (const x of s.ex) { const g = exercicio(x.ex).g; if (g) v[g] = (v[g] || 0) + x.series.length; }
  return v;
}
export function faixaVolume(g) {
  const prior = (S.personal.avaliacao?.prioridades || []).includes(g);
  if (g === "abdomen" || g === "antebraco" || g === "panturrilha") return [6, 16];
  return prior ? [12, 22] : [10, 20];
}

// ---------- força ----------
export const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? kg * (1 + reps / 30) : 0); // Epley
const melhorDa = (series) => series.reduce((m, s) => Math.max(m, e1rm(s.kg, s.reps)), 0);

// Recordes da semana: exercícios em que a melhor série (1RM estimado) superou tudo o que veio antes
export function recordes(ate = hoje(), dias = 7) {
  const ini = somaDias(ate, -dias), antes = new Map(), novos = new Map();
  for (const s of T().sessoes) {
    for (const x of s.ex) {
      const m = melhorDa(x.series);
      if (!m) continue;
      if (s.d <= ini) antes.set(x.ex, Math.max(antes.get(x.ex) || 0, m));
      else if (s.d <= ate) {
        const ref = Math.max(antes.get(x.ex) || 0, novos.get(x.ex)?.anterior || 0);
        if (antes.has(x.ex) && m > (antes.get(x.ex) || 0) * 1.005 && m > (novos.get(x.ex)?.agora || 0)) novos.set(x.ex, { ex: x.ex, nome: nomeEx(x.ex), agora: m, anterior: antes.get(x.ex), d: s.d, ref });
      }
    }
  }
  return [...novos.values()].map((r) => ({ ...r, ganho: Math.round(((r.agora - r.anterior) / r.anterior) * 1000) / 10 }));
}

// Exercícios parados: 3 sessões seguidas sem superar a melhor marca de antes delas
export function estagnados() {
  const hist = new Map();
  for (const s of T().sessoes) for (const x of s.ex) {
    const m = melhorDa(x.series);
    if (m) (hist.get(x.ex) || hist.set(x.ex, []).get(x.ex)).push(m);
  }
  const out = [];
  for (const [ex, ms] of hist) {
    if (ms.length < 4) continue;
    const ult3 = ms.slice(-3), antes = Math.max(...ms.slice(0, -3));
    if (Math.max(...ult3) <= antes * 1.005) out.push({ ex, nome: nomeEx(ex), sessoes: ms.length, troca: alternativa(ex) });
  }
  return out;
}

// Alternativa do mesmo músculo e tipo, respeitando lesões e sem repetir o que já está no plano
export function alternativa(id) {
  const g = exercicio(id).g, evita = new Set((S.personal.avaliacao?.lesoes || []).flatMap((l) => LESOES[l]?.evita || []));
  const noPlano = new Set(T().plano.flatMap((d) => d.ex.map((x) => x.ex)));
  const chaves = Object.keys(PREF).filter((k) => k.startsWith(g + ":") && PREF[k].includes(id));
  const lista = (chaves.length ? chaves : Object.keys(PREF).filter((k) => k.startsWith(g + ":"))).flatMap((k) => PREF[k]);
  return lista.find((x) => x !== id && !noPlano.has(x) && !evita.has(x)) || null;
}
export function trocarNoPlano(de, para) {
  for (const d of T().plano) for (const x of d.ex) if (x.ex === de) x.ex = para;
  salvar();
}

// ---------- blocos ----------
// Bloco de 5 semanas: 4 de progressão e a última de recuperação (deload: menos séries e 10% menos carga)
export function blocoAtual(d = hoje()) {
  const b = S.personal.bloco;
  if (!b) return null;
  const dias = Math.round((new Date(d) - new Date(b.ini)) / 864e5);
  const semana = Math.floor(dias / 7) + 1;
  return { ...b, semana, deload: semana === b.semanas, acabou: semana > b.semanas };
}
export function novoBloco() {
  S.personal.bloco = { ...(S.personal.bloco || {}), ini: hoje(), semanas: 5 };
  salvar();
}
export function ajusteDeload(nSeries, kg, passo = 2.5) {
  const b = blocoAtual();
  if (!b?.deload) return { nSeries, kg };
  const menos = kg === "" || kg == null ? kg : Math.max(0, Math.round((kg * 0.9) / passo) * passo);
  return { nSeries: Math.max(1, Math.round(nSeries * 0.6)), kg: menos };
}

// Descanso sugerido entre séries, em segundos
export const descansoPara = (id) => (ehComposto(id) ? 120 : 75);

export { GRUPOS };

GANCHOS.deload = ajusteDeload;
