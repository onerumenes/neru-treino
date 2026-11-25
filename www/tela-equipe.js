// Aba Registro (antiga Equipe): o catálogo do que foi feito, sem conselhos. Sub-abas Dieta, Físico e Treino.

import { S, hoje, somaDias, paraData, totais, pesos, MEDIDAS } from "./store.js";
import { $, esc, int, dec, lerNum, dataCurta, ui, ACOES, FORMS, FOLHAS, MUDANCAS, render, avisar, abrirFolha, fecharFolha } from "./base.js";
import { secaoSono } from "./extras.js";
import {
  POSES, DICAS_FOTO, composicao, registrarMedidas, ultimasMedidas, guardarFoto, apagarFoto, sessoesDeFotos, urlFoto,
} from "./corpo.js";

export const SUBABAS = [["dieta", "Dieta"], ["fisico", "Físico"], ["treino", "Treino"]];
// Outros módulos penduram seções aqui: { dieta: [fn], fisico: [fn], treino: [fn] }, cada fn devolve HTML
export const SECOES = { dieta: [], fisico: [], treino: [] };
// Nomes antigos das sub-abas (lembretes e botões de versões anteriores)
const ANTIGAS = { resumo: "dieta", plano: "dieta", corpo: "fisico" };

// ---------- gráfico de linha simples ----------
export function grafico(pontos, rotulo, { L = 320, A = 96 } = {}) {
  const m = 8, vs = pontos.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), faixa = max - min || 1;
  const x = (i) => (pontos.length === 1 ? L / 2 : m + (i * (L - 2 * m)) / (pontos.length - 1));
  const y = (v) => m + (1 - (v - min) / faixa) * (A - 2 * m);
  const linha = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const fim = pontos.length - 1;
  const media = pontos.some((p) => p.m != null)
    ? `<polyline class="media" points="${pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.m ?? p.v).toFixed(1)}`).join(" ")}"/>` : "";
  return `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img" aria-label="${esc(rotulo)}">
    ${pontos.length > 1 ? `<polyline points="${linha}"/>` : ""}${media}
    <circle cx="${x(fim).toFixed(1)}" cy="${y(pontos[fim].v).toFixed(1)}" r="4.5"/>
  </svg>`;
}

const sinal = (n) => (n > 0 ? "+" : n < 0 ? "−" : "");

// ---------- resumo ----------
function secaoSemana() {
  const h = hoje(), m = S.metas, dias = [];
  for (let n = 6; n >= 0; n--) { const d = somaDias(h, -n); dias.push({ d, t: totais(d) }); }
  const com = dias.filter((x) => x.t.kcal > 0);
  const escala = Math.max(m?.kcal || 0, ...dias.map((x) => x.t.kcal)) || 1;
  const media = com.length ? {
    kcal: com.reduce((s, x) => s + x.t.kcal, 0) / com.length,
    protein: com.reduce((s, x) => s + x.t.protein, 0) / com.length,
  } : null;
  return `
    <section class="secao">
      <h2>Últimos 7 dias</h2>
      <ul class="semana">
        ${dias.map(({ d, t }) => {
          const dt = paraData(d), passou = m && t.kcal > m.kcal;
          const rot = d === h ? "hoje" : dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
          return `<li>
            <button data-acao="ver-dia" data-d="${d}" aria-label="Abrir ${rot}, dia ${dt.getDate()}">
              <span class="quando">${rot} <small>${dt.getDate()}</small></span>
              <span class="barra ${passou ? "passou" : ""}"><i style="width:${((t.kcal / escala) * 100).toFixed(1)}%"></i>${m ? `<b class="marca" style="left:${((m.kcal / escala) * 100).toFixed(1)}%"></b>` : ""}</span>
              <span class="kc">${t.kcal ? int(t.kcal) : "–"}</span>
              <span class="pr">${t.kcal ? int(t.protein) + " g" : ""}</span>
            </button></li>`;
        }).join("")}
      </ul>
      ${media ? `<p class="legenda"><span>Média dos dias com registro: <b>${int(media.kcal)}</b> kcal e <b>${int(media.protein)}</b> g de proteína</span></p>` : `<p class="vazio">Nada registrado nesta semana ainda.</p>`}
    </section>`;
}

