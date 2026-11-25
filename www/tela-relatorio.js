// Telas da equipe: avisos (nutri + personal juntos), relatório semanal e o aviso mais importante no Diário.

import { S, hoje, salvar } from "./store.js";
import { esc, dataCurta, ui, ACOES, FOLHAS, render, avisar, abrirFolha } from "./base.js";
import { SECOES } from "./tela-equipe.js";
import { AVISOS_DIARIO } from "./tela-nutri.js";
import { avisos, executarAviso, dispensar, gerarRelatorio, relatorioPendente } from "./equipe.js";

// Gancho da IA: comentário da equipe sobre o relatório (equipe-ia.js)
export const NARRAR_RELATORIO = { relatorio: null };

function cartaoAviso(a, compacto = false) {
  return `
    <div class="aviso-time ${a.fixo ? "fixo" : ""}">
      <p><small>${esc(a.quem)}</small><br><b>${esc(a.titulo)}</b></p>
      ${compacto ? "" : `<p>${esc(a.texto)}</p>`}
      <div class="acoes-ex">
        ${a.acao ? `<button class="link" data-acao="aviso-acao" data-id="${esc(a.id)}">${esc(a.acao.rotulo)}</button>` : ""}
        ${compacto ? `<button class="link fraco" data-acao="ver-equipe">Ver</button>` : ""}
        ${a.fixo ? "" : `<button class="link fraco" data-acao="aviso-dispensar" data-id="${esc(a.id)}">Dispensar</button>`}
      </div>
    </div>`;
}

function secaoAvisos() {
  const lista = avisos();
  return lista.length ? `<section class="avisos-time">${lista.map((a) => cartaoAviso(a)).join("")}</section>` : "";
}

function secaoRelatorio() {
  const r = S.relatorios[S.relatorios.length - 1];
  if (!r) {
    return relatorioPendente() ? `<section class="secao"><h2>Relatório da semana</h2><button class="botao cheio" data-acao="gerar-relatorio">Gerar o relatório</button></section>` : "";
  }
  return `
    <section class="secao relatorio">
      <h2>Relatório da semana <small>${dataCurta(r.d)}</small></h2>
      ${r.linhas.map((l) => `<p>${esc(l)}</p>`).join("")}
      ${r.texto ? `<p class="narracao">${esc(r.texto)}</p>` : NARRAR_RELATORIO.relatorio ? `<button class="link" data-acao="narrar-relatorio">Pedir o comentário da equipe</button>` : ""}
      ${S.relatorios.length > 1 ? `<button class="link fraco" data-acao="relatorios-antigos">Relatórios anteriores</button>` : ""}
    </section>`;
}
// Avisos e relatório da equipe desligados: o app só registra e mostra (o código fica para voltar se quiser).



FOLHAS.relatorios = () => `
  <h2 id="folha-titulo">Relatórios anteriores</h2>
  ${[...S.relatorios].reverse().slice(1).map((r) => `
    <div class="plano-ref"><h3><span>Semana até ${dataCurta(r.d)}</span></h3>${r.linhas.map((l) => `<p class="texto">${esc(l)}</p>`).join("")}${r.texto ? `<p class="narracao">${esc(r.texto)}</p>` : ""}</div>`).join("")}`;

Object.assign(ACOES, {
  "aviso-acao"(b) {
    const a = avisos().find((x) => x.id === b.dataset.id);
    if (!a) return;
    if (a.acao.tipo === "sugestao") { abrirFolha({ tipo: "sugestao", d: hoje(), escolhas: {} }); return; }
    executarAviso(a); render();
    avisar(`Feito: ${a.acao.rotulo}. Meta agora em ${S.metas.kcal.toLocaleString("pt-BR")} kcal`);
  },
  "aviso-dispensar"(b) { dispensar(b.dataset.id); render(); },
  "ver-equipe"() { ui.aba = "equipe"; ui.equipe = "dieta"; render(); window.scrollTo(0, 0); },
  "gerar-relatorio"() { gerarRelatorio(); render(); },
  "relatorios-antigos"() { abrirFolha({ tipo: "relatorios" }); },
  async "narrar-relatorio"(b) {
    const r = S.relatorios[S.relatorios.length - 1];
    b.disabled = true; b.textContent = "A equipe está escrevendo…";
    try { r.texto = await NARRAR_RELATORIO.relatorio(r); salvar(); } catch (e) { avisar(e.message || "Não deu para falar com a IA agora."); }
    if (ui.aba === "equipe") render();
  },
});
