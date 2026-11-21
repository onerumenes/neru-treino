// Avaliação corporal: o dia de avaliação (passo a passo com as condições da medição), as dobras cutâneas,
// a simetria entre os lados, o mapa de dores e a saúde básica com o exame de referência.

import { S, hoje, somaDias, diaDe, salvar, MEDIDAS, LADOS, medidasAte } from "./store.js";
import { $, esc, dec, lerNum, dataCurta, ui, TELAS, ACOES, FORMS, MUDANCAS, ICONE, render, avisar } from "./base.js";
import {
  DOBRAS, DOBRAS_3, gorduraDoDia, gorduraMarinha, registrarDobras, dobrasAte, registrarExame, gorduraEm, NOME_METODO,
  PONTOS_DOR, QUANDO_DOI, pontoDor, registrarDor, alternarQuandoDoi, nivelDor, situacaoDor,
  registrarSaude, apagarSaude, sessoesDeFotos,
} from "./corpo.js";
import { svgCorpo, MEDIDA_DO_MUSCULO } from "./avatar.js";
import { LESOES } from "./personal.js";
import { nomeEx } from "./treino.js";
import { SECOES_PERFIL, comCorpo, desenhar, sexo, CARREGANDO, listaMedidas } from "./tela-perfil.js";
import { hidratarFotos } from "./tela-equipe.js";

const vb = (c) => c.vb.split(" ").map(Number);
// Posição de um ponto do desenho em % da caixa do SVG (para pôr um botão por cima)
function posicao(c, grupo, fx, fy) {
  const b = c.caixas[grupo];
  if (!b) return null;
  const [x0, y0, w, h] = vb(c);
  const x = b[0] + (b[2] - b[0]) * fx, y = b[1] + (b[3] - b[1]) * fy;
  return { left: ((x - x0) / w) * 100, top: ((y - y0) / h) * 100 };
}
const proporcao = (c) => { const [, , w, h] = vb(c); return `aspect-ratio: ${w} / ${h}`; };

// ---------- dia de avaliação ----------
const CONDICOES = [
  ["jejum", "Em jejum"], ["banheiro", "Depois do banheiro"], ["treino", "Sem treino nas últimas 24 horas"],
  ["horario", "No mesmo horário das outras vezes"], ["alcool", "Sem bebida alcoólica ontem"],
];
const avaliacaoHoje = () => S.dias[hoje()]?.avaliacao || null;
const medidasHoje = () => listaMedidas().filter((x) => S.dias[hoje()]?.med?.[x.id] > 0).length;

function ultimaAvaliacao() {
  const ds = Object.keys(S.dias).filter((d) => d < hoje() && (S.dias[d].med || S.dias[d].dobras)).sort();
  return ds[ds.length - 1] || null;
}

