// Dados pessoais (o lápis do Perfil) e Objetivo e ritmo: o que a pessoa diz de si e o que quer do corpo.

import { S, hoje, somaDias, paraData, diaDe, salvar } from "./store.js";
import { $, esc, int, dec, lerNum, ui, TELAS, ACOES, FORMS, MUDANCAS, render, avisar } from "./base.js";
import { ATIVIDADE, TRABALHO, idadeDe, idadeAtual } from "./metas.js";
import { aplicarMetas, atividadeEstimada, gastoEstimado } from "./nutri.js";

const marcado = (a, b) => (a === b ? "checked" : "");
const OBJETIVOS = [["perder", "Perder gordura"], ["manter", "Manter"], ["ganhar", "Ganhar massa"]];
const br = (n, c = 1) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

// ---------- dados pessoais ----------
function semanaDePesos() {
  // a semana de segunda a domingo de hoje
  const h = hoje(), dia = (paraData(h).getDay() + 6) % 7, seg = somaDias(h, -dia);
  return ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((nome, i) => {
    const d = somaDias(seg, i);
    return { nome, d, kg: S.dias[d]?.peso, hoje: d === h, futuro: d > h };
  });
}

function telaDados() {
  const u = S.user || { sexo: "m", trabalho: "sentado", atividade: "moderado" }, novo = !S.user;
  const idade = idadeDe(u.nascimento) ?? idadeAtual(u);
  const semana = semanaDePesos(), feitas = semana.filter((x) => x.kg).length;
  const atv = S.user ? atividadeEstimada() : { fonte: "declarado" };
  return `
    ${novo ? `<p class="intro">Para começar, seus dados. O app calcula quantas calorias e quanta proteína comer por dia.</p>` : ""}
    <form id="f-dados" data-form="dados" class="caixa formulario">
      <label class="campo"><span>Nome ou apelido</span><input name="apelido" maxlength="30" autocomplete="nickname" value="${esc(u.apelido || "")}"></label>
      <div class="nascimento">
        <label class="campo"><span>Data de nascimento</span>
          <input id="nascimento" name="nascimento" type="date" max="${hoje()}" min="1900-01-01" ${u.idade ? "" : "required"} value="${esc(u.nascimento || "")}"></label>
        <span class="idade-selo" aria-live="polite"><b id="idade-calc">${idade ?? "–"}</b><small>anos</small></span>
      </div>
      <fieldset class="opcoes duas"><legend>Sexo biológico</legend>
        <label><input type="radio" name="sexo" value="m" ${marcado(u.sexo, "m")}><span>Masculino</span></label>
        <label><input type="radio" name="sexo" value="f" ${marcado(u.sexo, "f")}><span>Feminino</span></label>
        <small>Usado nas fórmulas do metabolismo e da gordura corporal</small>
      </fieldset>
      <label class="campo com-unidade"><span>Altura</span><span class="caixa-unidade"><input name="altura" type="number" inputmode="numeric" min="120" max="230" required value="${u.altura ?? ""}"><i>cm</i></span></label>
      ${novo ? `<label class="campo com-unidade"><span>Peso de hoje</span><span class="caixa-unidade"><input name="peso" type="number" inputmode="decimal" min="30" max="300" step="0.1" required><i>kg</i></span></label>` : ""}
    </form>

    ${novo ? "" : `
    <form class="caixa pesagem" data-form="peso">
      <div class="titulo-caixa"><h2>Pesagem da semana</h2><small>${feitas} de 3 feitas</small></div>
      <ol class="dias-peso">${semana.map((x) => `<li class="${x.hoje ? "hoje" : ""} ${x.futuro ? "futuro" : ""}"><span class="${x.kg ? "feito" : ""}">${x.kg ? br(x.kg) : ""}</span>${x.nome}</li>`).join("")}</ol>
      <div class="par-peso">
        <label class="caixa-unidade forte"><span class="so-leitor">Peso de hoje em quilos</span>
          <input name="kg" type="number" inputmode="decimal" min="30" max="300" step="0.1" placeholder="${S.user?.peso ? br(S.user.peso) : "0,0"}" value="${S.dias[hoje()]?.peso ?? ""}"><i>kg</i></label>
        <button class="botao">Pesar</button>
      </div>
      <p class="dica">Uma vez por semana é o mínimo. Com 3 ou mais, o app mede o seu gasto real e ajusta a meta sozinho.</p>
    </form>`}

    <section class="caixa">
      <h2>Atividade</h2>
      <fieldset class="opcoes tres"><legend>No dia a dia, você passa mais tempo</legend>
        ${Object.entries(TRABALHO).map(([k, nome]) => `<label><input form="f-dados" type="radio" name="trabalho" value="${k}" ${marcado(u.trabalho || "sentado", k)}><span>${{ sentado: "Sentado", em_pe: "Em pé", bracal: "Braçal" }[k]}</span></label>`).join("")}
      </fieldset>
      ${atv.fonte === "estimado"
        ? `<p class="info-linha"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/></svg><span><b>Exercício: calculado pelos treinos.</b> ${dec(atv.treinos)} treinos${atv.cardioMin ? ` e ${int(atv.cardioMin)} min de cardio` : ""} por semana nas últimas 4 semanas.</span></p>`
        : `<label class="campo"><span>Exercício <small>até o app ter 4 treinos registrados</small></span>
          <select form="f-dados" name="atividade">${Object.entries(ATIVIDADE).map(([k, a]) => `<option value="${k}" ${k === u.atividade ? "selected" : ""}>${a.nome}: ${a.desc}</option>`).join("")}</select></label>`}
    </section>

    ${u.sexo === "f" ? `
    <section class="caixa">
      <h2>Ciclo menstrual</h2>
      <p class="dica">Opcional: o app não confunde a água retida com gordura.</p>
      <div class="grade2i">
        <label class="campo"><span>Início da última</span><input form="f-dados" name="cicloUltima" type="date" max="${hoje()}" value="${esc(u.ciclo?.ultima || "")}"></label>
        <label class="campo"><span>Duração <small>dias</small></span><input form="f-dados" name="cicloDuracao" type="number" inputmode="numeric" min="20" max="45" value="${u.ciclo?.duracao || 28}"></label>
      </div>
    </section>` : ""}

    <button class="botao escuro cheio salvar-dados" form="f-dados">${novo ? "Continuar" : "Salvar"}</button>`;
}

