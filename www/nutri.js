// Motor do nutri: aprende o que você come em cada refeição, sugere o que comer no resto do dia (com porções que
// fecham a meta sem passar), calcula o gasto real pela evolução do peso e decide o ajuste da meta no check-in.
// Aqui só tem conta; a IA, quando ligada, apenas explica o resultado.

import { S, REFEICOES, hoje, somaDias, diaDe, totais, pesos, refPelaHora, salvar } from "./store.js";
import { alimento, semAcento } from "./tabela.js";
import { CARDAPIO, MOLDES } from "./cardapio.js";
import { calcMetas } from "./metas.js";

const KCAL_POR_KG = 7700;
const ORDEM = REFEICOES.map((r) => r.id);
// Divisão do dia quando ainda não há histórico
const PARTE_PADRAO = { cafe: 0.22, almoco: 0.33, pos_treino: 0.13, janta: 0.25, ceia: 0.07 };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const r10 = (x) => Math.round(x / 10) * 10;
// Fontes extras de opções: o plano alimentar (modo fechado) se pendura aqui, sem import circular
export const FONTES = { plano: null, diaDeTreino: null };
export const pisoKcal = () => (S.user?.sexo === "f" ? 1200 : 1500);

// ---------- metas (com o ajuste acumulado dos check-ins) ----------
function recalcularCarbo(m) {
  m.fat = Math.round((m.kcal * 0.25) / 9 / 5) * 5;
  m.carbs = Math.max(0, Math.round((m.kcal - m.protein * 4 - m.fat * 9) / 4 / 5) * 5);
}
export function aplicarMetas() {
  const m = calcMetas(S.user);
  if (!m) { S.metas = null; return null; }
  const aj = S.nutri.ajuste || 0;
  if (aj) {
    m.kcal = Math.max(pisoKcal(), r10(m.kcal + aj));
    m.ajusteNutri = aj;
    recalcularCarbo(m);
  }
  // ajuste temporário da equipe (ex.: semana de recuperação do treino), que vence sozinho
  const tp = S.nutri.temporario;
  if (tp && !tp.manual && hoje() <= tp.ate) {
    m.kcal = Math.max(pisoKcal(), r10(m.kcal + tp.delta));
    m.temporario = tp;
    recalcularCarbo(m);
  }
  // doença renal informada na consulta: proteína alta pode não ser indicada; fica na recomendação geral até o médico liberar
  if (S.perfil?.alertas?.includes("renal")) {
    m.protein = Math.round((Number(S.user.peso) * 0.8) / 5) * 5;
    m.proteinaCuidado = true;
    recalcularCarbo(m);
  }
  S.metas = m;
  return m;
}
export function mudarMetaKcal(delta) {
  if (!delta || !S.metas) return;
  if (S.metasManuais) {
    S.metas.kcal = Math.max(pisoKcal(), r10(S.metas.kcal + delta));
    recalcularCarbo(S.metas);
  } else {
    S.nutri.ajuste = (S.nutri.ajuste || 0) + delta;
    aplicarMetas();
  }
  salvar();
}

// ---------- itens ----------
export const chaveItem = (i) => (i.t ? "t" + i.t : "n:" + semAcento(i.nome).replace(/[^a-z0-9]+/g, " ").trim());
// [kcal, proteína, carbo, gordura] por 100 g, quando dá para saber
export function base100(i) {
  if (i.t) { const a = alimento(i.t); if (a) return [a[2], a[3], a[4], a[5]]; }
  if (Array.isArray(i.b) && i.b[0] != null) return i.b.map((v) => v ?? 0);
  if (i.g > 0) return [i.kcal, i.protein, i.carbs, i.fat].map((v) => ((Number(v) || 0) * 100) / i.g);
  return null;
}
const doCardapio = (t) => CARDAPIO.find((c) => c.t === t) || null;
function grupoPelaBase(b) {
  if (!b || !b[0]) return "carbo";
  if (b[0] < 40) return "vegetal";
  if ((b[1] * 4) / b[0] >= 0.35) return "proteina";
  if ((b[3] * 9) / b[0] >= 0.6) return "gordura";
  return "carbo";
}