function telaAvaliacao() {
  const h = hoje(), av = avaliacaoHoje() || { condicoes: {} }, c = av.condicoes || {};
  const fotos = sessoesDeFotos()[0]?.d === h;
  const passos = [
    ["Condições", "Jejum, banheiro, sem treino", Object.keys(c).length > 0],
    ["Peso", "Na mesma balança, sem roupa", S.dias[h]?.peso > 0],
    ["Medidas", `${medidasHoje()} de ${listaMedidas().length} com a fita`, medidasHoje() >= 2],
    ["Dobras", "Opcional, com adipômetro", !!S.dias[h]?.dobras],
    ["Fotos", "Frente, lado e costas", fotos],
  ];
  const atual = passos.findIndex((p) => !p[2]);
  const marcadas = Object.values(c).filter(Boolean).length, semTreino = !!c.treino;
  const ult = ultimaAvaliacao();
  return `
    <section class="heroi checkup">
      <h2 class="heroi-titulo">Check-up do corpo</h2>
      <p>Uns 12 minutos, na mesma ordem e nas mesmas condições das outras vezes, para comparar de verdade.</p>
      <ol class="passos">
        ${passos.map(([nome, desc, feito], i) => `<li class="${feito ? "feito" : i === atual ? "agora" : ""}">
          <span class="num">${feito ? ICONE.feito : i + 1}</span><span><b>${nome}</b><small>${esc(desc)}</small></span></li>`).join("")}
      </ol>
    </section>

    <section class="secao">
      <h2>1 · Como você está agora?</h2>
      <p class="dica">Fica guardado junto da avaliação. Medida fora do padrão ganha um aviso e não entra nas conclusões.</p>
      <div class="condicoes">
        ${CONDICOES.map(([id, nome]) => `<button role="checkbox" aria-checked="${!!c[id]}" data-acao="condicao" data-id="${id}">
          <span class="caixa">${c[id] ? ICONE.feito : ""}</span>${esc(nome)}</button>`).join("")}
      </div>
      ${marcadas && !semTreino && !av.posTreino ? `<div class="confirma">
        <p><b>Treinou nas últimas 24 horas?</b> Braço, coxa e peito podem medir até 1 cm a mais por causa do inchaço.</p>
        <div class="par botoes"><button class="botao fraco" data-acao="condicao" data-id="treino">Não treinei</button>
          <button class="botao" data-acao="pos-treino">Medir como pós-treino</button></div></div>` : ""}
      ${av.posTreino ? `<p class="aviso-pos">Avaliação pós-treino: as medidas que incham (braço, antebraço, coxa, panturrilha, peito e ombros) ficam anotadas mas fora das comparações. <button class="link" data-acao="pos-treino">Desfazer</button></p>` : ""}
    </section>

    <section class="secao">
      <h2>2 · Peso</h2>
      <form class="par" data-form="peso">
        <input name="kg" type="number" inputmode="decimal" min="20" max="400" step="0.1" required placeholder="Peso de hoje em kg" value="${S.dias[h]?.peso || ""}" aria-label="Peso de hoje em kg">
        <button class="botao">${S.dias[h]?.peso ? "Trocar" : "Registrar"}</button>
      </form>
    </section>

    <section class="secao passos-botoes">
      <h2>3 a 5 · Corpo</h2>
      <button class="botao cheio escuro" data-acao="aba" data-aba="medidas" data-volta="avaliacao">${ICONE.fita}Medidas com a fita <small>${medidasHoje()} de ${listaMedidas().length}</small></button>
      <button class="botao fraco cheio" data-acao="aba" data-aba="dobras" data-volta="avaliacao">Dobras com adipômetro <small>${S.dias[h]?.dobras ? "feitas" : "opcional"}</small></button>
      <button class="botao fraco cheio" data-acao="ver-fotos" data-d="${h}">Fotos de frente, lado e costas <small>${fotos ? "feitas" : "a fazer"}</small></button>
      <p class="dica">${ult ? `Última avaliação: ${dataCurta(ult)}. ` : ""}Depois desta, a próxima é em ${dataCurta(somaDias(h, 28))}.</p>
    </section>`;
}

// ---------- dobras ----------
// Onde fica cada dobra no desenho: [vista, músculo, posição x, y dentro da caixa dele] (lado direito da pessoa)
const PONTO_DOBRA = {
  peitoral: ["front", "chest:l", 0.45, 0.45], axilar: ["front", "chest:l", 0.02, 0.95],
  triceps: ["back", "triceps:r", 0.5, 0.45], subescapular: ["back", "upper-back:r", 0.4, 0.62],
  abdominal: ["front", "abs:l", 0.6, 0.6], suprailiaca: ["front", "obliques:l", 0.4, 0.9],
  coxa: ["front", "quadriceps:l", 0.5, 0.45],
};
const dobrasUsadas = () => (S.cfg.dobras3 ? DOBRAS.filter((x) => DOBRAS_3[sexo()].includes(x.id)) : DOBRAS);

function vistaComPontos(vista, usadas, sel) {
  if (!comCorpo()) return `<div class="vista">${CARREGANDO}</div>`;
  const c = desenhar(vista);
  const pontos = usadas.map((x, i) => [x, i]).filter(([x]) => PONTO_DOBRA[x.id][0] === vista).map(([x, i]) => {
    const [, g, fx, fy] = PONTO_DOBRA[x.id], p = posicao(c, g, fx, fy);
    return p ? `<button class="ponto-dobra ${x.id === sel ? "on" : ""}" style="left:${p.left.toFixed(1)}%;top:${p.top.toFixed(1)}%" data-acao="dobra" data-id="${x.id}" aria-label="${esc(x.nome)}">${i + 1}</button>` : "";
  }).join("");
  return `<div class="vista" style="${proporcao(c)}">${svgCorpo(c, { rotulo: `${vista === "front" ? "Frente" : "Costas"} com os pontos das dobras` })}${pontos}
    <small>${vista === "front" ? "Frente" : "Costas"}</small></div>`;
}

