// Peças comuns a todas as telas: utilitários, estado da interface, moldura (topo, abas, folha, aviso)
// e os registros onde cada módulo pendura suas telas, ações e formulários.

import { hoje, somaDias, paraData } from "./store.js";

export const $ = (s, el = document) => el.querySelector(s);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const int = (x) => Math.round(Number(x) || 0).toLocaleString("pt-BR");
export const dec = (x) => (Math.round((Number(x) || 0) * 10) / 10).toLocaleString("pt-BR");
export const lerNum = (v) => Number(String(v ?? "").replace(",", ".")) || 0;
export const dataCurta = (d) => paraData(d).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");

export const ui = {
  aba: "hoje", data: hoje(), seguindoHoje: true,
  folha: null, desfazer: null,
  ocupado: false, status: "", foto: null, gravando: null, ultimo: null, erroChat: null,
  restaurar: null, testeIA: null,
  treino: "inicio", // "inicio" | "plano"
  equipe: "resumo", // "resumo" | "corpo" | "plano"
  fotoComparar: null, poseFoto: null,
};

// Registros preenchidos pelos módulos
export const TELAS = {};      // aba -> { titulo, html(), depois() }
export const ACOES = {};      // data-acao -> fn(botao, evento)
export const FORMS = {};      // data-form -> fn(form)
export const FOLHAS = {};     // tipo -> fn(folha) devolvendo o HTML
export const MUDANCAS = [];   // fn(elemento) chamada no evento change; devolve true se tratou

export const ICONE = {
  camera: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z"/><circle cx="12" cy="13.2" r="3.4"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>`,
  parar: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>`,
  enviar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5v-15M5.5 11 12 4.5 18.5 11"/></svg>`,
  antes: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>`,
  depois: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>`,
  ajustes: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`,
  fita: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="8" width="20" height="8" rx="2"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/></svg>`,
  cima: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 14.5 12 8l6.5 6.5"/></svg>`,
  baixo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 9.5 12 16l6.5-6.5"/></svg>`,
  feito: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7.5"/></svg>`,
};

// ---------- datas ----------
export function rotuloDia(d) {
  const h = hoje();
  if (d === h) return ["Hoje", dataCurta(d)];
  if (d === somaDias(h, -1)) return ["Ontem", dataCurta(d)];
  const sem = paraData(d).toLocaleDateString("pt-BR", { weekday: "long" });
  return [sem[0].toUpperCase() + sem.slice(1), dataCurta(d)];
}
export function irParaDia(d) {
  ui.data = d > hoje() ? hoje() : d;
  ui.seguindoHoje = ui.data === hoje();
  render();
}

