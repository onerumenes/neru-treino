// Telas do cardio: seção na aba Treino (plano, semana, evolução, histórico), cardio dentro do treino em andamento,
// pergunta do fôlego e as folhas de registrar cardio e montar o plano de cardio.

import { S, hoje, salvar } from "./store.js";
import { esc, dataCurta, ui, ACOES, FORMS, FOLHAS, MUDANCAS, render, avisar, abrirFolha, fecharFolha } from "./base.js";
import { T } from "./treino.js";
import { grafico } from "./tela-equipe.js";
import {
  APARELHOS, MODOS, ESFORCOS, NOMES_FASE, fmtNum, cardios, limparCardio, registrarCardio, removerCardio, planoCardio,
  iniciarPlanoCardio, desligarPlanoCardio, faseCardio, cardioDoDiaPlano, resumoCardio, evolucaoLeve, evolucaoFolego,
  descreverCardio,
} from "./cardio.js";

const marcado = (c) => (c ? "checked" : "");
const radios = (nome, mapa, atual) => Object.entries(mapa).map(([k, v]) =>
  `<label><input type="radio" name="${nome}" value="${k}" ${marcado(String(atual) === String(k))}><span>${v}</span></label>`).join("");

// ---------- linha do "próximo treino" ----------
export function linhaCardioDia(diaId) {
  const c = cardioDoDiaPlano(diaId);
  return c ? `<p class="legenda cardio-dia"><span>Depois: <b>cardio</b>, ${esc(c.texto)}</span></p>` : "";
}

