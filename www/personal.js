// Motor do personal: monta o programa pela avaliação (dias, tempo, nível, lesões, prioridades), confere o volume
// por músculo, acha recordes e exercícios parados e controla os blocos de treino com semana de recuperação (deload).

import { S, salvar, hoje, somaDias, novoId, paraData } from "./store.js";
import { T, GRUPOS, EXERCICIOS, exercicio, nomeEx, GANCHOS } from "./treino.js";
import { lesoesAtivas } from "./corpo.js";

// ---------- metadados dos exercícios ----------
const COMPOSTOS = new Set([
  "supino_reto", "supino_inclinado", "supino_reto_halteres", "supino_inclinado_halteres", "supino_maquina", "flexao", "paralelas",
  "barra_fixa", "puxada_frente", "puxada_triangulo", "remada_curvada", "remada_baixa", "remada_unilateral", "remada_maquina",
  "remada_cavalinho", "levantamento_terra", "desenvolvimento_halteres", "desenvolvimento_barra", "desenvolvimento_maquina",
  "agachamento", "agachamento_smith", "agachamento_hack", "leg_press", "afundo", "agachamento_bulgaro", "stiff", "bom_dia",
  "elevacao_pelvica", "supino_fechado",
]);
export const ehComposto = (id) => COMPOSTOS.has(id);

// Exercícios a evitar: pelas lesões da avaliação e pelas dores ativas do mapa de dores
export function exerciciosEvitados(lesoes = S.personal.avaliacao?.lesoes || []) {
  const todas = new Set([...lesoes, ...lesoesAtivas()]);
  return new Set([...todas].flatMap((l) => LESOES[l]?.evita || []));
}

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
  const div = divisaoPara(av), evita = exerciciosEvitados(av.lesoes);
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
  // programa novo não abre bloco fixo: a semana leve vem pelos sinais (musculos.js)
  S.personal.bloco = null;
  S.personal.divisao = prog.divisao;
  salvar();
}

// O volume por músculo (séries efetivas), a recuperação e a força por músculo ficam em musculos.js

// ---------- força ----------
// 1RM estimado (Epley) contando as repetições que ainda sobravam: 100 kg × 5 com 2 sobrando vale como 7 repetições.
// Série sem RIR anotado conta como se tivesse ido até a falha (como o app sempre contou).
export const e1rm = (kg, reps, rir = 0) => (kg > 0 && reps > 0 ? kg * (1 + (reps + (Number(rir) > 0 ? Number(rir) : 0)) / 30) : 0);
export const melhorDa = (series) => series.reduce((m, s) => Math.max(m, e1rm(s.kg, s.reps, s.rir)), 0);