// ---------- perfil: como você come em cada refeição ----------
// Olha os dias anteriores (não o de hoje), ignorando dias com menos de 600 kcal (registro incompleto).
export function perfil(ate = hoje(), janela = 28) {
  const refs = Object.fromEntries(ORDEM.map((r) => [r, { dias: 0, kcal: 0, partes: [], alimentos: new Map(), combos: new Map() }]));
  const usoTaco = new Map();
  let dias = 0;
  for (let n = 1; n <= janela; n++) {
    const d = somaDias(ate, -n), itens = S.dias[d]?.itens || [];
    const total = itens.reduce((s, i) => s + i.kcal, 0);
    if (total < 600) continue;
    dias++;
    for (const i of itens) if (i.t) usoTaco.set(i.t, (usoTaco.get(i.t) || 0) + 1);
    for (const r of ORDEM) {
      const P = refs[r], lista = itens.filter((i) => i.ref === r);
      if (!lista.length) { P.partes.push(0); continue; }
      const kc = lista.reduce((s, i) => s + i.kcal, 0);
      P.dias++; P.kcal += kc; P.partes.push(kc / total);
      const chaves = new Set();
      for (const i of lista) {
        const k = chaveItem(i);
        chaves.add(k);
        const a = P.alimentos.get(k) || { chave: k, vezes: 0, gs: [], recente: "" };
        a.vezes++;
        if (i.g > 0) a.gs.push(i.g);
        if (d >= a.recente) { a.recente = d; a.item = i; a.base = base100(i) || a.base; }
        P.alimentos.set(k, a);
      }
      const lista2 = [...chaves].sort(), ck = lista2.join("|");
      const c = P.combos.get(ck) || { chaves: lista2, vezes: 0, recente: "" };
      c.vezes++; if (d > c.recente) c.recente = d;
      P.combos.set(ck, c);
    }
  }
  for (const r of ORDEM) {
    const P = refs[r];
    P.kcalMedia = P.dias ? P.kcal / P.dias : 0;
    P.parte = P.partes.length ? P.partes.reduce((s, x) => s + x, 0) / P.partes.length : null;
    P.frequencia = dias ? P.dias / dias : 0;
  }
  return { refs, dias, usoTaco };
}

// Refeições do dia ainda sem nada registrado, da atual em diante (hoje) ou todas (outro dia).
// Com 7+ dias de histórico, pula as refeições que você quase nunca faz, salvo a da hora atual.
export function refeicoesQueFaltam(d = hoje(), P = perfil(d), agora = new Date()) {
  const itens = diaDe(d).itens;
  let vazias = ORDEM.filter((r) => !itens.some((i) => i.ref === r));
  let atual = null;
  if (d === hoje()) {
    atual = refPelaHora(agora);
    const k = ORDEM.indexOf(atual);
    vazias = vazias.filter((r) => ORDEM.indexOf(r) >= k);
  }
  if (P.dias >= 7) vazias = vazias.filter((r) => r === atual || P.refs[r].frequencia >= 0.3);
  return vazias;
}

function dividir(refs, kcal, prot, P, d = hoje()) {
  // dia de treino: mais espaço para o pós-treino (mais ainda no de perna)
  const treino = [1, 1.4, 1.7][FONTES.diaDeTreino?.(d) || 0];
  const peso = (r) => ((P.dias >= 7 && P.refs[r].parte > 0.02 ? P.refs[r].parte : PARTE_PADRAO[r]) || 0.1) * (r === "pos_treino" ? treino : 1);
  const soma = refs.reduce((s, r) => s + peso(r), 0) || 1;
  // proteína um pouco mais espalhada que as calorias: o corpo aproveita melhor em várias refeições
  return refs.map((r) => ({ ref: r, kcal: (kcal * peso(r)) / soma, prot: prot * (0.7 * (peso(r) / soma) + 0.3 / refs.length) }));
}

