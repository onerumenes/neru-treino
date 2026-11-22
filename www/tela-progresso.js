// Telas que saem do início do treino (canvas Neru Treino): Progresso (força por exercício, recordes, séries por
// semana e por músculo), Histórico, Fim do treino (resumo, recordes, músculos, esforço) e Cardio.

import { S, salvar, hoje, somaDias, paraData } from "./store.js";
import { esc, dataCurta, ui, TELAS, ACOES, MUDANCAS, render, avisar } from "./base.js";
import { T, GRUPOS, fmtKg, totalSeries, volume, removerSessao } from "./treino.js";
import { recordes, estagnados, recordesDaSessao, forcaDoExercicio, exerciciosFeitos } from "./personal.js";
import { volumeFeito, faixaVolume, musculosDo, estimuloSerie } from "./musculos.js";
import { secaoCardio } from "./tela-cardio.js";
import { linhaSessao, ICONE_ESTRELA } from "./tela-treino.js";
import { descreverCardio } from "./cardio.js";
import { svgCorpo } from "./avatar.js";
import { comCorpo, desenhar } from "./tela-perfil.js";
import { GRUPO_DE } from "./tela-treino-corpo.js";

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const n1 = (x) => (Math.round(x * 10) / 10).toLocaleString("pt-BR");
const ICONE_SOBE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
const ICONE_DESCE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`;
const ICONE_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`;
const serieTxt = (s) => (s ? `${Number(s.kg) > 0 ? `${n1(Number(s.kg))} × ` : ""}${s.reps}` : "");

