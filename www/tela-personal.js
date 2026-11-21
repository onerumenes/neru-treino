// Telas do personal: avaliação, programa gerado, revisão da semana, blocos e cronômetro de descanso.

import { S, salvar } from "./store.js";
import { $, esc, dataCurta, ui, ACOES, FORMS, FOLHAS, render, avisar, abrirFolha, fecharFolha } from "./base.js";
import { T, GRUPOS, nomeEx } from "./treino.js";
import {
  LESOES, gerarPrograma, aplicarPrograma, recordes, estagnados,
  trocarNoPlano, blocoAtual, descansoPara, semanaLeve, iniciarSemanaLeve, encerrarSemanaLeve,
} from "./personal.js";
import { volumePlanejado, volumeFeito, faixaVolume, descreverFaixas, sinaisSemanaLeve } from "./musculos.js";

const NIVEIS = { iniciante: "Iniciante (menos de 1 ano)", intermediario: "Intermediário (1 a 3 anos)", avancado: "Avançado (3 anos ou mais)" };
const FOCOS = { hipertrofia: "Hipertrofia", ambos: "Força e hipertrofia", forca: "Força" };
// Gancho da IA (fase 4): comentário do personal na revisão
export const NARRAR_PERSONAL = { revisao: null };
const marcado = (c) => (c ? "checked" : "");

// ---------- avaliação ----------
FOLHAS.avaliacaoTreino = (f) => {
  if (f.prog) {
    const vol = volumePlanejado(f.prog.plano);
    return `
      <h2 id="folha-titulo">Teu programa</h2>
      <p class="texto">${esc(f.prog.divisao)}. A semana leve vem quando o corpo pedir: o personal acompanha recuperação, força, sono e dor.</p>
      ${f.prog.plano.map((d) => `
        <div class="plano-ref"><h3><span>${esc(d.nome)}</span></h3>
          <ul class="lista-ex">${d.ex.map((x) => `<li><span class="oque">${esc(nomeEx(x.ex))}</span><span class="pts"></span><b>${x.series} × ${x.min}–${x.max}</b></li>`).join("")}</ul>
        </div>`).join("")}
      <h3>Séries por semana em cada músculo</h3>
      ${tabelaVolume(vol)}
      <p class="texto">Usar este programa troca o plano atual. O histórico de treinos e cargas continua.</p>
      <div class="par botoes">
        <button class="botao" data-acao="usar-programa">Usar este programa</button>
        <button class="botao fraco" data-acao="refazer-avaliacao">Voltar</button>
      </div>`;
  }
  const a = S.personal.avaliacao || { nivel: "intermediario", dias: 4, tempo: 60, foco: "hipertrofia", lesoes: [], prioridades: [] };
  return `
    <h2 id="folha-titulo">Avaliação com o personal</h2>
    <form data-form="avaliacao-treino">
      <fieldset class="opcoes lista-vertical"><legend>Experiência com musculação</legend>
        ${Object.entries(NIVEIS).map(([k, v]) => `<label><input type="radio" name="nivel" value="${k}" ${marcado(a.nivel === k)}><span>${v}</span></label>`).join("")}
      </fieldset>
      <fieldset class="opcoes"><legend>Dias por semana</legend>
        ${[2, 3, 4, 5, 6].map((n) => `<label><input type="radio" name="dias" value="${n}" ${marcado(Number(a.dias) === n)}><span>${n}</span></label>`).join("")}
      </fieldset>
      <fieldset class="opcoes"><legend>Tempo por treino</legend>
        ${[45, 60, 75, 90].map((n) => `<label><input type="radio" name="tempo" value="${n}" ${marcado(Number(a.tempo) === n)}><span>${n} min</span></label>`).join("")}
      </fieldset>
      <fieldset class="opcoes"><legend>Foco</legend>
        ${Object.entries(FOCOS).map(([k, v]) => `<label><input type="radio" name="foco" value="${k}" ${marcado(a.foco === k)}><span>${v}</span></label>`).join("")}
      </fieldset>
      <fieldset class="opcoes multi"><legend>Dor ou lesão (o personal evita os exercícios que forçam)</legend>
        ${Object.entries(LESOES).map(([k, v]) => `<label><input type="checkbox" name="lesoes" value="${k}" ${marcado(a.lesoes?.includes(k))}><span>${v.nome}</span></label>`).join("")}
      </fieldset>
      <fieldset class="opcoes multi"><legend>Músculos para priorizar (até 3)</legend>
        ${Object.entries(GRUPOS).filter(([k]) => k !== "antebraco").map(([k, v]) => `<label><input type="checkbox" name="prioridades" value="${k}" ${marcado(a.prioridades?.includes(k))}><span>${v}</span></label>`).join("")}
      </fieldset>
      <p class="dica">Academia completa. Dor que não passa ou que piora no treino é caso de médico ou fisioterapeuta.</p>
      <button class="botao cheio">Montar programa</button>
    </form>`;
};