// ---------- corpo ----------
function secaoPeso() {
  const h = hoje(), ps = pesos().slice(-60);
  let bloco = `<p class="vazio">Pesa-te de manhã, em jejum, de 3 a 7 vezes por semana. O app usa a média para não se enganar com a água.</p>`;
  if (ps.length) {
    const a = ps[0], z = ps[ps.length - 1], delta = z.kg - a.kg;
    // média móvel exponencial: tira o sobe-e-desce de água e sal
    let ema = ps[0].kg;
    const pontos = ps.map((p) => { ema = ema + 0.25 * (p.kg - ema); return { v: p.kg, m: ema }; });
    bloco = `
      <p class="peso-atual"><span>${dec(z.kg)}</span><em>kg</em></p>
      ${ps.length > 1 ? `<p class="legenda"><span>${sinal(delta)}${dec(Math.abs(delta))} kg desde ${dataCurta(a.d)}</span><span>Tendência: <b>${dec(ema)}</b> kg</span></p>` : ""}
      ${ps.length > 1 ? grafico(pontos, `Peso de ${dec(a.kg)} kg a ${dec(z.kg)} kg em ${ps.length} registros; a linha clara é a tendência`) : `<p class="vazio">A curva aparece a partir do segundo registro.</p>`}`;
  }
  return `
    <section class="secao">
      <h2>Peso</h2>
      ${bloco}
      <form class="par" data-form="peso">
        <input name="kg" type="number" inputmode="decimal" min="20" max="400" step="0.1" required placeholder="Peso de hoje em kg" value="${S.dias[h]?.peso || ""}" aria-label="Peso de hoje em kg">
        <button class="botao">Registrar peso</button>
      </form>
    </section>`;
}

function secaoMedidas() {
  const { atual, primeira, todas } = ultimasMedidas();
  const comp = composicao(atual), compIni = todas.length > 1 ? composicao(primeira) : null;
  let corpo = `<p class="vazio">Com fita métrica, a cada 2 a 4 semanas, de manhã. Pescoço e cintura já dão o percentual de gordura${S.user?.sexo === "f" ? " (para mulheres, também o quadril)" : ""}.</p>`;
  if (atual) {
    corpo = `
      ${comp ? `<p class="gordura"><b>${dec(comp.bf)}%</b> de gordura <small>massa magra ${dec(comp.magra)} kg, gorda ${dec(comp.gorda)} kg</small></p>
        ${compIni ? `<p class="legenda"><span>Desde ${dataCurta(primeira.d)}: gordura ${sinal(comp.bf - compIni.bf)}${dec(Math.abs(comp.bf - compIni.bf))} pontos, massa magra ${sinal(comp.magra - compIni.magra)}${dec(Math.abs(comp.magra - compIni.magra))} kg</span></p>` : ""}` : ""}
      <ul class="lista-ex medidas">
        ${MEDIDAS.filter((m) => atual[m.id]).map((m) => {
          const dif = primeira && primeira !== atual && primeira[m.id] ? atual[m.id] - primeira[m.id] : 0;
          return `<li><span class="oque">${m.nome}</span><span class="pts"></span><b>${dec(atual[m.id])} cm</b>${dif ? `<small>${sinal(dif)}${dec(Math.abs(dif))}</small>` : "<small></small>"}</li>`;
        }).join("")}
      </ul>
      <p class="legenda"><span>Medidas de ${dataCurta(atual.d)}${primeira && primeira !== atual ? `, comparadas com ${dataCurta(primeira.d)}` : ""}. O percentual vem da fórmula da Marinha americana: erra uns 3 pontos para cima ou para baixo, mas mostra bem a tendência.</span></p>`;
  }
  return `
    <section class="secao">
      <h2>Medidas</h2>
      ${corpo}
      <button class="botao fraco cheio" data-acao="abrir-medidas">Registrar medidas de hoje</button>
    </section>`;
}

const SILHUETA = {
  frente: `<svg viewBox="0 0 60 120" aria-hidden="true"><circle cx="30" cy="12" r="8"/><path d="M18 26h24l6 34-6 2-3-22v30l3 46h-9l-3-40-3 40h-9l3-46V40l-3 22-6-2z"/></svg>`,
  lado: `<svg viewBox="0 0 60 120" aria-hidden="true"><circle cx="30" cy="12" r="8"/><path d="M24 26h12l4 16-2 22-3 2-1-20v24l2 46h-8l-2-40-1 40h-6l1-46V44z"/></svg>`,
  costas: `<svg viewBox="0 0 60 120" aria-hidden="true"><circle cx="30" cy="12" r="8"/><path d="M18 26h24l6 34-6 2-3-22v30l3 46h-9l-3-40-3 40h-9l3-46V40l-3 22-6-2z"/><path d="M30 28v30" class="coluna"/></svg>`,
};

