// Treino no corpo: o avatar pintado por músculo em três modos (estímulo da semana, recuperação agora e força
// nas últimas 4 semanas), a lista por músculo e as sugestões de volume que aprendem com o corpo.

import { S, hoje, somaDias, salvar } from "./store.js";
import { esc, ui, TELAS, ACOES, render, avisar } from "./base.js";
import { T, GRUPOS, nomeEx } from "./treino.js";
import { volumeFeito, faixaVolume, descreverFaixas, recuperacao, forcaPorMusculo, musculosDo, sugestoesVolume, aplicarSugestaoVolume } from "./musculos.js";
import { svgCorpo } from "./avatar.js";
import { comCorpo, desenhar, CARREGANDO } from "./tela-perfil.js";

// Músculo do desenho → grupo do treino (pescoço e tibial ficam neutros)
export const GRUPO_DE = {
  chest: "peito", "upper-back": "costas", "lower-back": "costas", trapezius: "costas", deltoids: "ombros",
  biceps: "biceps", triceps: "triceps", forearm: "antebraco", abs: "abdomen", obliques: "abdomen",
  quadriceps: "quadriceps", adductors: "gluteos", gluteal: "gluteos", hamstring: "posterior", calves: "panturrilha",
};
const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString("pt-BR");

const MODOS = {
  estimulo: {
    nome: "Estímulo", cores: ["#D8C8B0", "#F7CF6B", "#E07A2C", "#8E3B12"],
    legenda: ["Sem treino", "Abaixo da faixa", "Na faixa", "Acima da faixa"],
    nota: () => `Séries efetivas nos últimos 7 dias. Série perto da falha vale 1, longe dela vale menos, e sem RIR anotado conta como 2. Exercício composto conta meia série nos músculos que ajudam. Faixa: ${descreverFaixas()}.`,
  },
  recuperacao: {
    nome: "Recuperação", cores: ["#D8C8B0", "#D9622B", "#F5B82E", "#3A78B8"],
    legenda: [null, "Cansado (menos de 50%)", "Recuperando", "Pronto (85% ou mais)"],
    nota: () => "Quanto cada músculo já se recuperou agora. Série até a falha e carga muito alta cansam mais, e músculo grande demora mais para voltar.",
  },
  forca: {
    nome: "Força", cores: ["#E4D6C2", "#3A78B8", "#8F8279", "#D9622B"],
    legenda: ["Sem dados", "Subindo", "Estável", "Caindo"],
    nota: () => "1RM estimado dos exercícios principais de cada músculo, contando as repetições que sobraram: últimas 2 semanas contra as 2 anteriores.",
  },
};

// De onde veio o estímulo de cada músculo na semana: exercícios, e (½) quando o músculo só ajudou
function origens() {
  const ini = somaDias(hoje(), -7), out = {};
  for (const s of T().sessoes) {
    if (s.d <= ini) continue;
    for (const x of s.ex) for (const [g, p] of musculosDo(x.ex)) {
      const nome = nomeEx(x.ex) + (p < 1 ? " (½)" : ""), lista = (out[g] ||= []);
      if (!lista.includes(nome)) lista.push(nome);
    }
  }
  return out;
}

