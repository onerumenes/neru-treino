// Aba Equipe > Plano: consulta inicial com o nutri (anamnese), plano alimentar com substituições, modo flexível ou
// fechado, e o retorno mensal.

import { S, REFEICOES, nomeRef, hoje, somaDias, salvar, pesos } from "./store.js";
import { esc, int, dec, ui, ACOES, FORMS, FOLHAS, MUDANCAS, render, avisar, abrirFolha, fecharFolha, dataCurta } from "./base.js";
import { SECOES } from "./tela-equipe.js";
import { gerarPlano, planoDesatualizado } from "./plano-alimentar.js";
import { aplicarMetas, adesao, gastoReal, tendencia } from "./nutri.js";
import { ultimasMedidas, composicao, sessoesDeFotos } from "./corpo.js";

export const ALERTAS = {
  diabetes: "Diabetes", hipertensao: "Pressão alta", renal: "Doença renal", cardiaca: "Doença do coração",
  remedio: "Remédio de uso contínuo", gestante: "Gestante ou amamentando", ta: "Já tive transtorno alimentar (anorexia, bulimia, compulsão)",
  bariatrica: "Cirurgia bariátrica",
};
const RESTRICOES = { vegetariano: "Vegetariano", sem_lactose: "Sem lactose", sem_gluten: "Sem glúten" };
const COZINHA = { sim: "Cozinho sempre", as_vezes: "Às vezes", nao: "Quase nunca" };
const ORCAMENTO = { economico: "Econômico", medio: "Médio", livre: "Sem aperto" };
// Ganchos da IA (fase 4): comentário do retorno mensal
export const NARRAR_PLANO = { retorno: null };

const marcado = (cond) => (cond ? "checked" : "");
const opcoesRadio = (nome, mapa, atual) => Object.entries(mapa).map(([k, v]) =>
  `<label><input type="radio" name="${nome}" value="${k}" ${marcado(atual === k)}><span>${v}</span></label>`).join("");
const opcoesCheck = (nome, mapa, atuais = []) => Object.entries(mapa).map(([k, v]) =>
  `<label><input type="checkbox" name="${nome}" value="${k}" ${marcado(atuais.includes(k))}><span>${v}</span></label>`).join("");

// ---------- consulta inicial ----------
const PASSOS = ["Rotina", "Preferências", "Saúde", "Meta e plano"];

