// Telas do treino: início (semana, próximo treino, outros dias, personal, cardio, progresso e últimos treinos),
// sessão em andamento e editor do plano. Progresso, histórico, resumo e cardio ficam em tela-progresso.js.

import { S, salvar, hoje, somaDias, paraData } from "./store.js";
import { $, esc, int, lerNum, dataCurta, ui, ACOES, FORMS, FOLHAS, MUDANCAS, ICONE, render, avisar, abrirFolha, fecharFolha } from "./base.js";
import {
  T, GRUPOS, temPlano, usarModelo, nomeEx, biblioteca, criarExercicio, diaDoPlano, addDia, mover,
  sugerir, resumoSeries, fmtKg, proximoDia, iniciar, addExNaSessao, concluir, descartar, removerSessao,
  volume, totalSeries,
} from "./treino.js";
import { cartaoPersonalInicio, iniciarDescanso, cartaoDescanso } from "./tela-personal.js";
import {
  emRecuperacao, sugerirPrincipal, cargaRecuo, e1rm, melhorDa, ehComposto, recordes, semanaDeTreino, semanasSeguidas,
  minutosEstimados, gruposDoDia, recordesDaSessao, forcaDoExercicio, exerciciosFeitos,
} from "./personal.js";
import { musculosDo } from "./musculos.js";
import { svgCorpo } from "./avatar.js";
import { comCorpo, desenhar } from "./tela-perfil.js";
import { GRUPO_DE } from "./tela-treino-corpo.js";
import { PONTOS_DOR, nivelDor } from "./corpo.js";
import { exercicio } from "./treino.js";
import { secaoCardioSessao, linhaCardioDia } from "./tela-cardio.js";
import { planoCardio, resumoCardio } from "./cardio.js";

const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// ---------- início ----------
// Mockup "Início do treino" (canvas Neru Treino): semana em bolinhas, cartão amarelo do próximo treino com o corpo,
// os outros dias em cartões que rolam de lado, um aviso do personal por vez, cardio e progresso, últimos treinos.
function telaVazia() {
  return `
    <section class="caixa sem-plano">
      <h2>Monta teu plano de treino</h2>
      <p>O app guarda tuas séries e cargas e sugere quanto carregar na próxima vez. Dá para começar por um modelo de 5 dias e trocar o que quiser, ou montar do zero.</p>
      <button class="botao escuro cheio" data-acao="usar-modelo">Usar o modelo de 5 dias</button>
      <button class="botao fraco cheio" data-acao="plano-do-zero">Montar do zero</button>
      <button class="botao fraco cheio" data-acao="abrir-avaliacao">Avaliação com o personal (monta o programa para ti)</button>
    </section>
    <button class="atalho" data-acao="aba" data-aba="cardio"><span>${ICONE_CARDIO}<b>Cardio</b></span><span class="seta-dir" aria-hidden="true">›</span></button>`;
}

const ICONE_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>`;
const ICONE_FOGO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 3 2 3 4"/></svg>`;
const ICONE_PLAY = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>`;
const ICONE_HALTER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/></svg>`;
export const ICONE_CARDIO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>`;
const ICONE_SOBE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/></svg>`;
export const ICONE_ESTRELA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 16.5 5.5 21l2-7.5L2 9h7z"/></svg>`;
const ICONE_PLANO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10M4 12h16M4 18h7"/><circle cx="17" cy="6" r="2"/><circle cx="14" cy="18" r="2"/></svg>`;
const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function cartaoSemana() {
  const dias = semanaDeTreino(), feitos = dias.filter((d) => d.feito).length;
  const meta = Math.min(7, S.personal.avaliacao?.dias || T().plano.length || 3), seguidas = semanasSeguidas();
  return `
    <section class="semana-treino">
      <div class="cab-semana">
        <b>Esta semana <span>· ${feitos} de ${meta} ${meta === 1 ? "treino" : "treinos"}</span></b>
        ${seguidas >= 2 ? `<span class="selo-seguidas">${ICONE_FOGO}${seguidas} semanas seguidas</span>` : ""}
      </div>
      <ol class="bolinhas">${dias.map((d, k) => `
        <li class="${d.feito ? "feito" : d.hoje ? "hoje" : d.futuro ? "futuro" : ""}"><span>${SEMANA[k]}</span><i>${d.feito ? ICONE_CHECK : ""}</i></li>`).join("")}</ol>
    </section>`;
}

// O corpo com os músculos do dia: os de mais séries em coral, os outros em amarelo claro
const COSTAS_DIA = new Set(["costas", "posterior", "gluteos", "panturrilha", "triceps"]);
function corpoDoDia(dia) {
  if (!comCorpo()) return `<span class="avatar-carregando"></span>`;
  const gs = gruposDoDia(dia);
  if (!gs.length) return "";
  const topo = gs[0].series, peso = Object.fromEntries(gs.map((x) => [x.g, x.series >= topo * 0.6 ? "sel" : "ajuda"]));
  const atras = gs.filter((x) => COSTAS_DIA.has(x.g)).reduce((t, x) => t + x.series, 0), frente = gs.reduce((t, x) => t + x.series, 0) - atras;
  return svgCorpo(desenhar(atras > frente ? "back" : "front", hoje(), {}, { camada: (s) => peso[GRUPO_DE[s]] || "musculo" }),
    { cores: { sel: "#F27A68", ajuda: "#FCE6B0", musculo: "#FFF3D1" }, rotulo: `Músculos de ${dia.nome}` });
}

