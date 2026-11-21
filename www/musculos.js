// Carga por músculo, em três medidas separadas (são os três modos do avatar):
//   estímulo:    séries efetivas na semana, o que manda no crescimento
//   recuperação: quanto o músculo já se recuperou do cansaço dos últimos treinos
//   força:       se o 1RM estimado dos exercícios do músculo está subindo
//
// Base: hipertrofia depende de séries perto da falha, quase não da carga (Schoenfeld 2017, Lopez 2021,
// Robinson 2024, Refalo 2023); série indireta vale meia (Pelland 2024); carga pesada rende mais força
// e treino até a falha pede mais tempo de recuperação (Morán-Navarro 2017). Os números das tabelas são
// a tradução dessas conclusões em regra, não coeficientes medidos.

import { S, hoje, somaDias, paraData, salvar, medidasAte } from "./store.js";
import { T, GRUPOS, exercicio } from "./treino.js";
import { melhorDa, emRecuperacao } from "./personal.js";
import { nivelDor } from "./corpo.js";

// ---------- músculos secundários (cada série conta 0,5 neles) ----------
const SUPINOS = ["triceps", "ombros"], PUXADAS = ["biceps"], REMADAS = ["biceps", "ombros"], AGACHAMENTOS = ["gluteos"];
export const SECUNDARIOS = {
  supino_reto: SUPINOS, supino_inclinado: SUPINOS, supino_reto_halteres: SUPINOS, supino_inclinado_halteres: SUPINOS,
  supino_maquina: SUPINOS, flexao: SUPINOS, paralelas: SUPINOS,
  barra_fixa: PUXADAS, puxada_frente: PUXADAS, puxada_triangulo: PUXADAS,
  remada_curvada: REMADAS, remada_baixa: REMADAS, remada_unilateral: REMADAS, remada_maquina: REMADAS, remada_cavalinho: REMADAS,
  levantamento_terra: ["posterior", "gluteos", "quadriceps"],
  desenvolvimento_halteres: ["triceps"], desenvolvimento_barra: ["triceps"], desenvolvimento_maquina: ["triceps"],
  crucifixo_inverso: ["costas"], face_pull: ["costas"],
  rosca_direta: ["antebraco"], rosca_martelo: ["antebraco"], rosca_inversa: ["biceps"],
  supino_fechado: ["peito", "ombros"],
  agachamento: AGACHAMENTOS, agachamento_smith: AGACHAMENTOS, agachamento_hack: AGACHAMENTOS, leg_press: AGACHAMENTOS,
  afundo: AGACHAMENTOS, agachamento_bulgaro: AGACHAMENTOS,
  stiff: ["gluteos"], bom_dia: ["gluteos", "costas"],
  elevacao_pelvica: ["posterior"],
};
const SECUNDARIO = 0.5;

// Músculos que a série trabalha: [[grupo, peso]]. Exercício criado pela pessoa conta só no músculo dele.
export function musculosDo(exId) {
  const g = exercicio(exId).g;
  if (!g) return [];
  return [[g, 1], ...(SECUNDARIOS[exId] || []).filter((x) => x !== g).map((x) => [x, SECUNDARIO])];
}

// ---------- estímulo de uma série ----------
export const RIR_PADRAO = 2; // série sem RIR anotado conta como RIR 2
const rirDe = (s) => (s.rir == null || s.rir === "" || !Number.isFinite(Number(s.rir)) ? RIR_PADRAO : Number(s.rir));

// Perto da falha vale cheio; de 0 a 2 o efeito é quase o mesmo, e cai à medida que sobram repetições
export function proximidade(rir) {
  if (rir <= 1) return 1;
  if (rir <= 2) return 0.95;
  if (rir <= 3) return 0.85;
  if (rir <= 4) return 0.7;
  if (rir <= 5) return 0.5;
  return 0.25;
}
// Séries muito curtas (carga muito alta) rendem um pouco menos de hipertrofia por série; muito longas também
export function fatorReps(reps) {
  if (reps <= 3) return 0.7;
  if (reps <= 5) return 0.85;
  if (reps <= 30) return 1;
  return 0.8;
}
export const estimuloSerie = (s) => (Number(s.reps) > 0 ? proximidade(rirDe(s)) * fatorReps(Number(s.reps)) : 0);