// Recordes da semana: exercícios em que a melhor série (1RM estimado) superou tudo o que veio antes
export function recordes(ate = hoje(), dias = 7) {
  const ini = somaDias(ate, -dias), antes = new Map(), novos = new Map();
  for (const s of T().sessoes) {
    for (const x of s.ex) {
      const m = melhorDa(x.series);
      if (!m) continue;
      if (s.d <= ini) antes.set(x.ex, Math.max(antes.get(x.ex) || 0, m));
      else if (s.d <= ate) {
        if (antes.has(x.ex) && m > (antes.get(x.ex) || 0) * 1.005 && m > (novos.get(x.ex)?.agora || 0)) novos.set(x.ex, { ex: x.ex, nome: nomeEx(x.ex), agora: m, anterior: antes.get(x.ex), d: s.d });
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
  const g = exercicio(id).g, evita = exerciciosEvitados();
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
// ---------- semana leve ----------
// Em vez de toda 5ª semana, a semana leve vem quando o corpo pede (sinais em musculos.js) e a pessoa aceita.
// Quem ainda está no meio de um bloco antigo termina ele normalmente.
export function semanaLeve(d = hoje()) {
  const s = S.personal.semanaLeve;
  return s && d >= s.ini && d <= s.fim ? s : null;
}
export function iniciarSemanaLeve(dias = 7) {
  S.personal.semanaLeve = { ini: hoje(), fim: somaDias(hoje(), dias - 1) };
  salvar();
}
export function encerrarSemanaLeve() {
  if (S.personal.semanaLeve) S.personal.semanaLeve.fim = somaDias(hoje(), -1);
  salvar();
}
// Semana de recuperação agora: a semana leve aceita, ou a 5ª semana de um bloco antigo
export const emRecuperacao = (d = hoje()) => !!semanaLeve(d) || !!blocoAtual(d)?.deload;

export function ajusteDeload(nSeries, kg, passo = 2.5) {
  if (!emRecuperacao()) return { nSeries, kg };
  const menos = kg === "" || kg == null ? kg : Math.max(0, Math.round((kg * 0.9) / passo) * passo);
  return { nSeries: Math.max(1, Math.round(nSeries * 0.6)), kg: menos };
}

// Descanso sugerido entre séries, em segundos: série pesada (principal, ou composto até 5 repetições) pede mais
export function descansoPara(id, serie = null) {
  const reps = Number(serie?.reps) || 0;
  if (serie?.tipo === "principal" || (ehComposto(id) && reps > 0 && reps <= 5)) return 180;
  return ehComposto(id) ? 120 : 90;
}

// ---------- série principal + recuo (foco em força) ----------
// Nos compostos de quem treina força: 1 série pesada perto da falha (RIR alvo 1) e as outras 10% mais leves.
// A carga da principal sai do 1RM estimado da última principal; cumpriu o alvo, sobe um passo.
export const ALVO_PRINCIPAL = { rir: 1 };
const RECUO = 0.9;
const kgBr = (kg) => `${(Math.round(kg * 100) / 100).toLocaleString("pt-BR")} kg`;
const arredonda = (kg, passo) => Math.max(0, Math.round(kg / passo) * passo);
export const cargaRecuo = (kg, passo = 2.5) => (kg === "" || kg == null ? "" : arredonda(Number(kg) * RECUO, passo));
export const usaPrincipal = (exId) => S.personal.avaliacao?.foco === "forca" && ehComposto(exId);

function ultimaPrincipal(exId) {
  const ss = T().sessoes;
  for (let i = ss.length - 1; i >= 0; i--) {
    const x = ss[i].ex.find((y) => y.ex === exId);
    if (!x?.series.length) continue;
    const p = x.series.find((s) => s.tipo === "principal") || x.series.reduce((m, s) => (e1rm(s.kg, s.reps, s.rir) > e1rm(m.kg, m.reps, m.rir) ? s : m));
    return { d: ss[i].d, serie: p };
  }
  return null;
}
export function sugerirPrincipal(exId, reps) {
  const passo = exercicio(exId).passo || 2.5, alvoRir = ALVO_PRINCIPAL.rir, ult = ultimaPrincipal(exId);
  if (!ult || !(ult.serie.kg > 0)) return { kg: "", e1rm: null, motivo: `Primeira vez: uma carga para ${reps} repetições sobrando ${alvoRir}.` };
  const p = ult.serie, e = e1rm(p.kg, p.reps, p.rir);
  const peloE1rm = Math.floor(e / (1 + (reps + alvoRir) / 30) / passo) * passo;
  const cumpriu = p.reps >= reps && (Number(p.rir) || 0) >= alvoRir;
  let kg, motivo;
  if (cumpriu) { kg = Math.max(peloE1rm, p.kg + passo); motivo = `Fez ${p.reps} sobrando ${Number(p.rir) || 0} da última vez: sobe para ${kgBr(kg)}.`; }
  else if (p.reps < reps - 1) { kg = Math.max(0, p.kg - passo); motivo = `Ficou em ${p.reps} repetições da última vez: desce para ${kgBr(kg)}.`; }
  else { kg = p.kg; motivo = `Mantém ${kgBr(kg)} e busca ${reps} repetições sobrando ${alvoRir}.`; }
  return { kg, e1rm: Math.round(e * 10) / 10, motivo };
}
GANCHOS.principal = (exId, nSeries, min, max) => {
  if (!usaPrincipal(exId) || nSeries < 2) return null;
  const passo = exercicio(exId).passo || 2.5, { kg } = sugerirPrincipal(exId, min);
  return [
    { kg, reps: "", rir: "", ok: false, tipo: "principal", alvoReps: min, alvoRir: ALVO_PRINCIPAL.rir },
    ...Array.from({ length: nSeries - 1 }, () => ({ kg: cargaRecuo(kg, passo), reps: "", rir: "", ok: false, tipo: "recuo", alvoReps: max, alvoRir: 2 })),
  ];
};

// ---------- resumos para as telas do treino ----------
// Semana de segunda a domingo: em quais dias houve treino
export function semanaDeTreino(d = hoje()) {
  const dow = (paraData(d).getDay() + 6) % 7, seg = somaDias(d, -dow);
  const feitos = new Set(T().sessoes.map((s) => s.d));
  return Array.from({ length: 7 }, (_, k) => { const dia = somaDias(seg, k); return { d: dia, feito: feitos.has(dia), hoje: dia === d, futuro: dia > d }; });
}
// Semanas seguidas com pelo menos um treino, contando a atual só se já teve treino
export function semanasSeguidas(d = hoje()) {
  const datas = T().sessoes.map((s) => s.d);
  let seg = somaDias(d, -((paraData(d).getDay() + 6) % 7)), n = 0;
  const teve = (ini) => datas.some((x) => x >= ini && x <= somaDias(ini, 6));
  if (!teve(seg)) seg = somaDias(seg, -7);
  while (teve(seg)) { n++; seg = somaDias(seg, -7); }
  return n;
}
// Minutos estimados de um dia do plano: ~45 s por série mais o descanso dela
export function minutosEstimados(dia) {
  const seg = (dia?.ex || []).reduce((t, x) => t + x.series * (45 + descansoPara(x.ex)), 0);
  return Math.max(5, Math.round(seg / 60 / 5) * 5);
}
// Músculos principais de um dia, do que tem mais séries para o que tem menos
export function gruposDoDia(dia) {
  const n = {};
  for (const x of dia?.ex || []) { const g = exercicio(x.ex).g; if (g) n[g] = (n[g] || 0) + x.series; }
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([g, series]) => ({ g, series }));
}
// Exercícios em que a sessão bateu a melhor marca de antes dela: a série do recorde e a melhor série de antes
const topoDa = (series) => series.reduce((b, y) => (e1rm(y.kg, y.reps, y.rir) > e1rm(b.kg, b.reps, b.rir) ? y : b), series[0]);
export function recordesDaSessao(s) {
  const antes = new Map();
  for (const o of T().sessoes) {
    if (o === s || o.d > s.d || (o.d === s.d && (o.fim || 0) >= (s.fim || 0))) continue;
    for (const x of o.ex) { const m = melhorDa(x.series); if (m > (antes.get(x.ex)?.v || 0)) antes.set(x.ex, { v: m, serie: topoDa(x.series) }); }
  }
  return s.ex.map((x) => {
    const m = melhorDa(x.series), a = antes.get(x.ex);
    return a && m > a.v * 1.005 ? { ex: x.ex, nome: nomeEx(x.ex), serie: topoDa(x.series), antes: a.serie } : null;
  }).filter(Boolean);
}
// 1RM estimado de um exercício, sessão a sessão, desde uma data
export function forcaDoExercicio(exId, desde = "0000-00-00") {
  return T().sessoes.filter((s) => s.d >= desde).map((s) => {
    const x = s.ex.find((y) => y.ex === exId);
    if (!x) return null;
    const v = melhorDa(x.series);
    return v ? { d: s.d, v: Math.round(v * 10) / 10, serie: topoDa(x.series) } : null;
  }).filter(Boolean);
}
// Exercícios com histórico, do mais feito para o menos
export function exerciciosFeitos(desde = "0000-00-00") {
  const n = new Map();
  for (const s of T().sessoes) if (s.d >= desde) for (const x of s.ex) n.set(x.ex, (n.get(x.ex) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([ex, vezes]) => ({ ex, nome: nomeEx(ex), vezes }));
}

export { GRUPOS };

GANCHOS.deload = ajusteDeload;