function cartaoProximo(prox) {
  const t = T(), k = t.plano.indexOf(prox), gs = gruposDoDia(prox), total = prox.ex.reduce((n, x) => n + x.series, 0);
  return `
    <section class="proximo-treino">
      <div class="prox-cab">
        <div>
          <small>Próximo · dia ${k + 1} de ${t.plano.length}</small>
          <h2>${esc(prox.nome)}</h2>
          <span class="prox-meta">${prox.ex.length ? `${plural(prox.ex.length, "exercício", "exercícios")} · ${plural(total, "série", "séries")} · ~${minutosEstimados(prox)} min` : "Ainda sem exercícios"}</span>
          ${gs.length ? `<span class="chips-musc">${gs.slice(0, 4).map((x, i) => `<span class="${i === 0 ? "principal" : "claro"}">${esc(GRUPOS[x.g])}</span>`).join("")}</span>` : ""}
        </div>
        ${gs.length ? `<div class="corpo-dia">${corpoDoDia(prox)}</div>` : ""}
      </div>
      ${linhaCardioDia(prox.id)}
      ${prox.ex.length ? `<button class="botao escuro cheio comecar" data-acao="comecar-treino" data-id="${esc(prox.id)}">${ICONE_PLAY}Começar treino</button>`
        : `<button class="botao escuro cheio" data-acao="editar-plano">Adicionar exercícios</button>`}
    </section>`;
}

function outrosTreinos(prox) {
  const t = T(), outros = t.plano.filter((d) => d !== prox);
  const barra = (d) => {
    const gs = gruposDoDia(d).slice(0, 3);
    return gs.map((x, i) => `<i class="${["c1", "c2", "c3"][i]}" style="flex:${x.series}"></i>`).join("");
  };
  return `
    <section class="bloco-treino outros-treinos">
      <div class="titulo-linha"><h2>Outros treinos</h2><button class="link" data-acao="editar-plano">Editar plano</button></div>
      <ul class="rolo">
        ${outros.map((d) => `<li><button data-acao="comecar-treino" data-id="${esc(d.id)}"><span class="barra-musc">${barra(d)}</span><b>${esc(d.nome)}</b><small>dia ${t.plano.indexOf(d) + 1} · ${plural(d.ex.length, "exercício", "exercícios")}</small></button></li>`).join("")}
        <li><button class="livre" data-acao="comecar-treino" data-id=""><span class="mais" aria-hidden="true">+</span><b>Treino livre</b><small>escolhe na hora</small></button></li>
      </ul>
    </section>`;
}

function cartaoCardio() {
  const p = planoCardio(), r = resumoCardio(), alvo = p ? 3 : 0;
  return `
    <button class="mini-cartao" data-acao="aba" data-aba="cardio">
      <span class="rotulo-mini">${ICONE_CARDIO}Cardio</span>
      <b class="grande">${r.sessoes}${alvo ? ` <span>de ${alvo}</span>` : ""}</b>
      ${alvo ? `<span class="tracos">${Array.from({ length: alvo }, (_, k) => `<i class="${k < r.sessoes ? "on" : ""}"></i>`).join("")}</span>` : ""}
      <small>${p ? "nos últimos 7 dias" : r.sessoes ? "nos últimos 7 dias, sem plano" : "monta um plano de cardio"}</small>
    </button>`;
}

// Linha simples do 1RM estimado: os pontos sem eixo, o último destacado
function linhaMini(pontos, w = 140, h = 38) {
  if (pontos.length < 2) return `<svg class="linha-mini" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="2" y1="${h - 4}" x2="${w - 2}" y2="${h - 4}"/></svg>`;
  const vs = pontos.map((p) => p.v), min = Math.min(...vs), max = Math.max(...vs), amp = max - min || 1;
  const xy = pontos.map((p, i) => [2 + (i * (w - 8)) / (pontos.length - 1), h - 4 - ((p.v - min) / amp) * (h - 10)]);
  const [ux, uy] = xy[xy.length - 1];
  return `<svg class="linha-mini" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="M${xy.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}"/><circle cx="${ux.toFixed(1)}" cy="${uy.toFixed(1)}" r="4"/></svg>`;
}

function cartaoProgresso() {
  const top = exerciciosFeitos(somaDias(hoje(), -90))[0], pts = top ? forcaDoExercicio(top.ex, somaDias(hoje(), -90)).slice(-12) : [];
  const rec = recordes(hoje(), 30).length;
  return `
    <button class="mini-cartao" data-acao="aba" data-aba="progresso">
      <span class="rotulo-mini">${ICONE_SOBE}Progresso</span>
      ${linhaMini(pts)}
      <small>${rec ? `<span class="estrela">${ICONE_ESTRELA}</span>${plural(rec, "recorde", "recordes")} no mês` : top ? esc(top.nome) : "aparece depois dos treinos"}</small>
    </button>`;
}

function ultimosTreinos() {
  const ss = T().sessoes.slice(-3).reverse();
  if (!ss.length) return "";
  return `
    <section class="bloco-treino ultimos">
      <div class="titulo-linha"><h2>Últimos treinos</h2>${T().sessoes.length > 3 ? `<button class="link" data-acao="aba" data-aba="historico">Ver todos</button>` : ""}</div>
      <ul class="caixa lista-sessoes">${ss.map(linhaSessao).join("")}</ul>
    </section>`;
}
export function linhaSessao(s) {
  const min = s.fim && s.ini ? Math.max(1, Math.round((s.fim - s.ini) / 60000)) : 0, pr = recordesDaSessao(s).length;
  const dt = paraData(s.d);
  return `<li><button data-acao="ver-sessao" data-id="${esc(s.id)}">
    <span class="data-sessao"><b>${dt.getDate()}</b><small>${dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</small></span>
    <span class="oque"><b>${esc(s.nome)}</b><small>${min ? `${min} min · ` : ""}${plural(totalSeries(s), "série", "séries")}</small></span>
    ${pr ? `<span class="selo-pr">${pr} PR</span>` : ""}</button></li>`;
}

