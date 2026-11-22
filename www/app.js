// Interface do Neru Calorias: diário, conversa com a IA e ajustes. A aba Equipe fica em tela-equipe.js.

import {
  S, REFEICOES, nomeRef, carregar, salvar, gravar, hoje, somaDias, paraData, diaDe, totais,
  addItem, acharItem, editarItem, removerItem, reporItem, addFav, removerFav, kcalFav, pesos,
  novoId, exportar, importar, porcao,
} from "./store.js";
import { camposItem, lerItem } from "./tabela.js";
import { ATIVIDADE, RITMOS, TRABALHO, idadeDe, idadeAtual } from "./metas.js";
import { aplicarMetas, tendencia, ritmoEfetivo, dicaProteina, sugerirResto } from "./nutri.js";
import { temPlano, proximoDia } from "./treino.js";
import { conversar, transcrever, testarChave, temIA, ultimaRota } from "./ia.js";
import { secaoIALocal } from "./tela-ia-ajustes.js";

import {
  $, esc, int, dec, lerNum, dataCurta, ui, TELAS, ACOES, FORMS, FOLHAS, MUDANCAS, ICONE,
  irParaDia, render, avisar, abrirFolha, fecharFolha,
} from "./base.js";
import { telaTreino } from "./tela-treino.js";
import { secaoSuplementosDia, secaoSuplementosAjustes, secaoExportar } from "./extras.js";
import { telaEquipe } from "./tela-equipe.js";
import { cartaoNutri } from "./tela-nutri.js";
import "./tela-plano.js";
import "./tela-relatorio.js";
import "./tela-perfil.js";
import "./tela-dados.js";
import "./tela-fotos.js";
import "./tela-avaliacao.js";
import "./tela-treino-corpo.js";
import "./tela-progresso.js";
import "./equipe-ia.js";
import { iniciarEquipe } from "./equipe.js";
import { agendarLembretes, ouvirLembretes } from "./lembretes.js";
import { iniciarAtualizador, nativo, salvarArquivo } from "./nativo.js";
import { LICENCA_CORPO } from "./avatar.js";

const BUILD = window.NERU_BUILD || { versao: "dev", atualizacoes: "" };

const EXEMPLOS = [
  "Comi 4 ovos mexidos e um pão francês",
  "Quanto falta de proteína hoje?",
  "O que posso jantar com o que sobra?",
];

// ---------- diário ----------
const CHAMA = { cafe: "Seu café da manhã", almoco: "Seu almoço", pos_treino: "Seu pós-treino", janta: "Sua janta", ceia: "Sua ceia" };
const ICONE_IA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>`;
const ICONE_HALTER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/></svg>`;
const pct = (a, b) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0).toFixed(1);
const nomesItens = (lista) => {
  const nomes = lista.map((i) => i.nome.split(",")[0].trim());
  const txt = nomes.slice(0, 4).join(", ");
  return nomes.length > 4 ? `${txt} e mais ${nomes.length - 4}` : txt;
};

function painelDia(d, t, m) {
  if (!m) {
    return `
      <section class="painel-dia">
        <div class="kcal-linha"><div><span>Calorias</span><b>${int(t.kcal)}</b><span>kcal no dia</span></div></div>
        <p>Preencha seus dados para o app calcular as metas de calorias e proteína.</p>
        <button class="botao escuro cheio" data-acao="aba" data-aba="dados">Preencher perfil</button>
      </section>`;
  }
  const resta = m.kcal - t.kcal;
  const mostraSugestao = d === hoje() && (resta > 80 || m.protein - t.protein > 15);
  return `
    <section class="painel-dia ${resta < 0 ? "passou" : ""}">
      <div class="kcal-linha">
        <div><span>Calorias</span><b>${int(t.kcal)}</b><span>de ${int(m.kcal)} kcal</span></div>
        <div class="faltam"><span>${resta < 0 ? "passou" : "faltam"}</span><b>${int(Math.abs(resta))}</b></div>
      </div>
      <span class="trilho-dia" role="img" aria-label="${int(t.kcal)} de ${int(m.kcal)} kcal"><i style="width:${pct(t.kcal, m.kcal)}%"></i></span>
      <div class="prot-dia">
        <div><span>Proteína</span><span><b>${int(t.protein)}</b> de ${int(m.protein)} g</span></div>
        <span class="trilho" role="img" aria-label="Proteína: ${int(t.protein)} de ${int(m.protein)} gramas"><i style="width:${pct(t.protein, m.protein)}%;background:var(--couve-forte)"></i></span>
        <div><small>Carbo ${int(t.carbs)} g · Gordura ${int(t.fat)} g</small><small>${m.proteinaPela === "magra" ? "meta pela massa magra" : "meta pelo peso"}</small></div>
      </div>
      ${mostraSugestao ? `<button class="botao escuro cheio" data-acao="o-que-comer">${ICONE_IA}O que eu como agora?</button>` : ""}
    </section>`;
}