function passoConsulta(f) {
  const d = f.dados, u = S.user || {};
  switch (f.passo) {
    case 0: return `
      <p class="texto">Teu objetivo está no perfil (Ajustes): <b>${{ perder: "perder gordura", manter: "manter", ganhar: "ganhar massa" }[u.objetivo] || "ainda não preenchido"}</b>. Agora a rotina, para o plano caber no teu dia.</p>
      <div class="grade3">
        <label class="campo"><span>Acordo</span><input name="acorda" type="time" value="${esc(d.acorda || "07:00")}"></label>
        <label class="campo"><span>Durmo</span><input name="dorme" type="time" value="${esc(d.dorme || "23:00")}"></label>
        <label class="campo"><span>Treino <small>vazio = não</small></span><input name="treinoHora" type="time" value="${esc(d.treinoHora || "")}"></label>
      </div>
      <fieldset class="opcoes multi"><legend>Refeições que fazes num dia normal</legend>
        ${REFEICOES.map((r) => `<label><input type="checkbox" name="refs" value="${r.id}" ${marcado((d.refs || ["cafe", "almoco", "janta", "ceia"]).includes(r.id))}><span>${r.nome}</span></label>`).join("")}
      </fieldset>`;
    case 1: return `
      <label class="campo"><span>O que gostas de comer <small>o nutri dá preferência</small></span><textarea name="gosta" rows="2" maxlength="300" placeholder="frango, arroz e feijão, ovos, frutas">${esc(d.gosta || "")}</textarea></label>
      <label class="campo"><span>O que não comes ou tens alergia <small>separa por vírgula</small></span><textarea name="naoCome" rows="2" maxlength="300" placeholder="peixe, lactose, amendoim">${esc(d.naoCome || "")}</textarea></label>
      <fieldset class="opcoes multi"><legend>Restrições</legend>${opcoesCheck("restricoes", RESTRICOES, d.restricoes)}</fieldset>
      <fieldset class="opcoes"><legend>Cozinhas?</legend>${opcoesRadio("cozinha", COZINHA, d.cozinha || "as_vezes")}</fieldset>
      <fieldset class="opcoes"><legend>Orçamento para comida</legend>${opcoesRadio("orcamento", ORCAMENTO, d.orcamento || "medio")}</fieldset>`;
    case 2: return `
      <p class="texto">O app não substitui médico nem nutricionista. Se algo abaixo vale para ti, ele fica mais conservador e te lembra de ter acompanhamento profissional.</p>
      <fieldset class="opcoes multi lista-vertical">${opcoesCheck("alertas", ALERTAS, d.alertas)}</fieldset>`;
    default: {
      const m = S.metas, alvo = Number(d.pesoAlvo) || 0, ritmo = Number(u.ritmo) || 0.5, atual = Number(u.peso) || 0;
      const semanas = alvo && atual && u.objetivo !== "manter" ? Math.ceil(Math.abs(atual - alvo) / ritmo) : 0;
      return `
        ${m ? `<p class="metas"><b>${int(m.kcal)}</b> kcal e <b>${int(m.protein)}</b> g de proteína por dia</p>` : `<p class="vazio">Preenche o perfil em Ajustes para ter as metas.</p>`}
        <label class="campo"><span>Peso que queres alcançar <small>kg, opcional</small></span><input name="pesoAlvo" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${esc(d.pesoAlvo || "")}"></label>
        ${semanas ? `<p class="texto">No ritmo de ${dec(ritmo)} kg por semana, são umas <b>${semanas} semanas</b> (até ${dataCurta(somaDias(hoje(), semanas * 7))}). Na prática o ritmo oscila; os check-ins ajustam.</p>` : ""}
        <fieldset class="opcoes"><legend>Como queres o plano</legend>
          <label><input type="radio" name="modo" value="flexivel" ${marcado((d.modo || S.nutri.modo) !== "fechado")}><span>Flexível</span></label>
          <label><input type="radio" name="modo" value="fechado" ${marcado((d.modo || S.nutri.modo) === "fechado")}><span>Fechado</span></label>
        </fieldset>
        <p class="dica">Flexível: metas e sugestões na hora, com o que tiveres. Fechado: um cardápio por refeição com lista de substituição. Dá para trocar depois em Ajustes.</p>`;
    }
  }
}

FOLHAS.consulta = (f) => `
  <h2 id="folha-titulo">Consulta com o nutri</h2>
  <ol class="passos">${PASSOS.map((p, i) => `<li class="${i === f.passo ? "atual" : i < f.passo ? "feito" : ""}">${p}</li>`).join("")}</ol>
  <form data-form="consulta">
    ${passoConsulta(f)}
    <div class="par botoes">
      ${f.passo > 0 ? `<button type="button" class="botao fraco" data-acao="consulta-voltar">Voltar</button>` : ""}
      <button class="botao">${f.passo < PASSOS.length - 1 ? "Continuar" : "Concluir consulta"}</button>
    </div>
  </form>`;

function lerPasso(form, dados) {
  const fd = new FormData(form);
  for (const el of form.elements) {
    if (!el.name || el.type === "submit" || el.type === "button") continue;
    if (el.type === "checkbox") dados[el.name] = fd.getAll(el.name);
    else if (el.type !== "radio" || el.checked) dados[el.name] = fd.get(el.name);
  }
}