// ---------- progresso ----------
const PERIODOS = { 28: "4 semanas", 91: "3 meses", 365: "1 ano" };
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Gráfico do 1RM estimado: grade de 3 linhas, área amarela, pontos e o último destacado
function graficoForca(pts, nome) {
  const W = 330, H = 150, x0 = 26, x1 = 322, y0 = 20, y1 = 120;
  const vs = pts.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), folga = Math.max(1, (max - min) * 0.15);
  const lo = min - folga, hi = max + folga;
  const X = (i) => x0 + (pts.length === 1 ? (x1 - x0) / 2 : (i * (x1 - x0)) / (pts.length - 1));
  const Y = (v) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  const linha = pts.map((p, i) => `${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" L");
  const grade = [hi, (hi + lo) / 2, lo].map((v, k) => `<line x1="0" y1="${y0 + k * 50}" x2="${W}" y2="${y0 + k * 50}"/><text x="0" y="${y0 + k * 50 - 4}">${Math.round(v)}</text>`).join("");
  // rótulos dos meses: no primeiro ponto de cada mês, sem encavalar
  let ult = -99;
  const meses = pts.map((p, i) => {
    const m = Number(p.d.slice(5, 7)) - 1;
    if (i > 0 && pts[i - 1].d.slice(5, 7) === p.d.slice(5, 7)) return "";
    if (X(i) - ult < 34) return "";
    ult = X(i);
    return `<text x="${X(i).toFixed(1)}" y="142" text-anchor="middle">${MESES[m]}</text>`;
  }).join("");
  const u = pts.length - 1;
  return `<svg class="grafico-forca" viewBox="0 0 ${W} ${H}" role="img" aria-label="1RM estimado de ${esc(nome)}: de ${n1(pts[0].v)} para ${n1(pts[u].v)} kg">
    <g class="grade">${grade}</g>
    ${pts.length > 1 ? `<path class="area" d="M${linha} L${X(u).toFixed(1)} ${y1} L${X(0).toFixed(1)} ${y1} Z"/><path class="traco" d="M${linha}"/>` : ""}
    ${pts.slice(0, -1).map((p, i) => `<circle class="ponto" cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3"/>`).join("")}
    <circle class="ultimo" cx="${X(u).toFixed(1)}" cy="${Y(pts[u].v).toFixed(1)}" r="6"/>
    <g class="meses">${meses}</g>
  </svg>`;
}

function cartaoForca(desde) {
  const lista = exerciciosFeitos(desde);
  if (!lista.length) return `<section class="caixa vazio">A força de cada exercício aparece aqui depois dos primeiros treinos.</section>`;
  const ex = lista.some((x) => x.ex === ui.progEx) ? ui.progEx : lista[0].ex, nome = lista.find((x) => x.ex === ex).nome;
  const pts = forcaDoExercicio(ex, desde), atual = pts[pts.length - 1], ini = pts[0], dif = atual.v - ini.v;
  const melhor = pts.reduce((b, p) => (p.v > b.v ? p : b), pts[0]);
  return `
    <section class="caixa forca-ex">
      <label class="escolha-ex"><span class="so-leitor">Exercício</span>
        <select data-campo="prog-ex">${lista.map((x) => `<option value="${esc(x.ex)}" ${x.ex === ex ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select></label>
      <div class="forca-num">
        <span><small>1RM estimado</small><b>${n1(atual.v)} kg</b></span>
        ${pts.length > 1 && Math.abs(dif) >= 0.5 ? `<span class="selo-dif ${dif > 0 ? "sobe" : "desce"}">${dif > 0 ? ICONE_SOBE : ICONE_DESCE}${n1(Math.abs(dif))} kg em ${PERIODOS[ui.progPeriodo || 91]}</span>` : ""}
      </div>
      ${graficoForca(pts, nome)}
      <div class="tres-numeros">
        <span><small>melhor série</small><b>${serieTxt(melhor.serie)}</b></span>
        <span><small>treinos</small><b>${pts.length}</b></span>
        <span><small>última vez</small><b>${dataCurta(atual.d)}</b></span>
      </div>
    </section>`;
}

function secaoRecordes(desde) {
  const lista = [];
  for (const s of T().sessoes) if (s.d >= somaDias(hoje(), -30)) for (const r of recordesDaSessao(s)) lista.push({ ...r, d: s.d });
  const ultimos = new Map();
  for (const r of lista) ultimos.set(r.ex, r);
  const top = [...ultimos.values()].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 3);
  if (!top.length) return "";
  return `
    <section class="secao">
      <h2>Recordes do mês</h2>
      <ul class="recordes-grade">${top.map((r) => `
        <li><span class="estrela">${ICONE_ESTRELA}</span><b>${Number(r.serie.kg) > 0 ? `${n1(Number(r.serie.kg))} kg` : `${r.serie.reps} reps`}</b><small>${esc(r.nome)}<br>${Number(r.serie.kg) > 0 ? `× ${r.serie.reps} · ` : ""}${dataCurta(r.d)}</small></li>`).join("")}</ul>
    </section>`;
}

// Séries efetivas por semana nas últimas 8 semanas, com a faixa do plano
function secaoSemanas() {
  const semanas = Array.from({ length: 8 }, (_, k) => {
    const ate = somaDias(hoje(), -7 * (7 - k)), v = volumeFeito(ate);
    // conta só o músculo principal de cada série, para não somar a mesma série duas vezes
    let n = 0;
    for (const s of T().sessoes) if (s.d > somaDias(ate, -7) && s.d <= ate) for (const x of s.ex) if (musculosDo(x.ex).length) n += x.series.reduce((t, y) => t + estimuloSerie(y), 0);
    return { ate, n: Math.round(n), tem: Object.keys(v).length > 0 };
  });
  if (!semanas.some((s) => s.n)) return "";
  const plano = T().plano.reduce((t, d) => t + d.ex.reduce((a, x) => a + x.series, 0), 0);
  const max = Math.max(plano * 1.15, ...semanas.map((s) => s.n), 1);
  return `
    <section class="caixa semanas-series">
      <div class="titulo-linha"><h2>Séries por semana</h2>${plano ? `<small>plano: ${plano}</small>` : ""}</div>
      <div class="barras-semana" role="img" aria-label="Séries nas últimas 8 semanas: ${semanas.map((s) => s.n).join(", ")}">
        ${plano ? `<span class="faixa-plano" style="bottom:${((plano * 0.9) / max * 100).toFixed(1)}%;height:${((plano * 0.2) / max * 100).toFixed(1)}%"></span>` : ""}
        ${semanas.map((s, k) => `<i class="${k === 7 ? "atual" : ""}" style="height:${Math.max(2, (s.n / max) * 100).toFixed(1)}%"></i>`).join("")}
      </div>
      <div class="rotulos-semana">${semanas.map((s, k) => `<span>${k === 7 ? "esta" : `${paraData(somaDias(s.ate, -6)).getDate()}/${paraData(somaDias(s.ate, -6)).getMonth() + 1}`}</span>`).join("")}</div>
      <p class="dica">Séries feitas a até 3 repetições da falha. A faixa verde é o que o teu plano prevê.</p>
    </section>`;
}

function secaoMusculos() {
  const v = volumeFeito(), gs = Object.keys(GRUPOS).filter((g) => v[g] >= 0.5);
  if (!gs.length) return "";
  return `
    <section class="caixa musculos-semana">
      <div class="titulo-linha"><h2>Séries por músculo</h2><button class="link" data-acao="aba" data-aba="corpotreino" data-volta="progresso">Ver no corpo</button></div>
      <ul>${gs.map((g) => {
        const [min, max] = faixaVolume(g), teto = max * 1.25, val = v[g];
        return `<li><span>${GRUPOS[g]}</span><span class="barra-faixa"><span class="faixa" style="left:${(min / teto * 100).toFixed(1)}%;width:${((max - min) / teto * 100).toFixed(1)}%"></span><i class="${val < min ? "baixo" : ""}" style="width:${Math.min(100, val / teto * 100).toFixed(1)}%"></i></span><b>${n1(val)}</b></li>`;
      }).join("")}</ul>
      <p class="dica">Últimos 7 dias. Contorno verde: a faixa de séries por semana que mais faz crescer.</p>
    </section>`;
}

function secaoExercicios(desde) {
  const lista = exerciciosFeitos(desde).slice(0, 8), parados = new Set(estagnados().map((x) => x.ex));
  if (!lista.length) return "";
  const mini = (pts) => {
    if (pts.length < 2) return "";
    const vs = pts.map((p) => p.v), lo = Math.min(...vs), amp = Math.max(...vs) - lo || 1;
    const d = pts.map((p, i) => `${(2 + (i * 66) / (pts.length - 1)).toFixed(1)} ${(22 - ((p.v - lo) / amp) * 18).toFixed(1)}`).join(" L");
    return `<svg viewBox="0 0 70 26" aria-hidden="true"><path d="M${d}"/></svg>`;
  };
  return `
    <section class="secao">
      <h2>Exercícios</h2>
      <ul class="caixa lista-exercicios">${lista.map((x) => {
        const pts = forcaDoExercicio(x.ex, desde), ult = pts[pts.length - 1], pct = pts.length > 1 ? Math.round((ult.v / pts[0].v - 1) * 100) : null;
        const tom = parados.has(x.ex) ? "parado" : pct > 0 ? "sobe" : pct < 0 ? "desce" : "";
        return `<li><button data-acao="prog-ver-ex" data-ex="${esc(x.ex)}">
          <span class="oque"><b>${esc(x.nome)}</b><small>1RM ${n1(ult.v)} kg${parados.has(x.ex) ? ` <span class="selo-parado">parado</span>` : ""}</small></span>
          <span class="spark ${tom}">${mini(pts)}</span>
          <b class="pct ${tom}">${pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct}%`}</b></button></li>`;
      }).join("")}</ul>
    </section>`;
}

function telaProgresso() {
  const dias = ui.progPeriodo || 91, desde = somaDias(hoje(), -dias);
  return `
    <div class="segmentos" role="radiogroup" aria-label="Período">
      ${Object.entries(PERIODOS).map(([k, v]) => `<button role="radio" data-acao="prog-periodo" data-v="${k}" aria-checked="${Number(k) === dias}" aria-selected="${Number(k) === dias}">${v}</button>`).join("")}
    </div>
    ${cartaoForca(desde)}
    ${secaoRecordes(desde)}
    ${secaoSemanas()}
    ${secaoMusculos()}
    ${secaoExercicios(desde)}`;
}

TELAS.progresso = {
  titulo: "Progresso", aba: "treino", html: telaProgresso,
  sub: () => { const n = T().sessoes.length, p = T().sessoes[0]; return n ? `${plural(n, "treino", "treinos")} desde ${dataCurta(p.d)}` : "Sem treinos ainda"; },
};

// ---------- histórico ----------
TELAS.historico = {
  titulo: "Todos os treinos", aba: "treino", sub: () => plural(T().sessoes.length, "treino", "treinos"),
  html: () => {
    const ss = [...T().sessoes].reverse();
    if (!ss.length) return `<p class="caixa vazio">Teus treinos concluídos aparecem aqui.</p>`;
    const meses = new Map();
    for (const s of ss) { const k = s.d.slice(0, 7); (meses.get(k) || meses.set(k, []).get(k)).push(s); }
    return [...meses.entries()].map(([k, lista]) => `
      <section class="secao">
        <h2>${MESES[Number(k.slice(5)) - 1][0].toUpperCase() + MESES[Number(k.slice(5)) - 1].slice(1)} de ${k.slice(0, 4)}</h2>
        <ul class="caixa lista-sessoes">${lista.map(linhaSessao).join("")}</ul>
      </section>`).join("");
  },
};

// ---------- fim do treino / treino passado ----------
const COSTAS = new Set(["costas", "posterior", "gluteos", "panturrilha", "triceps"]);
function musculosDaSessao(s) {
  const n = {};
  for (const x of s.ex) { const g = musculosDo(x.ex)[0]?.[0]; if (g) n[g] = (n[g] || 0) + x.series.length; }
  return Object.entries(n).sort((a, b) => b[1] - a[1]);
}
function corpoDaSessao(gs) {
  if (!comCorpo()) return `<span class="avatar-carregando"></span>`;
  const topo = gs[0][1], tipo = Object.fromEntries(gs.map(([g, k]) => [g, k >= topo * 0.6 ? "sel" : "ajuda"]));
  const atras = gs.filter(([g]) => COSTAS.has(g)).reduce((t, [, k]) => t + k, 0), frente = gs.reduce((t, [, k]) => t + k, 0) - atras;
  return svgCorpo(desenhar(atras > frente ? "back" : "front", hoje(), {}, { camada: (m) => tipo[GRUPO_DE[m]] || "musculo" }),
    { cores: { sel: "#F27A68", ajuda: "#F9D776", musculo: "#E7DFD3" }, rotulo: "Músculos do treino" });
}
const ESFORCO = { 1: "leve", 3: "ok", 5: "no limite" };

function telaResumo() {
  const r = ui.resumo, s = T().sessoes.find((x) => x.id === r?.id);
  if (!s) return `<p class="caixa vazio">Este treino não existe mais.</p>`;
  const min = s.fim && s.ini ? Math.max(1, Math.round((s.fim - s.ini) / 60000)) : 0, n = T().sessoes.indexOf(s) + 1;
  const vol = volume(s), antes = [...T().sessoes].slice(0, n - 1).reverse().find((o) => o.dia && o.dia === s.dia);
  const dif = antes && volume(antes) > 0 ? Math.round((vol / volume(antes) - 1) * 100) : null;
  const rec = recordesDaSessao(s), gs = musculosDaSessao(s), cardio = T().cardio.find((c) => c.sessao === s.id);
  return `
    <section class="heroi-fim">
      <span class="check-fim">${ICONE_CHECK}</span>
      <h2>${r.novo ? "Treino concluído" : esc(s.nome)}</h2>
      <span>${r.novo ? `${esc(s.nome)} · ` : `${dataCurta(s.d)} · `}treino nº ${n}</span>
      <div class="tres-numeros">
        <span><b>${min || "—"}</b><small>minutos</small></span>
        <span><b>${totalSeries(s)}</b><small>séries</small></span>
        <span><b>${vol >= 1000 ? `${n1(vol / 1000)} t` : `${Math.round(vol)} kg`}</b><small>volume</small></span>
      </div>
      ${dif != null && dif !== 0 ? `<span class="comparacao">${dif > 0 ? ICONE_SOBE : ICONE_DESCE}${Math.abs(dif)}% ${dif > 0 ? "mais" : "menos"} volume que na vez anterior</span>` : ""}
    </section>
    ${rec.length ? `
    <section class="secao">
      <h2>${plural(rec.length, "recorde", "recordes")}</h2>
      <ul class="caixa lista-recordes">${rec.map((x) => `
        <li><span class="estrela">${ICONE_ESTRELA}</span><span class="oque"><b>${esc(x.nome)}</b>${x.antes ? `<small>antes: ${serieTxt(x.antes)}</small>` : ""}</span><b>${serieTxt(x.serie)}</b></li>`).join("")}</ul>
    </section>` : ""}
    ${gs.length ? `
    <section class="caixa musculos-hoje">
      <div class="corpo-fim">${corpoDaSessao(gs)}</div>
      <div>
        <b>Músculos ${r.novo ? "de hoje" : "do treino"}</b>
        <ul>${gs.slice(0, 5).map(([g, k], i) => `<li><span><i class="${k >= gs[0][1] * 0.6 ? "sel" : "ajuda"}"></i>${GRUPOS[g]}</span><b>${plural(k, "série", "séries")}</b></li>`).join("")}</ul>
      </div>
    </section>` : ""}
    <section class="caixa esforco-fim">
      <b>Como foi o esforço?</b>
      <div class="escala-5" role="radiogroup" aria-label="Esforço do treino, de 1 a 5">
        ${[1, 2, 3, 4, 5].map((k) => `<button role="radio" aria-checked="${s.esforco === k}" data-acao="esforco-treino" data-n="${k}">${k}<small>${ESFORCO[k] || ""}</small></button>`).join("")}
      </div>
      <label class="campo"><span>Anotação <small>opcional</small></span><input data-campo="nota-treino" value="${esc(s.nota || "")}" maxlength="200" placeholder="joelho bem, dormi pouco..."></label>
    </section>
    ${s.ex.length ? `
    <section class="secao">
      <h2>Exercícios</h2>
      <ul class="caixa lista-feitos">${s.ex.map((x) => `<li><span>${esc(x.nome)}</span><b>${esc(x.series.map(serieTxt).join(", "))}</b></li>`).join("")}</ul>
    </section>` : ""}
    ${cardio ? `<p class="caixa texto">Cardio: ${esc(descreverCardio(cardio))}.</p>` : ""}
    ${r.novo ? `<button class="botao escuro cheio" data-acao="sair-resumo">Salvar treino</button>`
      : `<button class="botao perigo cheio" data-acao="excluir-sessao" data-id="${esc(s.id)}">Excluir treino</button>`}`;
}

TELAS.resumo = {
  titulo: () => (ui.resumo?.novo ? "Fim do treino" : "Treino"), aba: "treino", html: telaResumo,
  voltar: () => ({ acao: "sair-resumo", rotulo: "Voltar ao treino" }),
};

// ---------- cardio ----------
TELAS.cardio = { titulo: "Cardio", aba: "treino", html: () => secaoCardio() };

// ---------- ações ----------
Object.assign(ACOES, {
  "prog-periodo"(b) { ui.progPeriodo = Number(b.dataset.v); render(); },
  "prog-ver-ex"(b) { ui.progEx = b.dataset.ex; render(); window.scrollTo(0, 0); },
  "ver-sessao"(b) { ui.resumo = { id: b.dataset.id, novo: false }; ui.volta = ui.aba === "historico" ? "historico" : null; ui.aba = "resumo"; render(); window.scrollTo(0, 0); },
  "sair-resumo"() { const volta = ui.volta; ui.resumo = null; ui.aba = volta && TELAS[volta] ? volta : "treino"; ui.volta = null; ui.treino = "inicio"; render(); window.scrollTo(0, 0); },
  "esforco-treino"(b) {
    const s = T().sessoes.find((x) => x.id === ui.resumo?.id);
    if (!s) return;
    s.esforco = s.esforco === Number(b.dataset.n) ? undefined : Number(b.dataset.n);
    salvar(); render();
  },
  "excluir-sessao"(b) {
    if (!b.dataset.certeza) { b.dataset.certeza = "1"; b.textContent = "Excluir mesmo?"; return; }
    const r = removerSessao(b.dataset.id);
    ACOES["sair-resumo"]();
    if (r) avisar("Treino excluído", () => { T().sessoes.splice(r.i, 0, r.fora); salvar(); });
  },
});

// Exercício do gráfico e anotação do treino: salvam ao mudar
MUDANCAS.push((el) => {
  const c = el.dataset?.campo;
  if (c === "prog-ex") { ui.progEx = el.value; render(); return true; }
  if (c === "nota-treino") {
    const s = T().sessoes.find((x) => x.id === ui.resumo?.id);
    if (s) { s.nota = el.value.trim().slice(0, 200) || undefined; salvar(); }
    return true;
  }
  return false;
});
