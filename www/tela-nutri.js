// Telas do nutri: cartão do dia no Diário, "O que eu como agora?", check-in semanal e o resumo na aba Equipe.

import { S, REFEICOES, nomeRef, hoje, addItem, removerItem, porcao } from "./store.js";
import { esc, int, dec, ui, ACOES, FORMS, FOLHAS, render, avisar, abrirFolha, fecharFolha, dataCurta } from "./base.js";
import {
  sugerirResto, momentoDoDia, checkinPendente, avaliarSemana, registrarCheckin, gastoReal, perfil, adesao, ritmoPeso,
} from "./nutri.js";
import { SECOES } from "./tela-equipe.js";

const lista = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);
const nomesRefs = (refs) => lista(refs.map((r) => nomeRef(r).toLowerCase()));
// Ganchos da IA (fase 4): explicar a sugestão e o check-in com palavras. Preenchidos por tela-ia-equipe.js.
export const NARRAR = { sugestao: null, checkin: null };
// Avisos da equipe que aparecem no topo do Diário (preenchido por tela-relatorio.js)
export const AVISOS_DIARIO = [];

// ---------- cartão do dia (Diário) ----------
export function cartaoNutri(d) {
  const mo = momentoDoDia(d);
  const check = d === hoje() && checkinPendente()
    ? `<button class="aviso-equipe" data-acao="abrir-checkin"><b>Check-in da semana</b><span>2 minutos para o nutri ajustar teu plano</span></button>` : "";
  const extras = d === hoje() ? AVISOS_DIARIO.map((fn) => fn(d)).join("") : "";
  if (!mo) return check + extras;
  let texto = "", botao = "";
  if (mo.tipo === "manha") {
    texto = `Bom dia! Hoje a meta é <b>${int(mo.kcal)} kcal</b> e <b>${int(mo.prot)} g</b> de proteína.`;
    botao = `<button class="botao fraco" data-acao="o-que-comer">Sugestão para o ${nomeRef(mo.faltam[0] || "cafe").toLowerCase()}</button>`;
  } else if (mo.tipo === "meio") {
    texto = mo.kcal > 0
      ? `Faltam <b>${int(mo.kcal)} kcal</b> e <b>${int(Math.max(0, mo.prot))} g</b> de proteína para ${mo.faltam.length === 1 ? "a" : `${mo.faltam.length} refeições:`} ${nomesRefs(mo.faltam)}.`
      : `A meta de calorias do dia já foi${mo.prot > 15 ? `, mas faltam ${int(mo.prot)} g de proteína` : ""}.`;
    if (mo.kcal > 0 || mo.prot > 15) botao = `<button class="botao" data-acao="o-que-comer">O que eu como agora?</button>`;
  } else {
    const k = mo.kcal;
    texto = k >= 0 ? `Dia em ${int(mo.consumido.kcal)} kcal, ${int(k)} abaixo da meta.` : `Dia em ${int(mo.consumido.kcal)} kcal, ${int(-k)} acima da meta.`;
    texto += mo.prot > 10 ? ` Faltaram ${int(mo.prot)} g de proteína.` : " Proteína batida.";
    if (mo.faltam.length && (k > 80 || mo.prot > 15)) botao = `<button class="botao fraco" data-acao="o-que-comer">Fechar o dia</button>`;
  }
  return `${check}${extras}<section class="cartao-nutri"><p>${texto}</p>${botao}</section>`;
}

// ---------- o que eu como agora? ----------
function blocoRefeicao(r, f) {
  const e = r.escolha;
  if (!e) return `<div class="sug-ref"><h3>${nomeRef(r.ref)}</h3><p class="vazio">Sem opção que caiba em ${int(r.kcal)} kcal.</p></div>`;
  return `
    <div class="sug-ref">
      <h3><span>${nomeRef(r.ref)}</span><small>até ${int(r.kcal)} kcal</small></h3>
      <ul class="lista-ex">
        ${e.itens.map((i) => `<li><span class="oque">${esc(i.nome)} <small>${esc(porcao(i))}</small>${i.novo ? ` <em class="novo">novo</em>` : ""}</span><span class="pts"></span><b>${int(i.kcal)} kcal</b></li>`).join("")}
      </ul>
      <p class="legenda"><span><b>${int(e.kcal)}</b> kcal, <b>${int(e.protein)}</b> g de proteína</span><span>${{ habito: "do que costumas comer", plano: "do teu plano alimentar" }[e.origem] || "sugestão do cardápio"}</span></p>
      <div class="par botoes">
        <button class="botao" data-acao="registrar-sugestao" data-ref="${r.ref}">Registrar ${nomeRef(r.ref).toLowerCase()}</button>
        ${r.opcoes.length > 1 ? `<button class="botao fraco" data-acao="outra-opcao" data-ref="${r.ref}">Outra opção <small>${r.indice + 1} de ${r.opcoes.length}</small></button>` : ""}
      </div>
    </div>`;
}

