// Aba Perfil: a ficha do corpo como uma ficha de personagem (avatar, dados, motor, composição, medidas e
// fotos), a tela de medidas com a fita sobre o avatar e a linha do tempo entre as medições.

import { S, hoje, pesos, paraData, MEDIDAS, LADOS, medicoes, medidasAte, salvar } from "./store.js";
import { $, esc, int, dec, lerNum, dataCurta, ui, TELAS, ACOES, FORMS, MUDANCAS, ICONE, render, avisar } from "./base.js";
import { ATIVIDADE, TRABALHO, calcMetas, idadeAtual } from "./metas.js";
import { tendencia, gastoEstimado } from "./nutri.js";
import { composicao, registrarMedidas, sessoesDeFotos, dobrasAte, NOME_METODO } from "./corpo.js";
import { carregarCorpo, montarCorpo, svgCorpo, REF, MEDIDA_DO_MUSCULO } from "./avatar.js";
import { hidratarFotos } from "./tela-equipe.js";

const ICONE_LAPIS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>`;
const ICONE_HALTER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/></svg>`;
const ICONE_CADEADO = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
const sinal = (n) => (n > 0 ? "+" : n < 0 ? "−" : "");
const um = (n) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const OBJETIVOS = { perder: "Perder gordura", manter: "Manter", ganhar: "Ganhar massa" };
// Outros módulos penduram seções no perfil (a avaliação corporal, por exemplo): fn() devolve HTML
export const SECOES_PERFIL = [];

// Medidas da tela: as 9 e, com "medir os dois lados" ligado, o lado esquerdo de cada membro logo depois do direito
export function listaMedidas() {
  if (!S.cfg.doisLados) return MEDIDAS;
  return MEDIDAS.flatMap((x) => (LADOS.includes(x.id)
    ? [{ ...x, nome: `${x.nome} dir.` }, { ...x, id: `${x.id}_esq`, nome: `${x.nome} esq.` }] : [x]));
}
export const nomeMedida = (id) => listaMedidas().find((m) => m.id === id)?.nome || MEDIDAS.find((m) => m.id === id.replace("_esq", ""))?.nome || id;

// ---------- avatar ----------
// O desenho do corpo chega por fetch; até lá a tela mostra o lugar dele e redesenha quando chegar
let corpo = null;
export function comCorpo() {
  if (corpo) return true;
  // redesenha a tela que estiver esperando o avatar, seja qual for
  carregarCorpo().then((d) => { corpo = d; if (document.querySelector(".avatar-carregando")) render(); }).catch(() => {});
  return false;
}
export const sexo = () => (S.user?.sexo === "f" ? "f" : "m");
export const CARREGANDO = `<span class="avatar-carregando">Desenhando o corpo…</span>`;