function telaDobras() {
  if (!S.user) return `<section class="secao"><button class="botao cheio" data-acao="aba" data-aba="dados">Preencher os dados</button></section>`;
  const h = hoje(), usadas = dobrasUsadas(), hj = S.dias[h]?.dobras || {}, ult = dobrasAte(h);
  const ant = ult && ult.d !== h ? ult.dobras : null, sel = ui.dobra || usadas[0].id;
  // resultado de hoje, ou o da última vez que as dobras foram feitas
  const dr = gorduraDoDia(h) ? h : ult?.d, r = dr ? gorduraDoDia(dr) : null, ms = medidasAte();
  const fita = gorduraMarinha({ sexo: S.user.sexo, altura: S.user.altura, pescoco: ms.pescoco?.v, cintura: ms.cintura?.v, quadril: ms.quadril?.v });
  const base = hj.triceps ? hj : ult?.dobras || {};
  const musculo = (cm, mm) => (cm > 0 && mm > 0 ? `${dec(cm - (Math.PI * mm) / 10)} cm` : "–");
  const maiores = DOBRAS.filter((x) => base[x.id] > 0).sort((a, b) => base[b.id] - base[a.id]).slice(0, 2);
  return `
    <div class="segmentos" role="radiogroup" aria-label="Protocolo">
      <button role="radio" data-acao="protocolo-dobras" data-n="3" aria-selected="${!!S.cfg.dobras3}">3 dobras · rápido</button>
      <button role="radio" data-acao="protocolo-dobras" data-n="7" aria-selected="${!S.cfg.dobras3}">7 dobras · completo</button>
    </div>
    <div class="palco-dobras">${vistaComPontos("front", usadas, sel)}${vistaComPontos("back", usadas, sel)}</div>
    <p class="dica">A camada clara do avatar segue cada dobra.</p>
    <form data-form="dobras" class="lista-dobras">
      ${usadas.map((x, i) => `<label class="linha-dobra ${x.id === sel ? "on" : ""}">
        <span class="num">${i + 1}</span>
        <span class="nome"><b>${esc(x.nome)}</b>${x.id === sel ? `<small>${esc(x.dica)}</small>` : ant?.[x.id] ? `<small>última: ${dec(ant[x.id])} mm</small>` : ""}</span>
        <span class="mm"><input id="dobra-${x.id}" name="${x.id}" type="number" inputmode="decimal" min="1" max="99" step="any" value="${hj[x.id] ?? ""}" placeholder="0"><span>mm</span></span>
      </label>`).join("")}
      <button class="botao cheio">Salvar dobras</button>
    </form>
    <section class="resultado-dobras">
      <div><span>Gordura pelas dobras</span><b>${r ? `${dec(r.bf)}%` : "–"}</b><small>${r ? `Jackson-Pollock, ${r.metodo === "dobras7" ? "7" : "3"} dobras${dr !== h ? ` · ${dataCurta(dr)}` : ""}` : `Preencha as ${usadas.length} dobras para calcular`}</small></div>
      <div class="lado"><span>Fita: <b>${fita != null ? `${dec(fita)}%` : "–"}</b></span></div>
      <p>Com as dobras lançadas, elas viram a fonte principal da gordura por 60 dias. A fita fica como conferência.</p>
    </section>
    <section class="secao">
      <h2>Músculo e gordura por região</h2>
      <div class="cartoes2">
        <div class="cartao"><span>Músculo do braço</span><b>${musculo(ms.braco?.v, base.triceps)}</b><small>volta do braço − dobra do tríceps</small></div>
        <div class="cartao"><span>Músculo da coxa</span><b>${musculo(ms.coxa?.v, base.coxa)}</b><small>volta da coxa − dobra da coxa</small></div>
      </div>
      ${maiores.length ? `<p class="texto">Onde há mais gordura: <b>${maiores.map((x) => `${x.nome.toLowerCase()} (${dec(base[x.id])} mm)`).join(" e ")}</b>.</p>` : ""}
    </section>`;
}