function telaInicio() {
  const prox = proximoDia();
  return `
    ${cartaoSemana()}
    ${cartaoProximo(prox)}
    ${outrosTreinos(prox)}
    ${cartaoPersonalInicio()}
    <section class="par-cartoes">${cartaoCardio()}${cartaoProgresso()}</section>
    ${ultimosTreinos()}`;
}

// ---------- sessão ----------
// Um exercício por vez (mockup "Treino em andamento"): a série da vez com mais e menos, as feitas e as que faltam,
// o descanso logo abaixo e a lista do que vem depois.
// Simples (iniciante): carga, repetições e marcar. Completo: RIR, série principal com alvo, 1RM do dia e músculos que ajudam.
export const modoTreino = () => S.cfg.treinoDetalhe || (S.personal.avaliacao?.nivel === "iniciante" ? "simples" : "completo");

// Regiões de dor que um exercício usa: a dor ativa nelas abre a escala de dor durante a série
const REGIAO_GRUPOS = {
  joelho: ["quadriceps", "posterior", "gluteos", "panturrilha"], lombar: ["costas", "posterior", "gluteos", "quadriceps"],
  ombro: ["peito", "ombros", "costas", "triceps"], cotovelo: ["biceps", "triceps", "antebraco"], punho: ["biceps", "triceps", "antebraco", "peito"],
};
function doresDoExercicio(exId) {
  const g = exercicio(exId).g;
  return PONTOS_DOR.filter(([id, , , , , , les]) => les && REGIAO_GRUPOS[les]?.includes(g) && nivelDor(id) > 0);
}
function blocoDor(x, i) {
  const pontos = doresDoExercicio(x.ex);
  if (!pontos.length) return "";
  const [id, nome] = pontos.find((p) => p[0] === x.dor?.ponto) || pontos[0], n = x.dor?.ponto === id ? x.dor.n : null;
  const msg = n == null ? "Anote a dor durante a série." : n <= 2 ? "Até 2: segue normal. O personal acompanha a cada treino."
    : n <= 4 ? "Entre 3 e 4: diminua a carga ou a amplitude na próxima série." : "Acima de 4: pare este exercício hoje.";
  return `<div class="dor-serie">
    <b>${esc(nome)} durante a série</b>
    <div class="escala-dor" role="radiogroup" aria-label="Dor de 0 a 10">${Array.from({ length: 11 }, (_, k) =>
      `<button role="radio" aria-checked="${n === k}" data-acao="dor-serie" data-i="${i}" data-ponto="${id}" data-n="${k}">${k}</button>`).join("")}</div>
    <small>${msg}</small></div>`;
}
function ultimoMelhor(exId) {
  const ss = T().sessoes;
  for (let k = ss.length - 1; k >= 0; k--) { const y = ss[k].ex.find((z) => z.ex === exId); if (y?.series.length) return melhorDa(y.series); }
  return null;
}
const COSTAS = new Set(["costas", "posterior", "gluteos", "panturrilha", "triceps"]);
function miniCorpo(exId) {
  if (!comCorpo()) return `<span class="avatar-carregando"></span>`;
  const ms = musculosDo(exId), principal = ms[0]?.[0];
  if (!principal) return "";
  const peso = Object.fromEntries(ms);
  const camada = (s) => (GRUPO_DE[s] === principal ? "sel" : peso[GRUPO_DE[s]] ? "ajuda" : "musculo");
  return svgCorpo(desenhar(COSTAS.has(principal) ? "back" : "front", hoje(), {}, { camada }), { cores: { sel: "#F27A68", ajuda: "#F7CF6B", musculo: "#5B4853" }, rotulo: `Músculos de ${nomeEx(exId)}` });
}

// A série da vez: a primeira não marcada de um exercício
const daVez = (x) => x.series.findIndex((s) => !s.ok);
function exercicioAtual(a) {
  if (ui.exAtual != null && a.ex[ui.exAtual]) return ui.exAtual;
  const i = a.ex.findIndex((x) => daVez(x) >= 0);
  return i >= 0 ? i : Math.max(0, a.ex.length - 1);
}
// valores que a série da vez mostra antes de mexer: o que já foi digitado, o alvo, a última vez ou o mínimo da faixa
function valoresDaVez(x, j, sug) {
  const s = x.series[j], ant = sug.ultima?.series || [];
  const kg = s.kg !== "" && s.kg != null ? Number(s.kg) : Number(sug.kg) || 0;
  const reps = s.reps !== "" && s.reps != null ? Number(s.reps) : Number(s.alvoReps ?? ant[j]?.reps ?? x.min) || x.min;
  const rir = s.rir !== "" && s.rir != null ? Number(s.rir) : s.alvoRir ?? 2;
  return { kg, reps, rir };
}
const passo = (exId) => exercicio(exId).passo || 2.5;
const stepper = (campo, i, j, valor, rotulo, un = "") => `
  <div class="passo">
    <span>${rotulo}</span>
    <span class="passo-ctrl">
      <button data-acao="passo-serie" data-campo="${campo}" data-i="${i}" data-j="${j}" data-n="-1" aria-label="Menos ${rotulo.toLowerCase()}">−</button>
      <b>${valor}${un}</b>
      <button data-acao="passo-serie" data-campo="${campo}" data-i="${i}" data-j="${j}" data-n="1" aria-label="Mais ${rotulo.toLowerCase()}">+</button>
    </span>
  </div>`;