FORMS.consulta = (form) => {
  const f = ui.folha;
  lerPasso(form, f.dados);
  if (f.passo < PASSOS.length - 1) { f.passo++; abrirFolha(f); return; }
  const d = f.dados;
  S.perfil = {
    acorda: d.acorda || "", dorme: d.dorme || "", treinoHora: d.treinoHora || "",
    refs: (d.refs || []).length ? d.refs : ["cafe", "almoco", "janta", "ceia"],
    gosta: String(d.gosta || "").slice(0, 300), naoCome: String(d.naoCome || "").slice(0, 300),
    restricoes: d.restricoes || [], cozinha: d.cozinha || "as_vezes", orcamento: d.orcamento || "medio",
    alertas: d.alertas || [], pesoAlvo: Number(d.pesoAlvo) || null, data: hoje(),
  };
  S.nutri.modo = d.modo === "fechado" ? "fechado" : "flexivel";
  S.nutri.consultas.push({ d: hoje(), tipo: "inicial" });
  if (S.user && !S.metasManuais) aplicarMetas();
  if (S.metas) gerarPlano();
  salvar();
  fecharFolha(); ui.aba = "equipe"; ui.equipe = "plano"; render(); window.scrollTo(0, 0);
  avisar(S.perfil.alertas.length ? "Consulta salva. Com os alertas que marcaste, procura também acompanhamento profissional" : "Consulta salva e plano montado");
};

// ---------- retorno mensal ----------
export function retornoPendente(d = hoje()) {
  const ult = S.nutri.consultas[S.nutri.consultas.length - 1];
  return !!ult && somaDias(ult.d, 28) <= d;
}

function dadosRetorno() {
  const ult = S.nutri.consultas[S.nutri.consultas.length - 1], desde = ult?.d || somaDias(hoje(), -28);
  const tend = tendencia(), noIni = tend.find((x) => x.d >= desde)?.kg, agora = tend[tend.length - 1]?.kg;
  const meds = ultimasMedidas().todas, medIni = [...meds].reverse().find((m) => m.d <= desde) || meds[0], medFim = meds[meds.length - 1];
  const cIni = medIni && composicao(medIni), cFim = medFim && medFim !== medIni && composicao(medFim);
  const ads = [0, 7, 14, 21].map((n) => adesao(somaDias(hoje(), -n)));
  return {
    desde, pesoIni: noIni, pesoFim: agora, cIni, cFim, medIni, medFim,
    adesao: Math.round((ads.reduce((s, a) => s + a.pct, 0) / ads.length) * 100),
    diasRegistrados: ads.reduce((s, a) => s + a.registrados, 0),
    gasto: gastoReal(), fotosNoMes: sessoesDeFotos().filter((s) => s.d > desde).length,
    medidasNoMes: !!(medFim && medFim.d > desde),
  };
}