// ---------- montar uma refeição ----------
// itens: [{ nome, t, base, g (porção típica), unidade, grupo, novo, fixo }]; fixo = item sem base (porção pronta)
const passo = (x) => (x.unidade ? x.unidade.g : x.gf > 50 ? 10 : 5);
function arredondar(x) {
  if (x.unidade) return Math.max(1, Math.round(x.gf / x.unidade.g)) * x.unidade.g;
  const p = x.gf > 50 ? 10 : 5;
  return Math.max(p, Math.round(x.gf / p) * p);
}
const kcalDe = (x) => (x.base ? (x.base[0] * x.gf) / 100 : x.fixo.kcal);
const protDe = (x) => (x.base ? (x.base[1] * x.gf) / 100 : x.fixo.protein);

export function montar(itens, alvoKcal, alvoProt) {
  const out = itens.map((x) => {
    const y = { ...x, gf: x.base ? x.g : 0 };
    y.tipo = !x.base ? "fixo" : x.base[0] < 40 ? "livre" : (x.base[1] * 4) / x.base[0] >= 0.35 ? "prot" : "energia";
    y.min = x.base ? Math.max(x.unidade ? x.unidade.g : 10, x.g * 0.4) : 0;
    y.max = x.base ? x.g * (y.tipo === "prot" ? 2.5 : 2.2) : 0;
    if (x.unidade) y.max = Math.max(x.unidade.g, Math.min(y.max, x.unidade.g * 4)); // nada de "6 ovos"
    return y;
  });
  const fixos = out.filter((x) => x.tipo === "fixo" || x.tipo === "livre");
  const prots = out.filter((x) => x.tipo === "prot"), energ = out.filter((x) => x.tipo === "energia");
  const resto = alvoKcal - fixos.reduce((s, x) => s + kcalDe(x), 0);
  const protFalta = alvoProt - fixos.reduce((s, x) => s + protDe(x), 0) - energ.reduce((s, x) => s + protDe(x), 0);

  if (prots.length) {
    const somaP = prots.reduce((s, x) => s + x.base[1], 0) || 1;
    for (const x of prots) x.gf = clamp(((Math.max(0, protFalta) * (x.base[1] / somaP)) / x.base[1]) * 100, x.min, x.max);
    // a proteína não pode engolir a refeição: no máximo 70% das calorias quando há outros itens
    const lim = energ.length ? resto * 0.7 : resto, kp = prots.reduce((s, x) => s + kcalDe(x), 0);
    if (kp > lim && kp > 0) for (const x of prots) x.gf = Math.max(x.min, (x.gf * lim) / kp);
  }
  if (energ.length) {
    const sobra = resto - prots.reduce((s, x) => s + kcalDe(x), 0);
    const tipico = energ.reduce((s, x) => s + (x.base[0] * x.g) / 100, 0) || 1;
    for (const x of energ) x.gf = clamp((x.g * sobra) / tipico, x.min, x.max);
  }
  for (const x of out) if (x.base) x.gf = arredondar(x);

  // não passar do alvo: tira um passo de cada vez, primeiro dos itens de energia, depois da proteína
  const total = () => out.reduce((s, x) => s + kcalDe(x), 0);
  for (let guarda = 0; total() > alvoKcal && guarda < 80; guarda++) {
    const corta = (lista) => lista.filter((x) => x.gf - passo(x) >= x.min - 1e-6).sort((a, b) => kcalDe(b) - kcalDe(a))[0];
    const x = corta(energ) || corta(prots) || corta(fixos.filter((y) => y.base));
    if (!x) break;
    x.gf -= passo(x);
  }
  const res = out.map((x) => {
    const k = x.base ? x.gf / 100 : 1;
    const v = x.base ? x.base : [x.fixo.kcal, x.fixo.protein, x.fixo.carbs, x.fixo.fat];
    const n = x.unidade ? Math.round(x.gf / x.unidade.g) : 0;
    return {
      nome: x.nome, t: x.t || undefined, g: x.base ? x.gf : x.fixo.g || undefined,
      qtd: x.unidade ? `${n} ${n === 1 ? x.unidade.nome : x.unidade.plural}` : x.base ? "" : x.fixo.qtd || "",
      b: x.base ? x.base.map((y) => Math.round(y * 100) / 100) : undefined,
      kcal: Math.round(v[0] * k), protein: Math.round(v[1] * k * 10) / 10,
      carbs: Math.round(v[2] * k * 10) / 10, fat: Math.round(v[3] * k * 10) / 10,
      novo: !!x.novo, grupo: x.grupo,
    };
  });
  const soma = (k) => res.reduce((s, x) => s + x[k], 0);
  return { itens: res, kcal: Math.round(soma("kcal")), protein: Math.round(soma("protein")), carbs: Math.round(soma("carbs")), fat: Math.round(soma("fat")) };
}