FORMS.dados = (form) => {
  const f = new FormData(form), novo = !S.user;
  const nascimento = idadeDe(f.get("nascimento")) != null ? String(f.get("nascimento")) : S.user?.nascimento || "";
  const sexo = f.get("sexo") === "f" ? "f" : "m";
  S.user = {
    ...(S.user || { objetivo: "perder", ritmoAuto: true, ritmo: 0.5, atividade: "moderado" }),
    apelido: String(f.get("apelido") || "").trim().slice(0, 30),
    sexo,
    ...(nascimento ? { nascimento } : {}),
    altura: Math.round(lerNum(f.get("altura"))),
    trabalho: TRABALHO[f.get("trabalho")] ? f.get("trabalho") : S.user?.trabalho || "sentado",
    ...(f.get("atividade") ? { atividade: f.get("atividade") } : {}),
  };
  if (novo) {
    S.user.peso = Math.round(lerNum(f.get("peso")) * 10) / 10;
    diaDe(hoje(), true).peso = S.user.peso;
  }
  if (sexo === "f" && f.get("cicloUltima")) S.user.ciclo = { ultima: String(f.get("cicloUltima")), duracao: Math.round(lerNum(f.get("cicloDuracao"))) || 28 };
  else if (sexo !== "f") delete S.user.ciclo;
  if (!S.metasManuais || !S.metas) { S.metasManuais = false; aplicarMetas(); }
  salvar();
  // primeira vez: falta escolher o objetivo
  ui.aba = novo ? "objetivo" : "perfil"; ui.volta = null; ui.primeiroUso = novo;
  render(); window.scrollTo(0, 0);
  avisar(novo ? "Agora, o seu objetivo" : "Dados salvos");
};

// a idade ao lado da data muda enquanto a pessoa digita
document.addEventListener("input", (e) => {
  if (e.target.id !== "nascimento") return;
  const el = $("#idade-calc");
  if (el) el.textContent = idadeDe(e.target.value) ?? "–";
});
// trocar o sexo mostra (ou tira) o ciclo sem perder o que já foi digitado
MUDANCAS.push((el) => {
  if (ui.aba !== "dados" || el.name !== "sexo" || !S.user) return false;
  const f = new FormData($("#f-dados"));
  S.user = { ...S.user, sexo: el.value, apelido: String(f.get("apelido") || S.user.apelido || ""), altura: Math.round(lerNum(f.get("altura"))) || S.user.altura };
  if (idadeDe(f.get("nascimento")) != null) S.user.nascimento = String(f.get("nascimento"));
  render();
  return true;
});

// ---------- objetivo e ritmo ----------
const RITMO_PADRAO = { perder: 0.5, ganhar: 0.25 };
function pctManual(u) {
  if (u.ritmoPct) return u.ritmoPct;
  const peso = Number(u.peso) || 80;
  return Math.round(((Number(u.ritmo) || 0.5) / peso) * 100 * 20) / 20;
}