function serieDaVez(x, i, j, completo, sug) {
  const s = x.series[j], v = valoresDaVez(x, j, sug), principal = s.tipo === "principal";
  const titulo = principal ? "Série principal" : s.tipo === "recuo" ? `Recuo ${x.series.slice(0, j + 1).filter((z) => z.tipo === "recuo").length}` : `Série ${j + 1} de ${x.series.length}`;
  const alvo = principal && s.alvoReps ? `alvo: ${s.kg !== "" ? fmtKg(Number(s.kg)) + " × " : ""}${s.alvoReps}${completo ? `, sobrando ${s.alvoRir}` : ""}` : `faixa: ${x.min} a ${x.max}`;
  const um = completo && v.kg > 0 ? e1rm(v.kg, v.reps, v.rir) : 0, antes = um ? ultimoMelhor(x.ex) : null, dif = antes ? um - antes : 0;
  return `
    <div class="serie-vez">
      <div class="cab-vez"><b>${titulo}</b><small>${esc(alvo)}</small></div>
      <div class="passos ${completo ? "tres" : "dois"}">
        <div class="passo carga">
          <span>Carga</span>
          <span class="passo-ctrl">
            <button data-acao="passo-serie" data-campo="kg" data-i="${i}" data-j="${j}" data-n="-1" aria-label="Menos carga">−</button>
            <label><span class="so-leitor">Carga em kg</span><input type="number" inputmode="decimal" step="0.5" min="0" data-campo="kg" data-i="${i}" data-j="${j}" value="${v.kg || ""}" placeholder="0"></label>
            <button data-acao="passo-serie" data-campo="kg" data-i="${i}" data-j="${j}" data-n="1" aria-label="Mais carga">+</button>
          </span>
        </div>
        ${stepper("reps", i, j, v.reps, "Repetições")}
        ${completo ? stepper("rir", i, j, v.rir, "Sobraram (RIR)") : ""}
      </div>
      ${completo && um ? `<div class="um-rm"><span><small>1RM estimado ${principal ? "hoje" : "nesta série"}</small><b>${fmtKg(Math.round(um * 2) / 2)}</b></span>
        <span>${antes ? (Math.abs(dif) < 0.5 ? "igual ao último treino" : `${dif > 0 ? "+" : "−"}${fmtKg(Math.round(Math.abs(dif) * 2) / 2)} desde o último treino`) : "primeira vez"}</span></div>` : ""}
      <button class="botao escuro cheio" data-acao="marcar-serie" data-i="${i}" data-j="${j}">Feita</button>
    </div>`;
}

function linhaSerie(x, i, j, completo, vez) {
  const s = x.series[j];
  const txt = s.ok ? `${Number(s.kg) > 0 ? fmtKg(Number(s.kg)) + " × " : ""}${s.reps}`
    : `${s.kg !== "" && Number(s.kg) > 0 ? fmtKg(Number(s.kg)) + " × " : ""}${s.alvoReps ?? `${x.min} a ${x.max}`}`;
  const estado = s.ok ? `feita${completo && s.rir !== "" && s.rir != null ? ` · sobraram ${s.rir}` : ""}` : j === vez + 1 ? "depois do descanso" : "";
  return `<li><button class="linha-serie ${s.ok ? "ok" : ""}" ${s.ok ? `data-acao="marcar-serie" data-i="${i}" data-j="${j}" aria-label="Desmarcar a série ${j + 1}"` : `data-acao="serie-vez" data-i="${i}" data-j="${j}"`}>
    <span class="bola">${s.ok ? ICONE.feito : completo && s.tipo === "principal" ? "P" : j + 1}</span><b>${txt}</b><small>${estado}</small></button></li>`;
}

function cartaoExercicio(a, i, completo) {
  const x = a.ex[i], sug = sugerir(x.ex, x.min, x.max), princ = x.series.some((s) => s.tipo === "principal");
  const ms = musculosDo(x.ex), vez = ui.serieVez?.i === i && x.series[ui.serieVez.j] && !x.series[ui.serieVez.j].ok ? ui.serieVez.j : daVez(x);
  const rotulo = princ ? "Força · série principal + recuo" : ehComposto(x.ex) ? "Composto" : "Isolado";
  const feitas = x.series.map((_, j) => j).filter((j) => j !== vez);
  return `
    <section class="caixa ex-atual">
      <div class="ex-cab">
        <div>
          ${completo ? `<small class="rotulo-ex">${esc(rotulo)}</small>` : ""}
          <h2>${esc(x.nome)}</h2>
          <span class="chips-musc">${ms.length ? `<span class="principal">${esc(GRUPOS[ms[0][0]])}</span>` : ""}${completo ? ms.slice(1).map(([g]) => `<span>${esc(GRUPOS[g])}</span>`).join("") : ""}</span>
          ${completo && (princ ? sugerirPrincipal(x.ex, x.min).motivo : sug.motivo) ? `<p class="sugestao">${esc(princ ? sugerirPrincipal(x.ex, x.min).motivo : sug.motivo)}</p>` : ""}
        </div>
        <div class="mini-corpo">${miniCorpo(x.ex)}</div>
      </div>
      ${vez >= 0 ? serieDaVez(x, i, vez, completo, sug) : `<p class="tudo-feito">${ICONE.feito}Todas as séries feitas</p>`}
      ${feitas.length ? `<ol class="lista-series">${feitas.map((j) => linhaSerie(x, i, j, completo, vez)).join("")}</ol>` : ""}
      ${blocoDor(x, i)}
      <div class="acoes-ex">
        <button class="link" data-acao="mais-serie" data-i="${i}">Mais uma série</button>
        ${x.series.length > 1 ? `<button class="link" data-acao="menos-serie" data-i="${i}">Tirar a última</button>` : ""}
        <button class="link fraco" data-acao="tirar-ex-sessao" data-i="${i}">Tirar exercício</button>
      </div>
    </section>`;
}