// ---------- candidatos ----------
// O que a pessoa não come: palavras da consulta (com sinônimos de categoria) e restrições marcadas
const CATEGORIAS = {
  peixe: /merluza|sardinha|salmao|atum|pescada|tilapia|bacalhau|lambari|peixe/,
  "frutos do mar": /camarao|caranguejo|lula|polvo|marisco|mexilhao|ostra/,
  "carne vermelha": /carne, bovina|porco|lombo|presunto|linguica|bacon/,
  carne: /carne|frango|porco|lombo|presunto|peru|linguica/,
  porco: /porco|lombo|presunto|bacon|linguica|toucinho/,
  lactose: /leite|queijo|iogurte|requeijao|ricota|mozarela|manteiga|creme de leite/,
  leite: /leite|queijo|iogurte|requeijao|ricota|mozarela/,
  laticinio: /leite|queijo|iogurte|requeijao|ricota|mozarela|manteiga/,
  ovo: /ovo/, gluten: /pao|trigo|aveia|macarrao|biscoito|cuscuz, paulista/,
};
const RESTRICOES = {
  vegetariano: /carne|frango|porco|peixe|atum|sardinha|salmao|merluza|pescada|presunto|lombo|bacon|linguica/,
  sem_lactose: CATEGORIAS.lactose, sem_gluten: CATEGORIAS.gluten,
};
export function permitido(nome) {
  const n = semAcento(nome);
  const palavras = (S.perfil?.naoCome || "").split(/[,;\n]+/).map((s) => semAcento(s).trim()).filter((s) => s.length > 2);
  for (const p of palavras) {
    const sing = p.replace(/s$/, "");
    if (n.includes(p) || n.includes(sing) || CATEGORIAS[p]?.test(n) || CATEGORIAS[sing]?.test(n)) return false;
  }
  return !(S.perfil?.restricoes || []).some((r) => RESTRICOES[r]?.test(n));
}
const proibido = (nome) => !permitido(nome);

function doHistorico(a) {
  const base = a.base, t = a.item.t || null, c = t ? doCardapio(t) : null;
  if (base) {
    return {
      nome: a.item.nome, t, base, g: mediana(a.gs) || c?.g || 100,
      unidade: c?.unidade || null, grupo: c?.grupo || grupoPelaBase(base),
    };
  }
  const i = a.item;
  return { nome: i.nome, t, base: null, grupo: "fixo", fixo: { kcal: i.kcal, protein: i.protein, carbs: i.carbs, fat: i.fat, qtd: i.qtd } };
}
function doCardapioItem(c, P) {
  const a = alimento(c.t);
  return { nome: a[1], t: c.t, base: [a[2], a[3], a[4], a[5]], g: c.g, unidade: c.unidade, grupo: c.grupo, novo: !P.usoTaco.has(c.t) };
}
// Opções de um grupo para a refeição: as que você já come primeiro, depois as do cardápio na ordem
function opcoesDoGrupo(grupo, ref, P) {
  return CARDAPIO
    .filter((c) => c.grupo === grupo && c.refs.includes(ref) && alimento(c.t) && !proibido(alimento(c.t)[1]))
    .sort((x, y) => (P.usoTaco.get(y.t) || 0) - (P.usoTaco.get(x.t) || 0));
}