function cartaoRefeicao(r, lista, d, alvo, dica) {
  const kc = lista.reduce((s, i) => s + i.kcal, 0), pr = lista.reduce((s, i) => s + i.protein, 0);
  const cor = `<i class="cor" style="background:${r.cor}"></i>`;
  const textoDica = dica ? `<p class="dica-prot"><span>${CHAMA[r.id]} costuma ter <b>${dica.media} g</b> de proteína.${dica.sugestao ? ` ${esc(dica.sugestao.nome)} leva a ${dica.sugestao.total} g.` : ""}</span><button class="link" data-acao="o-que-comer">Trocar</button></p>` : "";
  if (!lista.length) {
    const sug = alvo ? `Sugestão: ${int(alvo.kcal)} kcal${alvo.prot >= 10 ? `, ${int(alvo.prot)} g prot.` : ""}` : "Nada ainda";
    return `
      <div class="ref-cartao vazia">
        <button class="ref-cab" data-acao="abrir-add" data-ref="${r.id}" aria-label="Adicionar em ${r.nome}">
          ${cor}<span class="ref-nome"><b>${r.nome}</b><small>${sug}</small></span><span class="mais" aria-hidden="true">+</span>
        </button>${textoDica}
      </div>`;
  }
  const aberta = ui.refAberta === `${d}:${r.id}`;
  return `
    <div class="ref-cartao ${aberta ? "aberta" : ""}">
      <button class="ref-cab" data-acao="abrir-ref" data-ref="${r.id}" aria-expanded="${aberta}">
        ${cor}<span class="ref-nome"><b>${r.nome}</b><small>${esc(nomesItens(lista))}</small></span>
        <span class="ref-num"><b>${int(kc)}</b><small>${int(pr)} g prot.</small></span>
      </button>
      ${aberta ? `<ul class="itens-ref">${lista.map(linhaItem).join("")}</ul>
        <button class="add-item" data-acao="abrir-add" data-ref="${r.id}">+ Adicionar em ${r.nome.toLowerCase()}</button>` : ""}
    </div>`;
}

function telaHoje() {
  const d = ui.data, t = totais(d), m = S.metas, itens = diaDe(d).itens;
  const dica = d === hoje() ? dicaProteina() : null;
  // o quanto cada refeição que falta deveria ter, pelo que sobra da meta
  const sug = d === hoje() && m ? sugerirResto(d) : null;
  const alvo = Object.fromEntries((sug?.refeicoes || []).map((r) => [r.ref, r]));
  const refs = REFEICOES.map((r) => {
    const lista = itens.filter((i) => i.ref === r.id);
    return cartaoRefeicao(r, lista, d, alvo[r.id], dica && dica.ref === r.id && !lista.length ? dica : null);
  }).join("");
  return `${painelDia(d, t, m)}${cartaoNutri(d)}
    <section class="secao refeicoes"><h2>Refeições</h2>${refs}</section>
    ${secaoSuplementosDia(d)}`;
}

function linhaItem(i) {
  const q = porcao(i);
  return `<li><button data-acao="editar" data-id="${esc(i.id)}">
    <span class="oque">${esc(i.nome)}${q ? ` <small>${esc(q)}</small>` : ""}</span>
    <span class="kc">${int(i.kcal)}</span>
    <span class="pr">${int(i.protein)} g</span>
  </button></li>`;
}

// Selo do topo do Diário: o treino de hoje (feito ou o próximo da fila)
function seloTreino() {
  if (ui.data !== hoje() || !temPlano()) return "";
  const feito = (S.treino?.sessoes || []).find((s) => s.d === hoje());
  const nome = feito ? feito.nome : proximoDia()?.nome;
  if (!nome) return "";
  return `<button class="selo-topo" data-acao="aba" data-aba="treino" data-treino="inicio">${ICONE_HALTER}${feito ? "Feito: " : ""}${esc(nome.replace(/^[A-Z] · /, ""))}</button>`;
}

// ---------- folha (adicionar e editar) ----------
FOLHAS.add = (f) => folhaAdd(f.ref);
FOLHAS.editar = (f) => folhaEditar(f.id);

function folhaAdd(ref) {
  const d = ui.data, nome = nomeRef(ref);
  const anterior = diaDe(somaDias(d, -1)).itens.filter((i) => i.ref === ref);
  const atuais = diaDe(d).itens.filter((i) => i.ref === ref);
  const favs = S.favs.length ? `
    <div class="bloco">
      <h3>Favoritos</h3>
      <ul class="favs">${S.favs.map((f) => `
        <li>
          <button class="fav" data-acao="usar-fav" data-id="${esc(f.id)}"><span>${esc(f.nome)}</span><b>${int(kcalFav(f))} kcal</b></button>
          <button class="tirar" data-acao="apagar-fav" data-id="${esc(f.id)}" aria-label="Remover o favorito ${esc(f.nome)}">×</button>
        </li>`).join("")}
      </ul>
    </div>` : "";
  const repetir = anterior.length ? `
    <button class="botao fraco cheio" data-acao="repetir-anterior">
      Repetir ${d === hoje() ? "o de ontem" : "o do dia anterior"}
      <small>${anterior.length} ${anterior.length > 1 ? "itens" : "item"}, ${int(anterior.reduce((s, i) => s + i.kcal, 0))} kcal</small>
    </button>` : "";
  const guardar = atuais.length ? `
    <form class="bloco" data-form="guardar-ref">
      <h3>Guardar esta refeição nos favoritos</h3>
      <div class="par">
        <input name="nome" value="${esc(nome)} de sempre" maxlength="40" aria-label="Nome do favorito">
        <button class="botao fraco">Guardar</button>
      </div>
    </form>` : "";
  return `
    <h2 id="folha-titulo">Adicionar em ${nome}</h2>
    ${favs}${repetir}
    <form class="bloco" data-form="novo-item">
      <h3>Buscar ou digitar um alimento</h3>
      ${camposItem({}, true)}
      <button class="botao cheio">Adicionar</button>
    </form>
    ${guardar}
    <p class="dica">Mais rápido: na aba IA, conta o que comeste por texto, foto ou áudio.</p>`;
}

