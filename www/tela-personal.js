// Telas do personal: avaliação, programa gerado, revisão da semana, blocos e cronômetro de descanso.

import { S, salvar } from "./store.js";
import { $, esc, ui, ACOES, FORMS, FOLHAS, render, avisar, abrirFolha, fecharFolha } from "./base.js";
import { T, GRUPOS, nomeEx } from "./treino.js";
import {
  LESOES, gerarPrograma, aplicarPrograma, volumePlanejado, volumeFeito, faixaVolume, recordes, estagnados,
  trocarNoPlano, blocoAtual, novoBloco, descansoPara,
} from "./personal.js";

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
      <p class="texto">${esc(f.prog.divisao)}, em blocos de 5 semanas: 4 de progressão e 1 de recuperação.</p>
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
    return `<li class="${st}"><span>${GRUPOS[g]}</span><span class="barra"><i style="width:${Math.min(100, (v / (max * 1.2)) * 100).toFixed(0)}%"></i><b class="marca" style="left:${((min / (max * 1.2)) * 100).toFixed(0)}%"></b><b class="marca" style="left:${((max / (max * 1.2)) * 100).toFixed(0)}%"></b></span><b>${v}</b></li>`;
  }).join("")}</ul><p class="legenda"><span>Faixa boa: ${feito ? "séries feitas nos últimos 7 dias" : "séries por semana"} entre as marcas (10 a 20; 12 a 22 nos prioritários).</span></p>`;
}

// ---------- seção do personal no início do treino ----------
export function secaoPersonal() {
  const b = blocoAtual(), av = S.personal.avaliacao;
  const rec = recordes(), est = estagnados(), feito = volumeFeito();
  const temHistorico = T().sessoes.length > 0;
  let bloco = "";
  if (b && !b.acabou) bloco = `<p class="bloco-status ${b.deload ? "deload" : ""}">Semana <b>${b.semana}</b> de ${b.semanas}${b.deload ? ": semana de recuperação. Menos séries e 10% menos carga, para o corpo absorver o bloco." : ""}</p>`;
  else if (b?.acabou) bloco = `<div class="confirma suave"><p>O bloco de ${b.semanas} semanas acabou. Hora de revisar: ${est.length ? `${est.length} exercício${est.length > 1 ? "s" : ""} parado${est.length > 1 ? "s" : ""} para trocar` : "nenhum exercício parado"}.</p><div class="par botoes"><button class="botao" data-acao="novo-bloco">Começar novo bloco</button><button class="botao fraco" data-acao="abrir-avaliacao">Refazer programa</button></div></div>`;
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
let relogio = null;
export function iniciarDescanso(exId) {
  const seg = descansoPara(exId);
  ui.descanso = { fim: Date.now() + seg * 1000, total: seg };
  clearInterval(relogio);
  relogio = setInterval(atualizarDescanso, 500);
  atualizarDescanso();
}
function atualizarDescanso() {
  const el = $("#descanso");
  if (!el) return;
  const d = ui.descanso;
  if (!d) { el.hidden = true; clearInterval(relogio); return; }
  const resta = Math.ceil((d.fim - Date.now()) / 1000);
  if (resta <= 0) {
    el.innerHTML = `<span><b>Descanso acabou.</b> Próxima série.</span><button data-acao="fechar-descanso">OK</button>`;
    if (!d.avisou) { d.avisou = true; try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ } }
    if (resta < -20) { ui.descanso = null; }
  } else {
    const mm = Math.floor(resta / 60), ss = String(resta % 60).padStart(2, "0");
    el.innerHTML = `<span>Descanso <b>${mm}:${ss}</b></span><span class="acoes"><button data-acao="mais-descanso">+30 s</button><button data-acao="fechar-descanso">Pular</button></span>`;
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
    avisar("Programa novo. Semana 1 do bloco");
  },
  "novo-bloco"() { novoBloco(); render(); avisar("Bloco novo: semana 1"); },
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
  "mais-descanso"() { if (ui.descanso) { ui.descanso.fim += 30000; atualizarDescanso(); } },
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