function nota(r, alvoK, alvoP, familiar) {
  let n = r.kcal > alvoK ? (5 * (r.kcal - alvoK)) / Math.max(alvoK, 50) : (0.6 * (alvoK - r.kcal)) / Math.max(alvoK, 50);
  if (alvoP > 1) n += (1.5 * Math.max(0, alvoP - r.protein)) / alvoP;
  return n - familiar;
}

export function candidatos(ref, alvoK, alvoP, P) {
  const lista = [];
  const R = P.refs[ref];
  // 1) o que você costuma comer nessa refeição
  const combos = [...R.combos.values()].sort((a, b) => b.vezes - a.vezes || (a.recente < b.recente ? 1 : -1)).slice(0, 5);
  const maxV = combos[0]?.vezes || 1;
  for (const c of combos) {
    const itens = c.chaves.map((k) => R.alimentos.get(k)).filter(Boolean).map(doHistorico);
    if (!itens.length || itens.some((x) => proibido(x.nome))) continue;
    lista.push({ origem: "habito", familiar: 0.25 + (0.35 * c.vezes) / maxV, itens });
  }
  // 2) montagens do cardápio (podem trazer alimentos novos)
  const moldes = MOLDES[ref] || [];
  const leve = alvoK < 250;
  const usados = leve ? [["proteina_leve"], ["proteina"], ["fruta"], ["proteina_leve", "fruta"]] : moldes;
  usados.forEach((molde, mi) => {
    for (let v = 0; v < 3; v++) {
      const vistos = new Set(), itens = [];
      for (const g0 of molde) {
        const opcional = g0.endsWith("?"), g = g0.replace("?", "");
        if (opcional && v > 0) continue;
        const ops = opcoesDoGrupo(g, ref, P).filter((c) => !vistos.has(c.t));
        if (!ops.length) continue;
        const c = ops[(v + mi) % ops.length];
        vistos.add(c.t);
        itens.push(doCardapioItem(c, P));
      }
      if (!itens.length) continue;
      const conhecidos = itens.filter((x) => !x.novo).length / itens.length;
      lista.push({ origem: "cardapio", familiar: 0.08 * conhecidos, itens });
    }
  });
  // avalia, ordena e tira repetidos
  const vistos = new Set();
  return lista
    .map((c) => { const r = montar(c.itens, alvoK, alvoP); return { ...r, origem: c.origem, nota: nota(r, alvoK, alvoP, c.familiar) }; })
    .filter((r) => r.kcal > 0)
    .sort((a, b) => a.nota - b.nota)
    .filter((r) => { const k = r.itens.map((x) => x.nome).sort().join("|"); if (vistos.has(k)) return false; vistos.add(k); return true; });
}