function telaSessao(a) {
  const completo = modoTreino() === "completo", atual = exercicioAtual(a);
  const outros = a.ex.map((x, i) => ({ x, i })).filter(({ i }) => i !== atual);
  const pendentes = outros.filter(({ x }) => daVez(x) >= 0), prontos = outros.filter(({ x }) => daVez(x) < 0);
  const item = ({ x, i }) => {
    const feitas = x.series.filter((s) => s.ok).length;
    return `<li><button data-acao="ex-atual" data-i="${i}"><span><b>${esc(x.nome)}</b>${feitas && feitas < x.series.length ? `<small>${feitas} de ${x.series.length} séries feitas</small>` : ""}</span>
      ${daVez(x) < 0 ? `<span class="ok-ex">${ICONE.feito}</span>` : `<b>${x.series.length} × ${x.series[0]?.alvoReps ?? x.min}${x.series[0]?.alvoReps ? "" : x.max !== x.min ? ` a ${x.max}` : ""}</b>`}</button></li>`;
  };
  return `
    <div class="segmentos" role="radiogroup" aria-label="Quanto detalhe mostrar no treino">
      <button role="radio" data-acao="detalhe-treino" data-v="simples" aria-checked="${!completo}" aria-selected="${!completo}">Simples</button>
      <button role="radio" data-acao="detalhe-treino" data-v="completo" aria-checked="${completo}" aria-selected="${completo}">Completo</button>
    </div>
    ${emRecuperacao() ? `<p class="bloco-status deload">Semana de recuperação: as séries e cargas já vieram reduzidas.</p>` : ""}
    ${a.ex.length ? cartaoExercicio(a, atual, completo) : `<section class="caixa"><p class="vazio">Nenhum exercício ainda.</p></section>`}
    <div id="descanso-cartao">${cartaoDescanso()}</div>
    ${pendentes.length ? `<section class="secao lista-depois"><h2>Depois</h2><ul>${pendentes.map(item).join("")}</ul></section>` : ""}
    ${prontos.length ? `<section class="secao lista-depois"><h2>Feitos</h2><ul>${prontos.map(item).join("")}</ul></section>` : ""}
    <section class="secao">
      <button class="botao fraco cheio" data-acao="abrir-biblioteca" data-para="sessao">Adicionar exercício</button>
    </section>
    ${secaoCardioSessao(a)}
    <section class="secao fim-sessao">
      <button class="botao escuro cheio" data-acao="concluir-treino">Terminar o treino</button>
      <button class="botao perigo cheio" data-acao="descartar-treino">Descartar</button>
    </section>`;
}

// ---------- plano ----------
// Mockup "Editar plano": cada dia é um cartão que abre; o exercício aberto mostra séries e repetições com mais e
// menos, trocar, tirar e a ordem. O que muda fica salvo na hora.
const faixa = (x) => `${x.series} × ${x.min === x.max ? x.min : `${x.min}–${x.max}`}`;
const passoPlano = (campo, i, j, valor, rotulo) => `
  <div class="passo">
    <span>${rotulo}</span>
    <span class="passo-ctrl">
      <button data-acao="passo-plano" data-campo="${campo}" data-i="${i}" data-j="${j}" data-n="-1" aria-label="Menos: ${rotulo.toLowerCase()}">−</button>
      <b>${valor}</b>
      <button data-acao="passo-plano" data-campo="${campo}" data-i="${i}" data-j="${j}" data-n="1" aria-label="Mais: ${rotulo.toLowerCase()}">+</button>
    </span>
  </div>`;

function linhaExPlano(d, i, x, j) {
  const aberto = ui.exPlano === `${i}:${j}`, ms = musculosDo(x.ex);
  const musc = ms.map(([g]) => GRUPOS[g]).slice(0, 2).join(", ");
  return `
    <li class="${aberto ? "aberto" : ""}">
      <button class="ex-plano" data-acao="abrir-ex-plano" data-i="${i}" data-j="${j}" aria-expanded="${aberto}">
        <span class="oque"><b>${esc(nomeEx(x.ex))}</b>${musc ? `<small>${esc(musc)}</small>` : ""}</span>
        <span class="pilula">${faixa(x)}</span>
      </button>
      ${aberto ? `
      <div class="ajuste-ex">
        <div class="passos tres">
          ${passoPlano("series", i, j, x.series, "Séries")}
          ${passoPlano("min", i, j, x.min, "Reps mín.")}
          ${passoPlano("max", i, j, x.max, "Reps máx.")}
        </div>
        <div class="acoes-ex">
          <button class="mini" data-acao="mover-ex" data-i="${i}" data-j="${j}" data-n="-1" aria-label="Subir o exercício" ${j === 0 ? "disabled" : ""}>${ICONE.cima}</button>
          <button class="mini" data-acao="mover-ex" data-i="${i}" data-j="${j}" data-n="1" aria-label="Descer o exercício" ${j === d.ex.length - 1 ? "disabled" : ""}>${ICONE.baixo}</button>
          <button class="link" data-acao="abrir-biblioteca" data-para="trocar" data-i="${i}" data-j="${j}">Trocar exercício</button>
          <button class="link perigo" data-acao="tirar-ex" data-i="${i}" data-j="${j}">Tirar do dia</button>
        </div>
      </div>` : ""}
    </li>`;
}

