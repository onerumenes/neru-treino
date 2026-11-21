// Telas do treino: início (próximo treino e histórico), sessão em andamento e editor do plano.

import { S, salvar, hoje } from "./store.js";
import { $, esc, int, lerNum, dataCurta, ui, ACOES, FORMS, FOLHAS, MUDANCAS, ICONE, render, avisar, abrirFolha, fecharFolha } from "./base.js";
import {
  T, GRUPOS, temPlano, usarModelo, nomeEx, biblioteca, criarExercicio, diaDoPlano, addDia, mover,
  sugerir, resumoSeries, fmtKg, proximoDia, iniciar, addExNaSessao, concluir, descartar, removerSessao,
  volume, totalSeries, evolucao,
} from "./treino.js";
import { secaoPersonal, iniciarDescanso, cartaoDescanso } from "./tela-personal.js";
import { emRecuperacao, sugerirPrincipal, cargaRecuo, e1rm, melhorDa, ehComposto } from "./personal.js";
import { musculosDo } from "./musculos.js";
import { svgCorpo } from "./avatar.js";
import { comCorpo, desenhar } from "./tela-perfil.js";
import { GRUPO_DE } from "./tela-treino-corpo.js";
import { PONTOS_DOR, nivelDor } from "./corpo.js";
import { exercicio } from "./treino.js";
import { secaoCardio, secaoCardioSessao, linhaCardioDia } from "./tela-cardio.js";
import { descreverCardio } from "./cardio.js";

const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// ---------- início ----------
function telaVazia() {
  return `
    <div class="sem-chave">
      <h2>Monta teu plano de treino</h2>
      <p>O app guarda tuas séries e cargas e sugere quanto carregar na próxima vez. Dá para começar por um modelo de 5 dias e trocar o que quiser, ou montar do zero.</p>
      <div class="par botoes">
        <button class="botao" data-acao="usar-modelo">Usar o modelo de 5 dias</button>
        <button class="botao fraco" data-acao="plano-do-zero">Montar do zero</button>
      </div>
      <button class="botao fraco cheio" data-acao="abrir-avaliacao" style="margin-top:10px">Avaliação com o personal (monta o programa para ti)</button>
    </div>
    ${secaoCardio()}`;
}