// ---------- simetria ----------
function telaSimetria() {
  const ms = medidasAte(), linhas = LADOS.filter((k) => ms[k] && ms[`${k}_esq`]).map((k) => {
    const dir = ms[k].v, esq = ms[`${k}_esq`].v, dif = Math.abs(dir - esq), pct = (dif / Math.max(dir, esq)) * 100;
    return { k, nome: MEDIDAS.find((x) => x.id === k).nome, dir, esq, dif, pct, menor: dir < esq ? "dir" : esq < dir ? "esq" : null };
  });
  if (!linhas.length) {
    return `<section class="secao"><p class="vazio">Meça braço, antebraço, coxa e panturrilha dos dois lados para ver a simetria.</p>
      <button class="botao cheio" data-acao="medir-dois-lados">Ligar e medir os dois lados</button></section>`;
  }
  // destaca o lado menor dos membros com 2% ou mais de diferença (de frente, o direito da pessoa é o "l")
  const destaque = new Map(linhas.filter((x) => x.pct >= 2 && x.menor).map((x) => [x.k, x.menor === "dir" ? "l" : "r"]));
  const avatar = comCorpo()
    ? svgCorpo(desenhar("front", hoje(), {}, { camada: (s, l) => (destaque.get(MEDIDA_DO_MUSCULO[s]) === l ? "sel" : "musculo") }),
      { sombra: true, cores: { sel: "#F27A68" }, rotulo: "Corpo de frente com o lado menor destacado" })
    : CARREGANDO;
  const tag = (pct) => (pct >= 5 ? ["grande", "grande"] : pct >= 2 ? ["atenção", "atencao"] : ["ok", "ok"]);
  const menores = linhas.filter((x) => x.pct >= 2 && x.menor);
  const ladoMenor = [...new Set(menores.map((x) => x.menor))];
  return `
    <section class="heroi simetria">
      <div class="heroi-chips"><span class="chip">Direito</span><span class="chip">Esquerdo</span></div>
      <div class="heroi-corpo">${avatar}</div>
      <span class="legenda-sel"><i></i>Lado menor</span>
    </section>
    <p class="dica">O desenho exagera a diferença para ela ficar visível.</p>
    <section class="secao">
      <table class="tabela-lados">
        <thead><tr><th>Medida</th><th>Dir.</th><th>Esq.</th><th>Diferença</th></tr></thead>
        <tbody>${linhas.map((x) => { const [t, cl] = tag(x.pct); return `<tr>
          <th scope="row">${esc(x.nome)}</th><td class="${x.menor === "esq" ? "maior" : ""}">${dec(x.dir)}</td><td class="${x.menor === "dir" ? "maior" : ""}">${dec(x.esq)}</td>
          <td><b>${dec(x.dif)} cm · ${dec(x.pct)}%</b><span class="tag ${cl}">${t}</span></td></tr>`; }).join("")}</tbody>
      </table>
    </section>
    ${menores.length ? `<section class="cartao-escuro">
      <b>O que fazer</b>
      <p>${esc(menores.map((x, i) => (i ? x.nome.toLowerCase() : x.nome)).join(", "))}: o lado ${ladoMenor.length === 1 ? (ladoMenor[0] === "dir" ? "direito" : "esquerdo") : "menor"} está atrás. Nos exercícios de um lado só, comece por ele e faça no outro o mesmo número de repetições.</p>
      <small>O app avisa a partir de 2% de diferença e acompanha se ela diminui.</small>
    </section>` : `<p class="texto">Os dois lados estão parecidos: diferença abaixo de 2% em tudo.</p>`}`;
}