function folhaEditar(id) {
  const i = acharItem(ui.data, id);
  if (!i) return "";
  return `
    <h2 id="folha-titulo">Editar item</h2>
    <form class="bloco" data-form="editar-item">
      <label class="campo"><span>Refeição</span>
        <select name="ref">${REFEICOES.map((r) => `<option value="${r.id}" ${r.id === i.ref ? "selected" : ""}>${r.nome}</option>`).join("")}</select></label>
      ${camposItem(i)}
      <button class="botao cheio">Salvar alterações</button>
    </form>
    <div class="par botoes">
      <button class="botao fraco" data-acao="favoritar-item">Guardar nos favoritos</button>
      <button class="botao perigo" data-acao="excluir-item">Excluir</button>
    </div>`;
}

// ---------- IA ----------
function telaIA() {
  if (!temIA("registro")) {
    return `
      <div class="sem-chave">
        <h2>Registrar falando, escrevendo ou fotografando</h2>
        <p>A IA estima calorias e proteína do que comes e lança no diário. Ela pode rodar no próprio celular (Ajustes > IA no celular, no app Android) ou usar a tua conta da OpenAI (cola a chave em Ajustes; fica só neste aparelho).</p>
        <button class="botao" data-acao="aba" data-aba="ajustes">Abrir Ajustes</button>
      </div>`;
  }
  return `
    <ol id="msgs" class="msgs">${msgsHtml()}</ol>
    <form id="compor" data-form="mensagem">
      <div id="previa" ${ui.foto ? "" : "hidden"}>${ui.foto ? previaHtml() : ""}</div>
      <div class="linha-compor">
        <input type="file" accept="image/*" id="foto" hidden>
        <button type="button" class="icone" data-acao="foto" aria-label="Anexar foto do prato ou do rótulo">${ICONE.camera}</button>
        <textarea id="texto" name="texto" rows="1" placeholder="O que comeste?" enterkeyhint="send" aria-label="Mensagem"></textarea>
        <button type="button" class="icone" id="mic" data-acao="gravar" aria-label="Gravar áudio">${ICONE.mic}</button>
        <button class="icone enviar" aria-label="Enviar">${ICONE.enviar}</button>
      </div>
    </form>`;
}
const previaHtml = () => `<img src="${ui.foto.mini}" alt="Foto anexada"><button type="button" data-acao="tirar-foto" aria-label="Remover foto">×</button>`;

function msgHtml(m) {
  if (m.de === "eu") {
    return `<li class="eu">${m.foto ? `<img src="${esc(m.foto)}" alt="Foto enviada">` : ""}${m.texto ? `<p>${esc(m.texto)}</p>` : ""}</li>`;
  }
  const f = m.feito, linhas = [];
  if (f) {
    for (const a of f.add) linhas.push(`<li><span class="oque">${esc(a.nome)}${porcao(a) ? ` <small>${esc(porcao(a))}</small>` : ""}</span><span class="pts"></span><b>${int(a.kcal)} kcal</b></li>`);
    for (const u of f.upd) linhas.push(`<li><span class="oque">Corrigido: ${esc(u.nome)}</span></li>`);
    for (const r of f.rem) linhas.push(`<li><span class="oque">Apagado: ${esc(r.nome)}</span></li>`);
  }
  const acoes = !linhas.length ? "" : m.desfeito
    ? `<p class="nota">Desfeito</p>`
    : `<button class="link" data-acao="desfazer-msg" data-id="${esc(m.id)}">Desfazer</button>`;
  return `<li class="ia"><p>${esc(m.texto)}</p>${m.via === "local" ? `<small class="via">IA do celular</small>` : ""}${linhas.length ? `<ul class="feito ${m.desfeito ? "desfeito" : ""}">${linhas.join("")}</ul>` : ""}${acoes}</li>`;
}

