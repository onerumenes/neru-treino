// Plano alimentar do nutri: estrutura de cada refeição (grupos e porções) com lista de substituição.
// No modo "fechado", as sugestões do dia seguem este plano; no "flexível", o plano é só referência.

import { S, REFEICOES, hoje, salvar } from "./store.js";
import { alimento } from "./tabela.js";
import { CARDAPIO, MOLDES, GRUPOS_ALIMENTO } from "./cardapio.js";
import { perfil, montar, FONTES, permitido } from "./nutri.js";

const PARTE_PADRAO = { cafe: 0.22, almoco: 0.33, pos_treino: 0.13, janta: 0.25, ceia: 0.07 };
const ORDEM = REFEICOES.map((r) => r.id);

// Refeições que a pessoa faz: as da consulta, senão as do histórico, senão as 4 principais
export function refeicoesDoPlano() {
  if (S.perfil?.refs?.length) return ORDEM.filter((r) => S.perfil.refs.includes(r));
  const P = perfil();
  if (P.dias >= 7) { const rs = ORDEM.filter((r) => P.refs[r].frequencia >= 0.4); if (rs.length >= 2) return rs; }
  return ["cafe", "almoco", "janta", "ceia"];
}

// Porção equivalente em calorias: quanto de outro alimento do mesmo grupo dá as mesmas kcal
function equivalente(c, kcal) {
  const a = alimento(c.t);
  let g = (kcal / a[2]) * 100, qtd = "";
  if (c.unidade) {
    const n = Math.max(1, Math.round(g / c.unidade.g));
    g = n * c.unidade.g; qtd = `${n} ${n === 1 ? c.unidade.nome : c.unidade.plural}`;
  } else g = Math.max(5, Math.round(g / (g > 50 ? 10 : 5)) * (g > 50 ? 10 : 5));
  return { t: c.t, nome: a[1], g, qtd, kcal: Math.round((a[2] * g) / 100), protein: Math.round((a[3] * g) / 10) / 10 };
}

export function gerarPlano() {
  const m = S.metas;
  if (!m) return null;
  const refs = refeicoesDoPlano(), P = perfil();
  const peso = (r) => (P.dias >= 7 && P.refs[r].parte > 0.03 ? P.refs[r].parte : PARTE_PADRAO[r]);
  const soma = refs.reduce((s, r) => s + peso(r), 0);
  const refeicoes = refs.map((ref) => {
    const kcal = (m.kcal * peso(ref)) / soma, prot = m.protein * (0.7 * (peso(ref) / soma) + 0.3 / refs.length);
    // monta o prato com a primeira opção permitida de cada grupo e distribui as porções pela conta do nutri
    const molde = (MOLDES[ref] || MOLDES.almoco)[0].map((g) => g.replace("?", ""));
    const escolhidos = [];
    for (const g of molde) {
      const op = CARDAPIO.find((c) => c.grupo === g && c.refs.includes(ref) && permitido(alimento(c.t)[1]) && !escolhidos.some((e) => e.c.t === c.t));
      if (op) escolhidos.push({ g, c: op });
    }
    const montado = montar(escolhidos.map(({ c }) => {
      const a = alimento(c.t);
      return { nome: a[1], t: c.t, base: [a[2], a[3], a[4], a[5]], g: c.g, unidade: c.unidade, grupo: c.grupo };
    }), kcal, prot);
    const grupos = escolhidos.map(({ g, c }, i) => {
      const porcaoKcal = montado.itens[i].kcal;
      const opcoes = CARDAPIO.filter((x) => x.grupo === g && x.refs.includes(ref) && permitido(alimento(x.t)[1]))
        .map((x) => (x.t === c.t ? { ...montado.itens[i], t: c.t } : equivalente(x, porcaoKcal)));
      // a escolhida primeiro
      opcoes.sort((a, b) => (a.t === c.t ? -1 : b.t === c.t ? 1 : 0));
      return { grupo: g, nome: GRUPOS_ALIMENTO[g], kcal: porcaoKcal, opcoes };
    });
    return { ref, kcal: Math.round(montado.kcal), protein: Math.round(montado.protein), alvo: Math.round(kcal), grupos };
  });
  const plano = { criado: hoje(), kcal: m.kcal, protein: m.protein, refeicoes };
  S.nutri.plano = plano;
  salvar();
  return plano;
}

// O plano ficou velho se a meta mudou mais de 5% desde que foi feito
export function planoDesatualizado() {
  const p = S.nutri.plano, m = S.metas;
  return !!(p && m && Math.abs(p.kcal - m.kcal) / m.kcal > 0.05);
}

// Opções do plano para uma refeição (modo fechado): gira as substituições de cada grupo
export function opcoesDoPlano(ref) {
  const r = S.nutri.plano?.refeicoes.find((x) => x.ref === ref);
  if (!r) return [];
  const n = Math.max(...r.grupos.map((g) => g.opcoes.length));
  const out = [];
  for (let v = 0; v < Math.min(n, 6); v++) {
    const itens = r.grupos.map((g) => g.opcoes[v % g.opcoes.length]).map((o) => {
      const a = alimento(o.t);
      return { nome: a[1], t: o.t, g: o.g, qtd: o.qtd, b: [a[2], a[3], a[4], a[5]], kcal: o.kcal, protein: o.protein,
        carbs: Math.round((a[4] * o.g) / 10) / 10, fat: Math.round((a[5] * o.g) / 10) / 10, novo: false, grupo: "" };
    });
    const soma = (k) => Math.round(itens.reduce((s, x) => s + x[k], 0));
    out.push({ itens, kcal: soma("kcal"), protein: soma("protein"), carbs: soma("carbs"), fat: soma("fat"), origem: "plano", nota: v });
  }
  return out;
}

FONTES.plano = opcoesDoPlano;