// ---------- dores ----------
const vistaDores = () => (ui.doresVista === "back" ? "back" : "front");
function telaDores() {
  const vista = vistaDores(), pontos = PONTOS_DOR.filter((p) => p[2] === vista);
  const sel = pontoDor(ui.dor)?.[2] === vista ? ui.dor : (pontos.find((p) => nivelDor(p[0]) > 0) || pontos[0])[0];
  const P = pontoDor(sel), dor = S.corpo.dores[sel], n = nivelDor(sel), sit = situacaoDor(sel);
  const ativas = Object.keys(S.corpo.dores).filter((id) => nivelDor(id) > 0).length, total = Object.keys(S.corpo.dores).length;
  let palco = CARREGANDO;
  if (comCorpo()) {
    const c = desenhar(vista);
    palco = svgCorpo(c, { rotulo: `Corpo ${vista === "front" ? "de frente" : "de costas"} com os pontos de dor` })
      + pontos.map(([id, nome, , g, fx, fy]) => {
        const p = posicao(c, g, fx, fy), nv = nivelDor(id), s = situacaoDor(id);
        if (!p) return "";
        const cls = nv >= 7 ? "forte" : nv >= 4 ? "media" : nv > 0 ? "leve" : s === "resolvida" ? "resolvida" : "";
        return `<button class="ponto-dor ${cls} ${id === sel ? "on" : ""}" style="left:${p.left.toFixed(1)}%;top:${p.top.toFixed(1)}%" data-acao="dor" data-id="${id}"
          aria-label="${esc(nome)}${nv ? `, dor ${nv} de 10` : s === "resolvida" ? ", resolvida" : ""}">${nv || (s === "resolvida" ? ICONE.feito : "")}</button>`;
      }).join("");
    palco = `<div class="vista" style="${proporcao(c)}">${palco}</div>`;
  }
  const evita = P[6] && n > 0 ? LESOES[P[6]].evita.map(nomeEx) : [];
  const chip = sit === "ativa" ? "ativa" : sit === "melhorando" ? "melhorando" : sit === "resolvida" ? "resolvida" : "";
  return `
    <div class="segmentos" role="radiogroup" aria-label="Vista">
      <button role="radio" data-acao="vista-dores" data-v="front" aria-selected="${vista === "front"}">Frente</button>
      <button role="radio" data-acao="vista-dores" data-v="back" aria-selected="${vista === "back"}">Costas</button>
    </div>
    <div class="palco-dores">${palco}</div>
    <section class="editor-medida dor">
      <div class="titulo-linha"><h2>${esc(P[1])}</h2>${chip ? `<span class="tag ${chip}">${{ ativa: "Ativa", melhorando: "Melhorando", resolvida: "Resolvida" }[chip]}</span>` : ""}</div>
      <label class="campo-faixa"><span><b>Quanto dói hoje</b><b>${n} de 10</b></span>
        <input id="dor-nivel" type="range" min="0" max="10" step="1" value="${n}">
        <span class="pontas"><small>0 · sem dor</small><small>10 · a pior possível</small></span></label>
      ${dor ? `<div class="chips quando">${Object.entries(QUANDO_DOI).map(([q, nome]) => `<button data-acao="dor-quando" data-q="${q}" class="${dor.quando.includes(q) ? "on" : ""}" aria-pressed="${dor.quando.includes(q)}">${nome}</button>`).join("")}</div>` : ""}
      ${dor?.hist.length > 1 ? `<div class="hist-dor"><b>Desde ${dataCurta(dor.desde)}</b><span>${dor.hist.slice(-8).map(([d, v]) => `<span><i style="height:${Math.max(4, v * 4.4)}px" class="${v >= 7 ? "forte" : v >= 4 ? "media" : v > 0 ? "leve" : ""}"></i>${dataCurta(d)}</span>`).join("")}</span></div>` : ""}
      ${evita.length ? `<div class="troca"><b>O treino se adapta enquanto doer</b><p>Saem do plano: ${esc(evita.join(", ").toLowerCase())}. A troca por um exercício do mesmo músculo aparece no treino.</p></div>` : ""}
      <p class="dica">Dor que não passa ou piora no treino é caso de médico ou fisioterapeuta.</p>
    </section>`;
}