function secaoFotos() {
  const sess = sessoesDeFotos();
  if (ui.fotoComparar && !(sess.some((s) => s.d === ui.fotoComparar.a) && sess.some((s) => s.d === ui.fotoComparar.b))) ui.fotoComparar = null;
  const cmp = ui.fotoComparar || (sess.length > 1 ? { a: sess[sess.length - 1].d, b: sess[0].d, pose: "frente" } : null);
  let comparacao = "";
  if (cmp) {
    const sa = sess.find((s) => s.d === cmp.a), sb = sess.find((s) => s.d === cmp.b);
    const ia = sa?.poses[cmp.pose], ib = sb?.poses[cmp.pose];
    const opcoes = (sel) => sess.map((s) => `<option value="${s.d}" ${s.d === sel ? "selected" : ""}>${dataCurta(s.d)}</option>`).join("");
    comparacao = `
      <div class="comparar">
        <div class="par">
          <label class="campo"><span>Antes</span><select id="foto-a">${opcoes(cmp.a)}</select></label>
          <label class="campo"><span>Depois</span><select id="foto-b">${opcoes(cmp.b)}</select></label>
        </div>
        <div class="opcoes poses" role="group" aria-label="Pose">
          ${POSES.map((p) => `<label><input type="radio" name="pose-cmp" value="${p.id}" ${p.id === cmp.pose ? "checked" : ""}><span>${p.nome}</span></label>`).join("")}
        </div>
        ${ia && ib ? `
          <div class="deslizante" style="--corte:50%">
            <img data-foto="${esc(ia)}" alt="Antes, ${dataCurta(cmp.a)}">
            <img data-foto="${esc(ib)}" class="cima" alt="Depois, ${dataCurta(cmp.b)}">
            <span class="rot a">${dataCurta(cmp.a)}</span><span class="rot b">${dataCurta(cmp.b)}</span>
          </div>
          <input type="range" id="corte" min="0" max="100" value="50" aria-label="Arrastar para comparar antes e depois">`
        : `<p class="vazio">Falta a foto de ${POSES.find((p) => p.id === cmp.pose).nome.toLowerCase()} numa das datas.</p>`}
      </div>`;
    ui.fotoComparar = cmp;
  }
  return `
    <section class="secao">
      <h2>Fotos do físico</h2>
      <p class="texto">Frente, lado e costas, a cada 2 a 4 semanas. Ficam só neste aparelho e não entram no backup.</p>
      ${sess.length ? `<ul class="tiras">${sess.slice(0, 6).map((s) => `
        <li><button data-acao="ver-fotos" data-d="${s.d}"><span>${dataCurta(s.d)}</span>
          <span class="mini-fotos">${POSES.map((p) => (s.poses[p.id] ? `<img data-foto="${esc(s.poses[p.id])}" alt="">` : `<i></i>`)).join("")}</span></button></li>`).join("")}</ul>` : ""}
      ${comparacao}
      <button class="botao fraco cheio" data-acao="ver-fotos" data-d="${hoje()}">Tirar as fotos de hoje</button>
    </section>`;
}