// ---------- dentro do treino em andamento ----------
export function secaoCardioSessao(a) {
  const pres = cardioDoDiaPlano(a.dia || "", a.d), feito = a.cardio;
  const folego = `
    <fieldset class="escala folego"><legend>Como estava o fôlego hoje?</legend>
      <div>${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="folego" value="${n}" ${marcado(a.folego === n)}><span>${n}</span></label>`).join("")}</div>
      <p><small>me cansei muito rápido</small><small>sobrou fôlego</small></p>
    </fieldset>`;
  return `
    <section class="secao cardio-sessao">
      <h2>Cardio</h2>
      ${feito ? `<p class="texto">${esc(descreverCardio(feito))}. Esforço: ${esc(ESFORCOS[feito.esforco].split(":")[0].toLowerCase())}.</p>
        <div class="acoes-ex"><button class="link" data-acao="registrar-cardio" data-para="sessao">Editar</button><button class="link fraco" data-acao="tirar-cardio-sessao">Tirar</button></div>`
      : pres ? `<p class="texto"><b>De hoje:</b> ${esc(pres.texto)}.</p><p class="dica">${esc(pres.motivo)}</p>
        <button class="botao fraco cheio" data-acao="registrar-cardio" data-para="sessao">Registrar o cardio</button>`
      : `<button class="botao fraco cheio" data-acao="registrar-cardio" data-para="sessao">Registrar cardio</button>`}
      ${folego}
    </section>`;
}

// ---------- seção na tela inicial do treino ----------
export function secaoCardio() {
  const p = planoCardio(), r = resumoCardio(), ev = evolucaoLeve(), fol = evolucaoFolego();
  const ultimos = [...cardios()].reverse().slice(0, 5);
  let topo;
  if (!p) {
    topo = `<p class="texto">Cardio depois do treino melhora o fôlego entre as séries. O personal monta um plano em fases: primeiro só leve (ritmo de conversa), depois um intervalado por semana.</p>
      <button class="botao fraco cheio" data-acao="plano-cardio">Montar plano de cardio</button>`;
  } else {
    const f = faseCardio();
    topo = `<p class="bloco-status">Semana <b>${f.semana}</b> do cardio. ${esc(NOMES_FASE[f.fase])}. Leve atual: <b>${p.leveMin} min</b>${p.leveVel ? ` a ${fmtNum(p.leveVel)} km/h` : ""}.</p>`;
  }
  const semana = r.sessoes
    ? `<p class="legenda"><span>Últimos 7 dias: <b>${r.sessoes}</b> ${r.sessoes === 1 ? "sessão" : "sessões"}, ${r.min} min${r.km ? `, ${fmtNum(r.km)} km` : ""}${r.intervalados ? `, ${r.intervalados} intervalado${r.intervalados > 1 ? "s" : ""}` : ""}</span>${r.folego != null ? `<span>Fôlego médio: <b>${fmtNum(r.folego)}</b> de 5</span>` : ""}</p>` : "";
  const graficoVel = ev.length > 1
    ? `<h3>Velocidade no cardio leve</h3>${grafico(ev, `Velocidade no cardio leve, de ${fmtNum(ev[0].v)} a ${fmtNum(ev[ev.length - 1].v)} km/h`)}
       <p class="legenda"><span>Mais rápido com o mesmo esforço leve = fôlego melhor.</span></p>` : "";
  const graficoFol = fol.length > 1
    ? `<h3>Fôlego nos treinos</h3>${grafico(fol, `Fôlego nos treinos, de ${fol[0].v} a ${fol[fol.length - 1].v} de 5`)}` : "";
  return `
    <section class="secao cardio">
      <h2>Cardio</h2>
      ${topo}
      ${semana}
      ${graficoVel}${graficoFol}
      ${ultimos.length ? `<ul class="linhas com-x">${ultimos.map((c) => `
        <li><span>${dataCurta(c.d)} <small>${esc(descreverCardio(c))}</small></span>
          <button class="tirar" data-acao="apagar-cardio" data-id="${esc(c.id)}" aria-label="Apagar o cardio de ${dataCurta(c.d)}">×</button></li>`).join("")}</ul>` : ""}
      <div class="par botoes">
        <button class="botao fraco" data-acao="registrar-cardio" data-para="avulso">Registrar cardio</button>
        ${p ? `<button class="botao fraco" data-acao="plano-cardio">Plano de cardio</button>` : ""}
      </div>
    </section>`;
}

// ---------- folhas ----------
FOLHAS.cardio = (f) => {
  const atual = f.para === "sessao" ? T().atual?.cardio : null;
  const pres = f.para === "sessao" ? cardioDoDiaPlano(T().atual?.dia || "", T().atual?.d) : cardioDoDiaPlano("");
  const v = atual || { aparelho: planoCardio()?.aparelho || "esteira", modo: pres?.modo || "leve", min: pres?.min || "", vel: pres?.modo === "intervalado" ? pres.vel || "" : "", esforco: "" };
  const campo = (nome, rotulo, un, valor, extra = "") => `<label class="campo"><span>${rotulo}${un ? ` <small>${un}</small>` : ""}</span>
    <input name="${nome}" type="number" inputmode="decimal" step="any" min="0" value="${valor ?? ""}" ${extra}></label>`;
  return `
    <h2 id="folha-titulo">${f.para === "sessao" ? "Cardio deste treino" : "Registrar cardio de hoje"}</h2>
    ${pres && !atual ? `<p class="texto"><b>Plano:</b> ${esc(pres.texto)}.</p>` : ""}
    <form data-form="cardio">
      <fieldset class="opcoes"><legend>Aparelho</legend>${radios("aparelho", APARELHOS, v.aparelho)}</fieldset>
      <fieldset class="opcoes"><legend>Tipo</legend>${radios("modo", MODOS, v.modo)}</fieldset>
      <div class="grade2">
        ${campo("min", "Tempo", "min", v.min, "required")}
        ${campo("km", "Distância", "km", v.km)}
      </div>
      <div class="grade3">
        ${campo("incl", "Inclinação", "%", v.incl)}
        ${campo("fc", "FC média", "bpm", v.fc)}
        ${campo("vel", "Tiros", "km/h", v.vel)}
      </div>
      <p class="dica">Só tempo é obrigatório. "Tiros" é a velocidade dos trechos fortes, no intervalado. As calorias do aparelho não precisam: o app não as usa.</p>
      <fieldset class="opcoes lista-vertical"><legend>Esforço</legend>${radios("esforco", ESFORCOS, v.esforco || 1)}</fieldset>
      <button class="botao cheio">Salvar cardio</button>
    </form>`;
};

FOLHAS.planoCardio = () => {
  const p = planoCardio();
  return `
    <h2 id="folha-titulo">Plano de cardio</h2>
    <p class="texto">Fases: semanas 1 e 2 só leve; 3 e 4 entra um intervalado curto (4 × 2 min forte / 2 min caminhando); da 5ª em diante, o 4×4 (4 min forte / 3 min caminhando). Leve é ritmo de conversa. Até 3 leves por semana, depois da musculação; o intervalado vai num dia sem perna. Na semana de recuperação do treino, o cardio também diminui.</p>
    <form data-form="plano-cardio">
      <fieldset class="opcoes"><legend>Quanto cardio leve aguentas hoje, sem parar?</legend>
        ${radios("min", { 10: "10 min", 15: "15 min", 20: "20 min", 30: "30 min" }, p ? [10, 15, 20, 30].reduce((a, b) => (Math.abs(b - p.leveMin) < Math.abs(a - p.leveMin) ? b : a)) : 15)}
      </fieldset>
      <fieldset class="opcoes"><legend>Aparelho principal</legend>${radios("aparelho", APARELHOS, p?.aparelho || "esteira")}</fieldset>
      <button class="botao cheio">${p ? "Recomeçar o plano" : "Começar o plano"}</button>
    </form>
    ${p ? `<button class="botao perigo cheio" data-acao="desligar-plano-cardio" style="margin-top:10px">Desligar o plano de cardio</button>` : ""}
    <p class="dica">Dor no peito, tontura ou falta de ar fora do normal: para e procura um médico.</p>`;
};

// ---------- ações ----------
Object.assign(ACOES, {
  "registrar-cardio"(b) { abrirFolha({ tipo: "cardio", para: b.dataset.para }); },
  "plano-cardio"() { abrirFolha({ tipo: "planoCardio" }); },
  "tirar-cardio-sessao"() { if (T().atual) { delete T().atual.cardio; salvar(); render(); } },
  "apagar-cardio"(b) {
    if (!b.dataset.certeza) { b.dataset.certeza = "1"; b.textContent = "Apagar?"; b.classList.add("certeza"); return; }
    const r = removerCardio(b.dataset.id);
    render();
    if (r) avisar("Cardio apagado", () => { T().cardio.splice(r.i, 0, r.fora); salvar(); });
  },
  "desligar-plano-cardio"(b) {
    if (!b.dataset.certeza) { b.dataset.certeza = "1"; b.textContent = "Desligar mesmo?"; return; }
    desligarPlanoCardio(); fecharFolha(); render();
    avisar("Plano de cardio desligado. O que já registraste continua");
  },
});

FORMS.cardio = (form) => {
  const fd = new FormData(form), x = Object.fromEntries(fd.entries());
  if (!(Number(String(x.min).replace(",", ".")) > 0)) return avisar("Preenche o tempo");
  const f = ui.folha;
  if (f.para === "sessao" && T().atual) {
    T().atual.cardio = limparCardio(x);
    salvar(); fecharFolha(); render();
    avisar("Cardio guardado: entra quando concluíres o treino");
  } else {
    const c = registrarCardio(x, hoje());
    fecharFolha(); render();
    avisar(`Cardio registrado: ${c.min} min`);
  }
};

FORMS["plano-cardio"] = (form) => {
  const fd = new FormData(form);
  iniciarPlanoCardio(fd.get("min"), fd.get("aparelho"));
  fecharFolha(); render();
  avisar(`Plano de cardio: semana 1, ${S.personal.cardio.leveMin} min leve`);
};

// Fôlego do treino em andamento: salva sem redesenhar
MUDANCAS.push((el) => {
  if (el.name !== "folego" || !T().atual) return false;
  T().atual.folego = Number(el.value);
  salvar();
  return true;
});