function telaInicio() {
  const t = T(), prox = proximoDia(), outros = t.plano.filter((d) => d.id !== prox.id);
  const historico = t.sessoes.slice(-12).reverse();
  return `
    <section class="proximo">
      <p class="texto">Pela ordem do plano, o próximo é</p>
      <h2>${esc(prox.nome)}</h2>
      ${prox.ex.length ? `<ul class="lista-ex">${prox.ex.map((x) => `
        <li><span class="oque">${esc(nomeEx(x.ex))}</span><span class="pts"></span><b>${x.series} × ${x.min} a ${x.max}</b></li>`).join("")}</ul>`
      : `<p class="vazio">Este dia ainda não tem exercícios. Adiciona em Editar plano.</p>`}
      ${linhaCardioDia(prox.id)}
      <button class="botao cheio" data-acao="comecar-treino" data-id="${esc(prox.id)}">Começar treino</button>
      <button class="botao fraco cheio treino-corpo" data-acao="aba" data-aba="corpotreino">Treino no corpo: estímulo, recuperação e força</button>
    </section>

    ${secaoPersonal()}

    ${secaoCardio()}

    <section class="secao">
      <h2>Outro treino</h2>
      <ul class="linhas">
        ${outros.map((d) => `<li><button data-acao="comecar-treino" data-id="${esc(d.id)}"><span>${esc(d.nome)}</span><small>${plural(d.ex.length, "exercício", "exercícios")}</small></button></li>`).join("")}
        <li><button data-acao="comecar-treino" data-id=""><span>Treino livre</span><small>escolhe os exercícios na hora</small></button></li>
      </ul>
      <button class="botao fraco cheio" data-acao="editar-plano">Editar plano</button>
    </section>

    ${secaoCargas()}

    <section class="secao">
      <h2>Histórico</h2>
      ${historico.length ? `<ul class="linhas">${historico.map((s) => `
        <li><button data-acao="ver-sessao" data-id="${esc(s.id)}"><span>${esc(s.nome)}</span><small>${dataCurta(s.d)}, ${plural(totalSeries(s), "série", "séries")}</small></button></li>`).join("")}</ul>`
      : `<p class="vazio">Teus treinos concluídos aparecem aqui.</p>`}
    </section>`;
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
function telaPlano() {
  const t = T();
  const mini = (acao, i, j, n, icone, rotulo, desligado) =>
    `<button class="mini" data-acao="${acao}" data-i="${i}" ${j == null ? "" : `data-j="${j}"`} data-n="${n}" aria-label="${rotulo}" ${desligado ? "disabled" : ""}>${icone}</button>`;
  return `
    <p class="texto">Os dias rodam nesta ordem. O que mudares aqui fica salvo na hora.</p>
    ${t.plano.map((d, i) => `
      <section class="dia-plano">
        <div class="cab">
          <input data-campo="nome-dia" data-i="${i}" value="${esc(d.nome)}" maxlength="40" aria-label="Nome do dia ${i + 1}">
          ${mini("mover-dia", i, null, -1, ICONE.cima, "Subir o dia", i === 0)}
          ${mini("mover-dia", i, null, 1, ICONE.baixo, "Descer o dia", i === t.plano.length - 1)}
        </div>
        <ul>
          ${d.ex.map((x, j) => `
            <li>
              <span class="nome">${esc(nomeEx(x.ex))}</span>
              <div class="ajuste">
                <label><input type="number" inputmode="numeric" min="1" max="10" data-campo="series" data-i="${i}" data-j="${j}" value="${x.series}" aria-label="Séries"><small>séries</small></label>
                <label><input type="number" inputmode="numeric" min="1" max="50" data-campo="min" data-i="${i}" data-j="${j}" value="${x.min}" aria-label="Repetições mínimas"><small>mín</small></label>
                <label><input type="number" inputmode="numeric" min="1" max="50" data-campo="max" data-i="${i}" data-j="${j}" value="${x.max}" aria-label="Repetições máximas"><small>máx</small></label>
                ${mini("mover-ex", i, j, -1, ICONE.cima, "Subir o exercício", j === 0)}
                ${mini("mover-ex", i, j, 1, ICONE.baixo, "Descer o exercício", j === d.ex.length - 1)}
                <button class="mini tirar-x" data-acao="tirar-ex" data-i="${i}" data-j="${j}" aria-label="Tirar ${esc(nomeEx(x.ex))} do dia">×</button>
              </div>
            </li>`).join("")}
        </ul>
        <div class="acoes-ex">
          <button class="link" data-acao="abrir-biblioteca" data-para="plano" data-i="${i}">Adicionar exercício</button>
          <button class="link fraco" data-acao="apagar-dia" data-i="${i}">Apagar dia</button>
        </div>
      </section>`).join("")}
    <button class="botao fraco cheio" data-acao="novo-dia">Adicionar dia</button>
    <button class="botao cheio" data-acao="fechar-plano">Concluir edição</button>`;
}

export const telaTreino = {
  titulo() {
    const a = S.treino?.atual;
    if (a) return a.nome;
    return ui.treino === "plano" && temPlano() ? "Plano de treino" : "Treino";
  },
  // treino em andamento: botão de sair (o treino continua aberto), tempo e exercício no subtítulo, Terminar à direita
  voltar() { return S.treino?.atual ? { aba: "hoje", rotulo: "Sair do treino (ele continua aberto)" } : ui.treino === "plano" && temPlano() ? { acao: "fechar-plano", rotulo: "Voltar ao treino" } : null; },
  sub() {
    const a = S.treino?.atual;
    if (!a) return "";
    const min = Math.max(0, Math.round((Date.now() - a.ini) / 60000));
    return a.ex.length ? `${min} min · exercício ${exercicioAtual(a) + 1} de ${a.ex.length}` : `${min} min`;
  },
  direita() { return S.treino?.atual ? `<button class="botao-topo" data-acao="concluir-treino">Terminar</button>` : ""; },
  html() {
    const a = S.treino?.atual;
    if (a) return telaSessao(a);
    if (!temPlano()) return telaVazia();
    return ui.treino === "plano" ? telaPlano() : telaInicio();
  },
};

// Seção "Cargas" da tela inicial do treino
export function secaoCargas() {
  const lista = evolucao();
  if (!lista.length) return "";
  return `
    <section class="secao">
      <h2>Cargas</h2>
      <ul class="cargas">
        ${lista.map((r) => {
          const delta = r.ultimo.kg - r.primeiro.kg;
          const mudou = r.vezes > 1 && delta !== 0 ? `<small class="${delta > 0 ? "subiu" : "desceu"}">${delta > 0 ? "+" : "−"}${fmtKg(Math.abs(delta))}</small>` : "";
          return `<li><span class="oque">${esc(r.nome)}</span><span class="pts"></span><b>${r.ultimo.kg > 0 ? fmtKg(r.ultimo.kg) + " × " : ""}${r.ultimo.reps}</b>${mudou}</li>`;
        }).join("")}
      </ul>
      <p class="legenda"><span>Melhor série do último treino de cada exercício, e a diferença de carga desde o primeiro registro.</span></p>
    </section>`;
}

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

FOLHAS.sessao = (f) => {
  const s = T().sessoes.find((x) => x.id === f.id);
  if (!s) return "";
  const min = s.fim && s.ini ? Math.max(1, Math.round((s.fim - s.ini) / 60000)) : 0;
  const cardio = T().cardio.find((c) => c.sessao === s.id);
  return `
    <h2 id="folha-titulo">${esc(s.nome)}</h2>
    <p class="texto">${dataCurta(s.d)}${min ? `, ${min} min` : ""}, ${plural(totalSeries(s), "série", "séries")}, ${int(volume(s))} kg de volume${s.folego ? `, fôlego ${s.folego} de 5` : ""}</p>
    <ul class="lista-ex">
      ${s.ex.map((x) => `<li><span class="oque">${esc(x.nome)}</span><span class="pts"></span><b>${esc(resumoSeries(x.series))}</b></li>`).join("")}
    </ul>
    ${cardio ? `<p class="texto">Cardio: ${esc(descreverCardio(cardio))}.</p>` : ""}
    <button class="botao perigo cheio" data-acao="excluir-sessao" data-id="${esc(s.id)}">Excluir treino</button>`;
};

function adicionarEscolhido(exId) {
  const f = ui.folha;
  if (f.para === "sessao") addExNaSessao(exId);
  else { T().plano[f.i]?.ex.push({ ex: exId, series: 3, min: 8, max: 12 }); salvar(); }
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
  "plano-do-zero"() { addDia(); ui.treino = "plano"; render(); },
  "editar-plano"() { ui.treino = "plano"; render(); window.scrollTo(0, 0); },
  "fechar-plano"() { ui.treino = "inicio"; render(); window.scrollTo(0, 0); },
  "novo-dia"() { addDia(); render(); },
  "apagar-dia"(b) {
    if (!confirmar(b, "Apagar mesmo?")) return;
    T().plano.splice(Number(b.dataset.i), 1); salvar();
    render();
  },
  "mover-dia"(b) { mover(T().plano, Number(b.dataset.i), Number(b.dataset.n)); render(); },
  "mover-ex"(b) { mover(T().plano[b.dataset.i].ex, Number(b.dataset.j), Number(b.dataset.n)); render(); },
  "tirar-ex"(b) { T().plano[b.dataset.i].ex.splice(Number(b.dataset.j), 1); salvar(); render(); },

  "abrir-biblioteca"(b) { abrirFolha({ tipo: "biblioteca", para: b.dataset.para, i: Number(b.dataset.i) }); },
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
    const comCardio = !!a.cardio, s = concluir();
    render(); window.scrollTo(0, 0);
    avisar(s ? `Treino salvo: ${plural(totalSeries(s), "série", "séries")}${comCardio ? " e cardio" : ""}` : "Cardio salvo");
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
  "ver-sessao"(b) { abrirFolha({ tipo: "sessao", id: b.dataset.id }); },
  "excluir-sessao"(b) {
    if (!confirmar(b, "Excluir mesmo?")) return;
    const r = removerSessao(b.dataset.id);
    fecharFolha(); render();
    if (r) avisar("Treino excluído", () => { T().sessoes.splice(r.i, 0, r.fora); salvar(); });
  },
});

FORMS["criar-ex"] = (form) => {
  const f = new FormData(form);
  adicionarEscolhido(criarExercicio(f.get("nome"), f.get("g")));
};

// Campos que salvam ao mudar, sem redesenhar a tela (para não perder o foco)
MUDANCAS.push((el) => {
  const campo = el.dataset?.campo;
  if (!campo) return false;
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
