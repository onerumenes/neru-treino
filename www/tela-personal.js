// Telas do personal: avaliação, programa gerado, revisão da semana, blocos e cronômetro de descanso.

import { S, salvar, hoje, somaDias, paraData } from "./store.js";
import { $, esc, dataCurta, ui, TELAS, ACOES, FORMS, FOLHAS, render, avisar, abrirFolha, fecharFolha } from "./base.js";
import { T, GRUPOS, nomeEx, exercicio } from "./treino.js";
import {
  LESOES, gerarPrograma, aplicarPrograma, recordes, estagnados,
  trocarNoPlano, blocoAtual, descansoPara, semanaLeve, iniciarSemanaLeve, encerrarSemanaLeve,
} from "./personal.js";
import { volumePlanejado, faixaVolume, descreverFaixas, sinaisSemanaLeve, sugestoesVolume, forcaPorMusculo } from "./musculos.js";
import { lacunasDoPlano } from "./regioes.js";

const NIVEIS = { iniciante: "Iniciante (menos de 1 ano)", intermediario: "Intermediário (1 a 3 anos)", avancado: "Avançado (3 anos ou mais)" };
const FOCOS = { hipertrofia: "Hipertrofia", ambos: "Força e hipertrofia", forca: "Força" };
// Gancho da IA (fase 4): comentário do personal na revisão
export const NARRAR_PERSONAL = { revisao: null };
const marcado = (c) => (c ? "checked" : "");
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

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
  }).join("")}</ul><p class="legenda"><span>Faixa boa: ${feito ? "séries efetivas nos últimos 7 dias" : "séries efetivas por semana"} entre as marcas (${descreverFaixas()}).</span><span>Série com até 3 repetições sobrando vale 1; mais longe da falha vale menos. Exercício composto conta parte da série nos músculos que ajudam.</span></p>`;
}

// ---------- personal: sugestões, cartão do início e tela própria ----------
// Mockup "Personal": o programa, as sugestões com dois botões, os sinais da semana leve e o comentário.
// Sugestão dispensada volta a valer depois de 3 semanas.
const ICONE_TROCA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>`;
const ICONE_MAIS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const ICONE_MENOS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>`;
const ICONE_ALVO = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICONE_PERSONAL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/></svg>`;
const ICONE_BRILHO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>`;

const dispensada = (id) => { const d = S.personal.dispensadas?.[id]; return !!d && d > somaDias(hoje(), -21); };
const volDispensada = (k) => { const d = S.personal.sugestoesDispensadas?.[k]; return !!d && d > somaDias(hoje(), -21); };

export function sugestoesPersonal() {
  const out = [];
  for (const x of estagnados()) {
    if (!x.troca || dispensada(`troca:${x.ex}`)) continue;
    out.push({ id: `troca:${x.ex}`, icone: ICONE_TROCA, tom: "laranja", titulo: `Trocar ${x.nome.toLowerCase()}`,
      texto: `Parado há 3 treinos, sem bater a melhor marca. ${nomeEx(x.troca)} trabalha o mesmo músculo de outro jeito.`,
      sim: `<button class="botao escuro" data-acao="trocar-exercicio" data-de="${esc(x.ex)}" data-para="${esc(x.troca)}">Trocar</button>`,
      nao: `<button class="botao fraco" data-acao="dispensar-sugestao" data-id="troca:${esc(x.ex)}">Manter</button>` });
  }
  for (const l of lacunasDoPlano()) {
    if (!l.sugestao || dispensada(`lacuna:${l.id}`)) continue;
    out.push({ id: `lacuna:${l.id}`, icone: ICONE_ALVO, tom: "amarelo", titulo: l.titulo, texto: `${l.texto} Que tal ${l.nomeSugestao.toLowerCase()}?`,
      sim: `<button class="botao escuro" data-acao="adicionar-lacuna" data-ex="${esc(l.sugestao)}" data-g="${esc(l.g)}">Adicionar</button>`,
      nao: `<button class="botao fraco" data-acao="dispensar-sugestao" data-id="lacuna:${esc(l.id)}">Agora não</button>` });
  }
  for (const v of sugestoesVolume()) {
    if (volDispensada(`${v.g}:${v.delta}`)) continue;
    const mais = v.delta > 0;
    out.push({ id: `vol:${v.g}`, icone: mais ? ICONE_MAIS : ICONE_MENOS, tom: "amarelo",
      titulo: `${mais ? "Mais" : "Menos"} ${Math.abs(v.delta)} séries de ${GRUPOS[v.g].toLowerCase()}`, texto: v.motivo,
      sim: `<button class="botao escuro" data-acao="aplicar-volume" data-g="${esc(v.g)}" data-n="${v.delta}">${mais ? "Adicionar" : "Tirar"}</button>`,
      nao: `<button class="botao fraco" data-acao="dispensar-volume" data-g="${esc(v.g)}" data-n="${v.delta}">Agora não</button>` });
  }
  return out;
}

function barrasLeve(s) {
  return `<span class="tracos-leve">${s.sinais.map((x) => `<i class="${x.ativo ? "on" : ""}"></i>`).join("")}</span>`;
}

export function cartaoPersonalInicio() {
  const sug = sugestoesPersonal(), av = S.personal.avaliacao, leve = semanaLeve(), temHist = T().sessoes.length > 0;
  const s = temHist && !leve ? sinaisSemanaLeve() : null;
  const sub = sug.length ? plural(sug.length, "sugestão", "sugestões") + " para esta semana" : av ? "nada para mudar agora" : "sem avaliação ainda";
  const aviso = leve ? `<b>Semana leve até ${dataCurta(leve.fim)}.</b> Menos séries e 10% menos carga.`
    : sug[0] ? `<b>${esc(sug[0].titulo)}.</b> ${esc(sug[0].texto)}`
    : !av ? "Faz a avaliação para o personal montar o programa pelos teus dias, tempo, nível e lesões." : "";
  return `
    <button class="cartao-personal" data-acao="aba" data-aba="personal">
      <span class="cab-personal">
        <span class="ic-personal">${ICONE_PERSONAL}</span>
        <span class="oque"><b>Personal</b><small>${esc(sub)}</small></span>
        <span class="seta-dir" aria-hidden="true">›</span>
      </span>
      ${aviso ? `<span class="aviso-personal">${aviso}</span>` : ""}
      ${s ? `<span class="linha-leve">${barrasLeve(s)}Semana leve: ${s.ativos} de ${s.sinais.length} sinais${s.propor ? ", o corpo está pedindo" : ", ainda não"}</span>` : ""}
    </button>`;
}

function cartaoPrograma() {
  const av = S.personal.avaliacao;
  if (!av) return `
    <section class="programa">
      <small>Teu programa</small>
      <b>Sem avaliação ainda</b>
      <p>O personal monta o programa pelos teus dias, tempo, nível, foco e lesões. O plano atual continua até usares o novo.</p>
      <button class="botao amarelo cheio" data-acao="abrir-avaliacao">Fazer a avaliação</button>
    </section>`;
  const desde = av.d || hoje(), dias = Math.max(0, Math.round((paraData(hoje()) - paraData(desde)) / 864e5));
  const semanas = Math.floor(dias / 7) + 1, feitos = T().sessoes.filter((s) => s.d >= desde).length;
  const previstos = Math.max(feitos, Math.round((dias / 7) * (av.dias || T().plano.length || 3)));
  const fs = Object.values(forcaPorMusculo()), forca = fs.length ? Math.round(fs.reduce((t, x) => t + x.pct, 0) / fs.length) : null;
  const rec = recordes(hoje(), Math.max(1, dias)).length;
  return `
    <section class="programa">
      <small>Teu programa</small>
      <b>Semana ${semanas} desde a avaliação</b>
      <span class="data-prog">Avaliação em ${dataCurta(desde)}</span>
      <div class="numeros-prog">
        <span><small>treinos</small><b>${feitos}${previstos ? ` de ${previstos}` : ""}</b></span>
        <span><small>força (2 sem.)</small><b class="${forca > 0 ? "sobe" : forca < 0 ? "desce" : ""}">${forca == null ? "—" : `${forca > 0 ? "+" : ""}${forca}%`}</b></span>
        <span><small>recordes</small><b class="ouro">${rec}</b></span>
      </div>
    </section>`;
}

function secaoSemanaLeve() {
  const leve = semanaLeve(), b = blocoAtual();
  if (b && !b.acabou) return `<p class="bloco-status ${b.deload ? "deload" : ""}">Semana <b>${b.semana}</b> de ${b.semanas} do bloco${b.deload ? ": semana de recuperação. Menos séries e 10% menos carga." : ""}</p>`;
  if (leve) return `
    <section class="caixa leve-ativa">
      <h2>Semana leve até ${dataCurta(leve.fim)}</h2>
      <p>Menos séries e 10% menos carga, para o corpo se recuperar.</p>
      <button class="link" data-acao="encerrar-semana-leve">Encerrar antes</button>
    </section>`;
  if (!T().sessoes.length) return "";
  const s = sinaisSemanaLeve();
  return `
    <section class="caixa sinais-semana ${s.propor ? "propor" : ""}">
      <div class="titulo-linha"><h2>Semana leve</h2><small>${s.ativos} de ${s.sinais.length} sinais · ${s.propor ? "o corpo está pedindo" : "ainda não"}</small></div>
      <ul class="grade-sinais">${s.sinais.map((x) => `<li class="${x.ativo ? "on" : ""}"><i></i><b>${esc(x.nome)}</b><small>${esc(x.detalhe)}</small></li>`).join("")}</ul>
      ${s.propor ? `<button class="botao escuro cheio" data-acao="iniciar-semana-leve">Fazer a semana leve (7 dias)</button>`
        : `<p class="dica">Com 3 sinais o personal propõe 7 dias com menos séries e 10% menos carga.</p>`}
    </section>`;
}

function telaPersonal() {
  const sug = sugestoesPersonal();
  return `
    ${cartaoPrograma()}
    <section class="secao">
      <h2>Sugestões da semana</h2>
      ${sug.length ? `<ul class="sugestoes">${sug.map((x) => `
        <li class="caixa">
          <div class="sug-cab"><span class="ic-sug ${x.tom}">${x.icone}</span><span><b>${esc(x.titulo)}</b><small>${esc(x.texto)}</small></span></div>
          <div class="par botoes">${x.sim}${x.nao}</div>
        </li>`).join("")}</ul>`
      : `<p class="caixa vazio">${T().sessoes.length ? "Nada para mudar agora. O personal olha de novo a cada treino." : "As sugestões aparecem depois dos primeiros treinos."}</p>`}
    </section>
    ${secaoSemanaLeve()}
    ${ui.narracaoPersonal || NARRAR_PERSONAL.revisao ? `
    <section class="comentario-personal">
      <span class="rotulo-mini">${ICONE_BRILHO}Comentário do personal</span>
      ${ui.narracaoPersonal ? `<p>${esc(ui.narracaoPersonal)}</p>` : `<p>O personal olha a semana inteira e comenta o que está indo bem e o que ajustar.</p>`}
      ${NARRAR_PERSONAL.revisao ? `<button class="link" data-acao="narrar-personal">${ui.narracaoPersonal ? "Pedir de novo" : "Pedir o comentário"}</button>` : ""}
    </section>` : ""}
    <button class="botao fraco cheio" data-acao="abrir-avaliacao">${S.personal.avaliacao ? "Refazer avaliação e programa" : "Avaliação com o personal"}</button>`;
}

TELAS.personal = {
  titulo: "Personal", aba: "treino", html: telaPersonal,
  sub: () => { const a = S.personal.avaliacao; return a ? `${FOCOS[a.foco] || "Hipertrofia"} · ${a.dias} dias · ${{ iniciante: "iniciante", intermediario: "intermediário", avancado: "avançado" }[a.nivel] || ""}` : "Sem avaliação"; },
};

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
  "dispensar-sugestao"(b) {
    S.personal.dispensadas = { ...(S.personal.dispensadas || {}), [b.dataset.id]: hoje() };
    salvar(); render();
  },
  // lacuna do plano: o exercício entra no dia que mais treina aquele músculo, 3 séries de 10 a 15
  "adicionar-lacuna"(b) {
    const plano = T().plano, g = b.dataset.g, ex = b.dataset.ex;
    const conta = (d) => d.ex.filter((x) => exercicio(x.ex).g === g || (g === "posterior" && exercicio(x.ex).g === "quadriceps")).length;
    const dia = [...plano].sort((a, c) => conta(c) - conta(a))[0];
    if (!dia) return;
    dia.ex.push({ ex, series: 3, min: 10, max: 15 });
    salvar(); render();
    avisar(`${nomeEx(ex)} entrou em ${dia.nome}`, () => { const k = dia.ex.findIndex((x) => x.ex === ex); if (k >= 0) dia.ex.splice(k, 1); salvar(); });
  },
  "trocar-exercicio"(b) {
    trocarNoPlano(b.dataset.de, b.dataset.para);
    render();
    avisar(`${nomeEx(b.dataset.de)} trocado por ${nomeEx(b.dataset.para)}`, () => trocarNoPlano(b.dataset.para, b.dataset.de));
  },
  async "narrar-personal"(b) {
    b.disabled = true; b.textContent = "O personal está escrevendo…";
    try { ui.narracaoPersonal = await NARRAR_PERSONAL.revisao(); } catch (e) { ui.narracaoPersonal = e.message || "Não deu para falar com a IA agora."; }
    if (ui.aba === "personal" || ui.aba === "treino") render();
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