function tabelaVolume(vol, feito = null) {
  const grupos = Object.keys(GRUPOS).filter((g) => vol[g] || feito?.[g]);
  return `<ul class="volume">${grupos.map((g) => {
    const [min, max] = faixaVolume(g), v = feito ? feito[g] || 0 : vol[g];
    const st = v < min ? "baixo" : v > max ? "alto" : "ok";
    return `<li class="${st}"><span>${GRUPOS[g]}</span><span class="barra"><i style="width:${Math.min(100, (v / (max * 1.2)) * 100).toFixed(0)}%"></i><b class="marca" style="left:${((min / (max * 1.2)) * 100).toFixed(0)}%"></b><b class="marca" style="left:${((max / (max * 1.2)) * 100).toFixed(0)}%"></b></span><b>${v.toLocaleString("pt-BR")}</b></li>`;
  }).join("")}</ul><p class="legenda"><span>Faixa boa: ${feito ? "séries efetivas nos últimos 7 dias" : "séries efetivas por semana"} entre as marcas (${descreverFaixas()}).</span><span>Série perto da falha vale 1, longe dela vale menos (sem RIR anotado conta como 2). Exercício composto conta meia série nos músculos que ajudam.</span></p>`;
}

// ---------- seção do personal no início do treino ----------
export function secaoPersonal() {
  const b = blocoAtual(), av = S.personal.avaliacao, leve = semanaLeve();
  const rec = recordes(), est = estagnados(), feito = volumeFeito();
  const temHistorico = T().sessoes.length > 0;
  let bloco = "";
  // bloco antigo de 5 semanas: quem estava no meio termina ele; depois, a semana leve vem pelos sinais
  if (b && !b.acabou) bloco = `<p class="bloco-status ${b.deload ? "deload" : ""}">Semana <b>${b.semana}</b> de ${b.semanas} do bloco${b.deload ? ": semana de recuperação. Menos séries e 10% menos carga." : ""}</p>`;
  else if (leve) bloco = `<div class="bloco-status deload"><p><b>Semana leve até ${dataCurta(leve.fim)}.</b> Menos séries e 10% menos carga, para o corpo se recuperar.</p><button class="link" data-acao="encerrar-semana-leve">Encerrar antes</button></div>`;
  else if (temHistorico) {
    const s = sinaisSemanaLeve();
    bloco = `<div class="sinais-leve ${s.propor ? "propor" : ""}">
      <div class="titulo-linha"><b>Semana leve</b><small>${s.propor ? "o corpo está pedindo" : `ainda não · ${s.ativos} de ${s.sinais.length} sinais`}</small></div>
      <div class="sinais">${s.sinais.map((x) => `<span class="${x.ativo ? "on" : ""}" title="${esc(x.detalhe)}"><i></i>${x.nome}</span>`).join("")}</div>
      ${s.propor ? `<p class="dica">${esc(s.sinais.filter((x) => x.ativo).map((x) => `${x.nome}: ${x.detalhe}`).join(". "))}.</p>
        <button class="botao cheio" data-acao="iniciar-semana-leve">Fazer a semana leve (7 dias)</button>` : ""}
    </div>`;
  }
  return `
    <section class="secao personal">
      <h2>Personal</h2>
      ${bloco}
      ${!av ? `<p class="texto">Faz a avaliação para o personal montar o programa pelos teus dias, tempo, nível e lesões.</p>` : ""}
      ${temHistorico ? `
        ${rec.length ? `<h3>Recordes da semana</h3><ul class="lista-ex">${rec.map((r) => `<li><span class="oque">${esc(r.nome)}</span><span class="pts"></span><b>+${String(r.ganho).replace(".", ",")}%</b></li>`).join("")}</ul>` : ""}
        ${est.length ? `<h3>Parados há 3 treinos</h3><ul class="lista-ex">${est.map((x) => `<li><span class="oque">${esc(x.nome)}${x.troca ? `<br><small>trocar por ${esc(nomeEx(x.troca))}</small>` : ""}</span><span class="pts"></span>${x.troca ? `<button class="link" data-acao="trocar-exercicio" data-de="${esc(x.ex)}" data-para="${esc(x.troca)}">Trocar</button>` : ""}</li>`).join("")}</ul>` : ""}
        ${Object.keys(feito).length ? `<h3>Volume dos últimos 7 dias</h3>${tabelaVolume(volumePlanejado(), feito)}` : ""}
        ${ui.narracaoPersonal ? `<p class="narracao">${esc(ui.narracaoPersonal)}</p>` : NARRAR_PERSONAL.revisao ? `<button class="link" data-acao="narrar-personal">Pedir o comentário do personal</button>` : ""}` : ""}
      <button class="botao fraco cheio" data-acao="abrir-avaliacao">${av ? "Refazer avaliação e programa" : "Avaliação com o personal"}</button>
    </section>`;
}