function msgsHtml() {
  let html = "";
  if (!S.chat.length && !ui.ocupado && !ui.erroChat) {
    html = `<li class="inicio">
      <p>Conta o que comeste, manda foto do prato ou do rótulo, ou grava um áudio. Também dá para perguntar sobre o teu dia.</p>
      <div class="exemplos">${EXEMPLOS.map((e) => `<button data-acao="exemplo">${e}</button>`).join("")}</div>
    </li>`;
  }
  html += S.chat.map(msgHtml).join("");
  if (ui.ocupado) html += `<li class="ia pensando"><span>${esc(ui.status || "Calculando")}</span><i></i><i></i><i></i></li>`;
  if (ui.erroChat) {
    const paraAjustes = ["sem-chave", "chave", "modelo", "limite"].includes(ui.erroChat.tipo);
    html += `<li class="ia erro"><p>${esc(ui.erroChat.texto)}</p>
      <div class="par botoes">${ui.ultimo ? `<button class="botao fraco" data-acao="tentar">Tentar de novo</button>` : ""}
      ${paraAjustes ? `<button class="botao fraco" data-acao="aba" data-aba="ajustes">Abrir Ajustes</button>` : ""}</div></li>`;
  }
  return html;
}

function fimDoChat() { requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight)); }
function atualizarChat() {
  if (ui.aba !== "ia") return;
  const lista = $("#msgs");
  if (!lista) return render();
  lista.innerHTML = msgsHtml();
  fimDoChat();
}

function aplicarIA(res, d) {
  const feito = { add: [], upd: [], rem: [] };
  for (const a of res.add) {
    const it = addItem(d, { ref: a.meal, nome: a.name, qtd: a.qty, g: a.grams, kcal: a.kcal, protein: a.protein, carbs: a.carbs, fat: a.fat });
    feito.add.push({ id: it.id, nome: it.nome, qtd: it.qtd, g: it.g, kcal: it.kcal });
  }
  for (const u of res.update) {
    const c = {};
    if (u.meal != null) c.ref = u.meal;
    if (u.name != null) c.nome = u.name;
    if (u.qty != null) c.qtd = u.qty;
    if (u.grams != null) c.g = u.grams;
    for (const k of ["kcal", "protein", "carbs", "fat"]) if (u[k] != null) c[k] = u[k];
    // trocou o alimento ou os valores: a base por 100 g antiga deixa de valer (na edição ela sai das gramas)
    if (["nome", "kcal", "protein", "carbs", "fat"].some((k) => k in c)) c.b = null;
    const antes = editarItem(d, String(u.id), c);
    if (antes) feito.upd.push({ antes, nome: acharItem(d, antes.id).nome });
  }
  for (const id of res.remove) {
    const fora = removerItem(d, id);
    if (fora) feito.rem.push(fora);
  }
  return feito.add.length + feito.upd.length + feito.rem.length ? feito : null;
}

async function enviar({ texto, imagem, mini }, repetir = false) {
  texto = (texto || "").trim();
  if (ui.ocupado || (!texto && !imagem)) return;
  const d = ui.data;
  if (!repetir) S.chat.push({ id: novoId("m"), de: "eu", texto, foto: mini || null, h: Date.now() });
  ui.ultimo = { texto, imagem, mini };
  ui.erroChat = null; ui.ocupado = true; ui.status = imagem ? "Olhando a foto" : "Calculando";
  atualizarChat();
  try {
    const res = await conversar({ texto, imagem, d, historico: S.chat.slice(0, -1) });
    const feito = aplicarIA(res, d);
    S.chat.push({ id: novoId("m"), de: "ia", texto: res.reply || (feito ? "Registrado." : "Não entendi. Pode dizer de outro jeito?"), d, feito, h: Date.now(), via: ultimaRota });
    ui.ultimo = null;
  } catch (e) {
    ui.erroChat = { texto: e.message || "Algo deu errado.", tipo: e.tipo };
  }
  ui.ocupado = false;
  if (S.chat.length > 60) S.chat.splice(0, S.chat.length - 60);
  salvar();
  atualizarChat();
}

function desfazerMsg(id) {
  const m = S.chat.find((x) => x.id === id);
  if (!m?.feito || m.desfeito) return;
  for (const a of m.feito.add) removerItem(m.d, a.id);
  for (const u of m.feito.upd) reporItem(m.d, u.antes);
  for (const r of m.feito.rem) reporItem(m.d, r);
  m.desfeito = true;
  salvar();
  atualizarChat();
}

async function reduzir(arquivo, max, qualidade) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", qualidade);
  } finally { URL.revokeObjectURL(url); }
}

function marcarMic() {
  const b = $("#mic");
  if (!b) return;
  b.classList.toggle("gravando", !!ui.gravando);
  b.innerHTML = ui.gravando ? ICONE.parar : ICONE.mic;
  b.setAttribute("aria-label", ui.gravando ? "Parar e enviar o áudio" : "Gravar áudio");
}