FOLHAS.retorno = (f) => {
  const r = f.r || (f.r = dadosRetorno());
  const pend = [];
  if (!r.medidasNoMes) pend.push(`<button class="link" data-acao="abrir-medidas">Registrar as medidas de hoje</button>`);
  if (!r.fotosNoMes) pend.push(`<button class="link" data-acao="ver-fotos" data-d="${hoje()}">Tirar as fotos de hoje</button>`);
  const dp = r.pesoIni != null && r.pesoFim != null ? r.pesoFim - r.pesoIni : null;
  return `
    <h2 id="folha-titulo">Retorno do mês</h2>
    <p class="texto">Desde ${dataCurta(r.desde)}.</p>
    ${pend.length ? `<div class="confirma suave"><p>Antes de fechar o retorno:</p>${pend.join("")}</div>` : ""}
    <ul class="lista-ex">
      ${dp != null ? `<li><span class="oque">Peso (tendência)</span><span class="pts"></span><b>${dp > 0 ? "+" : dp < 0 ? "−" : ""}${dec(Math.abs(dp))} kg</b></li>` : ""}
      ${r.cIni && r.cFim ? `<li><span class="oque">Gordura</span><span class="pts"></span><b>${dec(r.cIni.bf)}% → ${dec(r.cFim.bf)}%</b></li>
        <li><span class="oque">Massa magra</span><span class="pts"></span><b>${r.cFim.magra - r.cIni.magra >= 0 ? "+" : "−"}${dec(Math.abs(r.cFim.magra - r.cIni.magra))} kg</b></li>` : ""}
      ${r.medIni && r.medFim && r.medIni !== r.medFim && r.medIni.cintura && r.medFim.cintura ? `<li><span class="oque">Cintura</span><span class="pts"></span><b>${dec(r.medIni.cintura)} → ${dec(r.medFim.cintura)} cm</b></li>` : ""}
      <li><span class="oque">Dias perto da meta</span><span class="pts"></span><b>${r.adesao}%</b></li>
      <li><span class="oque">Dias registrados</span><span class="pts"></span><b>${r.diasRegistrados} de 28</b></li>
      ${r.gasto.ok ? `<li><span class="oque">Gasto real</span><span class="pts"></span><b>${int(r.gasto.tdee)} kcal</b></li>` : ""}
    </ul>
    ${f.narracao ? `<p class="narracao">${esc(f.narracao)}</p>` : NARRAR_PLANO.retorno ? `<button class="link" data-acao="narrar-retorno">Pedir a análise do nutri e do personal</button>` : ""}
    <p class="texto">Fechar o retorno refaz o plano alimentar com a meta atual${S.nutri.modo === "fechado" ? " (as substituições acompanham)" : ""}.</p>
    <button class="botao cheio" data-acao="fechar-retorno">Fechar retorno e refazer o plano</button>`;
};

// ---------- tela ----------
function secaoConsulta() {
  if (!S.perfil) {
    return `
      <section class="secao">
        <h2>Consulta inicial</h2>
        <p class="texto">Uns 3 minutos: rotina, o que gostas e o que não comes, saúde e meta. Com isso o nutri monta teu plano alimentar.</p>
        <button class="botao cheio" data-acao="abrir-consulta">Começar a consulta</button>
      </section>`;
  }
  const p = S.perfil, pend = retornoPendente();
  return `
    ${p.alertas?.length ? `<div class="confirma"><p>Marcaste na consulta: ${esc(p.alertas.map((a) => ALERTAS[a]).join(", ").toLowerCase())}. Mantém acompanhamento com médico e nutricionista; o app ficou mais conservador nas mudanças${p.alertas.includes("renal") ? " e a meta de proteína está em 0,8 g por kg até um profissional liberar mais" : ""}.</p></div>` : ""}
    ${pend ? `<button class="aviso-equipe" data-acao="abrir-retorno"><b>Retorno do mês</b><span>Medidas, fotos e revisão do plano</span></button>` : ""}
    <section class="secao">
      <h2>Consulta</h2>
      <p class="texto">Feita em ${dataCurta(p.data)}. Refeições: ${esc(p.refs.map((r) => nomeRef(r).toLowerCase()).join(", "))}.${p.naoCome ? ` Não come: ${esc(p.naoCome)}.` : ""}${p.restricoes?.length ? ` ${esc(p.restricoes.map((r) => RESTRICOES[r]).join(", "))}.` : ""}</p>
      <div class="par botoes">
        <button class="botao fraco" data-acao="abrir-consulta">Refazer consulta</button>
        <button class="botao fraco" data-acao="abrir-retorno">Retorno agora</button>
      </div>
    </section>`;
}