// As dobras dizem em que região está a gordura: cada classe do avatar engrossa ou afina pela dobra dela
const DOBRA_DA_CLASSE = [["abdominal", "suprailiaca"], ["coxa"], ["peitoral", "triceps", "subescapular"], ["triceps", "coxa", "axilar"]];
function ajusteDasDobras(d) {
  const dob = dobrasAte(d)?.dobras;
  if (!dob) return null;
  const media = (ids) => { const v = ids.map((k) => dob[k]).filter((x) => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const geral = media(Object.keys(dob));
  if (!geral) return null;
  return [...DOBRA_DA_CLASSE.map((ids) => { const r = media(ids); return r ? Math.min(1.6, Math.max(0.6, r / geral)) : 1; }), 1];
}

// Medidas do corpo numa data: a última de cada parte, a % de gordura e onde ela está
export function corpoEm(d = hoje(), extra = {}) {
  const ms = medidasAte(d), m = {};
  for (const k in ms) m[k] = ms[k].v;
  Object.assign(m, extra);
  const comp = composicao({ d, ...m });
  m.bf = comp?.bf ?? REF[sexo()].bf;
  return { m, comp, ajuste: ajusteDasDobras(d) };
}
// O lado esquerdo do corpo é o direito da tela de frente e o esquerdo de costas
function paraVista(m, vista) {
  const out = { ...m };
  for (const k of LADOS) if (m[`${k}_esq`] > 0) out[`${k}_${vista === "back" ? "l" : "r"}`] = m[`${k}_esq`];
  return out;
}
// Corpo montado numa vista ("front" ou "back"); op vai para o montarCorpo (camada de cor etc.)
export function desenhar(vista = "front", d = hoje(), extra = {}, op = {}) {
  const { m, ajuste } = corpoEm(d, extra);
  return montarCorpo(corpo[sexo()][vista], sexo(), paraVista(m, vista), { ...(ajuste ? { ajusteGordura: ajuste } : {}), ...op });
}

// ---------- fita sobre o avatar ----------
// Onde passar a fita, pelas caixas dos músculos já escalados: [músculo da altura, fração da altura], os dois
// lados (um músculo de cada lado) ou o membro, e a classe de gordura. De frente, o lado direito da pessoa é o
// esquerdo da tela ("l"); a medida principal dos membros é a do lado direito.
const FITA = {
  pescoco: { y: ["neck:l", 0.55], lados: ["neck:l", "neck:r"], g: 3 },
  ombros: { y: ["deltoids:l", 0.35], lados: ["deltoids:l", "deltoids:r"], g: 3 },
  peito: { y: ["chest:l", 0.6], lados: ["chest:l", "chest:r"], g: 2 },
  braco: { y: ["biceps:l", 0.5], membro: ["biceps:l", "triceps:l"], g: 2 },
  antebraco: { y: ["forearm:l", 0.25], membro: ["forearm:l"], g: 3, parte: 0.7, deFora: true },
  cintura: { y: ["abs:l", 0.62], lados: ["obliques:l", "obliques:r"], g: 0 },
  quadril: { y: ["quadriceps:l", 0.06], lados: ["quadriceps:l", "quadriceps:r"], g: 1 },
  coxa: { y: ["quadriceps:l", 0.4], membro: ["adductors:l", "quadriceps:l"], g: 1 },
  panturrilha: { y: ["calves:l", 0.35], membro: ["calves:l", "tibialis:l"], g: 3 },
};
const trocaLado = (k) => k.replace(/:l$/, ":X").replace(/:r$/, ":l").replace(/:X$/, ":r");
for (const k of LADOS) {
  const f = FITA[k];
  FITA[`${k}_esq`] = { ...f, y: [trocaLado(f.y[0]), f.y[1]], membro: f.membro.map(trocaLado), deFora: !f.deFora && f.parte ? true : undefined };
}
function linhaDaFita(c, id) {
  const f = FITA[id], C = c.caixas, cy = f && C[f.y[0]];
  if (!cy) return null;
  const y = cy[1] + (cy[3] - cy[1]) * f.y[1], meia = (c.gordura[f.g]?.w || 0) / 2;
  let x1, x2;
  if (f.lados) {
    const a = C[f.lados[0]], b = C[f.lados[1]];
    if (!a || !b) return null;
    x1 = a[0] - meia; x2 = b[2] + meia;
  } else {
    const cs = f.membro.map((k) => C[k]).filter(Boolean);
    if (!cs.length) return null;
    x1 = Math.min(...cs.map((b) => b[0])) - meia; x2 = Math.max(...cs.map((b) => b[2])) + meia;
    // antebraço: só a parte de cima, perto do cotovelo (que fica do lado de dentro)
    if (f.parte) { const w = (x2 - x1) * f.parte; if (f.deFora) x1 = x2 - w; else x2 = x1 + w; }
  }
  return `M${x1.toFixed(1)} ${y.toFixed(1)} L${x2.toFixed(1)} ${y.toFixed(1)}`;
}
function svgComFita(c, sel, op = {}) {
  const outras = listaMedidas().filter((x) => x.id !== sel).map((x) => linhaDaFita(c, x.id)).filter(Boolean).join(" ");
  const ativa = sel ? linhaDaFita(c, sel) : "";
  const extra = `<path d="${outras}" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-dasharray="14 10" stroke-opacity="0.85"/>`
    + (ativa ? `<path d="${ativa}" fill="none" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round"/><path d="${ativa}" fill="none" stroke="#241A22" stroke-width="9" stroke-linecap="round" stroke-dasharray="20 10"/>` : "");
  return svgCorpo(c, { ...op, cores: { sel: "#F27A68" }, extra });
}

// ---------- perfil ----------
function diasDeJornada() {
  const datas = Object.keys(S.dias).sort();
  return datas.length ? Math.round((new Date(hoje()) - new Date(datas[0])) / 864e5) + 1 : 0;
}

function heroi() {
  const u = S.user, idade = idadeAtual(u), { comp } = corpoEm();
  const dias = diasDeJornada();
  const avatar = comCorpo()
    ? svgCorpo(desenhar("front"), { sombra: true, rotulo: "Seu corpo desenhado com as suas medidas" })
    : CARREGANDO;
  const sub = [idade ? `${idade} anos` : "", u.altura ? `${(u.altura / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m` : "", u.sexo === "f" ? "Feminino" : "Masculino"].filter(Boolean).join(" · ");
  return `
    <section class="heroi">
      <div class="heroi-chips">
        <button class="chip escuro" data-acao="aba" data-aba="objetivo" data-volta="perfil">${esc(OBJETIVOS[u.objetivo] || "Objetivo")}</button>
        ${dias ? `<span class="chip">Jornada · dia ${int(dias)}</span>` : ""}
      </div>
      <button class="heroi-corpo" data-acao="aba" data-aba="medidas" aria-label="Abrir as medidas no corpo">
        ${avatar}
        ${comp ? `<span class="flutua esq"><b>${dec(comp.bf)}%</b><small>gordura</small></span>
          <span class="flutua dir"><b>${dec(comp.magra)} kg</b><small>massa magra</small></span>` : ""}
      </button>
      <h2 class="heroi-nome">${esc(u.apelido || "Seu perfil")}</h2>
      <p class="heroi-sub">${esc(sub)}</p>
      <div class="par botoes">
        <button class="botao escuro" data-acao="aba" data-aba="medidas">${ICONE.fita}Medir</button>
        <button class="botao claro" data-acao="aba" data-aba="corpotreino" data-volta="perfil">${ICONE_HALTER}Treino no corpo</button>
      </div>
      <button class="link-heroi" data-acao="aba" data-aba="linha">Ver a linha do tempo do corpo</button>
    </section>`;
}

function secaoFicha() {
  const u = S.user, idade = idadeAtual(u);
  const t = tendencia(), atual = t[t.length - 1], semana = t[t.length - 8];
  const delta = atual && semana ? atual.kg - semana.kg : null;
  const ps = pesos().slice(-56);
  let linha = "";
  if (ps.length > 1) {
    const vs = ps.map((p) => p.kg), min = Math.min(...vs), max = Math.max(...vs), faixa = max - min || 1;
    const pts = ps.map((p, i) => `${((i / (ps.length - 1)) * 116 + 2).toFixed(1)},${(4 + (1 - (p.kg - min) / faixa) * 28).toFixed(1)}`).join(" ");
    linha = `<svg class="mini-linha" viewBox="0 0 120 36" aria-hidden="true"><polyline points="${pts}"/></svg>`;
  }
  return `
    <section class="secao">
      <h2>Ficha</h2>
      <div class="cartoes3">
        <div class="cartao"><span>Idade</span><b>${idade ?? "–"}</b><small>${u.nascimento ? esc(dataCurta(u.nascimento) + " " + u.nascimento.slice(0, 4)) : "falta a data nos Ajustes"}</small></div>
        <div class="cartao"><span>Altura</span><b>${int(u.altura)}</b><small>cm</small></div>
        <div class="cartao"><span>Sexo</span><b>${u.sexo === "f" ? "F" : "M"}</b><small>nas fórmulas</small></div>
      </div>
      <div class="cartao largo">
        <div><span>Peso (tendência)</span><b>${atual ? `${dec(atual.kg)} kg` : `${dec(u.peso)} kg`}</b>
          ${delta != null ? `<small class="${delta < 0 ? "desceu" : delta > 0 ? "subiu" : ""}">${sinal(delta)}${dec(Math.abs(delta))} kg na semana</small>` : `<small>pese-se de 3 a 7 vezes por semana</small>`}</div>
        <div class="peso-lado">${linha}<small>${ps.length > 1 ? `${Math.max(1, Math.round((paraData(ps[ps.length - 1].d) - paraData(ps[0].d)) / 6048e5))} semanas · ${dec(Math.min(7, (ps.length / Math.max(1, (paraData(ps[ps.length - 1].d) - paraData(ps[0].d)) / 6048e5))))} pesagens/sem` : ""}</small></div>
      </div>
    </section>`;
}

function secaoMotor() {
  const u = S.user, base = calcMetas(u), ge = gastoEstimado(), g = ge?.real, m = S.metas;
  const atv = m?.atividade || { fonte: "declarado" }, at = ATIVIDADE[u.atividade];
  const etapa = ge?.fonte || "declarado";
  const falta = g && !g.ok ? `medido depois de ${g.faltaPesagens ? `mais ${g.faltaPesagens} pesagens` : `mais ${g.faltaDias} dias de registro`}` : "";
  const desc = { medido: `Medido pelo peso e pelo diário · confiança ${g?.confianca}`, estimado: g?.ok ? `Misturando a fórmula com o medido (${int(g.tdee)} kcal, confiança ${g.confianca})` : `Pelos seus treinos · ${falta}`, declarado: `Pela fórmula · ${falta}` }[etapa];
  return `
    <section class="secao">
      <h2>Motor</h2>
      <ul class="linhas">
        <li><span><b>Metabolismo basal</b><small>Com o peso e a idade de hoje</small></span><span class="valor-dir"><b>${base ? `${int(base.tmb)} kcal` : "–"}</b>${m?.magra ? `<small>pela massa magra: ${int(370 + 21.6 * m.magra)}</small>` : ""}</span></li>
        <li class="com-etapas"><span><b>Gasto diário</b><small>${esc(desc)}</small></span><b>${ge ? `${int(ge.kcal)} kcal` : "–"}</b>
          <span class="etapas">${["declarado", "estimado", "medido"].map((e) => `<i class="${e === etapa ? "on" : ""}">${{ declarado: "Declarado", estimado: "Estimado", medido: "Medido" }[e]}</i>`).join("")}</span></li>
        <li><span><b>Atividade</b><small>${atv.fonte === "estimado" ? `${dec(atv.treinos)} treinos${atv.cardioMin ? ` e ${int(atv.cardioMin)} min de cardio` : ""} por semana nas últimas 4` : esc(at ? at.desc : "")}${u.trabalho ? ` · trabalho ${esc(TRABALHO[u.trabalho].toLowerCase())}` : ""}</small></span><b>${atv.fonte === "estimado" ? "Pelos treinos" : esc(at?.nome || "–")}</b></li>
        ${m ? `<li><span><b>Proteína</b><small>${m.proteinaPela === "magra" ? `Pela massa magra (${dec(m.magra)} kg)` : "Pelo peso; com dobras ou fita, sai da massa magra"}</small></span><b>${int(m.protein)} g</b></li>` : ""}
      </ul>
    </section>`;
}

function secaoComposicao() {
  const cs = medicoes().map((x) => ({ d: x.d, c: composicao(x) })).filter((x) => x.c);
  const ultima = cs[cs.length - 1], z = ultima?.c;
  // compara com a primeira medição em que a gordura saiu do mesmo jeito (fita com fita, dobras com dobras)
  const inicio = z ? cs.find((x) => x.c.metodo === z.metodo) : null, a = inicio?.c;
  if (!z) {
    return `
      <section class="secao">
        <h2>Composição</h2>
        <p class="vazio">Meça pescoço e cintura${S.user.sexo === "f" ? " (e quadril)" : ""} para o app calcular a gordura e a massa magra.</p>
      </section>`;
  }
  const varia = inicio && inicio !== ultima;
  return `
    <section class="secao">
      <h2>Composição</h2>
      <div class="cartoes2">
        <div class="cartao"><span>Gordura</span><b>${dec(z.bf)}%</b><small>${esc(NOME_METODO[z.metodo] || "")}${z.calibrada ? " · calibrada" : ""}${varia ? ` · ${sinal(z.bf - a.bf)}${dec(Math.abs(z.bf - a.bf))} pts desde ${dataCurta(inicio.d)}` : ""}</small></div>
        <div class="cartao"><span>Magra</span><b>${dec(z.magra)} kg</b><small class="${varia && z.magra > a.magra ? "desceu" : ""}">${varia ? `${sinal(z.magra - a.magra)}${dec(Math.abs(z.magra - a.magra))} desde ${dataCurta(inicio.d)}` : `gordura: ${dec(z.gorda)} kg`}</small></div>
      </div>
    </section>`;
}

function secaoMedidasResumo() {
  const ms = medidasAte(), todas = medicoes();
  const primeira = (id) => todas.find((x) => x[id] > 0);
  const linhas = MEDIDAS.map((x) => {
    if (!ms[x.id]) return `<li><span>${esc(x.nome)}</span><span class="valor"><small class="falta">faltando</small><b>—</b></span></li>`;
    const p = primeira(x.id), dif = p && p.d !== ms[x.id].d ? ms[x.id].v - p[x.id] : 0;
    // cintura e quadril descendo é bom; o resto subindo é músculo
    const bom = dif && ((x.id === "cintura" || x.id === "quadril") ? dif < 0 : dif > 0);
    return `<li><span>${esc(x.nome)}</span><span class="valor">${dif ? `<small class="${bom ? "bom" : ""}">${sinal(dif)}${um(Math.abs(dif))}</small>` : ""}<b>${um(ms[x.id].v)} cm</b></span></li>`;
  });
  const feitas = MEDIDAS.filter((x) => ms[x.id]).length;
  return `
    <section class="secao">
      <div class="titulo-linha"><h2>Medidas</h2><button class="link" data-acao="aba" data-aba="medidas">${feitas ? `Ver as ${MEDIDAS.length}` : "Começar"}</button></div>
      ${feitas ? `<ul class="linhas medidas-resumo">${linhas.join("")}</ul>` : `<p class="vazio">Com fita métrica, a cada 2 a 4 semanas. O avatar segue cada medida.</p>`}
    </section>`;
}

function secaoFotosResumo() {
  const s = sessoesDeFotos()[0];
  const poses = [["frente", "Frente"], ["lado", "Lado"], ["costas", "Costas"]];
  return `
    <section class="secao">
      <div class="titulo-linha"><h2>Fotos</h2><button class="link" data-acao="aba" data-aba="fotos">${s ? "Comparar" : "Tirar"}</button></div>
      <div class="fotos-perfil">
        ${poses.map(([p, nome]) => `<button class="foto-tile" data-acao="aba" data-aba="fotos" data-pose="${p}">${s?.poses[p] ? `<img data-foto="${esc(s.poses[p])}" alt="">` : ""}<span><b>${nome}</b><small>${s ? dataCurta(s.d) : "sem foto"}</small></span></button>`).join("")}
      </div>
      <p class="dica com-icone">${ICONE_CADEADO}As fotos ficam só no aparelho</p>
    </section>`;
}

function telaPerfil() {
  if (!S.user) {
    return `<section class="secao"><p class="intro">Preencha seus dados para montar o seu perfil e o seu avatar.</p>
      <button class="botao cheio" data-acao="aba" data-aba="dados">Preencher os dados</button></section>`;
  }
  return heroi() + secaoFicha() + secaoMotor() + secaoComposicao() + SECOES_PERFIL.map((fn) => fn()).join("") + secaoMedidasResumo() + secaoFotosResumo()
    + `<section class="secao"><button class="botao fraco cheio" data-acao="aba" data-aba="ajustes" data-volta="perfil">${ICONE.ajustes}Ajustes do app</button></section>`;
}

// ---------- medidas no avatar ----------
const valorHoje = (id) => S.dias[hoje()]?.med?.[id];
function medidaSelecionada() {
  const lista = listaMedidas();
  if (lista.some((x) => x.id === ui.medida)) return ui.medida;
  return (lista.find((x) => !valorHoje(x.id)) || lista[0]).id;
}
// Corpo com o valor que está sendo digitado (para o avatar responder antes de salvar)
function avatarMedidas(sel, digitado) {
  if (!comCorpo()) return CARREGANDO;
  const extra = digitado > 0 ? { [sel]: digitado } : {};
  // destaca os músculos da medida; nos membros, só o lado medido (o direito da pessoa é o esquerdo da tela)
  const base = sel.replace("_esq", ""), lado = LADOS.includes(base) ? (sel.endsWith("_esq") ? "r" : "l") : null;
  const c = desenhar("front", hoje(), extra, { camada: (s, l) => (MEDIDA_DO_MUSCULO[s] === base && (!lado || l === lado) ? "sel" : "musculo") });
  return svgComFita(c, sel, { rotulo: `Corpo com a linha da fita no ${nomeMedida(sel).toLowerCase()}` });
}

function telaMedidas() {
  if (!S.user) return `<section class="secao"><button class="botao cheio" data-acao="aba" data-aba="dados">Preencher os dados</button></section>`;
  const lista = listaMedidas(), sel = medidaSelecionada(), ms = medidasAte(), sm = lista.find((x) => x.id === sel);
  const hj = valorHoje(sel), ant = medicoes().filter((x) => x.d < hoje() && x[sel] > 0).pop();
  const feitas = lista.filter((x) => valorHoje(x.id)).length;
  let comparar = ant ? `Última: ${dec(ant[sel])} cm em ${dataCurta(ant.d)}` : "Primeira vez nesta medida";
  if (hj && ant) { const d = hj - ant[sel]; comparar = d ? `${sinal(d)}${dec(Math.abs(d))} cm desde ${dataCurta(ant.d)}` : `Igual a ${dataCurta(ant.d)}`; }
  return `
    <div class="palco-medidas">
      <div class="palco-corpo" id="avatar-medidas">${avatarMedidas(sel)}</div>
      <ul class="lista-medidas">
        ${lista.map((x) => {
          const v = valorHoje(x.id), velho = !v && ms[x.id];
          return `<li><button data-acao="medida" data-id="${x.id}" ${x.id === sel ? 'aria-current="true"' : ""} class="${v ? "feita" : velho ? "velha" : "falta"}">
            <span>${esc(x.nome)}</span><b>${v ? `${dec(v)} cm` : velho ? `${dec(velho.v)} cm` : "+ medir"}</b></button></li>`;
        }).join("")}
      </ul>
    </div>
    <form class="editor-medida" data-form="medida">
      <h2>${esc(sm.nome)}</h2>
      <p class="dica">${esc(sm.dica[0].toUpperCase() + sm.dica.slice(1))}.</p>
      <div class="par">
        <label class="campo-cm"><span class="so-leitor">${esc(sm.nome)} em centímetros</span>
          <input id="medida-valor" name="valor" type="number" inputmode="decimal" min="10" max="250" step="any" placeholder="0,0" value="${hj ?? ""}">
          <span aria-hidden="true">cm</span></label>
        <button class="botao">Salvar</button>
      </div>
      <div class="editor-rodape">
        <small>${esc(comparar)}</small>
        <span class="par">
          <button type="button" class="redondo" data-acao="medida-passo" data-n="-1" aria-label="Medida anterior">${ICONE.antes}</button>
          <button type="button" class="redondo" data-acao="medida-passo" data-n="1" aria-label="Próxima medida">${ICONE.depois}</button>
        </span>
      </div>
    </form>
    <label class="chave-liga"><input type="checkbox" id="dois-lados" ${S.cfg.doisLados ? "checked" : ""}><span>Medir braço, antebraço, coxa e panturrilha dos dois lados</span></label>
    ${S.cfg.doisLados ? `<p class="dica">A medida principal é a do lado direito. A diferença entre os lados aparece em <button class="link" data-acao="aba" data-aba="simetria">Simetria</button>.</p>` : ""}`;
}

// ---------- linha do tempo ----------
function pesoEm(d) {
  const ps = pesos().filter((p) => p.d <= d);
  return ps.length ? ps[ps.length - 1].kg : null;
}
function pontosDaLinha() {
  return medicoes().map((x) => {
    const { m, ajuste } = corpoEm(x.d);
    return { d: x.d, m, ajuste, peso: pesoEm(x.d) };
  });
}
function noPonto(pts, pos) {
  const i = Math.min(pts.length - 2, Math.floor(pos / 10)), t = (pos - i * 10) / 10, a = pts[i], b = pts[i + 1];
  const m = {};
  for (const k of new Set([...Object.keys(a.m), ...Object.keys(b.m)])) {
    const va = a.m[k] ?? b.m[k], vb = b.m[k] ?? a.m[k];
    m[k] = va + (vb - va) * t;
  }
  const peso = a.peso != null && b.peso != null ? a.peso + (b.peso - a.peso) * t : (t < 0.5 ? a.peso : b.peso);
  const ajuste = a.ajuste && b.ajuste ? a.ajuste.map((x, j) => x + (b.ajuste[j] - x) * t) : (t < 0.5 ? a.ajuste : b.ajuste);
  return { m, peso, ajuste, d: pts[Math.round(pos / 10)].d };
}
function conteudoLinha(pts, pos) {
  const p = noPonto(pts, pos), a = pts[0];
  const dif = (k, un) => {
    const v = p.m[k] - (a.m[k] ?? p.m[k]);
    return Math.abs(v) < 0.05 ? "0" : `${sinal(v)}${dec(Math.abs(v))}${un}`;
  };
  return {
    avatar: comCorpo() ? svgCorpo(montarCorpo(corpo[sexo()].front, sexo(), paraVista(p.m, "front"), p.ajuste ? { ajusteGordura: p.ajuste } : {}), { sombra: true, rotulo: `Corpo em ${dataCurta(p.d)}` }) : CARREGANDO,
    data: dataCurta(p.d), d: p.d,
    peso: p.peso != null ? `${dec(p.peso)} kg` : "",
    bf: `${dec(p.m.bf)}%`,
    deltas: [
      ["Peso", p.peso != null && a.peso != null ? `${sinal(p.peso - a.peso)}${dec(Math.abs(p.peso - a.peso))} kg` : "–"],
      ["Gordura", `${dif("bf", " pts")}`], ["Cintura", dif("cintura", " cm")], ["Ombros", dif("ombros", " cm")],
      ["Braço", dif("braco", " cm")], ["Coxa", dif("coxa", " cm")],
    ],
  };
}
function fotosDaData(d) {
  const s = sessoesDeFotos().find((x) => x.d === d);
  const poses = [["frente", "Frente"], ["lado", "Lado"], ["costas", "Costas"]];
  return `<span class="titulo-fotos">Fotos de ${dataCurta(d)}</span>
    <div class="fotos-perfil">${poses.map(([p, nome]) => `<button class="foto-tile pequena" data-acao="aba" data-aba="fotos" data-volta="linha">${s?.poses[p] ? `<img data-foto="${esc(s.poses[p])}" alt="">` : ""}<span><b>${nome}</b>${s?.poses[p] ? "" : "<small>sem foto</small>"}</span></button>`).join("")}</div>`;
}
const deltasHtml = (c) => c.deltas.map(([n, v]) => `<div><span>${n}</span><b>${esc(v)}</b></div>`).join("");

function telaLinha() {
  const pts = pontosDaLinha();
  if (pts.length < 2) {
    return `<section class="caixa"><p class="vazio">A linha do tempo aparece a partir da segunda medição. Ela transforma o avatar de uma data para a outra.</p>
      <button class="botao escuro cheio" data-acao="aba" data-aba="medidas">Medir agora</button></section>`;
  }
  const max = (pts.length - 1) * 10, pos = Math.min(max, ui.linhaPos ?? max), c = conteudoLinha(pts, pos);
  // marcas de mês embaixo da barra: até 5, espalhadas entre a primeira e a última medição
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => paraData(pts[Math.round(f * (pts.length - 1))].d).toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""));
  return `
    <section class="palco-linha">
      <div class="linha-corpo" id="linha-avatar">${c.avatar}</div>
      <div class="selo-data"><span>Avaliação</span><b id="linha-data">${esc(c.data)}</b></div>
      <div class="selos-dir"><span id="linha-peso" ${c.peso ? "" : "hidden"}><b>${esc(c.peso)}</b></span><span><b id="linha-bf">${esc(c.bf)}</b> gordura</span></div>
    </section>
    <section class="caixa controle-linha">
      <button class="tocar" data-acao="linha-tocar" aria-label="Tocar a evolução"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>
      <label><span class="so-leitor">Data da avaliação</span>
        <input id="linha-pos" type="range" min="0" max="${max}" step="1" value="${pos}">
        <span class="meses">${marcas.map((m) => `<span>${esc(m)}</span>`).join("")}</span></label>
    </section>
    <section class="caixa">
      <h2>Desde ${esc(dataCurta(pts[0].d))}</h2>
      <div class="deltas" id="linha-deltas">${deltasHtml(c)}</div>
    </section>
    <section class="fotos-linha" id="linha-fotos">${fotosDaData(c.d)}</section>`;
}
function atualizarLinha(pos) {
  const pts = pontosDaLinha();
  if (pts.length < 2) return;
  ui.linhaPos = pos;
  const c = conteudoLinha(pts, pos);
  $("#linha-avatar").innerHTML = c.avatar;
  $("#linha-data").textContent = c.data;
  $("#linha-bf").textContent = c.bf;
  const p = $("#linha-peso"); p.hidden = !c.peso; p.innerHTML = `<b>${esc(c.peso)}</b>`;
  $("#linha-deltas").innerHTML = deltasHtml(c);
  const f = $("#linha-fotos");
  if (f.dataset.d !== c.d) { f.dataset.d = c.d; f.innerHTML = fotosDaData(c.d); hidratarFotos(f); }
}