const r1 = (x) => Math.round(x * 10) / 10;
const sessoesEntre = (ini, ate) => T().sessoes.filter((s) => s.d > ini && s.d <= ate);

// Séries efetivas por músculo nos últimos `dias` (sem limite por treino)
export function volumeFeito(ate = hoje(), dias = 7) {
  const v = {};
  for (const s of sessoesEntre(somaDias(ate, -dias), ate)) {
    for (const x of s.ex) {
      const ms = musculosDo(x.ex);
      for (const serie of x.series) {
        const e = estimuloSerie(serie);
        for (const [g, p] of ms) v[g] = (v[g] || 0) + e * p;
      }
    }
  }
  for (const g in v) v[g] = r1(v[g]);
  return v;
}

// O plano rende quantas séries efetivas por semana: supõe RIR 2 e o meio da faixa de repetições
export function volumePlanejado(plano = T().plano) {
  const v = {};
  for (const d of plano) {
    for (const x of d.ex) {
      const e = estimuloSerie({ reps: Math.round(((x.min || 8) + (x.max || 12)) / 2), rir: RIR_PADRAO });
      for (const [g, p] of musculosDo(x.ex)) v[g] = (v[g] || 0) + x.series * e * p;
    }
  }
  for (const g in v) v[g] = r1(v[g]);
  return v;
}

// Faixa boa de séries efetivas por semana, pelo foco da avaliação (força responde a bem menos volume)
const FAIXAS = {
  hipertrofia: { normal: [10, 20], prior: [12, 22], pequeno: [6, 16] },
  ambos: { normal: [8, 18], prior: [10, 20], pequeno: [5, 14] },
  forca: { normal: [4, 12], prior: [6, 14], pequeno: [3, 10] },
};
const PEQUENOS = new Set(["abdomen", "antebraco", "panturrilha"]);
export function faixaVolume(g) {
  const av = S.personal.avaliacao, f = FAIXAS[av?.foco] || FAIXAS.hipertrofia;
  if (PEQUENOS.has(g)) return f.pequeno;
  return (av?.prioridades || []).includes(g) ? f.prior : f.normal;
}
export const descreverFaixas = () => {
  const f = FAIXAS[S.personal.avaliacao?.foco] || FAIXAS.hipertrofia;
  return `${f.normal[0]} a ${f.normal[1]}; ${f.prior[0]} a ${f.prior[1]} nos prioritários`;
};

// ---------- recuperação ----------
// Cansaço de uma série: maior perto da falha (a falha pesa mais) e com carga muito alta
function cansacoSerie(s) {
  const rir = rirDe(s), reps = Number(s.reps);
  if (!(reps > 0)) return 0;
  const perto = rir <= 0 ? 1.3 : rir <= 1 ? 1 : rir <= 2 ? 0.9 : rir <= 3 ? 0.75 : rir <= 4 ? 0.6 : 0.4;
  return perto * (reps <= 5 ? 1.15 : 1);
}
// Meia-vida do cansaço, em horas: músculos grandes demoram mais
const MEIA_VIDA = { quadriceps: 36, posterior: 36, gluteos: 36, costas: 36, peito: 30, ombros: 30 };
const meiaVida = (g) => MEIA_VIDA[g] || 24;
const CAPACIDADE = 8; // cansaço que deixa o músculo em 0%
const horaDaSessao = (s) => s.fim || paraData(s.d).getTime() + 18 * 36e5;

// % de recuperação por músculo agora (100 = descansado). Só olha os últimos 10 dias.
export function recuperacao(agora = Date.now()) {
  const cansaco = {}, ini = somaDias(hoje(), -10);
  for (const s of T().sessoes) {
    if (s.d <= ini) continue;
    const horas = (agora - horaDaSessao(s)) / 36e5;
    if (horas < 0) continue;
    for (const x of s.ex) {
      const ms = musculosDo(x.ex), c = x.series.reduce((t, y) => t + cansacoSerie(y), 0);
      for (const [g, p] of ms) cansaco[g] = (cansaco[g] || 0) + c * p * 0.5 ** (horas / meiaVida(g));
    }
  }
  const out = {};
  for (const g in cansaco) out[g] = Math.round(100 * Math.max(0, 1 - cansaco[g] / CAPACIDADE));
  return out;
}