// ---------- o que eu como agora? ----------
// escolhas: { ref: índice da opção }; refs: lista de refeições a planejar (senão, as que faltam)
export function sugerirResto(d = hoje(), { refs, escolhas = {} } = {}) {
  const m = S.metas;
  if (!m) return null;
  const t = totais(d), P = perfil(d);
  const kcal = Math.round(m.kcal - t.kcal), prot = Math.round(m.protein - t.protein);
  const faltam = refs || refeicoesQueFaltam(d, P);
  const base = { d, kcal, prot, consumido: t, meta: m, faltam, diasHistorico: P.dias };
  if (!faltam.length) return { ...base, refeicoes: [] };
  if (kcal <= 0) {
    // meta batida: se ainda falta proteína, opções magras e pequenas
    if (prot < 15) return { ...base, refeicoes: [], estourou: true };
    const alvoP = Math.min(prot, 40), alvoK = Math.round(alvoP * 4 * 1.25), ref = faltam[0];
    const magro = (x) => x.kcal > 0 && (x.protein * 4) / x.kcal >= 0.5;
    const opcoes = candidatos(ref, alvoK, alvoP, P).filter((o) => o.itens.every(magro));
    const i = (escolhas[ref] || 0) % (opcoes.length || 1);
    return { ...base, estourou: true, refeicoes: opcoes.length ? [{ ref, kcal: alvoK, prot: alvoP, opcoes, indice: i, escolha: opcoes[i] }] : [] };
  }
  // Em sequência: o que uma refeição deixa de usar (ou usa a mais de proteína) passa para as seguintes
  const pesosK = dividir(faltam, 1, 0, P, d).map((p) => p.kcal);
  let kRest = kcal, pRest = Math.max(0, prot);
  const refeicoes = faltam.map((ref, n) => {
    const soma = pesosK.slice(n).reduce((s, x) => s + x, 0) || 1, parte = pesosK[n] / soma;
    const alvoK = kRest * parte, alvoP = pRest * (0.7 * parte + 0.3 / (faltam.length - n));
    let opcoes = candidatos(ref, alvoK, alvoP, P);
    // modo fechado: primeiro as combinações do plano que cabem no que falta (até 10% acima)
    if (S.nutri.modo === "fechado" && FONTES.plano) {
      const doPlano = FONTES.plano(ref).filter((o) => o.kcal <= alvoK * 1.1);
      if (doPlano.length) opcoes = [...doPlano, ...opcoes];
    }
    const i = (escolhas[ref] || 0) % (opcoes.length || 1), escolha = opcoes[i] || null;
    kRest -= escolha?.kcal || 0; pRest = Math.max(0, pRest - (escolha?.protein || 0));
    return { ref, kcal: alvoK, prot: alvoP, opcoes, indice: i, escolha };
  });
  const soma = (k) => refeicoes.reduce((s, r) => s + (r.escolha?.[k] || 0), 0);
  return { ...base, refeicoes, total: { kcal: soma("kcal"), protein: soma("protein") } };
}

// ---------- peso: tendência e gasto real ----------
// Média móvel exponencial diária (alfa 0,1), seguindo nos dias sem pesagem
export function tendencia(ate = hoje(), dias = 120) {
  const ps = pesos().filter((p) => p.d <= ate && p.d > somaDias(ate, -dias));
  if (!ps.length) return [];
  const out = [];
  let ema = ps[0].kg, k = 0;
  for (let d = ps[0].d; d <= ate; d = somaDias(d, 1)) {
    if (k < ps.length && ps[k].d === d) { ema += 0.1 * (ps[k].kg - ema); k++; }
    out.push({ d, kg: ema });
  }
  return out;
}
// Inclinação (kg por dia) da reta que melhor passa pelas pesagens: sem o atraso da média móvel,
// e o sobe-e-desce de água de um dia se dilui entre todas as pesagens da janela
function inclinacao(ps) {
  const t0 = new Date(ps[0].d).getTime(), xs = ps.map((p) => (new Date(p.d).getTime() - t0) / 864e5), ys = ps.map((p) => p.kg);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : 0;
}
const pesagensEntre = (ini, ate) => pesos().filter((p) => p.d >= ini && p.d <= ate);
const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

// Ritmo de peso em kg por semana nas últimas `semanas` (precisa de 3 pesagens cobrindo pelo menos 6 dias)
export function ritmoPeso(ate = hoje(), semanas = 2) {
  const ps = pesagensEntre(somaDias(ate, -7 * semanas), ate);
  if (ps.length < 3 || diasEntre(ps[0].d, ps[ps.length - 1].d) < 6) return null;
  return Math.round(inclinacao(ps) * 7 * 100) / 100;
}