// ---------- saúde ----------
const TIPOS_EXAME = { dexa: "DEXA", inbody: "InBody", bio: "Bioimpedância de clínica" };
function telaSaude() {
  const ex = S.corpo.exames.slice(-1)[0], pr = S.corpo.pressao.slice(-1)[0], fc = S.corpo.fc.slice(-3);
  const sangue = [...S.corpo.sangue].map((x, i) => ({ ...x, i })).sort((a, b) => (a.d < b.d ? 1 : -1));
  const atual = gorduraEm(hoje());
  const dif = ex?.ref ? Math.round((ex.ref.bf - ex.bf) * 10) / 10 : null;
  return `
    <section class="secao">
      <h2>Exame de referência</h2>
      ${ex ? `<div class="cartoes2">
          <div class="cartao"><span>${esc(TIPOS_EXAME[ex.tipo] || ex.tipo)} · ${dataCurta(ex.d)}</span><b>${dec(ex.bf)}%</b><small>${ex.magra ? `massa magra ${dec(ex.magra)} kg` : "gordura no exame"}</small></div>
          <div class="cartao"><span>O app no mesmo dia</span><b>${ex.ref ? `${dec(ex.ref.bf)}%` : "–"}</b><small>${ex.ref ? esc(NOME_METODO[ex.ref.metodo]) : "sem medidas nesse dia"}</small></div>
        </div>
        ${dif ? `<label class="chave-liga calibrar"><input type="checkbox" id="calibrar" ${S.corpo.calibrar ? "checked" : ""}><span>O app marcou <b>${dec(Math.abs(dif))} ${Math.abs(dif) === 1 ? "ponto" : "pontos"} a ${dif > 0 ? "mais" : "menos"}</b> que o exame. Calibrar desconta essa diferença das próximas estimativas ${esc(NOME_METODO[ex.ref.metodo])}, até um exame novo.</span></label>` : ""}
        ${atual?.calibrada ? `<p class="dica">Gordura de hoje, calibrada: ${dec(atual.bf)}%.</p>` : ""}`
      : `<p class="vazio">Fez DEXA, InBody ou bioimpedância de clínica? Lançando o resultado, o app compara com a fita e as dobras e pode se calibrar por ele.</p>`}
      <form class="form-saude" data-form="exame">
        <label class="campo"><span>Exame</span><select name="tipo">${Object.entries(TIPOS_EXAME).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
        <div class="grade3">
          <label class="campo"><span>Data</span><input name="d" type="date" max="${hoje()}" value="${hoje()}" required></label>
          <label class="campo"><span>Gordura <small>%</small></span><input name="bf" type="number" inputmode="decimal" min="3" max="70" step="0.1" required></label>
          <label class="campo"><span>Magra <small>kg</small></span><input name="magra" type="number" inputmode="decimal" min="20" max="150" step="0.1"></label>
        </div>
        <button class="botao fraco cheio">Adicionar exame</button>
      </form>
    </section>

    <section class="secao">
      <h2>Saúde básica</h2>
      <div class="cartoes2">
        <div class="cartao"><span>Pressão</span><b>${pr ? `${pr.sist}/${pr.diast}` : "–"}</b><small>${pr ? dataCurta(pr.d) : "ainda não medida"}</small></div>
        <div class="cartao"><span>FC de repouso</span><b>${fc.length ? `${fc[fc.length - 1].bpm} bpm` : "–"}</b><small>${fc.length > 1 ? `antes: ${fc.slice(0, -1).map((x) => x.bpm).join(", ")}` : fc.length ? dataCurta(fc[0].d) : "de manhã, antes de levantar"}</small></div>
      </div>
      <form class="par form-saude" data-form="pressao">
        <input name="sist" type="number" inputmode="numeric" min="60" max="250" placeholder="Máxima (12 = 120)" aria-label="Pressão máxima" required>
        <input name="diast" type="number" inputmode="numeric" min="30" max="160" placeholder="Mínima (8 = 80)" aria-label="Pressão mínima" required>
        <button class="botao fraco">Salvar</button>
      </form>
      <form class="par form-saude" data-form="fc">
        <input name="bpm" type="number" inputmode="numeric" min="25" max="150" placeholder="Batimentos por minuto" aria-label="Frequência cardíaca de repouso" required>
        <button class="botao fraco">Salvar</button>
      </form>
    </section>

    <section class="secao">
      <h2>Exames de sangue</h2>
      ${sangue.length ? `<ul class="linhas sangue">${sangue.slice(0, 20).map((x) => {
        const fora = (x.min != null && x.valor < x.min) || (x.max != null && x.valor > x.max);
        return `<li><span><b>${esc(x.nome)}</b><small>${dataCurta(x.d)}${x.min != null || x.max != null ? ` · faixa ${x.min ?? ""}${x.min != null && x.max != null ? "–" : x.min != null ? " ou mais" : "até "}${x.max ?? ""}` : ""}</small></span>
          <span class="valor"><b>${dec(x.valor)} ${esc(x.unidade || "")}</b><i class="estado ${fora ? "fora" : "dentro"}" role="img" aria-label="${fora ? "fora da faixa" : "dentro da faixa"}"></i>
          <button class="tirar" data-acao="apagar-sangue" data-i="${x.i}" aria-label="Apagar ${esc(x.nome)}">×</button></span></li>`;
      }).join("")}</ul>` : `<p class="vazio">Lance os resultados com a faixa que vem no laudo. Ficam guardados com o histórico.</p>`}
      <form class="form-saude" data-form="sangue">
        <div class="grade2i">
          <label class="campo"><span>Exame</span><input name="nome" maxlength="40" placeholder="Vitamina D" required></label>
          <label class="campo"><span>Resultado</span><input name="valor" type="number" inputmode="decimal" step="any" required></label>
        </div>
        <div class="grade3">
          <label class="campo"><span>Unidade</span><input name="unidade" maxlength="12" placeholder="ng/mL"></label>
          <label class="campo"><span>Faixa: de</span><input name="min" type="number" inputmode="decimal" step="any"></label>
          <label class="campo"><span>até</span><input name="max" type="number" inputmode="decimal" step="any"></label>
        </div>
        <label class="campo"><span>Data do exame</span><input name="d" type="date" max="${hoje()}" value="${hoje()}" required></label>
        <button class="botao fraco cheio">Adicionar resultado</button>
      </form>
      <p class="dica">As faixas vêm do laudo do laboratório. Nada disso entra nas contas do app; quem interpreta é o médico.</p>
    </section>`;
}