function telaObjetivo() {
  if (!S.user) return `<section class="caixa"><p class="vazio">Preencha seus dados primeiro.</p><button class="botao cheio" data-acao="aba" data-aba="dados">Dados pessoais</button></section>`;
  const u = S.user, m = S.metas, auto = !!u.ritmoAuto, obj = u.objetivo || "manter", sinal = obj === "perder" ? -1 : obj === "ganhar" ? 1 : 0;
  const ra = m?.ritmoAuto, peso = Number(u.peso) || 0;
  const pct = obj === "manter" ? 0 : auto ? ra?.pct ?? 0 : pctManual(u);
  const kg = obj === "manter" ? 0 : auto ? ra?.kg ?? 0 : Math.round((peso * pct) / 100 * 100) / 100;
  const ge = gastoEstimado();
  return `
    <fieldset class="opcoes tres objetivos" role="radiogroup" aria-label="Objetivo">
      ${OBJETIVOS.map(([k, nome]) => `<label><input type="radio" name="objetivo-tela" value="${k}" ${marcado(obj, k)}><span>${nome}</span></label>`).join("")}
    </fieldset>

    <section class="caixa ritmo">
      ${obj === "manter" ? "" : `<div class="linha-chave">
        <span><b>Ritmo automático</b><small>Ajusta sozinho a cada check-in</small></span>
        <button class="chave ${auto ? "on" : ""}" role="switch" aria-checked="${auto}" aria-label="Ritmo automático" data-acao="ritmo-auto"><i></i></button>
      </div>`}
      <div class="ritmo-destaque">
        <span>${obj === "perder" ? "Perder por semana" : obj === "ganhar" ? "Ganhar por semana" : "Manter o peso"}</span>
        <b>${sinal ? `${br(kg, 2)} kg` : "0 kg"}</b>
        <span>${sinal ? `${br(pct, 2)}% do peso · ${br(kg * 4.3)} kg por mês` : "Variação de até 0,5 kg é normal"}</span>
      </div>
      ${auto && sinal && ra?.motivos?.length ? `<div class="motivos-chips">${ra.motivos.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
      ${!auto && sinal ? `<label class="campo-faixa"><span><b>Ritmo por semana</b></span>
        <input id="ritmo-pct" type="range" min="0.1" max="1" step="0.05" value="${pct}">
        <span class="pontas"><small>0,1% do peso</small><small>1% do peso</small></span></label>` : ""}
    </section>

    ${m ? `<section class="cartoes2 metas-objetivo">
      <div class="cartao escuro"><span>Meta do dia</span><b>${int(m.kcal)} kcal</b><small>${ge ? `gasto ${ge.fonte === "medido" ? "medido" : "estimado"} ${int(ge.kcal)}` : ""}</small></div>
      <div class="cartao"><span>Proteína</span><b>${int(m.protein)} g</b><small>${m.proteinaPela === "magra" ? `${br(m.protein / m.magra)} g por kg de massa magra` : `${br(m.protein / peso)} g por kg de peso`}</small></div>
    </section>` : ""}
    ${ui.primeiroUso ? `<button class="botao escuro cheio comecar" data-acao="comecar-app">Começar</button>` : ""}
    ${S.metasManuais ? `<p class="dica">As metas estão definidas na mão em Ajustes; o objetivo e o ritmo valem quando você voltar para as automáticas.</p>` : ""}`;
}

function aplicarObjetivo(muda) {
  const antes = S.user.objetivo;
  Object.assign(S.user, muda);
  // mudou o objetivo: os ajustes dos check-ins eram para o objetivo antigo
  if (muda.objetivo && muda.objetivo !== antes) S.nutri.ajuste = 0;
  if (!S.metasManuais) aplicarMetas();
  salvar(); render();
}

Object.assign(ACOES, {
  "comecar-app"() { ui.primeiroUso = false; ui.aba = "hoje"; render(); window.scrollTo(0, 0); },
  "ritmo-auto"() {
    const u = S.user;
    if (u.ritmoAuto) {
      // ao desligar, o ritmo manual começa no que o automático estava usando
      const pct = S.metas?.ritmoAuto?.pct || RITMO_PADRAO[u.objetivo] / (Number(u.peso) || 80) * 100;
      aplicarObjetivo({ ritmoAuto: false, ritmoPct: Math.round(pct * 20) / 20, ritmo: Math.round((Number(u.peso) * pct) / 100 * 100) / 100 });
    } else aplicarObjetivo({ ritmoAuto: true });
  },
});
MUDANCAS.push((el) => {
  if (el.name === "objetivo-tela") { aplicarObjetivo({ objetivo: el.value }); return true; }
  if (el.id === "ritmo-pct") {
    const pct = Number(el.value), peso = Number(S.user.peso) || 80;
    aplicarObjetivo({ ritmoPct: pct, ritmo: Math.round((peso * pct) / 100 * 100) / 100 });
    return true;
  }
  return false;
});
// arrastar o ritmo já mostra os números, sem esperar soltar
document.addEventListener("input", (e) => {
  if (e.target.id !== "ritmo-pct" || !S.user) return;
  const pct = Number(e.target.value), kg = (Number(S.user.peso) * pct) / 100, d = $(".ritmo-destaque");
  if (!d) return;
  d.querySelector("b").textContent = `${br(kg, 2)} kg`;
  d.querySelector("span:last-child").textContent = `${br(pct, 2)}% do peso · ${br(kg * 4.3)} kg por mês`;
});

TELAS.dados = { titulo: "Dados pessoais", aba: "perfil", html: telaDados };
TELAS.objetivo = { titulo: "Objetivo", aba: "perfil", html: telaObjetivo };