// ---------- força ----------
// Melhor 1RM estimado de cada exercício (músculo principal) nas 2 últimas semanas contra as 2 anteriores
export function forcaPorMusculo(ate = hoje()) {
  const meio = somaDias(ate, -14), ini = somaDias(ate, -28), rec = new Map(), ant = new Map();
  for (const s of sessoesEntre(ini, ate)) {
    for (const x of s.ex) {
      const m = melhorDa(x.series);
      if (!m) continue;
      const alvo = s.d > meio ? rec : ant;
      alvo.set(x.ex, Math.max(alvo.get(x.ex) || 0, m));
    }
  }
  const porGrupo = {};
  for (const [ex, m] of rec) {
    if (!ant.has(ex)) continue;
    const g = exercicio(ex).g;
    if (g) (porGrupo[g] ||= []).push({ ex, antes: r1(ant.get(ex)), agora: r1(m), pct: (m / ant.get(ex) - 1) * 100 });
  }
  const out = {};
  for (const [g, xs] of Object.entries(porGrupo)) {
    const pct = r1(xs.reduce((a, b) => a + b.pct, 0) / xs.length);
    // o exemplo mostrado é o exercício que mais mudou
    const ex = [...xs].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
    out[g] = { pct, exercicios: xs.length, exemplo: ex, tendencia: pct > 1 ? "subindo" : pct < -3 ? "caindo" : "estavel" };
  }
  return out;
}

// ---------- semana leve pelos sinais ----------
// Quatro sinais de que o corpo pede uma semana mais leve; com 3 ou mais, o personal propõe.
// Recuperação baixa nos músculos treinados, força caindo (ou a mesma carga pesando mais), sono ruim e dor nova.
function rirSubindo(ate) {
  // mesma carga, menos repetições sobrando: o mesmo esforço ficou mais pesado
  const meio = somaDias(ate, -14), ini = somaDias(ate, -28), rec = new Map(), ant = new Map();
  for (const s of sessoesEntre(ini, ate)) {
    for (const x of s.ex) {
      for (const y of x.series) {
        if (y.rir == null || y.rir === "" || !(y.kg > 0)) continue;
        const k = `${x.ex}@${y.kg}`, alvo = s.d > meio ? rec : ant;
        (alvo.get(k) || alvo.set(k, []).get(k)).push(Number(y.rir));
      }
    }
  }
  const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return [...rec.keys()].filter((k) => ant.has(k) && media(ant.get(k)) - media(rec.get(k)) >= 1).length;
}
export function sinaisSemanaLeve(ate = hoje()) {
  const feito = volumeFeito(ate), rec = recuperacao();
  const treinados = Object.keys(feito).filter((g) => feito[g] >= 2);
  const mediaRec = treinados.length ? treinados.reduce((s, g) => s + (rec[g] ?? 100), 0) / treinados.length : 100;
  const fp = forcaPorMusculo(ate), caindo = Object.values(fp).filter((x) => x.tendencia === "caindo").length, pesando = rirSubindo(ate);
  const sonos = [];
  for (let n = 0; n < 7; n++) { const v = S.dias[somaDias(ate, -n)]?.sono; if (v > 0) sonos.push(v); }
  const sonoMedio = sonos.length >= 3 ? sonos.reduce((a, b) => a + b, 0) / sonos.length : null;
  const ck = S.nutri?.checkins?.slice(-1)[0];
  const sonoRuim = (sonoMedio != null && sonoMedio < 6.5) || (ck && ck.sono <= 2 && somaDias(ck.d, 10) >= ate);
  const doresNovas = Object.entries(S.corpo?.dores || {}).filter(([id, d]) => d.hist[0]?.[0] >= somaDias(ate, -14) && nivelDor(id) > 0).length;
  const sinais = [
    { id: "recuperacao", nome: "Recuperação", ativo: treinados.length >= 2 && mediaRec < 60, detalhe: `${Math.round(mediaRec)}% em média nos músculos treinados` },
    { id: "forca", nome: "Força", ativo: caindo >= 2 || pesando >= 2, detalhe: caindo ? `caindo em ${caindo} ${caindo === 1 ? "músculo" : "músculos"}` : pesando ? `mesma carga mais pesada em ${pesando}` : "estável ou subindo" },
    { id: "sono", nome: "Sono", ativo: !!sonoRuim, detalhe: sonoMedio != null ? `${(Math.round(sonoMedio * 10) / 10).toLocaleString("pt-BR")} h por noite` : "sem registro" },
    { id: "dor", nome: "Dor", ativo: doresNovas > 0, detalhe: doresNovas ? "dor nova nas últimas 2 semanas" : "nenhuma dor nova" },
  ];
  const ativos = sinais.filter((x) => x.ativo).length;
  const ultima = S.personal.semanaLeve?.fim, treinos = sessoesEntre(somaDias(ate, -21), ate).length;
  const propor = ativos >= 3 && !emRecuperacao(ate) && treinos >= 3 && !(ultima && ultima > somaDias(ate, -21));
  return { sinais, ativos, propor };
}