function cartaoDia(d, i, n) {
  const aberto = ui.diaPlano === i, gs = gruposDoDia(d).slice(0, 3);
  const barra = gs.map((x, k) => `<i class="${["c1", "c2", "c3"][k]}" style="flex:${x.series}"></i>`).join("");
  if (!aberto) return `
    <li class="dia-cartao">
      <button class="cab-dia" data-acao="abrir-dia" data-i="${i}" aria-expanded="false">
        <span class="num">${i + 1}</span>
        <span class="oque"><b>${esc(d.nome)}</b><span class="barra-musc">${barra}</span></span>
        <small>${d.ex.length} exerc.</small>${ICONE.baixo}
      </button>
    </li>`;
  return `
    <li class="dia-cartao aberto">
      <div class="cab-dia">
        <span class="num">${i + 1}</span>
        <label class="nome-dia"><span class="so-leitor">Nome do dia ${i + 1}</span><input data-campo="nome-dia" data-i="${i}" value="${esc(d.nome)}" maxlength="40"></label>
        <button class="mini" data-acao="abrir-dia" data-i="${i}" aria-expanded="true" aria-label="Fechar o dia">${ICONE.cima}</button>
      </div>
      ${d.ex.length ? `<ul class="exs-plano">${d.ex.map((x, j) => linhaExPlano(d, i, x, j)).join("")}</ul>` : `<p class="vazio">Nenhum exercício neste dia.</p>`}
      <button class="tracejado" data-acao="abrir-biblioteca" data-para="plano" data-i="${i}">+ Adicionar exercício</button>
      <div class="acoes-ex">
        <button class="mini" data-acao="mover-dia" data-i="${i}" data-n="-1" aria-label="Subir o dia" ${i === 0 ? "disabled" : ""}>${ICONE.cima}</button>
        <button class="mini" data-acao="mover-dia" data-i="${i}" data-n="1" aria-label="Descer o dia" ${i === n - 1 ? "disabled" : ""}>${ICONE.baixo}</button>
        <button class="link perigo" data-acao="apagar-dia" data-i="${i}">Apagar dia</button>
      </div>
    </li>`;
}

function telaPlano() {
  const t = T();
  return `
    <ol class="dias-plano">${t.plano.map((d, i) => cartaoDia(d, i, t.plano.length)).join("")}</ol>
    <button class="tracejado grande" data-acao="novo-dia">+ Adicionar dia</button>`;
}

export const telaTreino = {
  titulo() {
    const a = S.treino?.atual;
    if (a) return a.nome;
    return ui.treino === "plano" && temPlano() ? "Plano de treino" : "Treino";
  },
  // treino em andamento: botão de sair (o treino continua aberto), tempo e exercício no subtítulo, Terminar à direita.
  // Editor do plano: voltar, "N dias · rodam nesta ordem" e Pronto. Início: o botão redondo do plano.
  voltar() { return S.treino?.atual ? { aba: "hoje", rotulo: "Sair do treino (ele continua aberto)" } : ui.treino === "plano" && temPlano() ? { acao: "fechar-plano", rotulo: "Voltar ao treino" } : null; },
  sub() {
    const a = S.treino?.atual;
    if (!a) return ui.treino === "plano" && temPlano() ? `${plural(T().plano.length, "dia", "dias")} · rodam nesta ordem` : "";
    const min = Math.max(0, Math.round((Date.now() - a.ini) / 60000));
    return a.ex.length ? `${min} min · exercício ${exercicioAtual(a) + 1} de ${a.ex.length}` : `${min} min`;
  },
  direita() {
    if (S.treino?.atual) return `<button class="botao-topo" data-acao="concluir-treino">Terminar</button>`;
    if (!temPlano()) return "";
    return ui.treino === "plano" ? `<button class="botao-topo" data-acao="fechar-plano">Pronto</button>`
      : `<button class="redondo" data-acao="editar-plano" aria-label="Editar plano">${ICONE_PLANO}</button>`;
  },
  html() {
    const a = S.treino?.atual;
    if (a) return telaSessao(a);
    if (!temPlano()) return telaVazia();
    return ui.treino === "plano" ? telaPlano() : telaInicio();
  },
};

// ---------- folhas ----------
FOLHAS.biblioteca = (f) => {
  const porGrupo = {};
  for (const x of biblioteca()) (porGrupo[x.g] ||= []).push(x);
  const grupos = [...Object.keys(GRUPOS), ""].filter((g) => porGrupo[g]);
  return `
    <h2 id="folha-titulo">Adicionar exercício</h2>
    <input id="busca-ex" type="search" placeholder="Buscar, por exemplo: supino" autocomplete="off" aria-label="Buscar exercício">
    <div id="lista-biblioteca">
      ${grupos.map((g) => `
        <div class="grupo">
          <h3>${GRUPOS[g] || "Teus exercícios"}</h3>
          <ul class="linhas">${porGrupo[g].map((x) => `<li data-nome="${esc(x.nome.toLowerCase())}"><button data-acao="escolher-ex" data-id="${esc(x.id)}"><span>${esc(x.nome)}</span></button></li>`).join("")}</ul>
        </div>`).join("")}
    </div>
    <form class="bloco" data-form="criar-ex">
      <h3>Não achou? Cria o teu</h3>
      <label class="campo"><span>Nome</span><input name="nome" required maxlength="60" autocomplete="off"></label>
      <label class="campo"><span>Grupo muscular</span>
        <select name="g">${Object.entries(GRUPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <button class="botao fraco cheio">Criar e adicionar</button>
    </form>`;
};