async function alternarGravacao() {
  if (ui.gravando) return ui.gravando.stop();
  if (ui.ocupado) return;
  if (!S.cfg.chave) return avisar("O áudio usa a transcrição da OpenAI: cola a chave em Ajustes, ou escreve a mensagem.");
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return avisar("Este navegador não grava áudio.");
  let fluxo;
  try { fluxo = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { return avisar("Sem permissão para usar o microfone."); }
  const rec = new MediaRecorder(fluxo), partes = [];
  rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  rec.onstop = async () => {
    fluxo.getTracks().forEach((t) => t.stop());
    ui.gravando = null;
    marcarMic();
    const blob = new Blob(partes, { type: rec.mimeType || "audio/webm" });
    if (blob.size < 1000) return avisar("Áudio curto demais. Segura um pouco mais.");
    ui.erroChat = null; ui.ocupado = true; ui.status = "Ouvindo o áudio";
    atualizarChat();
    try {
      const texto = await transcrever(blob);
      ui.ocupado = false;
      if (texto) return enviar({ texto });
      avisar("Não deu para entender o áudio.");
    } catch (e) {
      ui.ocupado = false; ui.ultimo = null;
      ui.erroChat = { texto: e.message || "Não deu para transcrever o áudio.", tipo: e.tipo };
    }
    atualizarChat();
  };
  rec.start();
  ui.gravando = rec;
  marcarMic();
}

// ---------- ajustes ----------
function explicarMetas(m, u) {
  if (S.metasManuais) return "Metas definidas por ti.";
  if (!m || !u) return "";
  const at = ATIVIDADE[u.atividade], est = m.atividade?.fonte === "estimado";
  let t = `Gasto estimado de ${int(m.gasto)} kcal por dia (basal de ${int(m.tmb)} com ${est ? `atividade estimada pelos seus ${dec(m.atividade.treinos)} treinos por semana` : `atividade ${at.nome.toLowerCase()}`})`;
  const rk = ritmoEfetivo(u).toLocaleString("pt-BR");
  if (u.objetivo === "perder") t += `, menos ${int(Math.abs(m.ajuste))} para perder cerca de ${rk} kg por semana${m.ritmoAuto ? " (ritmo automático)" : ""}.`;
  else if (u.objetivo === "ganhar") t += `, mais ${int(m.ajuste)} para ganhar cerca de ${rk} kg por semana${m.ritmoAuto ? " (ritmo automático)" : ""}.`;
  else t += ", sem ajuste, para manter o peso.";
  if (m.proteinaPela === "magra") t += ` A proteína sai da massa magra (${dec(m.magra)} kg).`;
  if (m.noPiso) t += ` A conta deu abaixo de ${int(m.kcal)} kcal, então a meta ficou nesse piso de segurança. Escolhe um ritmo mais leve.`;
  if (m.ajusteNutri) t += ` Os check-ins semanais ajustaram ${m.ajusteNutri > 0 ? "+" : "−"}${int(Math.abs(m.ajusteNutri))} kcal pelo teu ritmo real.`;
  return t;
}

function telaAjustes() {
  const m = S.metas, c = S.cfg;
  const marcado = (a, b) => (a === b ? "checked" : "");
  const teste = ui.testeIA ? `<p class="resultado ${ui.testeIA.ok ? "ok" : "ruim"}">${esc(ui.testeIA.texto)}</p>` : "";
  return `
    <section class="secao">
      <h2>Você</h2>
      <ul class="linhas atalhos-ajustes">
        <li><button data-acao="aba" data-aba="dados" data-volta="ajustes"><span><b>Dados pessoais</b><small>Nome, nascimento, altura, pesagem e atividade</small></span><span class="seta-dir" aria-hidden="true">›</span></button></li>
        <li><button data-acao="aba" data-aba="objetivo" data-volta="ajustes"><span><b>Objetivo e ritmo</b><small>${esc({ perder: "Perder gordura", manter: "Manter", ganhar: "Ganhar massa" }[S.user?.objetivo] || "Escolher")}${S.user?.ritmoAuto ? " · ritmo automático" : ""}</small></span><span class="seta-dir" aria-hidden="true">›</span></button></li>
      </ul>
    </section>

    <section class="secao">
      <h2>Metas do dia</h2>
      <div class="caixa">
      ${m ? `<p class="metas"><b>${int(m.kcal)}</b> kcal e <b>${int(m.protein)}</b> g de proteína</p><p class="texto">${esc(explicarMetas(m, S.user))}</p>` : `<p class="vazio">Preencha os dados pessoais para o app calcular.</p>`}
      <label class="chave-liga"><input type="checkbox" id="manuais" ${S.metasManuais ? "checked" : ""}><span>Definir as metas na mão</span></label>
      <form class="par" data-form="metas" ${S.metasManuais ? "" : "hidden"}>
        <label class="campo"><span>Calorias</span><input name="kcal" type="number" inputmode="numeric" min="800" max="8000" required value="${m?.kcal ?? ""}"></label>
        <label class="campo"><span>Proteína <small>g</small></span><input name="protein" type="number" inputmode="numeric" min="20" max="500" required value="${m?.protein ?? ""}"></label>
        <button class="botao">Salvar metas</button>
      </form>
      </div>
    </section>

    ${secaoSuplementosAjustes()}

    ${secaoIALocal()}

    <section class="secao">
      <h2>IA da OpenAI</h2>
      <p class="texto">O registro por texto, foto e áudio usa a tua conta da OpenAI, cobrada por uso. Cria uma chave em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a> e cola aqui. Ela fica só neste aparelho e não entra no backup.</p>
      <form data-form="ia">
        <label class="campo"><span>Chave da API</span><input name="chave" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." value="${esc(c.chave)}"></label>
        <details>
          <summary>Modelos</summary>
          <label class="campo"><span>Conversa</span><input name="modeloChat" value="${esc(c.modeloChat)}" spellcheck="false" autocapitalize="off"></label>
          <label class="campo"><span>Fotos</span><input name="modeloFoto" value="${esc(c.modeloFoto)}" spellcheck="false" autocapitalize="off"></label>
          <label class="campo"><span>Áudio</span><input name="modeloAudio" value="${esc(c.modeloAudio)}" spellcheck="false" autocapitalize="off"></label>
        </details>
        <div class="par botoes">
          <button class="botao">Salvar</button>
          <button type="button" class="botao fraco" data-acao="testar-ia">Salvar e testar</button>
        </div>
        ${teste}
      </form>
    </section>

    <section class="secao">
      <h2>Aparência</h2>
      <fieldset class="opcoes"><legend>Tema</legend>
        <label><input type="radio" name="tema" value="auto" ${marcado(c.tema || "auto", "auto")}><span>Automático</span></label>
        <label><input type="radio" name="tema" value="claro" ${marcado(c.tema, "claro")}><span>Claro</span></label>
        <label><input type="radio" name="tema" value="escuro" ${marcado(c.tema, "escuro")}><span>Escuro</span></label>
      </fieldset>
      <p class="dica">Automático segue o tema do celular.</p>
    </section>

    ${secaoExportar()}

    <section class="secao">
      <h2>Teus dados</h2>
      <p class="texto">Tudo fica guardado só neste aparelho. Se limpares os dados do app ou trocares de celular, o diário vai junto, então guarda um backup de vez em quando. Ele leva diário, treinos, favoritos, medidas e metas. As fotos do físico não entram: ficam só neste aparelho.</p>
      <div class="par botoes">
        <button class="botao fraco" data-acao="backup">Baixar backup</button>
        <button class="botao fraco" data-acao="escolher-backup">Restaurar backup</button>
        <input type="file" id="arq-backup" accept="application/json,.json" hidden>
      </div>
      ${ui.restaurar ? `<div class="confirma"><p>Restaurar troca o diário atual pelo do arquivo ${esc(ui.restaurar.nome)}.</p>
        <div class="par botoes"><button class="botao perigo" data-acao="confirmar-restaurar">Restaurar</button><button class="botao fraco" data-acao="cancelar-restaurar">Cancelar</button></div></div>` : ""}
    </section>
    <section class="secao">
      <h2>Créditos</h2>
      <p class="texto">Alimentos: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição, NEPA/UNICAMP, 2011. Desenho do corpo: react-native-body-highlighter, de ELABBASSI Hicham, licença MIT. Fonte: Bricolage Grotesque, licença SIL OFL 1.1.</p>
      <details>
        <summary>Licença do desenho do corpo (MIT)</summary>
        <p class="texto licenca">${esc(LICENCA_CORPO)}</p>
      </details>
    </section>
    <p class="rodape">Neru Calorias, versão ${esc(BUILD.versao)}${nativo ? " (app Android)" : ""}</p>`;
}

// Tema: "auto" tira o atributo e deixa o CSS seguir o celular; "claro" e "escuro" fixam
function aplicarTema() {
  const t = S.cfg.tema;
  if (t === "claro" || t === "escuro") document.documentElement.dataset.tema = t;
  else delete document.documentElement.dataset.tema;
  const claro = t === "claro" || (t !== "escuro" && matchMedia("(prefers-color-scheme: light)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", claro ? "#F6F2EA" : "#241A22");
}
matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (!S.cfg.tema || S.cfg.tema === "auto") aplicarTema(); });