// ---------- volume que aprende com o corpo ----------
// Cada músculo junta o estímulo, a recuperação e o resultado (força e a medida da fita). Só sugere; quem aplica é a pessoa.
const MEDIDA_DO_GRUPO = {
  biceps: "braco", triceps: "braco", quadriceps: "coxa", posterior: "coxa", panturrilha: "panturrilha",
  peito: "peito", ombros: "ombros", antebraco: "antebraco", gluteos: "quadril",
};
function medidaSubiu(id, ate) {
  const agora = medidasAte(ate)[id], antes = medidasAte(somaDias(ate, -42))[id];
  if (!agora || !antes || agora.d === antes.d) return null;
  return agora.v - antes.v >= 0.5;
}
export function sugestoesVolume(ate = hoje()) {
  if (sessoesEntre(somaDias(ate, -42), ate).length < 6) return []; // pouco histórico para concluir
  const planejado = volumePlanejado(), rec = recuperacao(), forca = forcaPorMusculo(ate), out = [];
  const semanas = [0, 1, 2, 3, 4, 5].map((n) => volumeFeito(somaDias(ate, -7 * n)));
  for (const g of Object.keys(GRUPOS)) {
    if (!planejado[g]) continue;
    const [min, max] = faixaVolume(g), agora = semanas[0][g] || 0, naFaixa = semanas.filter((v) => (v[g] || 0) >= min).length;
    const f = forca[g], r = rec[g] ?? 100, cresceu = MEDIDA_DO_GRUPO[g] ? medidaSubiu(MEDIDA_DO_GRUPO[g], ate) : null;
    if (f?.tendencia === "caindo" && r < 50) {
      out.push({ g, delta: -2, motivo: `Força caindo (${f.pct.toLocaleString("pt-BR")}%) e recuperação em ${r}%.` });
    } else if (agora < min && planejado[g] < min) {
      out.push({ g, delta: 2, motivo: `Abaixo da faixa: ${agora.toLocaleString("pt-BR")} de ${min} séries efetivas na semana.` });
    } else if (naFaixa >= 4 && f?.tendencia !== "subindo" && cresceu === false && r >= 70 && planejado[g] < max) {
      out.push({ g, delta: 2, motivo: `Na faixa há ${naFaixa} semanas, sem ficar mais forte e com a medida parada.` });
    }
  }
  return out;
}
// Aplica no plano: +2 é uma série a mais em até 2 exercícios do músculo; −2, uma a menos (mínimo 1)
export function aplicarSugestaoVolume(g, delta) {
  const exs = T().plano.flatMap((d) => d.ex).filter((x) => exercicio(x.ex).g === g);
  if (!exs.length) return 0;
  const ordem = [...exs].sort((a, b) => (delta > 0 ? a.series - b.series : b.series - a.series));
  let feito = 0;
  for (const x of ordem) {
    if (feito >= Math.abs(delta)) break;
    if (delta > 0 && x.series < 6) { x.series++; feito++; } else if (delta < 0 && x.series > 1) { x.series--; feito++; }
  }
  if (feito < Math.abs(delta) && ordem[0]) {
    const x = ordem[0], falta = Math.abs(delta) - feito;
    x.series = delta > 0 ? Math.min(6, x.series + falta) : Math.max(1, x.series - falta);
  }
  salvar();
  return feito;
}