// ---------- cronômetro de descanso ----------
// Na tela do treino ele é um cartão com o anel do tempo; fora dela, a barra fixa embaixo
let relogio = null;
export function iniciarDescanso(exId, serie = null) {
  const seg = descansoPara(exId, serie);
  ui.descanso = { fim: Date.now() + seg * 1000, total: seg, tipo: serie?.tipo === "principal" || seg >= 180 ? "composto pesado" : seg >= 120 ? "composto" : "isolado" };
  clearInterval(relogio);
  relogio = setInterval(atualizarDescanso, 500);
  atualizarDescanso();
}
const L = 2 * Math.PI * 42;
export function cartaoDescanso() {
  const d = ui.descanso;
  if (!d) return "";
  const resta = Math.max(0, Math.ceil((d.fim - Date.now()) / 1000)), mm = Math.floor(resta / 60), ss = String(resta % 60).padStart(2, "0");
  const fracao = Math.min(1, resta / d.total);
  return `
    <section class="cartao-descanso ${resta <= 0 ? "acabou" : ""}">
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" class="fundo-anel"/><circle cx="50" cy="50" r="42" class="anel" stroke-dasharray="${(fracao * L).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 50 50)"/><text x="50" y="57" text-anchor="middle">${resta > 0 ? `${mm}:${ss}` : "0:00"}</text></svg>
      <div>
        <span><b>${resta > 0 ? "Descanso" : "Descanso acabou"}</b><small>${resta > 0 ? `${Math.round(d.total / 60 * 10) / 10 >= 1 ? `${Math.round(d.total / 60 * 10) / 10} min` : `${d.total} s`} · ${d.tipo}` : "Próxima série"}</small></span>
        <div class="acoes-descanso">
          <button data-acao="menos-descanso">−15 s</button><button data-acao="mais-descanso">+15 s</button><button class="pular" data-acao="fechar-descanso">${resta > 0 ? "Pular" : "OK"}</button>
        </div>
      </div>
    </section>`;
}
function atualizarDescanso() {
  const el = $("#descanso"), cartao = $("#descanso-cartao");
  const d = ui.descanso;
  if (!d) { if (el) el.hidden = true; if (cartao) cartao.innerHTML = ""; clearInterval(relogio); return; }
  const resta = Math.ceil((d.fim - Date.now()) / 1000);
  if (resta <= 0 && !d.avisou) { d.avisou = true; try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ } }
  if (resta < -20) { ui.descanso = null; atualizarDescanso(); return; }
  if (cartao) { cartao.innerHTML = cartaoDescanso(); if (el) el.hidden = true; return; }
  if (!el) return;
  if (resta <= 0) el.innerHTML = `<span><b>Descanso acabou.</b> Próxima série.</span><button data-acao="fechar-descanso">OK</button>`;
  else {
    const mm = Math.floor(resta / 60), ss = String(resta % 60).padStart(2, "0");
    el.innerHTML = `<span>Descanso <b>${mm}:${ss}</b></span><span class="acoes"><button data-acao="mais-descanso">+15 s</button><button data-acao="fechar-descanso">Pular</button></span>`;
  }
  el.hidden = false;
}

// ---------- ações ----------
Object.assign(ACOES, {
  "abrir-avaliacao"() { abrirFolha({ tipo: "avaliacaoTreino" }); },
  "refazer-avaliacao"() { abrirFolha({ tipo: "avaliacaoTreino" }); },
  "usar-programa"() {
    const f = ui.folha;
    aplicarPrograma(f.prog);
    fecharFolha(); ui.treino = "inicio"; render(); window.scrollTo(0, 0);
    avisar("Programa novo");
  },
  "iniciar-semana-leve"() { iniciarSemanaLeve(); render(); avisar("Semana leve: os próximos treinos já vêm reduzidos"); },
  "encerrar-semana-leve"() { encerrarSemanaLeve(); render(); avisar("Semana leve encerrada"); },
  "trocar-exercicio"(b) {
    trocarNoPlano(b.dataset.de, b.dataset.para);
    render();
    avisar(`${nomeEx(b.dataset.de)} trocado por ${nomeEx(b.dataset.para)}`, () => trocarNoPlano(b.dataset.para, b.dataset.de));
  },
  async "narrar-personal"(b) {
    b.disabled = true; b.textContent = "O personal está escrevendo…";
    try { ui.narracaoPersonal = await NARRAR_PERSONAL.revisao(); } catch (e) { ui.narracaoPersonal = e.message || "Não deu para falar com a IA agora."; }
    if (ui.aba === "treino") render();
  },
  "mais-descanso"() { if (ui.descanso) { ui.descanso.fim += 15000; ui.descanso.total += 15; atualizarDescanso(); } },
  "menos-descanso"() { if (ui.descanso) { ui.descanso.fim -= 15000; atualizarDescanso(); } },
  "fechar-descanso"() { ui.descanso = null; atualizarDescanso(); },
});

FORMS["avaliacao-treino"] = (form) => {
  const fd = new FormData(form);
  const av = {
    nivel: fd.get("nivel") || "intermediario", dias: Number(fd.get("dias")) || 4, tempo: Number(fd.get("tempo")) || 60,
    foco: fd.get("foco") || "hipertrofia", lesoes: fd.getAll("lesoes"), prioridades: fd.getAll("prioridades").slice(0, 3), d: new Date().toISOString().slice(0, 10),
  };
  S.personal.avaliacao = av;
  salvar();
  abrirFolha({ tipo: "avaliacaoTreino", prog: gerarPrograma(av) });
  $("#folha .painel").scrollTop = 0;
};

