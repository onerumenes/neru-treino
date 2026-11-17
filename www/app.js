// Interface do Neru Calorias: diário, conversa com a IA, progresso e ajustes.

import {
  S, REFEICOES, nomeRef, carregar, salvar, gravar, hoje, somaDias, paraData, diaDe, totais,
  addItem, acharItem, editarItem, removerItem, reporItem, addFav, removerFav, kcalFav, pesos,
  novoId, exportar, importar,
} from "./store.js";
import { calcMetas, ATIVIDADE, RITMOS } from "./metas.js";
import { conversar, transcrever, testarChave } from "./ia.js";

import {
  $, esc, int, dec, lerNum, dataCurta, ui, TELAS, ACOES, FORMS, FOLHAS, MUDANCAS, ICONE,
  irParaDia, render, avisar, abrirFolha, fecharFolha,
} from "./base.js";
import { telaTreino, secaoCargas } from "./tela-treino.js";
import { secaoSuplementosDia, secaoSuplementosAjustes, secaoSono, secaoExportar } from "./extras.js";
import { iniciarAtualizador, nativo, salvarArquivo } from "./nativo.js";

const BUILD = window.NERU_BUILD || { versao: "dev", atualizacoes: "" };

const EXEMPLOS = [
  "Comi 4 ovos mexidos e um pão francês",
  "Quanto falta de proteína hoje?",
  "O que posso jantar com o que sobra?",
];

// ---------- diário ----------
function telaHoje() {
  const d = ui.data, t = totais(d), m = S.metas, itens = diaDe(d).itens;
  let resumo;
  if (m) {
    const resta = m.kcal - t.kcal, escala = Math.max(m.kcal, t.kcal) || 1;
    const segs = REFEICOES.filter((r) => t.porRef[r.id] > 0)
      .map((r) => `<i style="width:${((t.porRef[r.id] / escala) * 100).toFixed(2)}%;background:${r.cor}"></i>`).join("");
    const marca = resta < 0 ? `<b class="marca" style="left:${((m.kcal / escala) * 100).toFixed(2)}%"></b>` : "";
    const pctP = m.protein ? Math.min(100, (t.protein / m.protein) * 100) : 0;
    resumo = `
      <section class="resumo ${resta < 0 ? "passou" : ""}">
        <p class="numero"><small>${resta < 0 ? "Passou" : "Restam"}</small><span>${int(Math.abs(resta))}</span><em>kcal</em></p>
        <div class="barra kcal" role="img" aria-label="${int(t.kcal)} de ${int(m.kcal)} kcal">${segs}${marca}</div>
        <p class="legenda"><span>${int(t.kcal)} de ${int(m.kcal)} kcal</span></p>
        <div class="barra prot" role="img" aria-label="Proteína: ${int(t.protein)} de ${int(m.protein)} gramas"><i style="width:${pctP.toFixed(2)}%"></i></div>
        <p class="legenda"><span>Proteína <b>${int(t.protein)}</b> de ${int(m.protein)} g</span></p>
        <p class="legenda outros"><span>Carboidrato ${int(t.carbs)} g</span><span>Gordura ${int(t.fat)} g</span></p>
      </section>`;
  } else {
    resumo = `
      <section class="resumo sem-metas">
        <p class="numero"><span>${int(t.kcal)}</span><em>kcal</em></p>
        <p class="legenda"><span>Proteína <b>${int(t.protein)}</b> g</span><span>Carboidrato ${int(t.carbs)} g</span><span>Gordura ${int(t.fat)} g</span></p>
        <p class="convite">Preenche teu perfil para o app calcular tuas metas de calorias e proteína.</p>
        <button class="botao" data-acao="aba" data-aba="ajustes">Preencher perfil</button>
      </section>`;
  }

  const refs = REFEICOES.map((r) => {
    const lista = itens.filter((i) => i.ref === r.id);
    return `
      <section class="ref">
        <h2>
          <i class="ponto" style="background:${r.cor}"></i>
          <span class="nome">${r.nome}</span>
          <span class="sub">${lista.length ? int(t.porRef[r.id]) + " kcal" : ""}</span>
          <button class="mais" data-acao="abrir-add" data-ref="${r.id}" aria-label="Adicionar em ${r.nome}">+</button>
        </h2>
        ${lista.length ? `<ul>${lista.map(linhaItem).join("")}</ul>` : ""}
      </section>`;
  }).join("");

  return `${resumo}
    <div class="comanda">
      ${itens.length ? `<p class="colunas" aria-hidden="true"><span>kcal</span><span>prot.</span></p>` : ""}
      ${refs}
      ${secaoSuplementosDia(d)}
    </div>`;
}