// ---------- moldura ----------
function topo() {
  const el = $("#topo"), tela = TELAS[ui.aba];
  const titulo = typeof tela.titulo === "function" ? tela.titulo() : tela.titulo;
  const sub = typeof tela.sub === "function" ? tela.sub() : tela.sub;
  const b = tela.botao, direita = typeof tela.direita === "function" ? tela.direita() : "";
  const botao = b ? `<button class="redondo" data-acao="${b.acao}" ${b.aba ? `data-aba="${b.aba}"` : ""} aria-label="${esc(b.rotulo)}">${b.icone}</button>` : "";
  if (tela.comData) {
    // aba com dia: a data pequena (com setas para trocar de dia), o nome do dia grande e um selo à direita
    const [a, d] = rotuloDia(ui.data);
    const longa = paraData(ui.data).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }).replace(".", "");
    el.className = "principal";
    el.innerHTML = `
      <div class="titulo-dia">
        <span class="data-pequena">
          <button data-acao="dia" data-n="-1" aria-label="Dia anterior">${ICONE.antes}</button>
          <button data-acao="dia-hoje" aria-label="${a}, ${d}. Voltar para hoje">${esc(longa)}</button>
          <button data-acao="dia" data-n="1" aria-label="Próximo dia" ${ui.data >= hoje() ? "disabled" : ""}>${ICONE.depois}</button>
        </span>
        <h1>${esc(tela.tituloDia ? tela.tituloDia(a) : a)}</h1>
      </div>${direita}${botao}`;
    return;
  }
  // tela de dentro de outra aba (tela.aba) ganha o botão redondo de voltar: para a tela de onde veio (ui.volta),
  // senão para a aba dona dela; as abas principais têm o título grande
  const alvo = ui.volta && ui.volta !== ui.aba && TELAS[ui.volta] ? ui.volta : tela.aba && tela.aba !== ui.aba ? tela.aba : null;
  // a própria tela pode pedir um voltar (o treino em andamento, o editor do plano)
  const proprio = !alvo && typeof tela.voltar === "function" ? tela.voltar() : null;
  if (proprio) {
    el.className = "interna";
    el.innerHTML = `
      <button class="redondo" data-acao="${proprio.acao || "aba"}" ${proprio.aba ? `data-aba="${proprio.aba}"` : ""} aria-label="${esc(proprio.rotulo)}">${ICONE.antes}</button>
      <div class="titulo-interno"><h1>${esc(titulo)}</h1>${sub ? `<span>${esc(sub)}</span>` : ""}</div>${direita}${botao}`;
    return;
  }
  if (!alvo) {
    el.className = "principal";
    el.innerHTML = `<h1>${esc(titulo)}</h1>${direita}${botao}`;
    return;
  }
  const pai = TELAS[alvo], nomePai = typeof pai.titulo === "function" ? pai.titulo() : pai.titulo;
  el.className = "interna";
  el.innerHTML = `
    <button class="redondo" data-acao="aba" data-aba="${alvo}" aria-label="Voltar para ${esc(nomePai || "a tela anterior")}">${ICONE.antes}</button>
    <div class="titulo-interno"><h1>${esc(titulo)}</h1>${sub ? `<span>${esc(sub)}</span>` : ""}</div>${direita}${botao}`;
}

export function render() {
  const tela = TELAS[ui.aba], ativa = tela.aba || ui.aba;
  topo();
  for (const b of document.querySelectorAll("#abas button")) {
    if (b.dataset.aba === ativa) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  }
  const el = $("#tela");
  el.className = "tela-" + ui.aba;
  el.innerHTML = tela.html();
  tela.depois?.();
}

let tAviso;
export function avisar(texto, desfazer = null) {
  const el = $("#aviso");
  ui.desfazer = desfazer;
  el.innerHTML = `<span>${esc(texto)}</span>${desfazer ? `<button data-acao="desfazer-aviso">Desfazer</button>` : ""}`;
  el.classList.add("on");
  clearTimeout(tAviso);
  tAviso = setTimeout(() => el.classList.remove("on"), desfazer ? 6000 : 2600);
}

// ---------- folha ----------
export function abrirFolha(f) {
  const manterRolagem = ui.folha?.tipo === f.tipo ? $("#folha .painel").scrollTop : 0;
  ui.folha = f;
  $("#folha-corpo").innerHTML = FOLHAS[f.tipo](f);
  $("#folha").hidden = false;
  document.body.classList.add("com-folha");
  $("#folha .painel").scrollTop = manterRolagem;
}
export function fecharFolha() {
  ui.folha = null;
  $("#folha").hidden = true;
  document.body.classList.remove("com-folha");
}

Object.assign(ACOES, {
  aba(b) {
    ui.aba = b.dataset.aba; ui.testeIA = null;
    ui.volta = b.dataset.volta || null;
    if (b.dataset.treino) ui.treino = b.dataset.treino;
    render();
    if (!TELAS[ui.aba].manterRolagem) window.scrollTo(0, 0);
  },
  dia(b) { irParaDia(somaDias(ui.data, Number(b.dataset.n))); },
  "dia-hoje"() { irParaDia(hoje()); },
  "ver-dia"(b) { ui.aba = "hoje"; irParaDia(b.dataset.d); window.scrollTo(0, 0); },
  "fechar-folha": fecharFolha,
  "desfazer-aviso"() {
    const fn = ui.desfazer;
    ui.desfazer = null;
    $("#aviso").classList.remove("on");
    if (fn) { fn(); render(); }
  },
});

// ---------- eventos ----------
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-acao]");
  if (b && !b.disabled) ACOES[b.dataset.acao]?.(b, e);
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  FORMS[form.dataset.form]?.(form);
});

document.addEventListener("change", (e) => {
  for (const fn of MUDANCAS) if (fn(e.target)) return;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.folha) fecharFolha();
});