FOLHAS.sugestao = (f) => {
  const s = sugerirResto(f.d, { refs: f.refs, escolhas: f.escolhas });
  ui.ultimaSugestao = s;
  if (!s) return `<h2 id="folha-titulo">O que eu como agora?</h2><p class="texto">Preenche teu perfil em Ajustes para o nutri saber tuas metas.</p>`;
  f.refs ||= s.faltam;
  const chips = `<div class="chips" role="group" aria-label="Refeições que faltam">${REFEICOES.map((r) => {
    const on = f.refs.includes(r.id);
    return `<button class="${on ? "on" : ""}" aria-pressed="${on}" data-acao="alternar-ref-sug" data-ref="${r.id}">${r.nome}</button>`;
  }).join("")}</div>`;
  let corpo;
  if (!f.refs.length) corpo = `<p class="vazio">Escolhe acima as refeições que ainda vais fazer.</p>`;
  else if (s.estourou && !s.refeicoes.length) corpo = `<p class="texto">A meta do dia já foi${s.prot > 0 ? ` e a proteína também` : ""}. Se bater fome, vai de legumes, salada, chá ou café sem açúcar.</p>`;
  else {
    corpo = (s.estourou ? `<p class="texto">As calorias do dia já foram, mas faltam ${int(s.prot)} g de proteína. Uma porção magra resolve sem pesar:</p>` : "")
      + s.refeicoes.map((r) => blocoRefeicao(r, f)).join("")
      + (s.total ? `<p class="total-sug">Com isso o dia fecha em <b>${int(s.consumido.kcal + s.total.kcal)}</b> de ${int(s.meta.kcal)} kcal e <b>${int(s.consumido.protein + s.total.protein)}</b> de ${int(s.meta.protein)} g de proteína.</p>` : "");
  }
  const narra = f.narracao ? `<p class="narracao">${esc(f.narracao)}</p>` : NARRAR.sugestao && s.refeicoes.length ? `<button class="link" data-acao="narrar-sugestao">Pedir a explicação do nutri</button>` : "";
  return `
    <h2 id="folha-titulo">${s.kcal > 0 ? `Faltam ${int(s.kcal)} kcal` : "O que eu como agora?"}</h2>
    <p class="texto">${s.diasHistorico >= 7 ? `Baseado no que costumas comer nos últimos ${s.diasHistorico} dias com registro e na tabela TACO.` : "Ainda com pouco histórico: as sugestões vêm do cardápio base. Com uma semana de registros, entram os teus hábitos."}</p>
    ${chips}${narra}${corpo}`;
};