// ---------- seção no perfil ----------
function secaoAvaliacao() {
  if (!S.user) return "";
  const h = hoje(), dob = dobrasAte(h), g = dob ? gorduraDoDia(dob.d) : null, ms = medidasAte();
  const lados = LADOS.filter((k) => ms[k] && ms[`${k}_esq`]);
  const atencao = lados.filter((k) => Math.abs(ms[k].v - ms[`${k}_esq`].v) / Math.max(ms[k].v, ms[`${k}_esq`].v) >= 0.02).length;
  const ativas = Object.keys(S.corpo.dores).filter((id) => nivelDor(id) > 0).sort((a, b) => nivelDor(b) - nivelDor(a));
  const ult = ultimaAvaliacao(), prox = ult ? Math.round((new Date(somaDias(ult, 28)) - new Date(h)) / 864e5) : null;
  return `
    <section class="secao">
      <div class="titulo-linha"><h2>Avaliação corporal</h2>${prox != null ? `<small>${prox > 0 ? `próxima em ${prox} dias` : "é hora da próxima"}</small>` : ""}</div>
      <button class="cartao-escuro botao-cartao" data-acao="aba" data-aba="avaliacao">
        <span><b>Dia de avaliação</b><small>Condições, peso, medidas, dobras e fotos de uma vez</small></span>${ICONE.depois}</button>
      <div class="cartoes2 atalhos">
        <button class="cartao" data-acao="aba" data-aba="dobras"><b>Dobras</b><small>${g ? `${dec(g.bf)}% · ${dataCurta(dob.d)}` : "com adipômetro"}</small></button>
        <button class="cartao" data-acao="aba" data-aba="simetria"><b>Simetria</b><small>${lados.length ? (atencao ? `${atencao} em atenção` : "lados parecidos") : "medir os dois lados"}</small></button>
        <button class="cartao" data-acao="aba" data-aba="dores"><b>Dores e lesões</b><small>${ativas.length ? `${esc(pontoDor(ativas[0])[1])} · ${nivelDor(ativas[0])} de 10` : "nenhuma ativa"}</small></button>
        <button class="cartao" data-acao="aba" data-aba="saude"><b>Saúde</b><small>${S.corpo.exames.length || S.corpo.sangue.length ? `${S.corpo.exames.length + S.corpo.sangue.length} resultados` : "pressão, exames"}</small></button>
      </div>
    </section>`;
}
SECOES_PERFIL.push(secaoAvaliacao);

// ---------- registro ----------
const numAvaliacao = () => Object.keys(S.dias).filter((d) => d < hoje() && (S.dias[d].med || S.dias[d].dobras)).length + 1;
TELAS.avaliacao = { titulo: "Dia de avaliação", sub: () => `${numAvaliacao()}ª avaliação · a cada 4 semanas`, aba: "perfil", html: telaAvaliacao, depois: () => hidratarFotos($("#tela")) };
TELAS.dobras = { titulo: "Dobras cutâneas", sub: "Com adipômetro · lado direito do corpo", aba: "perfil", html: telaDobras };
TELAS.simetria = { titulo: "Simetria", sub: () => { const d = Object.keys(S.dias).filter((x) => S.dias[x].med && Object.keys(S.dias[x].med).some((k) => k.endsWith("_esq"))).sort().pop(); return `Lado direito × lado esquerdo${d ? ` · ${dataCurta(d)}` : ""}`; }, aba: "perfil", html: telaSimetria };
TELAS.dores = {
  titulo: "Dores e lesões", aba: "perfil", html: telaDores,
  sub: () => { const ids = Object.keys(S.corpo.dores), ativas = ids.filter((id) => nivelDor(id) > 0).length; return ids.length ? `${ids.length} ${ids.length === 1 ? "marcada" : "marcadas"} · ${ativas} ${ativas === 1 ? "ativa" : "ativas"}` : "Toque numa articulação ou região"; },
};
TELAS.saude = { titulo: "Saúde e conexões", sub: "O que vem de fora do app", aba: "perfil", html: telaSaude };