function adicionarEscolhido(exId) {
  const f = ui.folha;
  if (f.para === "sessao") addExNaSessao(exId);
  else if (f.para === "trocar") {
    const x = T().plano[f.i]?.ex[f.j];
    if (x) { const de = x.ex; x.ex = exId; salvar(); fecharFolha(); render(); avisar(`${nomeEx(de)} trocado por ${nomeEx(exId)}`); }
    return;
  } else { T().plano[f.i]?.ex.push({ ex: exId, series: 3, min: 8, max: 12 }); ui.diaPlano = f.i; salvar(); }
  fecharFolha(); render();
  avisar(`${nomeEx(exId)} adicionado`);
}

// Botão que pede um segundo toque antes de apagar
function confirmar(b, texto) {
  if (b.dataset.certeza) return true;
  b.dataset.certeza = "1"; b.textContent = texto;
  return false;
}

// ---------- ações ----------
Object.assign(ACOES, {
  "usar-modelo"() { usarModelo(); ui.treino = "inicio"; render(); avisar("Modelo de 5 dias criado. Ajusta em Editar plano"); },
  "plano-do-zero"() { addDia(); ui.treino = "plano"; ui.diaPlano = 0; render(); },
  "editar-plano"() { ui.treino = "plano"; ui.diaPlano = T().plano.indexOf(proximoDia()); ui.exPlano = null; ui.aba = "treino"; render(); window.scrollTo(0, 0); },
  "fechar-plano"() { ui.treino = "inicio"; render(); window.scrollTo(0, 0); },
  "novo-dia"() { addDia(); ui.diaPlano = T().plano.length - 1; ui.exPlano = null; render(); },
  "abrir-dia"(b) { const i = Number(b.dataset.i); ui.diaPlano = ui.diaPlano === i ? null : i; ui.exPlano = null; render(); },
  "abrir-ex-plano"(b) { const k = `${b.dataset.i}:${b.dataset.j}`; ui.exPlano = ui.exPlano === k ? null : k; render(); },
  "passo-plano"(b) {
    const x = T().plano[b.dataset.i]?.ex[b.dataset.j], c = b.dataset.campo, n = Number(b.dataset.n);
    if (!x) return;
    x[c] = Math.min(c === "series" ? 10 : 50, Math.max(1, x[c] + n));
    if (x.max < x.min) { if (c === "min") x.max = x.min; else x.min = x.max; }
    salvar(); render();
  },
  "apagar-dia"(b) {
    if (!confirmar(b, "Apagar mesmo?")) return;
    T().plano.splice(Number(b.dataset.i), 1); ui.diaPlano = null; ui.exPlano = null; salvar();
    render();
  },
  "mover-dia"(b) {
    const i = Number(b.dataset.i), n = Number(b.dataset.n);
    mover(T().plano, i, n); if (ui.diaPlano === i) ui.diaPlano = Math.min(T().plano.length - 1, Math.max(0, i + n)); render();
  },
  "mover-ex"(b) {
    const i = Number(b.dataset.i), j = Number(b.dataset.j), n = Number(b.dataset.n), lista = T().plano[i].ex;
    mover(lista, j, n); if (ui.exPlano === `${i}:${j}`) ui.exPlano = `${i}:${Math.min(lista.length - 1, Math.max(0, j + n))}`; render();
  },
  "tirar-ex"(b) {
    if (!confirmar(b, "Tirar mesmo?")) return;
    T().plano[b.dataset.i].ex.splice(Number(b.dataset.j), 1); ui.exPlano = null; salvar(); render();
  },

  "abrir-biblioteca"(b) { abrirFolha({ tipo: "biblioteca", para: b.dataset.para, i: Number(b.dataset.i), j: Number(b.dataset.j) }); },
  "escolher-ex"(b) { adicionarEscolhido(b.dataset.id); },

  "comecar-treino"(b) { iniciar(b.dataset.id); ui.treino = "inicio"; ui.exAtual = null; ui.serieVez = null; render(); window.scrollTo(0, 0); },
  "marcar-serie"(b) {
    const a = T().atual, i = Number(b.dataset.i), j = Number(b.dataset.j), x = a.ex[i], s = x.series[j];
    if (s.ok) { s.ok = false; ui.serieVez = { i, j }; ui.exAtual = i; salvar(); render(); return; }
    const v = valoresDaVez(x, j, sugerir(x.ex, x.min, x.max));
    if (!(v.reps > 0)) { avisar("Coloque as repetições desta série"); return; }
    s.kg = v.kg; s.reps = v.reps; s.ok = true;
    s.rir = modoTreino() === "completo" ? v.rir : s.rir ?? "";
    // a principal define o recuo: 10% mais leve; nas outras séries, a carga segue a da série anterior
    if (s.tipo === "principal") { for (const r of x.series) if (r.tipo === "recuo" && !r.ok) r.kg = cargaRecuo(v.kg, passo(x.ex)); }
    else for (const depois of x.series.slice(j + 1)) if (!depois.ok && depois.kg === "") depois.kg = v.kg;
    ui.serieVez = null;
    // acabou o exercício: o próximo que ainda tem série vira o da vez
    if (daVez(x) < 0) { const prox = a.ex.findIndex((y, k) => k > i && daVez(y) >= 0); const qualquer = a.ex.findIndex((y) => daVez(y) >= 0); ui.exAtual = prox >= 0 ? prox : qualquer >= 0 ? qualquer : i; }
    salvar(); render();
    // descanso, salvo depois da última série do treino
    const fim = a.ex.every((y) => y.series.every((z) => z.ok));
    if (!fim) iniciarDescanso(x.ex, s);
  },
  "passo-serie"(b) {
    const i = Number(b.dataset.i), j = Number(b.dataset.j), x = T().atual?.ex[i], s = x?.series[j];
    if (!s) return;
    const v = valoresDaVez(x, j, sugerir(x.ex, x.min, x.max)), n = Number(b.dataset.n), c = b.dataset.campo;
    if (c === "kg") s.kg = Math.max(0, Math.round((v.kg + n * passo(x.ex)) * 100) / 100);
    else if (c === "reps") s.reps = Math.max(1, v.reps + n);
    else s.rir = Math.min(10, Math.max(0, v.rir + n));
    // o valor mostrado passa a ser o digitado: guarda também os outros dois
    if (s.kg === "" || s.kg == null) s.kg = v.kg;
    if (s.reps === "" || s.reps == null) s.reps = v.reps;
    salvar(); render();
  },
  "serie-vez"(b) { ui.serieVez = { i: Number(b.dataset.i), j: Number(b.dataset.j) }; render(); },
  "ex-atual"(b) { ui.exAtual = Number(b.dataset.i); ui.serieVez = null; render(); window.scrollTo(0, 0); },
  "mais-serie"(b) {
    const x = T().atual.ex[b.dataset.i], ult = x.series[x.series.length - 1];
    x.series.push({ kg: ult?.kg ?? "", reps: "", rir: "", ok: false });
    salvar(); render();
  },
  "menos-serie"(b) { T().atual.ex[b.dataset.i].series.pop(); salvar(); render(); },
  "tirar-ex-sessao"(b) {
    if (!confirmar(b, "Tirar mesmo?")) return;
    T().atual.ex.splice(Number(b.dataset.i), 1); ui.exAtual = null; ui.serieVez = null; salvar(); render();
  },
  "concluir-treino"() {
    const a = T().atual;
    if (!a.ex.some((x) => x.series.some((s) => s.ok)) && !a.cardio) return avisar("Marca pelo menos uma série ou registra o cardio, ou descarta o treino");
    const s = concluir();
    ui.descanso = null; ui.exAtual = null; ui.serieVez = null;
    // com séries feitas, abre o resumo do treino (mockup "Fim do treino"); só cardio volta ao início
    if (s) { ui.resumo = { id: s.id, novo: true }; ui.aba = "resumo"; ui.volta = null; }
    render(); window.scrollTo(0, 0);
    if (!s) avisar("Cardio salvo");
  },
  "descartar-treino"(b) {
    if (!confirmar(b, "Descartar mesmo?")) return;
    descartar(); render(); window.scrollTo(0, 0);
  },

  "detalhe-treino"(b) { S.cfg.treinoDetalhe = b.dataset.v; salvar(); render(); },
  "dor-serie"(b) {
    const x = T().atual?.ex[Number(b.dataset.i)];
    if (!x) return;
    x.dor = { ponto: b.dataset.ponto, n: Number(b.dataset.n) };
    salvar(); render();
  },
});