// ---------- check-in semanal ----------
const escala = (nome, rotulo, baixo, alto, valor) => `
  <fieldset class="escala"><legend>${rotulo}</legend>
    <div>${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${nome}" value="${n}" ${valor === n ? "checked" : ""} required><span>${n}</span></label>`).join("")}</div>
    <p><small>${baixo}</small><small>${alto}</small></p>
  </fieldset>`;

FOLHAS.checkin = (f) => {
  if (!f.aval) {
    const ad = adesao(), r = ritmoPeso();
    return `
      <h2 id="folha-titulo">Check-in da semana</h2>
      <p class="texto">Nesta semana: ${ad.registrados} dias registrados, ${ad.naMeta} perto da meta de calorias, média de ${int(ad.kcalMedia)} kcal e ${int(ad.protMedia)} g de proteína${r != null ? `. Peso: ${r > 0 ? "+" : ""}${dec(r)} kg por semana` : ""}.</p>
      <form data-form="checkin">
        ${escala("fome", "Fome durante a semana", "nenhuma", "muita", f.r?.fome)}
        ${escala("energia", "Energia e disposição", "baixa", "alta", f.r?.energia)}
        ${escala("sono", "Qualidade do sono", "ruim", "ótima", f.r?.sono)}
        <button class="botao cheio">Ver o que o nutri acha</button>
      </form>`;
  }
  const a = f.aval, m = S.metas;
  return `
    <h2 id="folha-titulo">Resultado do check-in</h2>
    <ul class="motivos">${a.motivos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    ${f.narracao ? `<p class="narracao">${esc(f.narracao)}</p>` : ""}
    ${a.delta ? `
      <p class="metas">Nova meta: <b>${int(a.nova)}</b> kcal <small>(${a.delta > 0 ? "+" : "−"}${int(Math.abs(a.delta))}, era ${int(m.kcal)})</small></p>
      <div class="par botoes">
        <button class="botao" data-acao="fechar-checkin" data-aceitar="1">Aceitar</button>
        <button class="botao fraco" data-acao="fechar-checkin">Manter ${int(m.kcal)}</button>
      </div>`
    : `<button class="botao cheio" data-acao="fechar-checkin">Fechar check-in</button>`}`;
};

// ---------- aba Equipe: resumo do nutri ----------
function secaoNutri() {
  if (!S.metas) return "";
  const g = gastoReal(), ult = S.nutri.checkins[S.nutri.checkins.length - 1], pend = checkinPendente();
  const gasto = g.ok
    ? `<p class="destaque"><b>${int(g.tdee)}</b> kcal por dia <small>gasto real, confiança ${g.confianca}</small></p>
       <p class="legenda"><span>Comeste em média ${int(g.entrada)} kcal e o peso ${g.delta <= 0 ? "caiu" : "subiu"} ${dec(Math.abs(g.delta))} kg em ${g.janela} dias.${S.metas.gasto ? ` A fórmula estimava ${int(S.metas.gasto)}.` : ""}</span></p>`
    : `<p class="vazio">O gasto real aparece com 2 semanas de pesagens (pelo menos 6) e registros (pelo menos 10 dias). ${g.faltaPesagens ? `Faltam ${g.faltaPesagens} pesagens. ` : ""}${g.faltaDias ? `Faltam ${g.faltaDias} dias.` : ""}</p>`;
  return `
    <section class="secao">
      <h2>Nutri</h2>
      ${gasto}
      ${ult ? `<p class="legenda"><span>Último check-in em ${dataCurta(ult.d)}: ${ult.aplicado ? `meta ${ult.aplicado > 0 ? "+" : "−"}${int(Math.abs(ult.aplicado))} kcal` : "meta mantida"}.</span></p>` : ""}
      <button class="botao ${pend ? "" : "fraco"} cheio" data-acao="abrir-checkin">${pend ? "Fazer o check-in da semana" : "Fazer check-in agora"}</button>
    </section>`;
}

function secaoHabitos() {
  const P = perfil();
  if (P.dias < 3) return "";
  const linhas = REFEICOES.filter((r) => P.refs[r.id].dias).map((r) => {
    const R = P.refs[r.id];
    const top = [...R.alimentos.values()].sort((a, b) => b.vezes - a.vezes).slice(0, 3).map((a) => a.item.nome.split(",")[0]);
    return `<li><span class="oque"><b>${r.nome}</b> <small>${Math.round(R.frequencia * 100)}% dos dias, ${Math.round((R.parte || 0) * 100)}% das calorias</small><br><small>${esc(lista(top))}</small></span><span class="pts"></span><b>${int(R.kcalMedia)} kcal</b></li>`;
  }).join("");
  return `
    <section class="secao">
      <h2>Como comes</h2>
      <ul class="lista-ex habitos">${linhas}</ul>
      <p class="legenda"><span>Últimos ${P.dias} dias com registro. É daqui que saem as sugestões.</span></p>
    </section>`;
}
SECOES.resumo.push(secaoNutri, secaoHabitos);

// ---------- ações ----------
Object.assign(ACOES, {
  "o-que-comer"() { abrirFolha({ tipo: "sugestao", d: ui.data, escolhas: {} }); },
  "outra-opcao"(b) {
    const f = ui.folha;
    f.escolhas[b.dataset.ref] = (f.escolhas[b.dataset.ref] || 0) + 1;
    f.narracao = null;
    abrirFolha(f);
  },
  "alternar-ref-sug"(b) {
    const f = ui.folha, r = b.dataset.ref;
    f.refs = f.refs.includes(r) ? f.refs.filter((x) => x !== r) : REFEICOES.map((x) => x.id).filter((x) => x === r || f.refs.includes(x));
    f.narracao = null;
    abrirFolha(f);
  },
  "registrar-sugestao"(b) {
    const f = ui.folha, ref = b.dataset.ref, r = ui.ultimaSugestao?.refeicoes.find((x) => x.ref === ref);
    if (!r?.escolha) return;
    const ids = r.escolha.itens.map((i) => addItem(f.d, { ...i, ref }).id);
    f.refs = f.refs.filter((x) => x !== ref); f.narracao = null;
    if (f.refs.length) abrirFolha(f); else fecharFolha();
    render();
    avisar(`${nomeRef(ref)} registrada: ${int(r.escolha.kcal)} kcal`, () => ids.forEach((id) => removerItem(f.d, id)));
  },
  async "narrar-sugestao"(b) {
    const f = ui.folha;
    b.disabled = true; b.textContent = "O nutri está escrevendo…";
    try { f.narracao = await NARRAR.sugestao(ui.ultimaSugestao); } catch (e) { f.narracao = e.message || "Não deu para falar com a IA agora."; }
    if (ui.folha === f) abrirFolha(f);
  },
  "abrir-checkin"() { abrirFolha({ tipo: "checkin" }); },
  "fechar-checkin"(b) {
    const a = ui.folha?.aval;
    if (!a) return fecharFolha();
    const aceitar = !!b.dataset.aceitar;
    registrarCheckin(a, aceitar);
    fecharFolha(); render();
    avisar(aceitar && a.delta ? `Meta ajustada para ${int(S.metas.kcal)} kcal` : "Check-in registrado");
  },
});

FORMS.checkin = async (form) => {
  const fd = new FormData(form), r = { fome: Number(fd.get("fome")), energia: Number(fd.get("energia")), sono: Number(fd.get("sono")) };
  const f = ui.folha;
  f.r = r; f.aval = avaliarSemana(r);
  abrirFolha(f);
  if (NARRAR.checkin) {
    try { f.narracao = await NARRAR.checkin(f.aval); if (ui.folha === f) abrirFolha(f); } catch { /* sem IA: fica só o texto das regras */ }
  }
};

