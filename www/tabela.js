// Campos de um alimento no diário: busca na Tabela TACO e a conta automática pelas gramas.
// A conta guarda a base por 100 g no campo escondido "b". Mudar as gramas escala os nutrientes que têm base;
// mudar um nutriente com as gramas preenchidas corrige a base dele. Valores digitados antes das gramas
// (os de um rótulo, por exemplo) viram base quando o campo de gramas é confirmado.

import { ALIMENTOS } from "./alimentos.js";
import { esc, int, dec, lerNum, ui, ACOES } from "./base.js";

const NUTRI = ["kcal", "protein", "carbs", "fat"];

// ---------- busca ----------
export const semAcento = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no", "para"]);
const CRU = new Set(["cru", "crua", "crus", "cruas"]);
const palavras = (t) => semAcento(t).split(/[^a-z0-9]+/).filter((w) => w && !LIGACOES.has(w));
// "ovos" acha "ovo"; "arroz" acha "arroz" e "arrozinho"
const bate = (w, t) => w.startsWith(t) || (t.length > 3 && t.endsWith("s") && w.startsWith(t.slice(0, -1)));

let indice = null, porNumero = null;
export function buscar(termo, max = 25) {
  const q = palavras(termo);
  if (!q.length) return [];
  indice ||= ALIMENTOS.map((a) => palavras(a[1]));
  const achados = [];
  ALIMENTOS.forEach((a, k) => {
    const ws = indice[k];
    if (!q.every((t) => ws.some((w) => bate(w, t)))) return;
    const cru = !q.some((t) => t.startsWith("cru")) && ws.some((w) => CRU.has(w)) ? 1 : 0;
    achados.push({ a, frente: bate(ws[0], q[0]) ? 0 : 1, cru });
  });
  // primeiro os que começam pela palavra buscada; depois o preparado antes do cru (arroz e feijão se pesam
  // cozidos), a não ser que a busca peça "cru"; por fim, os nomes mais curtos (os mais simples)
  achados.sort((x, y) => x.frente - y.frente || x.cru - y.cru || x.a[1].length - y.a[1].length);
  return achados.slice(0, max).map((x) => x.a);
}
export const alimento = (n) => (porNumero ||= new Map(ALIMENTOS.map((a) => [a[0], a]))).get(n);

function achadosHtml(termo) {
  const lista = buscar(termo);
  if (!lista.length) return `<li class="nada">Nada na tabela com “${esc(termo.trim())}”. Tenta outra palavra ou preenche os valores abaixo.</li>`;
  return lista.map(([n, nome, kcal, p]) => `<li><button type="button" data-acao="escolher-alimento" data-n="${n}">
    <span>${esc(nome)}</span><small>${int(kcal)} kcal<br>${dec(p)} g prot.</small></button></li>`).join("");
}

// ---------- campos ----------
export const textoBase = (b) => (b && b[0] != null
  ? `Em 100 g: ${int(b[0])} kcal${b[1] != null ? `, ${dec(b[1])} g de proteína` : ""}. Muda as gramas e os valores acompanham.`
  : "");

// i: item existente (para editar) ou vazio. comBusca: mostra a busca na tabela.
export function camposItem(i = {}, comBusca = false) {
  let g = i.g || "", qtd = i.qtd || "";
  // itens antigos guardavam o peso só no texto ("150 g"): passa para o campo de gramas
  const m = !g && qtd.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramas?)\.?\s*$/i);
  if (m) { g = lerNum(m[1]); qtd = ""; }
  const b = i.b || (g > 0 && i.kcal != null ? NUTRI.map((k) => ((Number(i[k]) || 0) * 100) / g) : null);
  const numeros = [["kcal", "Calorias", ""], ["protein", "Proteína", "g"], ["carbs", "Carbo", "g"], ["fat", "Gordura", "g"]];
  return `
    ${comBusca ? `
      <label class="campo"><span>Buscar na Tabela TACO <small>valores em 100 g</small></span>
        <input id="busca-alimento" type="search" enterkeyhint="search" placeholder="Ex.: arroz cozido, frango grelhado" autocomplete="off" spellcheck="false"></label>
      <ul id="achados" class="achados" hidden></ul>` : ""}
    <label class="campo"><span>Alimento</span>
      <input name="nome" required maxlength="80" value="${esc(i.nome || "")}" placeholder="Arroz branco cozido" autocomplete="off"></label>
    <div class="grade2">
      <label class="campo"><span>Gramas</span>
        <input name="g" type="number" inputmode="decimal" min="0" step="any" value="${g}" placeholder="150"></label>
      <label class="campo"><span>Medida <small>opcional</small></span>
        <input name="qtd" maxlength="40" value="${esc(qtd)}" placeholder="2 colheres, 1 unidade" autocomplete="off"></label>
    </div>
    <input type="hidden" name="b" value="${b ? b.map((v) => (v == null ? "" : +v.toFixed(2))).join(";") : ""}">
    <input type="hidden" name="t" value="${i.t || ""}">
    <p class="dica por100" ${b ? "" : "hidden"}>${esc(textoBase(b))}</p>
    <div class="grade4">
      ${numeros.map(([n, rot, un]) => `<label class="campo"><span>${rot}${un ? ` <small>${un}</small>` : ""}</span>
        <input name="${n}" type="number" inputmode="decimal" min="0" step="any" ${n === "kcal" ? "required" : ""} value="${i[n] ?? ""}"></label>`).join("")}
    </div>`;
}