FORMS["criar-ex"] = (form) => {
  const f = new FormData(form);
  adicionarEscolhido(criarExercicio(f.get("nome"), f.get("g")));
};

// Campos que salvam ao mudar, sem redesenhar a tela (para não perder o foco)
MUDANCAS.push((el) => {
  const campo = el.dataset?.campo;
  if (!["kg", "reps", "rir", "nome-dia", "series", "min", "max"].includes(campo)) return false;
  const t = T(), i = Number(el.dataset.i), j = Number(el.dataset.j);
  if (campo === "kg" || campo === "reps" || campo === "rir") {
    const s = t.atual?.ex[i]?.series[j];
    if (!s) return true;
    s[campo] = el.value === "" ? "" : campo === "kg" ? Math.max(0, lerNum(el.value)) : Math.max(0, Math.round(lerNum(el.value)));
  } else if (campo === "nome-dia") {
    t.plano[i].nome = el.value.trim() || `Treino ${i + 1}`;
  } else {
    const x = t.plano[i]?.ex[j];
    if (!x) return true;
    const limite = campo === "series" ? 10 : 50;
    x[campo] = Math.min(limite, Math.max(1, Math.round(lerNum(el.value)) || 1));
    if (x.max < x.min) { if (campo === "min") x.max = x.min; else x.min = x.max; }
    // acerta os campos na tela sem redesenhar, para o toque no campo seguinte não se perder
    for (const c of ["series", "min", "max"]) $(`[data-campo=${c}]`, el.closest("li")).value = x[c];
  }
  salvar();
  return true;
});

// Busca na biblioteca: esconde o que não bate, sem redesenhar
document.addEventListener("input", (e) => {
  if (e.target.id !== "busca-ex") return;
  const termo = e.target.value.trim().toLowerCase();
  const sem = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const li of document.querySelectorAll("#lista-biblioteca li")) li.hidden = !sem(li.dataset.nome).includes(sem(termo));
  for (const g of document.querySelectorAll("#lista-biblioteca .grupo")) g.hidden = !g.querySelector("li:not([hidden])");
});
