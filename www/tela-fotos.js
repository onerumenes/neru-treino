// Fotos do físico: a mesma pose lado a lado (a primeira e a última, ou as que a pessoa escolher),
// o olhar da IA sobre elas e quando tirar as próximas.

import { S, hoje, somaDias, paraData, pesos } from "./store.js";
import { $, esc, dec, dataCurta, ui, TELAS, ACOES, render } from "./base.js";
import { sessoesDeFotos, POSES } from "./corpo.js";
import { hidratarFotos } from "./tela-equipe.js";

// Outros módulos penduram seções aqui (a análise pela IA, em equipe-ia.js)
export const SECOES_FOTOS = [];
const ICONE_CAMERA = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/></svg>`;
const pesoEm = (d) => pesos().filter((p) => p.d <= d).pop()?.kg;

export function comparacaoAtual() {
  const sess = sessoesDeFotos();
  if (!sess.length) return null;
  let c = ui.fotoComparar;
  if (!c || !sess.some((s) => s.d === c.a) || !sess.some((s) => s.d === c.b)) c = { a: sess[sess.length - 1].d, b: sess[0].d, pose: c?.pose || "frente" };
  ui.fotoComparar = c;
  return { c, sess };
}

function figura(s, pose, destaque) {
  const id = s?.poses[pose], kg = s ? pesoEm(s.d) : null;
  return `
    <figure class="foto-cmp ${destaque ? "depois" : ""}">
      <button data-acao="ver-fotos" data-d="${s.d}" aria-label="Abrir as fotos de ${dataCurta(s.d)}">
        ${id ? `<img data-foto="${esc(id)}" alt="${esc(POSES.find((p) => p.id === pose).nome)}, ${dataCurta(s.d)}">` : `<span class="sem">${ICONE_CAMERA}sem foto de ${POSES.find((p) => p.id === pose).nome.toLowerCase()}</span>`}
      </button>
      <figcaption><b>${dataCurta(s.d)}</b>${kg ? `<span>${dec(kg)} kg</span>` : ""}</figcaption>
    </figure>`;
}

function telaFotos() {
  const x = comparacaoAtual();
  const ult = sessoesDeFotos()[0], prox = ult ? Math.round((paraData(somaDias(ult.d, 28)) - paraData(hoje())) / 864e5) : 0;
  const proximas = `
    <section class="caixa">
      <div class="titulo-caixa"><h2>Próximas fotos</h2><b>${!ult ? "hoje" : prox > 0 ? `em ${prox} ${prox === 1 ? "dia" : "dias"}` : "hoje"}</b></div>
      <p class="dica">A cada 4 semanas, no mesmo dia das medidas, com a mesma luz e a mesma roupa.</p>
      <button class="botao escuro cheio" data-acao="ver-fotos" data-d="${hoje()}">${ICONE_CAMERA}Tirar as fotos agora</button>
    </section>`;
  if (!x) return `<p class="vazio">Frente, lado e costas, a cada 4 semanas. As fotos ficam só no aparelho.</p>${proximas}`;
  const { c, sess } = x, sa = sess.find((s) => s.d === c.a), sb = sess.find((s) => s.d === c.b);
  const datas = (lado, sel) => sess.length > 2 ? `<div class="chips datas-fotos" aria-label="${lado === "a" ? "Antes" : "Depois"}">${[...sess].reverse().map((s) => `<button class="${s.d === sel ? "on" : ""}" data-acao="foto-data" data-lado="${lado}" data-d="${s.d}">${dataCurta(s.d)}</button>`).join("")}</div>` : "";
  return `
    <div class="segmentos" role="tablist" aria-label="Pose">
      ${POSES.map((p) => `<button role="tab" aria-selected="${p.id === c.pose}" data-acao="foto-pose" data-pose="${p.id}">${p.nome}</button>`).join("")}
    </div>
    <section class="fotos-lado">${figura(sa, c.pose)}${sb !== sa ? figura(sb, c.pose, true) : ""}</section>
    ${sess.length > 2 ? `<details class="trocar-datas"><summary>Trocar as datas</summary><h3>Antes</h3>${datas("a", c.a)}<h3>Depois</h3>${datas("b", c.b)}</details>` : ""}
    ${SECOES_FOTOS.map((fn) => fn()).join("")}
    ${proximas}`;
}

Object.assign(ACOES, {
  "foto-pose"(b) { comparacaoAtual(); ui.fotoComparar.pose = b.dataset.pose; render(); },
  "foto-data"(b) { comparacaoAtual(); ui.fotoComparar[b.dataset.lado] = b.dataset.d; render(); },
});

TELAS.fotos = {
  titulo: "Fotos", aba: "perfil", html: telaFotos,
  sub() {
    const sess = sessoesDeFotos();
    if (!sess.length) return "";
    const mes = paraData(sess[sess.length - 1].d).toLocaleDateString("pt-BR", { month: "long" });
    return `${sess.length} ${sess.length === 1 ? "sessão" : "sessões"} desde ${mes}`;
  },
  depois: () => hidratarFotos($("#tela")),
};