function linhaItem(i) {
  return `<li><button data-acao="editar" data-id="${esc(i.id)}">
    <span class="oque">${esc(i.nome)}${i.qtd ? ` <small>${esc(i.qtd)}</small>` : ""}</span>
    <span class="pts"></span>
    <span class="kc">${int(i.kcal)}</span>
    <span class="pr">${int(i.protein)} g</span>
  </button></li>`;
}

// ---------- folha (adicionar e editar) ----------
FOLHAS.add = (f) => folhaAdd(f.ref);
FOLHAS.editar = (f) => folhaEditar(f.id);

function camposItem(i = {}) {
  const numeros = [["kcal", "Calorias", ""], ["protein", "Proteína", "g"], ["carbs", "Carbo", "g"], ["fat", "Gordura", "g"]];
  return `
    <label class="campo"><span>Alimento</span>
      <input name="nome" required maxlength="80" value="${esc(i.nome || "")}" placeholder="Arroz branco cozido" autocomplete="off"></label>
    <label class="campo"><span>Quantidade</span>
      <input name="qtd" maxlength="40" value="${esc(i.qtd || "")}" placeholder="150 g, 2 colheres, 1 unidade" autocomplete="off"></label>
    <div class="grade4">
      ${numeros.map(([n, rot, un]) => `<label class="campo"><span>${rot}${un ? ` <small>${un}</small>` : ""}</span>
        <input name="${n}" type="number" inputmode="decimal" min="0" step="0.1" ${n === "kcal" ? "required" : ""} value="${i[n] ?? ""}"></label>`).join("")}
    </div>`;
}
function lerItem(form) {
  const f = new FormData(form);
  return {
    ref: f.get("ref") || ui.folha?.ref, nome: f.get("nome"), qtd: f.get("qtd"),
    kcal: lerNum(f.get("kcal")), protein: lerNum(f.get("protein")), carbs: lerNum(f.get("carbs")), fat: lerNum(f.get("fat")),
  };
}

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
      <h3>Digitar um alimento</h3>
      ${camposItem()}
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
  if (!S.cfg.chave) {
    return `
      <div class="sem-chave">
        <h2>Registrar falando, escrevendo ou fotografando</h2>
        <p>A IA estima calorias e proteína do que comes e lança no diário. Para isso o app usa a tua conta da OpenAI: cola a chave em Ajustes. Ela fica guardada só neste aparelho.</p>
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
    for (const a of f.add) linhas.push(`<li><span class="oque">${esc(a.nome)}${a.qtd ? ` <small>${esc(a.qtd)}</small>` : ""}</span><span class="pts"></span><b>${int(a.kcal)} kcal</b></li>`);
    for (const u of f.upd) linhas.push(`<li><span class="oque">Corrigido: ${esc(u.nome)}</span></li>`);
    for (const r of f.rem) linhas.push(`<li><span class="oque">Apagado: ${esc(r.nome)}</span></li>`);
  }
  const acoes = !linhas.length ? "" : m.desfeito
    ? `<p class="nota">Desfeito</p>`
    : `<button class="link" data-acao="desfazer-msg" data-id="${esc(m.id)}">Desfazer</button>`;
  return `<li class="ia"><p>${esc(m.texto)}</p>${linhas.length ? `<ul class="feito ${m.desfeito ? "desfeito" : ""}">${linhas.join("")}</ul>` : ""}${acoes}</li>`;
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
    const it = addItem(d, { ref: a.meal, nome: a.name, qtd: a.qty, kcal: a.kcal, protein: a.protein, carbs: a.carbs, fat: a.fat });
    feito.add.push({ id: it.id, nome: it.nome, qtd: it.qtd, kcal: it.kcal });
  }
  for (const u of res.update) {
    const c = {};
    if (u.meal != null) c.ref = u.meal;
    if (u.name != null) c.nome = u.name;
    if (u.qty != null) c.qtd = u.qty;
    for (const k of ["kcal", "protein", "carbs", "fat"]) if (u[k] != null) c[k] = u[k];
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
    S.chat.push({ id: novoId("m"), de: "ia", texto: res.reply || (feito ? "Registrado." : "Não entendi. Pode dizer de outro jeito?"), d, feito, h: Date.now() });
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

// ---------- progresso ----------
function grafico(ps) {
  const L = 320, A = 96, m = 8;
  const kgs = ps.map((p) => p.kg), min = Math.min(...kgs), max = Math.max(...kgs), faixa = max - min || 1;
  const x = (i) => (ps.length === 1 ? L / 2 : m + (i * (L - 2 * m)) / (ps.length - 1));
  const y = (kg) => m + (1 - (kg - min) / faixa) * (A - 2 * m);
  const pontos = ps.map((p, i) => `${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const fim = ps.length - 1;
  return `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img" aria-label="Peso de ${dec(ps[0].kg)} kg a ${dec(ps[fim].kg)} kg em ${ps.length} registros">
    ${ps.length > 1 ? `<polyline points="${pontos}"/>` : ""}
    <circle cx="${x(fim).toFixed(1)}" cy="${y(ps[fim].kg).toFixed(1)}" r="4.5"/>
  </svg>`;
}

function telaProgresso() {
  const h = hoje(), ps = pesos().slice(-30), m = S.metas;
  let blocoPeso = `<p class="vazio">Registra teu peso de vez em quando para ver a curva aqui.</p>`;
  if (ps.length) {
    const a = ps[0], z = ps[ps.length - 1], delta = z.kg - a.kg;
    const desde = dataCurta(a.d);
    blocoPeso = `
      <p class="peso-atual"><span>${dec(z.kg)}</span><em>kg</em></p>
      ${ps.length > 1 ? `<p class="legenda"><span>${delta > 0 ? "+" : delta < 0 ? "−" : ""}${dec(Math.abs(delta))} kg desde ${desde}</span></p>` : ""}
      ${ps.length > 1 ? grafico(ps) : `<p class="vazio">A curva aparece a partir do segundo registro.</p>`}`;
  }

  const dias = [];
  for (let n = 6; n >= 0; n--) { const d = somaDias(h, -n); dias.push({ d, t: totais(d) }); }
  const comRegistro = dias.filter((x) => x.t.kcal > 0);
  const escala = Math.max(m?.kcal || 0, ...dias.map((x) => x.t.kcal)) || 1;
  const media = comRegistro.length ? {
    kcal: comRegistro.reduce((s, x) => s + x.t.kcal, 0) / comRegistro.length,
    protein: comRegistro.reduce((s, x) => s + x.t.protein, 0) / comRegistro.length,
  } : null;

  return `
    <section class="secao">
      <h2>Peso</h2>
      ${blocoPeso}
      <form class="par" data-form="peso">
        <input name="kg" type="number" inputmode="decimal" min="20" max="400" step="0.1" required placeholder="Peso de hoje em kg" value="${S.dias[h]?.peso || ""}" aria-label="Peso de hoje em kg">
        <button class="botao">Registrar peso</button>
      </form>
    </section>
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
    </section>
    ${secaoCargas()}
    ${secaoSono()}
    ${secaoExportar()}`;
}

// ---------- ajustes ----------
function explicarMetas(m, u) {
  if (S.metasManuais) return "Metas definidas por ti.";
  if (!m || !u) return "";
  const at = ATIVIDADE[u.atividade];
  let t = `Gasto estimado de ${int(m.gasto)} kcal por dia (basal de ${int(m.tmb)} com atividade ${at.nome.toLowerCase()})`;
  if (u.objetivo === "perder") t += `, menos ${int(Math.abs(m.ajuste))} para perder cerca de ${Number(u.ritmo).toLocaleString("pt-BR")} kg por semana.`;
  else if (u.objetivo === "ganhar") t += `, mais ${int(m.ajuste)} para ganhar cerca de ${Number(u.ritmo).toLocaleString("pt-BR")} kg por semana.`;
  else t += ", sem ajuste, para manter o peso.";
  if (m.noPiso) t += ` A conta deu abaixo de ${int(m.kcal)} kcal, então a meta ficou nesse piso de segurança. Escolhe um ritmo mais leve.`;
  return t;
}

function telaAjustes() {
  const u = S.user || { sexo: "m", atividade: "moderado", objetivo: "perder", ritmo: 0.5 }, m = S.metas, c = S.cfg;
  const marcado = (a, b) => (a === b ? "checked" : "");
  const teste = ui.testeIA ? `<p class="resultado ${ui.testeIA.ok ? "ok" : "ruim"}">${esc(ui.testeIA.texto)}</p>` : "";
  return `
    <section class="secao">
      <h2>Perfil</h2>
      ${S.user ? "" : `<p class="intro">Para começar, preenche teus dados. O app calcula quantas calorias e quanta proteína comer por dia.</p>`}
      <form data-form="perfil">
        <fieldset class="opcoes"><legend>Sexo, para a fórmula do gasto</legend>
          <label><input type="radio" name="sexo" value="m" ${marcado(u.sexo, "m")}><span>Homem</span></label>
          <label><input type="radio" name="sexo" value="f" ${marcado(u.sexo, "f")}><span>Mulher</span></label>
        </fieldset>
        <div class="grade3">
          <label class="campo"><span>Idade</span><input name="idade" type="number" inputmode="numeric" min="14" max="100" required value="${u.idade ?? ""}"></label>
          <label class="campo"><span>Altura <small>cm</small></span><input name="altura" type="number" inputmode="numeric" min="120" max="230" required value="${u.altura ?? ""}"></label>
          <label class="campo"><span>Peso <small>kg</small></span><input name="peso" type="number" inputmode="decimal" min="30" max="300" step="0.1" required value="${u.peso ?? ""}"></label>
        </div>
        <label class="campo"><span>Atividade</span>
          <select name="atividade">${Object.entries(ATIVIDADE).map(([k, a]) => `<option value="${k}" ${k === u.atividade ? "selected" : ""}>${a.nome}: ${a.desc}</option>`).join("")}</select></label>
        <fieldset class="opcoes"><legend>Objetivo</legend>
          <label><input type="radio" name="objetivo" value="perder" ${marcado(u.objetivo, "perder")}><span>Perder gordura</span></label>
          <label><input type="radio" name="objetivo" value="manter" ${marcado(u.objetivo, "manter")}><span>Manter</span></label>
          <label><input type="radio" name="objetivo" value="ganhar" ${marcado(u.objetivo, "ganhar")}><span>Ganhar massa</span></label>
        </fieldset>
        <label class="campo" id="campo-ritmo" ${u.objetivo === "manter" ? "hidden" : ""}><span>Ritmo</span>
          <select name="ritmo">${RITMOS.map((r) => `<option value="${r}" ${Number(u.ritmo) === r ? "selected" : ""}>${r.toLocaleString("pt-BR")} kg por semana</option>`).join("")}</select></label>
        <button class="botao cheio">Salvar perfil</button>
      </form>
    </section>

    <section class="secao">
      <h2>Metas do dia</h2>
      ${m ? `<p class="metas"><b>${int(m.kcal)}</b> kcal e <b>${int(m.protein)}</b> g de proteína</p><p class="texto">${esc(explicarMetas(m, S.user))}</p>` : `<p class="vazio">Salva o perfil para o app calcular.</p>`}
      <label class="chave-liga"><input type="checkbox" id="manuais" ${S.metasManuais ? "checked" : ""}><span>Definir as metas na mão</span></label>
      <form class="par" data-form="metas" ${S.metasManuais ? "" : "hidden"}>
        <label class="campo"><span>Calorias</span><input name="kcal" type="number" inputmode="numeric" min="800" max="8000" required value="${m?.kcal ?? ""}"></label>
        <label class="campo"><span>Proteína <small>g</small></span><input name="protein" type="number" inputmode="numeric" min="20" max="500" required value="${m?.protein ?? ""}"></label>
        <button class="botao">Salvar metas</button>
      </form>
    </section>

    ${secaoSuplementosAjustes()}

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
      <h2>Teus dados</h2>
      <p class="texto">Tudo fica guardado só neste aparelho. Se limpares os dados do app ou trocares de celular, o diário vai junto, então guarda um backup de vez em quando. Ele leva diário, treinos, favoritos e metas.</p>
      <div class="par botoes">
        <button class="botao fraco" data-acao="backup">Baixar backup</button>
        <button class="botao fraco" data-acao="escolher-backup">Restaurar backup</button>
        <input type="file" id="arq-backup" accept="application/json,.json" hidden>
      </div>
      ${ui.restaurar ? `<div class="confirma"><p>Restaurar troca o diário atual pelo do arquivo ${esc(ui.restaurar.nome)}.</p>
        <div class="par botoes"><button class="botao perigo" data-acao="confirmar-restaurar">Restaurar</button><button class="botao fraco" data-acao="cancelar-restaurar">Cancelar</button></div></div>` : ""}
    </section>
    <p class="rodape">Neru Calorias, versão ${esc(BUILD.versao)}${nativo ? " (app Android)" : ""}</p>`;
}

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
    try { await importar(r.texto); avisar("Backup restaurado"); }
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
      S.user.peso = kg;
      if (!S.metasManuais) {
        const antes = S.metas?.kcal;
        S.metas = calcMetas(S.user);
        if (antes && S.metas && antes !== S.metas.kcal) extra = `. Meta ajustada para ${int(S.metas.kcal)} kcal`;
      }
    }
    salvar(); render();
    avisar(`Peso registrado: ${dec(kg)} kg${extra}`);
  },
  perfil(form) {
    const f = new FormData(form), primeiraVez = !S.metas;
    S.user = {
      sexo: f.get("sexo") === "f" ? "f" : "m",
      idade: Math.round(lerNum(f.get("idade"))), altura: Math.round(lerNum(f.get("altura"))),
      peso: Math.round(lerNum(f.get("peso")) * 10) / 10,
      atividade: f.get("atividade"), objetivo: f.get("objetivo") || "manter", ritmo: lerNum(f.get("ritmo")) || 0.5,
    };
    if (!S.metasManuais || !S.metas) { S.metas = calcMetas(S.user); S.metasManuais = false; }
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
  if (el.name === "objetivo") { $("#campo-ritmo").hidden = el.value === "manter"; return true; }
  if (el.id === "manuais") {
    S.metasManuais = el.checked;
    if (!el.checked && S.user) S.metas = calcMetas(S.user);
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
  // Virou o dia com o app aberto: acompanha o novo "hoje"
  if (ui.seguindoHoje && ui.data !== hoje()) irParaDia(hoje());
});

// ---------- início ----------
TELAS.hoje = { comData: true, html: telaHoje };
TELAS.ia = { comData: true, html: telaIA, depois: fimDoChat, manterRolagem: true };
TELAS.treino = telaTreino;
TELAS.progresso = { titulo: "Progresso", html: telaProgresso };
TELAS.ajustes = { titulo: "Ajustes", html: telaAjustes };

await carregar();
if (!S.user) ui.aba = "ajustes";
render();
iniciarAtualizador(BUILD);

if (!nativo && "serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* sem modo offline, o app segue funcionando */ });
}
