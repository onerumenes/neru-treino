// Telas do treino: início (próximo treino e histórico), sessão em andamento e editor do plano.

import { S, salvar } from "./store.js";
import { $, esc, int, lerNum, dataCurta, ui, ACOES, FORMS, FOLHAS, MUDANCAS, ICONE, render, avisar, abrirFolha, fecharFolha } from "./base.js";
import {
  T, GRUPOS, temPlano, usarModelo, nomeEx, biblioteca, criarExercicio, diaDoPlano, addDia, mover,
  sugerir, resumoSeries, fmtKg, proximoDia, iniciar, addExNaSessao, concluir, descartar, removerSessao,
  volume, totalSeries, evolucao,
} from "./treino.js";
import { secaoPersonal, iniciarDescanso } from "./tela-personal.js";
import { blocoAtual } from "./personal.js";
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
function telaSessao(a) {
  const blocos = a.ex.map((x, i) => {
    const sug = sugerir(x.ex, x.min, x.max);
    const antes = sug.ultima?.series || [];
    return `
      <section class="exercicio">
        <h2><span class="nome">${esc(x.nome)}</span><span class="alvo">${x.series.length} × ${x.min} a ${x.max}</span></h2>
        <p class="sugestao">${esc(sug.motivo)}</p>
        ${sug.ultima ? `<p class="ultima">Última vez, ${dataCurta(sug.ultima.d)}: ${esc(resumoSeries(antes))}</p>` : ""}
        <ol class="series">
          ${x.series.map((s, j) => `
            <li class="${s.ok ? "ok" : ""}">
              <span class="n">${j + 1}</span>
              <label><input type="number" inputmode="decimal" step="0.5" min="0" data-campo="kg" data-i="${i}" data-j="${j}" value="${s.kg}" aria-label="Carga da série ${j + 1}, em kg"><small>kg</small></label>
              <label><input type="number" inputmode="numeric" step="1" min="0" data-campo="reps" data-i="${i}" data-j="${j}" value="${s.reps}" placeholder="${antes[j]?.reps ?? x.max}" aria-label="Repetições da série ${j + 1}"><small>reps</small></label>
              <label class="rir"><input type="number" inputmode="numeric" step="1" min="0" max="10" data-campo="rir" data-i="${i}" data-j="${j}" value="${s.rir ?? ""}" placeholder="–" aria-label="RIR da série ${j + 1}: quantas repetições ainda sobravam"><small>RIR</small></label>
              <button class="marcar" data-acao="marcar-serie" data-i="${i}" data-j="${j}" aria-pressed="${s.ok}" aria-label="${s.ok ? "Desmarcar" : "Marcar"} a série ${j + 1} de ${esc(x.nome)}">${ICONE.feito}</button>
            </li>`).join("")}
        </ol>
        <div class="acoes-ex">
          <button class="link" data-acao="mais-serie" data-i="${i}">Mais uma série</button>
          ${x.series.length > 1 ? `<button class="link" data-acao="menos-serie" data-i="${i}">Tirar a última</button>` : ""}
          <button class="link fraco" data-acao="tirar-ex-sessao" data-i="${i}">Tirar exercício</button>
        </div>
      </section>`;
  }).join("");
  return `
    ${blocoAtual()?.deload ? `<p class="bloco-status deload">Semana de recuperação: as séries e cargas já vieram reduzidas.</p>` : ""}
    <p class="texto">Começou às ${hora(a.ini)}. Marca cada série quando terminar; só as marcadas ficam salvas. RIR é quantas repetições ainda sobravam (0 = falha).</p>
    ${blocos || `<p class="vazio">Nenhum exercício ainda.</p>`}
    <button class="botao fraco cheio" data-acao="abrir-biblioteca" data-para="sessao">Adicionar exercício</button>
    ${secaoCardioSessao(a)}
    <div class="par botoes fim-sessao">
      <button class="botao" data-acao="concluir-treino">Concluir treino</button>
      <button class="botao perigo" data-acao="descartar-treino">Descartar</button>
    </div>`;
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

  "comecar-treino"(b) { iniciar(b.dataset.id); ui.treino = "inicio"; render(); window.scrollTo(0, 0); },
  "marcar-serie"(b) {
    const i = Number(b.dataset.i), j = Number(b.dataset.j), x = T().atual.ex[i], s = x.series[j];
    if (s.ok) { s.ok = false; salvar(); render(); return; }
    const linha = b.closest("li");
    const kg = lerNum($("[data-campo=kg]", linha).value), reps = Math.round(lerNum($("[data-campo=reps]", linha).value));
    const rirTxt = $("[data-campo=rir]", linha).value;
    s.rir = rirTxt === "" ? "" : Math.min(10, Math.max(0, Math.round(lerNum(rirTxt))));
    if (!(reps > 0)) { avisar("Preenche as repetições desta série"); $("[data-campo=reps]", linha).focus(); return; }
    s.kg = kg; s.reps = reps; s.ok = true;
    for (const depois of x.series.slice(j + 1)) if (!depois.ok && depois.kg === "") depois.kg = kg;
    salvar(); render();
    // descanso, salvo depois da última série do treino
    const fim = T().atual.ex.every((y) => y.series.every((z) => z.ok));
    if (!fim) iniciarDescanso(x.ex);
  },
  "mais-serie"(b) {
    const x = T().atual.ex[b.dataset.i], ult = x.series[x.series.length - 1];
    x.series.push({ kg: ult?.kg ?? "", reps: "", rir: "", ok: false });
    salvar(); render();
  },
  "menos-serie"(b) { T().atual.ex[b.dataset.i].series.pop(); salvar(); render(); },
  "tirar-ex-sessao"(b) {
    if (!confirmar(b, "Tirar mesmo?")) return;
    T().atual.ex.splice(Number(b.dataset.i), 1); salvar(); render();
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