function lerFormIA(form) {
  const f = new FormData(form);
  S.cfg.chave = String(f.get("chave") || "").trim();
  for (const k of ["modeloChat", "modeloFoto", "modeloAudio"]) {
    const v = String(f.get(k) || "").trim();
    if (v) S.cfg[k] = v;
  }
  salvar();
}

// ---------- ações ----------
Object.assign(ACOES, {
  "abrir-add"(b) { abrirFolha({ tipo: "add", ref: b.dataset.ref }); },
  "abrir-ref"(b) {
    const k = `${ui.data}:${b.dataset.ref}`;
    ui.refAberta = ui.refAberta === k ? null : k;
    render();
  },
  editar(b) { abrirFolha({ tipo: "editar", id: b.dataset.id }); },

  "usar-fav"(b) {
    const fav = S.favs.find((f) => f.id === b.dataset.id), ref = ui.folha.ref, d = ui.data;
    if (!fav) return;
    const ids = fav.itens.map((i) => addItem(d, { ...i, ref }).id);
    fecharFolha(); render();
    avisar(`${fav.nome} adicionado em ${nomeRef(ref)}`, () => ids.forEach((id) => removerItem(d, id)));
  },
  "apagar-fav"(b) {
    if (b.dataset.certeza) { removerFav(b.dataset.id); abrirFolha(ui.folha); return; }
    b.dataset.certeza = "1"; b.textContent = "Remover?"; b.classList.add("certeza");
  },
  "repetir-anterior"() {
    const ref = ui.folha.ref, d = ui.data;
    const ids = diaDe(somaDias(d, -1)).itens.filter((i) => i.ref === ref).map((i) => addItem(d, { ...i, ref }).id);
    fecharFolha(); render();
    avisar(`${ids.length} ${ids.length > 1 ? "itens repetidos" : "item repetido"} em ${nomeRef(ref)}`, () => ids.forEach((id) => removerItem(d, id)));
  },
  "favoritar-item"() {
    const i = acharItem(ui.data, ui.folha.id);
    if (!i) return;
    addFav(i.nome, [i]);
    fecharFolha();
    avisar(`${i.nome} guardado nos favoritos`);
  },
  "excluir-item"() {
    const d = ui.data, fora = removerItem(d, ui.folha.id);
    fecharFolha(); render();
    if (fora) avisar(`${fora.nome} excluído`, () => reporItem(d, fora));
  },
  foto() { $("#foto").click(); },
  "tirar-foto"() { ui.foto = null; const p = $("#previa"); p.hidden = true; p.innerHTML = ""; },
  gravar: alternarGravacao,
  exemplo(b) { enviar({ texto: b.textContent }); },
  tentar() { if (ui.ultimo) enviar(ui.ultimo, true); },
  "desfazer-msg"(b) { desfazerMsg(b.dataset.id); },

  async "testar-ia"(b) {
    lerFormIA(b.closest("form"));
    ui.testeIA = { ok: true, texto: "Testando a conexão com a OpenAI…" };
    render();
    try { await testarChave(); ui.testeIA = { ok: true, texto: `Chave aceita e modelo ${S.cfg.modeloChat} disponível.` }; }
    catch (e) { ui.testeIA = { ok: false, texto: e.message }; }
    if (ui.aba === "ajustes") render();
  },

  async backup() {
    try {
      const como = await salvarArquivo(`neru-calorias-${hoje()}.json`, exportar(), "application/json");
      if (como === "baixado") avisar("Backup baixado");
    } catch { avisar("Não deu para gerar o backup."); }
  },
  "escolher-backup"() { $("#arq-backup").click(); },
  "cancelar-restaurar"() { ui.restaurar = null; render(); },
  async "confirmar-restaurar"() {
    const r = ui.restaurar;
    ui.restaurar = null;
    try { await importar(r.texto); aplicarTema(); avisar("Backup restaurado"); }
    catch (e) { avisar(e.message || "Não deu para ler esse arquivo."); }
    render();
  },
});