// Gasto real: o que você comeu menos o que o peso mostrou que sobrou (ou faltou), numa janela de 3 semanas.
// Usa só os dias com registro razoável (1.000 kcal ou mais) para a média do que entrou.
export function gastoReal(ate = somaDias(hoje(), -1), janela = 21) {
  const ps = pesagensEntre(somaDias(ate, -janela), ate);
  // a janela vale do primeiro ao último dia com pesagem (precisa de pelo menos 14 dias)
  const ini = ps[0]?.d || somaDias(ate, -janela), dias = ps.length ? diasEntre(ps[0].d, ps[ps.length - 1].d) : 0;
  const pesagens = ps.length, comidas = [];
  for (let d = ini; d <= ate; d = somaDias(d, 1)) { const k = totais(d).kcal; if (k >= 1000) comidas.push(k); }
  if (dias < 14 || pesagens < 6 || comidas.length < 10) {
    return { ok: false, pesagens, diasComida: comidas.length, faltaPesagens: Math.max(0, 6 - pesagens), faltaDias: Math.max(0, 10 - comidas.length, 14 - dias) };
  }
  janela = dias;
  const entrada = comidas.reduce((s, x) => s + x, 0) / comidas.length, delta = inclinacao(ps) * dias;
  const tdee = r10(entrada - (delta * KCAL_POR_KG) / janela);
  const confianca = pesagens >= 12 && comidas.length >= 17 ? "alta" : pesagens >= 8 && comidas.length >= 13 ? "média" : "baixa";
  return { ok: true, tdee, entrada: Math.round(entrada), delta: Math.round(delta * 100) / 100, janela, pesagens, diasComida: comidas.length, confianca };
}

// ---------- adesão e check-in semanal ----------
// Dias dos últimos 7 (sem hoje) com registro, e quantos ficaram perto da meta (até 10% acima e proteína a 85%)
export function adesao(ate = hoje(), dias = 7) {
  const m = S.metas;
  let registrados = 0, naMeta = 0, protOk = 0, kcal = 0, prot = 0;
  for (let n = 1; n <= dias; n++) {
    const t = totais(somaDias(ate, -n));
    if (t.kcal < 600) continue;
    registrados++; kcal += t.kcal; prot += t.protein;
    if (m && t.kcal <= m.kcal * 1.1 && t.kcal >= m.kcal * 0.8) naMeta++;
    if (m && t.protein >= m.protein * 0.85) protOk++;
  }
  return {
    registrados, naMeta, protOk, dias, pct: registrados ? naMeta / registrados : 0,
    kcalMedia: registrados ? Math.round(kcal / registrados) : 0, protMedia: registrados ? Math.round(prot / registrados) : 0,
  };
}

export function checkinPendente(d = hoje()) {
  if (!S.metas || !S.user) return false;
  const ult = S.nutri.checkins[S.nutri.checkins.length - 1];
  if (ult) return somaDias(ult.d, 7) <= d;
  const primeiro = Object.keys(S.dias).filter((x) => S.dias[x].itens?.length).sort()[0];
  return !!primeiro && somaDias(primeiro, 7) <= d;
}