function secaoPlano() {
  const p = S.nutri.plano;
  const modo = `
    <fieldset class="opcoes"><legend>Modo do plano</legend>
      <label><input type="radio" name="modo-plano" value="flexivel" ${marcado(S.nutri.modo !== "fechado")}><span>Flexível</span></label>
      <label><input type="radio" name="modo-plano" value="fechado" ${marcado(S.nutri.modo === "fechado")}><span>Fechado</span></label>
    </fieldset>`;
  if (!S.metas) return `<section class="secao"><h2>Plano alimentar</h2><p class="vazio">Preenche o perfil em Ajustes para o nutri calcular as metas.</p></section>`;
  if (!p) return `<section class="secao"><h2>Plano alimentar</h2>${modo}<button class="botao cheio" data-acao="gerar-plano">Montar plano alimentar</button></section>`;
  return `
    <section class="secao">
      <h2>Plano alimentar</h2>
      ${modo}
      <p class="texto">${S.nutri.modo === "fechado" ? "No modo fechado, o \"O que eu como agora?\" segue estas refeições e gira pelas substituições." : "No modo flexível, isto é a referência: as sugestões do dia se ajustam ao que já comeste."} Montado em ${dataCurta(p.criado)} para ${int(p.kcal)} kcal.</p>
      ${planoDesatualizado() ? `<div class="confirma suave"><p>A meta mudou desde que o plano foi feito.</p><button class="link" data-acao="gerar-plano">Refazer com a meta de ${int(S.metas.kcal)} kcal</button></div>` : ""}
      ${p.refeicoes.map((r) => `
        <div class="plano-ref">
          <h3><span>${nomeRef(r.ref)}</span><small>${int(r.kcal)} kcal, ${int(r.protein)} g prot.</small></h3>
          ${r.grupos.map((g) => `
            <details class="grupo-plano">
              <summary><span class="oque"><small>${esc(g.nome)}</small><br>${esc(g.opcoes[0].nome)} <small>${esc(g.opcoes[0].qtd ? `${g.opcoes[0].qtd}, ${g.opcoes[0].g} g` : `${g.opcoes[0].g} g`)}</small></span><b>${int(g.opcoes[0].kcal)} kcal</b></summary>
              ${g.opcoes.length > 1 ? `<ul class="subst">${g.opcoes.slice(1).map((o) => `<li><span>${esc(o.nome)}</span><small>${esc(o.qtd ? `${o.qtd}, ${o.g} g` : `${o.g} g`)}</small></li>`).join("")}</ul>` : `<p class="dica">Sem substituições neste grupo.</p>`}
            </details>`).join("")}
        </div>`).join("")}
      <p class="legenda"><span>Toca num item para ver as trocas com as mesmas calorias.</span></p>
      <button class="botao fraco cheio" data-acao="gerar-plano">Refazer plano</button>
    </section>`;
}
SECOES.plano.push(secaoConsulta, secaoPlano);

// ---------- ações ----------
Object.assign(ACOES, {
  "abrir-consulta"() { abrirFolha({ tipo: "consulta", passo: 0, dados: { ...(S.perfil || {}), modo: S.nutri.modo } }); },
  "consulta-voltar"(b) { const f = ui.folha; lerPasso(b.closest("form"), f.dados); f.passo = Math.max(0, f.passo - 1); abrirFolha(f); },
  "gerar-plano"() { gerarPlano(); render(); avisar("Plano alimentar montado"); },
  "abrir-retorno"() { abrirFolha({ tipo: "retorno" }); },
  async "narrar-retorno"(b) {
    const f = ui.folha;
    b.disabled = true; b.textContent = "Analisando…";
    try { f.narracao = await NARRAR_PLANO.retorno(f.r); } catch (e) { f.narracao = e.message || "Não deu para falar com a IA agora."; }
    if (ui.folha === f) abrirFolha(f);
  },
  "fechar-retorno"() {
    S.nutri.consultas.push({ d: hoje(), tipo: "retorno", adesao: ui.folha?.r?.adesao ?? null, peso: pesos().pop()?.kg ?? null });
    if (S.metas) gerarPlano();
    salvar(); fecharFolha(); render();
    avisar("Retorno registrado e plano refeito");
  },
});

MUDANCAS.push((el) => {
  if (el.name === "modo-plano") { S.nutri.modo = el.value; salvar(); render(); avisar(el.value === "fechado" ? "Plano fechado: as sugestões seguem o cardápio" : "Plano flexível"); return true; }
  return false;
});