Object.assign(FORMS, {
  "novo-item"(form) {
    const d = ui.data, it = addItem(d, lerItem(form));
    fecharFolha(); render();
    avisar(`${it.nome} adicionado em ${nomeRef(it.ref)}`, () => removerItem(d, it.id));
  },
  "editar-item"(form) {
    editarItem(ui.data, ui.folha.id, lerItem(form));
    fecharFolha(); render();
    avisar("Alterações salvas");
  },
  "guardar-ref"(form) {
    const itens = diaDe(ui.data).itens.filter((i) => i.ref === ui.folha.ref);
    const fav = addFav(new FormData(form).get("nome") || nomeRef(ui.folha.ref), itens);
    fecharFolha();
    avisar(`${fav.nome} guardado nos favoritos`);
  },
  mensagem(form) {
    const campo = $("#texto", form), texto = campo.value;
    if (ui.ocupado || (!texto.trim() && !ui.foto)) return;
    const foto = ui.foto;
    campo.value = ""; campo.style.height = "";
    ACOES["tirar-foto"]();
    enviar({ texto, imagem: foto?.imagem, mini: foto?.mini });
  },
  peso(form) {
    const kg = Math.round(lerNum(new FormData(form).get("kg")) * 10) / 10;
    if (!(kg > 0)) return;
    diaDe(hoje(), true).peso = kg;
    let extra = "";
    if (S.user) {
      // o peso do perfil é a tendência (média que tira o sobe-e-desce de água), não a pesagem do dia
      const t = tendencia();
      S.user.peso = Math.round((t[t.length - 1]?.kg || kg) * 10) / 10;
      if (!S.metasManuais) {
        const antes = S.metas?.kcal;
        aplicarMetas();
        if (antes && S.metas && antes !== S.metas.kcal) extra = `. Meta ajustada para ${int(S.metas.kcal)} kcal`;
      }
    }
    salvar(); render();
    avisar(`Peso registrado: ${dec(kg)} kg${extra}`);
  },
  perfil(form) {
    const f = new FormData(form), primeiraVez = !S.metas;
    // mudou o objetivo: os ajustes dos check-ins eram para o objetivo antigo
    if (S.user && S.user.objetivo !== (f.get("objetivo") || "manter")) S.nutri.ajuste = 0;
    const nascimento = idadeDe(f.get("nascimento")) != null ? String(f.get("nascimento")) : S.user?.nascimento || "";
    S.user = {
      apelido: String(f.get("apelido") || "").trim().slice(0, 30),
      sexo: f.get("sexo") === "f" ? "f" : "m",
      ...(nascimento ? { nascimento } : { idade: S.user?.idade }),
      altura: Math.round(lerNum(f.get("altura"))),
      peso: Math.round(lerNum(f.get("peso")) * 10) / 10,
      atividade: f.get("atividade"), trabalho: TRABALHO[f.get("trabalho")] ? f.get("trabalho") : "sentado",
      objetivo: f.get("objetivo") || "manter",
      ritmoAuto: f.get("ritmo") === "auto", ritmo: f.get("ritmo") === "auto" ? (S.user?.ritmo || 0.5) : lerNum(f.get("ritmo")) || 0.5,
      ...(f.get("sexo") === "f" && f.get("cicloUltima") ? { ciclo: { ultima: String(f.get("cicloUltima")), duracao: Math.round(lerNum(f.get("cicloDuracao"))) || 28 } } : {}),
    };
    if (!S.metasManuais || !S.metas) { S.metasManuais = false; aplicarMetas(); }
    diaDe(hoje(), true).peso = S.user.peso;
    salvar();
    if (primeiraVez && S.metas) { ui.aba = "hoje"; window.scrollTo(0, 0); }
    render();
    avisar(S.metas ? `Perfil salvo. Meta: ${int(S.metas.kcal)} kcal e ${int(S.metas.protein)} g de proteína` : "Perfil salvo");
  },
  metas(form) {
    const f = new FormData(form);
    S.metas = { ...(S.metas || {}), kcal: Math.round(lerNum(f.get("kcal"))), protein: Math.round(lerNum(f.get("protein"))) };
    S.metasManuais = true;
    salvar(); render();
    avisar("Metas salvas");
  },
  ia(form) {
    lerFormIA(form);
    ui.testeIA = null;
    render();
    avisar(S.cfg.chave ? "Chave salva neste aparelho" : "Chave removida");
  },
});