const diaAvaliacao = () => { const dia = diaDe(hoje(), true); dia.avaliacao ||= { condicoes: {} }; return dia.avaliacao; };
Object.assign(ACOES, {
  condicao(b) {
    const av = diaAvaliacao();
    av.condicoes[b.dataset.id] = !av.condicoes[b.dataset.id];
    if (b.dataset.id === "treino" && av.condicoes.treino) delete av.posTreino;
    salvar(); render();
  },
  "pos-treino"() {
    const av = diaAvaliacao();
    if (av.posTreino) delete av.posTreino; else av.posTreino = true;
    salvar(); render();
  },
  "protocolo-dobras"(b) { S.cfg.dobras3 = b.dataset.n === "3"; salvar(); render(); },
  dobra(b) { ui.dobra = b.dataset.id; render(); $(`#dobra-${b.dataset.id}`)?.focus(); },
  "medir-dois-lados"() { S.cfg.doisLados = true; salvar(); ui.aba = "medidas"; ui.volta = "simetria"; ui.medida = "braco_esq"; render(); },
  dor(b) { ui.dor = b.dataset.id; render(); },
  "vista-dores"(b) { ui.doresVista = b.dataset.v; ui.dor = null; render(); },
  "dor-quando"(b) { alternarQuandoDoi(ui.dor, b.dataset.q); render(); },
  "apagar-sangue"(b) {
    if (!b.dataset.certeza) { b.dataset.certeza = "1"; b.textContent = "Apagar?"; return; }
    apagarSaude("sangue", Number(b.dataset.i)); render();
  },
});

FORMS.dobras = (form) => {
  const f = new FormData(form), valores = {};
  for (const x of DOBRAS) valores[x.id] = lerNum(f.get(x.id)) || S.dias[hoje()]?.dobras?.[x.id] || 0;
  // só as dobras do protocolo na tela vêm do formulário; as outras do dia ficam como estavam
  for (const x of dobrasUsadas()) valores[x.id] = lerNum(f.get(x.id));
  const dob = registrarDobras(valores);
  render();
  const r = gorduraDoDia(hoje());
  avisar(dob ? (r ? `Dobras salvas: ${dec(r.bf)}% de gordura` : "Dobras salvas. Faltam algumas para calcular a gordura") : "Dobras apagadas");
};
FORMS.exame = (form) => {
  const f = new FormData(form), bf = lerNum(f.get("bf"));
  if (!(bf > 0)) return;
  registrarExame({ tipo: f.get("tipo"), bf, magra: lerNum(f.get("magra")), d: f.get("d") || hoje() });
  render(); avisar("Exame guardado");
};
FORMS.pressao = (form) => {
  const f = new FormData(form);
  let sist = lerNum(f.get("sist")), diast = lerNum(f.get("diast"));
  if (sist < 30) sist *= 10; if (diast < 20) diast *= 10; // quem escreve "12 por 8"
  registrarSaude("pressao", { sist: Math.round(sist), diast: Math.round(diast) });
  render(); avisar(`Pressão guardada: ${Math.round(sist)}/${Math.round(diast)}`);
};
FORMS.fc = (form) => {
  const bpm = Math.round(lerNum(new FormData(form).get("bpm")));
  if (!(bpm > 0)) return;
  registrarSaude("fc", { bpm });
  render(); avisar(`Frequência de repouso: ${bpm} bpm`);
};
FORMS.sangue = (form) => {
  const f = new FormData(form), num = (k) => (String(f.get(k) ?? "").trim() === "" ? null : lerNum(f.get(k)));
  registrarSaude("sangue", {
    nome: String(f.get("nome") || "").trim().slice(0, 40), valor: lerNum(f.get("valor")),
    unidade: String(f.get("unidade") || "").trim().slice(0, 12), min: num("min"), max: num("max"),
  }, f.get("d") || hoje());
  render(); avisar("Resultado guardado");
};

MUDANCAS.push((el) => {
  if (el.id === "dor-nivel" && ui.aba === "dores") {
    const vista = vistaDores(), pontos = PONTOS_DOR.filter((p) => p[2] === vista);
    const id = pontoDor(ui.dor)?.[2] === vista ? ui.dor : (pontos.find((p) => nivelDor(p[0]) > 0) || pontos[0])[0];
    ui.dor = id;
    registrarDor(id, el.value);
    render();
    return true;
  }
  if (el.id === "calibrar") { S.corpo.calibrar = el.checked; salvar(); render(); return true; }
  return false;
});

// mostra o número da dor enquanto arrasta
document.addEventListener("input", (e) => {
  if (e.target.id !== "dor-nivel") return;
  const b = e.target.closest(".campo-faixa")?.querySelector("span b:last-child");
  if (b) b.textContent = `${e.target.value} de 10`;
});