function telaCorpoTreino() {
  limparDispensadas();
  const modo = MODOS[ui.modoCorpo] ? ui.modoCorpo : "estimulo", M = MODOS[modo];
  const est = volumeFeito(), rec = recuperacao(), forca = forcaPorMusculo(), orig = origens();
  const grupos = Object.keys(GRUPOS);
  const cat = {
    estimulo: (g) => { const v = est[g] || 0, [a, b] = faixaVolume(g); return v <= 0 ? 0 : v < a ? 1 : v <= b ? 2 : 3; },
    recuperacao: (g) => { const r = rec[g] ?? 100; return r < 50 ? 1 : r < 85 ? 2 : 3; },
    forca: (g) => { const f = forca[g]; return !f ? 0 : f.tendencia === "subindo" ? 1 : f.tendencia === "caindo" ? 3 : 2; },
  }[modo];
  const cores = Object.fromEntries(M.cores.map((c, i) => [`c${i}`, c]));
  const camada = (s) => (GRUPO_DE[s] ? `c${cat(GRUPO_DE[s])}` : "c0");
  const vistas = comCorpo()
    ? ["front", "back"].map((v) => `<div class="vista-treino">${svgCorpo(desenhar(v, hoje(), {}, { camada }), { cores, rotulo: `Músculos ${v === "front" ? "de frente" : "de costas"} pintados por ${M.nome.toLowerCase()}` })}<small>${v === "front" ? "Frente" : "Costas"}</small></div>`).join("")
    : CARREGANDO;

  let linhas;
  const ponto = (i) => `<i class="ponto-cor" style="background:${M.cores[i]}"></i>`;
  if (modo === "estimulo") {
    linhas = grupos.filter((g) => est[g] || orig[g]).sort((a, b) => (est[b] || 0) - (est[a] || 0)).map((g) => {
      const v = est[g] || 0, [a, b] = faixaVolume(g), topo = b * 1.25, i = cat(g);
      return { g, valor: `${n1(v)} ${v === 1 ? "série" : "séries"}`, origem: (orig[g] || []).join(", "), ponto: ponto(i),
        barra: `<span class="trilho"><i style="width:${Math.min(100, (v / topo) * 100).toFixed(1)}%;background:${M.cores[i]}"></i><b style="left:${((a / topo) * 100).toFixed(1)}%"></b><b style="left:${((b / topo) * 100).toFixed(1)}%"></b></span>` };
    });
  } else if (modo === "recuperacao") {
    linhas = grupos.filter((g) => rec[g] != null).sort((a, b) => rec[a] - rec[b]).map((g) => {
      const r = rec[g], i = cat(g);
      return { g, valor: `${r}%`, origem: (orig[g] || []).join(", "), ponto: ponto(i),
        barra: `<span class="trilho"><i style="width:${r}%;background:${M.cores[i]}"></i></span>` };
    });
  } else {
    linhas = grupos.filter((g) => forca[g]).sort((a, b) => forca[b].pct - forca[a].pct).map((g) => {
      const f = forca[g], i = cat(g), larg = Math.min(50, Math.abs(f.pct) * 8), esq = f.pct >= 0 ? 50 : 50 - larg;
      const ex = f.exemplo;
      return { g, valor: `${f.pct > 0 ? "+" : f.pct < 0 ? "−" : ""}${n1(Math.abs(f.pct))}%`, ponto: ponto(i),
        origem: ex ? `${nomeEx(ex.ex)}: 1RM estimado ${n1(ex.antes)} → ${n1(ex.agora)} kg` : "",
        barra: `<span class="trilho"><i style="left:${esq}%;width:${larg}%;background:${M.cores[i]}"></i><b style="left:50%"></b></span>` };
    });
  }

  const dispensadas = S.personal.sugestoesDispensadas || {};
  const sugs = modo === "estimulo" ? sugestoesVolume().filter((x) => !dispensadas[`${x.g}:${x.delta}`]) : [];
  return `
    <div class="segmentos" role="tablist">${Object.entries(MODOS).map(([id, x]) =>
      `<button role="tab" data-acao="modo-corpo" data-m="${id}" aria-selected="${id === modo}">${x.nome}</button>`).join("")}</div>
    <div class="palco-treino">${vistas}</div>
    <div class="legenda-cores">${M.legenda.map((nome, i) => (nome ? `<span>${ponto(i)}${nome}</span>` : "")).join("")}</div>
    <p class="dica">${esc(M.nota())}</p>
    ${sugs.length ? `<section class="sugestoes-volume">
      <h2>O personal sugere</h2>
      ${sugs.map((x) => `<div class="sugestao-volume">
        <span class="sinal ${x.delta > 0 ? "mais" : "menos"}">${x.delta > 0 ? "+" : "−"}${Math.abs(x.delta)}</span>
        <span class="texto-sug"><b>${esc(GRUPOS[x.g])}: ${x.delta > 0 ? "+" : "−"}${Math.abs(x.delta)} séries</b><small>${esc(x.motivo)}</small></span>
        <span class="acoes-sug"><button class="botao" data-acao="aplicar-volume" data-g="${x.g}" data-n="${x.delta}">Aplicar</button>
          <button class="link fraco" data-acao="dispensar-volume" data-g="${x.g}" data-n="${x.delta}">Agora não</button></span>
      </div>`).join("")}
    </section>` : ""}
    <section class="secao">
      ${linhas.length ? `<ul class="musculos-lista">${linhas.map((l) => `<li>
        <div class="cab-musculo"><span>${l.ponto}<b>${esc(GRUPOS[l.g])}</b></span><b>${l.valor}</b></div>
        ${l.barra}${l.origem ? `<small>${esc(l.origem)}</small>` : ""}</li>`).join("")}</ul>`
      : `<p class="vazio">${modo === "forca" ? "A força aparece quando o mesmo exercício se repete em 4 semanas." : "Os músculos aparecem aqui depois dos primeiros treinos."}</p>`}
    </section>`;
}

TELAS.corpotreino = { titulo: "Treino no corpo", aba: "treino", html: telaCorpoTreino };

Object.assign(ACOES, {
  "modo-corpo"(b) { ui.modoCorpo = b.dataset.m; render(); },
  "aplicar-volume"(b) {
    const g = b.dataset.g, n = Number(b.dataset.n);
    aplicarSugestaoVolume(g, n);
    S.personal.sugestoesDispensadas = { ...(S.personal.sugestoesDispensadas || {}), [`${g}:${n}`]: hoje() };
    salvar(); render();
    avisar(`${GRUPOS[g]}: ${n > 0 ? "+" : "−"}${Math.abs(n)} séries no plano`);
  },
  "dispensar-volume"(b) {
    S.personal.sugestoesDispensadas = { ...(S.personal.sugestoesDispensadas || {}), [`${b.dataset.g}:${b.dataset.n}`]: hoje() };
    salvar(); render();
  },
});

// as sugestões dispensadas ou aplicadas voltam a valer depois de 3 semanas
function limparDispensadas() {
  const d = S.personal.sugestoesDispensadas;
  if (!d) return;
  for (const [k, quando] of Object.entries(d)) if (somaDias(quando, 21) < hoje()) delete d[k];
}