// respostas: { fome, energia, sono } de 1 a 5. Devolve a decisão do nutri, sem aplicar.
export function avaliarSemana(respostas = {}, ate = hoje()) {
  const u = S.user, m = S.metas, ad = adesao(ate), ritmo = ritmoPeso(ate, 2), gasto = gastoReal(somaDias(ate, -1));
  const alvoRitmo = u.objetivo === "perder" ? -Number(u.ritmo || 0.5) : u.objetivo === "ganhar" ? Number(u.ritmo || 0.25) : 0;
  const motivos = [];
  let delta = 0;
  const mal = respostas.energia <= 2 && respostas.fome >= 4;

  if (ad.registrados < 4) {
    motivos.push(`Só ${ad.registrados} dias registrados na semana: sem dados suficientes para mexer na meta. O mais importante agora é registrar todo dia.`);
  } else if (ad.pct < 0.6) {
    motivos.push(`Ficou perto da meta de calorias em ${ad.naMeta} de ${ad.registrados} dias. Antes de mudar a meta, vale acertar a rotina: a meta atual ainda não foi testada de verdade.`);
  } else if (ritmo == null) {
    motivos.push("Faltam pesagens nas últimas duas semanas para saber o ritmo. Pesa-te pelo menos 3 vezes por semana.");
  } else {
    const ajObj = (alvoRitmo * KCAL_POR_KG) / 7;
    if (gasto.ok && gasto.confianca !== "baixa") {
      // com o gasto real medido, a meta vai para gasto + ajuste do objetivo, aos poucos
      delta = clamp(r10(gasto.tdee + ajObj - m.kcal), -150, 150);
      motivos.push(`Teu gasto real nas últimas 3 semanas ficou em ${gasto.tdee} kcal por dia (confiança ${gasto.confianca}).`);
    } else if (u.objetivo === "perder") {
      if (ritmo > alvoRitmo * 0.5) delta = ritmo >= 0 ? -150 : -100;
      else if (ritmo < alvoRitmo * 1.5 || ritmo < -1) delta = 100;
    } else if (u.objetivo === "ganhar") {
      if (ritmo < alvoRitmo * 0.5) delta = 100;
      else if (ritmo > alvoRitmo * 1.5) delta = -100;
    } else if (Math.abs(ritmo) > 0.2) delta = ritmo > 0 ? -100 : 100;

    const fmt = (x) => `${x > 0 ? "+" : ""}${x.toLocaleString("pt-BR")} kg por semana`;
    motivos.unshift(`Ritmo das últimas 2 semanas: ${fmt(ritmo)} (o plano é ${fmt(alvoRitmo)}).`);
    if (mal && delta < 0) { delta = 0; motivos.push("Com fome alta e energia baixa, não vale apertar mais agora: a meta fica como está."); }
    else if (mal && u.objetivo === "perder" && delta === 0) { delta = 100; motivos.push("Fome alta e energia baixa: um respiro de 100 kcal ajuda a manter o plano."); }
  }
  if (m && ad.registrados >= 4 && ad.protOk < ad.registrados * 0.6) motivos.push(`A proteína ficou abaixo da meta em ${ad.registrados - ad.protOk} de ${ad.registrados} dias (média de ${ad.protMedia} g para uma meta de ${m.protein} g). O botão "O que eu como agora?" ajuda a fechar.`);
  // com algum alerta de saúde na consulta, mudanças menores
  if (S.perfil?.alertas?.length && Math.abs(delta) > 100) { delta = Math.sign(delta) * 100; motivos.push("Por causa do que contaste na consulta, o ajuste fica em no máximo 100 kcal por semana."); }
  const nova = m ? Math.max(pisoKcal(), r10(m.kcal + delta)) : null;
  if (m && nova === pisoKcal() && delta < 0) motivos.push(`A meta chegou ao piso de segurança de ${pisoKcal()} kcal.`);
  delta = m ? nova - m.kcal : 0;
  if (!delta && ad.registrados >= 4 && ad.pct >= 0.6 && ritmo != null && !motivos.some((x) => x.includes("fica como está"))) motivos.push("Está no caminho: a meta continua a mesma.");
  return { delta, nova, motivos, ritmo, alvoRitmo, adesao: ad, gasto, respostas };
}

export function registrarCheckin(aval, aceitar) {
  const c = {
    d: hoje(), ...aval.respostas, ritmo: aval.ritmo, adesao: Math.round(aval.adesao.pct * 100),
    kcalMedia: aval.adesao.kcalMedia, sugerido: aval.delta, aplicado: aceitar ? aval.delta : 0,
    peso: tendencia()[tendencia().length - 1]?.kg ?? null,
  };
  S.nutri.checkins.push(c);
  if (aceitar && aval.delta) mudarMetaKcal(aval.delta);
  salvar();
  return c;
}

// ---------- o dia de hoje em uma frase ----------
export function momentoDoDia(d = hoje(), agora = new Date()) {
  const m = S.metas;
  if (!m || d !== hoje()) return null;
  const t = totais(d), h = agora.getHours() + agora.getMinutes() / 60;
  const kcal = Math.round(m.kcal - t.kcal), prot = Math.round(m.protein - t.protein);
  const faltam = refeicoesQueFaltam(d);
  if (!t.kcal && h < 11) return { tipo: "manha", kcal: m.kcal, prot: m.protein, faltam };
  if (h >= 21.5 || !faltam.length) return { tipo: "fim", kcal, prot, consumido: t, faltam };
  return { tipo: "meio", kcal, prot, faltam };
}