function subMedidas() {
  const lista = listaMedidas();
  return `${lista.filter((x) => valorHoje(x.id)).length} de ${lista.length} · toque numa medida`;
}
function subLinha() {
  const pts = pontosDaLinha();
  if (pts.length < 2) return "";
  const mes = paraData(pts[0].d).toLocaleDateString("pt-BR", { month: "long" });
  return `${pts.length} avaliações desde ${mes}`;
}

// ---------- registro ----------
TELAS.perfil = {
  titulo: "Perfil", html: telaPerfil, depois: () => hidratarFotos($("#tela")),
  botao: { acao: "aba", aba: "dados", rotulo: "Editar dados pessoais", icone: ICONE_LAPIS },
};
TELAS.medidas = { titulo: "Medidas", aba: "perfil", html: telaMedidas, sub: subMedidas, direita: () => `<span class="chip data">${esc(dataCurta(hoje()))}</span>` };
TELAS.linha = { titulo: "Linha do tempo", aba: "perfil", html: telaLinha, sub: subLinha, depois: () => hidratarFotos($("#tela")) };

let tocando = null;
Object.assign(ACOES, {
  medida(b) { ui.medida = b.dataset.id; render(); },
  "medida-passo"(b) {
    const lista = listaMedidas(), i = lista.findIndex((x) => x.id === medidaSelecionada());
    ui.medida = lista[(i + Number(b.dataset.n) + lista.length) % lista.length].id;
    render();
  },
  "linha-tocar"() {
    const el = $("#linha-pos");
    if (!el) return;
    clearInterval(tocando);
    if (Number(el.value) >= Number(el.max)) el.value = 0;
    tocando = setInterval(() => {
      const atual = $("#linha-pos");
      if (!atual || ui.aba !== "linha" || Number(atual.value) >= Number(atual.max)) { clearInterval(tocando); return; }
      atual.value = Number(atual.value) + 1;
      atualizarLinha(Number(atual.value));
    }, 90);
  },
  // atalho do perfil para comparar as fotos na aba Equipe > Corpo
  "sub-equipe-corpo"() { ui.aba = "equipe"; ui.equipe = "fisico"; render(); window.scrollTo(0, 0); },
});