const lerBase = (form) => {
  const v = String(form.elements.b?.value || "").split(";");
  return NUTRI.map((_, n) => (v[n] == null || v[n] === "" ? null : Number(v[n])));
};

export function lerItem(form) {
  const f = new FormData(form);
  return {
    ref: f.get("ref") || ui.folha?.ref, nome: f.get("nome"), qtd: f.get("qtd"), g: lerNum(f.get("g")), b: lerBase(form), t: lerNum(f.get("t")),
    kcal: lerNum(f.get("kcal")), protein: lerNum(f.get("protein")), carbs: lerNum(f.get("carbs")), fat: lerNum(f.get("fat")),
  };
}

// ---------- conta pelas gramas ----------
const arred = (k, v) => (k === "kcal" ? Math.round(v) : Math.round(v * 10) / 10);

function gravarBase(form, b) {
  const tem = b.some((v) => v != null);
  form.elements.b.value = tem ? b.map((v) => (v == null ? "" : +v.toFixed(2))).join(";") : "";
  const info = form.querySelector(".por100");
  if (info) { info.textContent = textoBase(tem ? b : null); info.hidden = !info.textContent; }
}

// A cada tecla nas gramas: escala o que tem base
function aoDigitarGramas(form) {
  const g = lerNum(form.elements.g.value);
  if (!(g > 0)) return; // campo apagado no meio da digitação: espera o número novo
  const b = lerBase(form);
  NUTRI.forEach((k, n) => { if (b[n] != null) form.elements[k].value = arred(k, (b[n] * g) / 100); });
}

// Gramas confirmadas: o que foi digitado sem base passa a valer para este peso
function aoConfirmarGramas(form) {
  const g = lerNum(form.elements.g.value);
  if (!(g > 0)) return;
  const b = lerBase(form);
  let mudou = false;
  NUTRI.forEach((k, n) => {
    const v = form.elements[k].value;
    if (b[n] == null && v !== "") { b[n] = (lerNum(v) * 100) / g; mudou = true; }
  });
  if (mudou) gravarBase(form, b);
}

function aoMudarNutriente(form, k) {
  const g = lerNum(form.elements.g.value);
  if (!(g > 0)) return;
  const b = lerBase(form), v = form.elements[k].value;
  b[NUTRI.indexOf(k)] = v === "" ? null : (lerNum(v) * 100) / g;
  gravarBase(form, b);
}

ACOES["escolher-alimento"] = (botao) => {
  const a = alimento(Number(botao.dataset.n)), form = botao.closest("form");
  if (!a || !form) return;
  const [, nome, kcal, p, c, f] = a, campoG = form.elements.g;
  form.elements.nome.value = nome;
  form.elements.t.value = a[0];
  if (!(lerNum(campoG.value) > 0)) campoG.value = 100;
  gravarBase(form, [kcal, p, c, f]);
  aoDigitarGramas(form);
  const busca = form.querySelector("#busca-alimento"), lista = form.querySelector("#achados");
  busca.value = ""; lista.hidden = true; lista.innerHTML = "";
  campoG.focus(); campoG.select();
};

document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "busca-alimento") {
    const lista = el.form.querySelector("#achados"), termo = el.value;
    lista.hidden = palavras(termo).length === 0;
    lista.innerHTML = lista.hidden ? "" : achadosHtml(termo);
    lista.scrollTop = 0;
    return;
  }
  const form = el.form;
  if (!form?.elements.b || !form.elements.g) return;
  if (el.name === "nome" && form.elements.t) form.elements.t.value = "";
  if (el.name === "g") aoDigitarGramas(form);
  else if (NUTRI.includes(el.name)) aoMudarNutriente(form, el.name);
});

document.addEventListener("change", (e) => {
  if (e.target.name === "g" && e.target.form?.elements.b) aoConfirmarGramas(e.target.form);
});

// Enter na busca escolhe o primeiro resultado, em vez de enviar o formulário
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.target.id !== "busca-alimento" || e.isComposing) return;
  e.preventDefault();
  e.target.form.querySelector("#achados [data-acao=escolher-alimento]")?.click();
});