FOLHAS.fotos = (f) => {
  const s = sessoesDeFotos().find((x) => x.d === f.d), ehHoje = f.d === hoje();
  return `
    <h2 id="folha-titulo">Fotos ${ehHoje ? "de hoje" : `de ${dataCurta(f.d)}`}</h2>
    ${ehHoje ? `<ul class="dicas">${DICAS_FOTO.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
    <input type="file" accept="image/*" id="arq-foto" hidden>
    <div class="poses-grade">
      ${POSES.map((p) => {
        const id = s?.poses[p.id];
        return `<div class="pose">
          ${id ? `<img data-foto="${esc(id)}" alt="${p.nome}, ${dataCurta(f.d)}">` : `<div class="guia">${SILHUETA[p.id]}</div>`}
          <b>${p.nome}</b>
          ${ehHoje ? `<button class="link" data-acao="tirar-foto-corpo" data-pose="${p.id}">${id ? "Refazer" : "Tirar ou escolher"}</button>` : ""}
          ${id ? `<button class="link fraco" data-acao="apagar-foto-corpo" data-id="${esc(id)}">Apagar</button>` : ""}
        </div>`;
      }).join("")}
    </div>
    ${ehHoje ? `<p class="dica">${esc(POSES.map((p) => `${p.nome}: ${p.dica}`).join(" "))}</p>` : ""}`;
};

FOLHAS.medidas = () => {
  const ant = ultimasMedidas().atual, hj = S.dias[hoje()]?.med || {};
  return `
    <h2 id="folha-titulo">Medidas de hoje</h2>
    <p class="texto">Em centímetros, com a fita firme mas sem apertar a pele. Pode deixar em branco o que não medir.</p>
    <form data-form="medidas">
      ${MEDIDAS.map((m) => `<label class="campo"><span>${m.nome} <small>${esc(m.dica)}${ant?.[m.id] ? `; última: ${dec(ant[m.id])}` : ""}</small></span>
        <input name="${m.id}" type="number" inputmode="decimal" min="10" max="250" step="any" value="${hj[m.id] ?? ""}"></label>`).join("")}
      <button class="botao cheio">Salvar medidas</button>
    </form>`;
};

// Preenche as <img data-foto> depois de desenhar (as imagens vêm do IndexedDB)
export async function hidratarFotos(raiz = document) {
  for (const img of raiz.querySelectorAll("img[data-foto]:not([src])")) {
    const url = await urlFoto(img.dataset.foto);
    if (url) img.src = url; else img.replaceWith(Object.assign(document.createElement("i"), { className: "sem-foto", textContent: "não está neste aparelho" }));
  }
}

// ---------- tela ----------
export const telaEquipe = {
  titulo: "Registro",
  html() {
    if (ANTIGAS[ui.equipe]) ui.equipe = ANTIGAS[ui.equipe];
    const sub = SUBABAS.some(([k]) => k === ui.equipe) ? ui.equipe : "dieta";
    const seg = `<div class="segmentos" role="tablist">${SUBABAS.map(([k, nome]) =>
      `<button role="tab" data-acao="sub-equipe" data-sub="${k}" aria-selected="${k === sub}">${nome}</button>`).join("")}</div>`;
    const base = {
      dieta: () => secaoSemana() + secaoSono(),
      fisico: () => secaoPeso() + secaoMedidas() + secaoFotos(),
      treino: () => "",
    }[sub]();
    const extra = SECOES[sub].map((fn) => fn()).join("");
    return seg + (base + extra || `<p class="vazio">Nada registrado ainda.</p>`);
  },
  depois() { hidratarFotos($("#tela")); },
};

// ---------- ações ----------
Object.assign(ACOES, {
  "sub-equipe"(b) { ui.equipe = b.dataset.sub; render(); window.scrollTo(0, 0); },
  "abrir-medidas"() { abrirFolha({ tipo: "medidas" }); },
  "ver-fotos"(b) { abrirFolha({ tipo: "fotos", d: b.dataset.d }); hidratarFotos($("#folha")); },
  "tirar-foto-corpo"(b) { ui.poseFoto = b.dataset.pose; $("#arq-foto").click(); },
  async "apagar-foto-corpo"(b) {
    if (!b.dataset.certeza) { b.dataset.certeza = "1"; b.textContent = "Apagar mesmo?"; return; }
    await apagarFoto(b.dataset.id);
    abrirFolha(ui.folha); hidratarFotos($("#folha")); render();
  },
});

FORMS.medidas = (form) => {
  const f = new FormData(form), valores = {};
  for (const m of MEDIDAS) valores[m.id] = lerNum(f.get(m.id));
  const med = registrarMedidas(valores);
  fecharFolha(); render();
  const comp = med && composicao({ d: hoje(), ...med });
  avisar(med ? `Medidas salvas${comp ? `: ${dec(comp.bf)}% de gordura` : ""}` : "Medidas apagadas");
};

MUDANCAS.push((el) => {
  if (el.id === "arq-foto" && el.files[0]) {
    const arq = el.files[0], pose = ui.poseFoto;
    el.value = "";
    guardarFoto(arq, pose).then(() => {
      abrirFolha(ui.folha); hidratarFotos($("#folha")); render();
      avisar("Foto guardada neste aparelho");
    }).catch(() => avisar("Não deu para guardar essa foto."));
    return true;
  }
  if (el.id === "foto-a" || el.id === "foto-b") {
    ui.fotoComparar = { ...ui.fotoComparar, [el.id === "foto-a" ? "a" : "b"]: el.value };
    render(); return true;
  }
  if (el.name === "pose-cmp") { ui.fotoComparar = { ...ui.fotoComparar, pose: el.value }; render(); return true; }
  return false;
});

// Deslizante antes/depois: só mexe no corte, sem redesenhar
document.addEventListener("input", (e) => {
  if (e.target.id !== "corte") return;
  e.target.previousElementSibling?.style.setProperty("--corte", e.target.value + "%");
});