FORMS.medida = (form) => {
  const sel = medidaSelecionada(), v = Math.round(lerNum(new FormData(form).get("valor")) * 10) / 10;
  const med = { ...(S.dias[hoje()]?.med || {}) };
  if (v > 0) med[sel] = v; else delete med[sel];
  registrarMedidas(med);
  salvar();
  // depois de salvar, vai para a próxima que ainda falta hoje
  const prox = listaMedidas().find((x) => !valorHoje(x.id));
  if (v > 0 && prox) ui.medida = prox.id;
  render();
  const comp = composicao({ d: hoje(), ...corpoEm().m });
  avisar(v > 0 ? `${nomeMedida(sel)}: ${dec(v)} cm${comp && (sel === "cintura" || sel === "pescoco" || sel === "quadril") ? ` · gordura ${dec(comp.bf)}%` : ""}` : `${nomeMedida(sel)} apagada`);
};

MUDANCAS.push((el) => {
  if (el.id !== "dois-lados") return false;
  S.cfg.doisLados = el.checked; salvar(); render();
  return true;
});

// Digitar a medida já muda o avatar; arrastar a linha do tempo, idem (sem redesenhar a tela toda)
document.addEventListener("input", (e) => {
  if (e.target.id === "medida-valor" && ui.aba === "medidas") {
    const el = $("#avatar-medidas");
    if (el) el.innerHTML = avatarMedidas(medidaSelecionada(), lerNum(e.target.value));
  } else if (e.target.id === "linha-pos" && ui.aba === "linha") {
    clearInterval(tocando);
    atualizarLinha(Number(e.target.value));
  }
});