// ---------- eventos ----------
MUDANCAS.push((el) => {
  if (el.id === "foto" && el.files[0]) { anexarFoto(el); return true; }
  if (el.id === "arq-backup" && el.files[0]) {
    const arq = el.files[0];
    arq.text().then((texto) => { ui.restaurar = { nome: arq.name, texto }; render(); });
    return true;
  }
  if (el.name === "tema") { S.cfg.tema = el.value; salvar(); aplicarTema(); return true; }
  if (el.id === "manuais") {
    S.metasManuais = el.checked;
    if (!el.checked && S.user) aplicarMetas();
    salvar(); render();
    return true;
  }
  return false;
});

async function anexarFoto(el) {
  {
    const arq = el.files[0];
    el.value = "";
    try {
      ui.foto = { imagem: await reduzir(arq, 1280, 0.82), mini: await reduzir(arq, 240, 0.7) };
      const p = $("#previa");
      p.innerHTML = previaHtml(); p.hidden = false;
      $("#texto")?.focus();
    } catch { avisar("Não deu para abrir essa imagem."); }
  }
}

document.addEventListener("input", (e) => {
  if (e.target.id !== "texto") return;
  e.target.style.height = "";
  e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && e.target.id === "texto" && !e.isComposing) {
    e.preventDefault();
    e.target.form.requestSubmit();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") return gravar();
  // Virou o dia com o app aberto: acompanha o novo "hoje" (e a equipe revisa metas temporárias e o relatório)
  if (ui.seguindoHoje && ui.data !== hoje()) { iniciarEquipe(); irParaDia(hoje()); }
});

// ---------- início ----------
TELAS.hoje = { comData: true, html: telaHoje, direita: seloTreino };
TELAS.ia = { comData: true, tituloDia: () => "IA", html: telaIA, depois: fimDoChat, manterRolagem: true };
TELAS.treino = telaTreino;
TELAS.equipe = telaEquipe;
TELAS.ajustes = { titulo: "Ajustes", aba: "perfil", html: telaAjustes };

// Primeiro de tudo: confirma ao atualizador que esta versão abriu (senão ele desfaz em 10 s e bloqueia a versão)
iniciarAtualizador(BUILD);
await carregar();
aplicarTema();
// a idade e o peso de hoje mudam a meta (aniversário, tendência nova); um erro aqui não pode deixar a tela em branco
try { if (S.user && !S.metasManuais) aplicarMetas(); } catch (e) { console.warn("Metas:", e); }
try { iniciarEquipe(); } catch (e) { console.warn("Equipe:", e); }
if (!S.user) ui.aba = "dados";
render();
// lembretes: reagenda com os horários atuais e abre a tela certa ao tocar
ouvirLembretes((x) => {
  ui.aba = x.aba; if (x.sub) ui.equipe = x.sub;
  if (x.aba === "hoje") irParaDia(hoje());
  render();
  if (x.acao === "checkin") ACOES["abrir-checkin"]();
});
if (S.cfg.lembretes.ativo) agendarLembretes().catch(() => { /* sem permissão: segue sem lembretes */ });

if (!nativo && "serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* sem modo offline, o app segue funcionando */ });
}
