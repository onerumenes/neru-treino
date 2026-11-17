// Estado do app e gravação no aparelho (IndexedDB, com localStorage de reserva).
// Tudo fica num objeto só; nada sai do celular, fora o que a IA precisa para responder.

export const REFEICOES = [
  { id: "cafe", nome: "Café da manhã", cor: "#F9D776" },
  { id: "almoco", nome: "Almoço", cor: "#F5B82E" },
  { id: "pos_treino", nome: "Pós-treino", cor: "#EE9A2B" },
  { id: "janta", nome: "Janta", cor: "#E2703A" },
  { id: "ceia", nome: "Ceia", cor: "#C9608A" },
];
export const nomeRef = (id) => REFEICOES.find((r) => r.id === id)?.nome || id;

export function refPelaHora(data = new Date()) {
  const h = data.getHours() + data.getMinutes() / 60;
  if (h < 4) return "ceia";
  if (h < 10.5) return "cafe";
  if (h < 14.5) return "almoco";
  if (h < 18.5) return "pos_treino";
  if (h < 21.5) return "janta";
  return "ceia";
}

const padrao = () => ({
  v: 1,
  seq: 0,
  user: null,          // { sexo, idade, altura, peso, atividade, objetivo, ritmo }
  metas: null,         // { kcal, protein, carbs, fat, ... }
  metasManuais: false,
  dias: {},            // "2026-11-16": { itens: [...], peso: 80.2, sono: 7.5, supl: [ids] }
  favs: [],            // { id, nome, itens: [{ nome, qtd, kcal, protein, carbs, fat }] }
  chat: [],
  treino: null,        // { plano, custom, sessoes, atual } (ver treino.js)
  supl: [],            // { id, nome, dose }; o que foi tomado fica em dias[d].supl
  cfg: { chave: "", modeloChat: "gpt-6-luna", modeloFoto: "gpt-6-luna", modeloAudio: "gpt-transcribe" },
});

export const S = padrao();

// ---------- datas ----------
const p2 = (n) => String(n).padStart(2, "0");
export const chaveDia = (dt) => `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
export const hoje = () => chaveDia(new Date());
export const paraData = (d) => { const [a, m, dia] = d.split("-").map(Number); return new Date(a, m - 1, dia); };
export function somaDias(d, n) { const dt = paraData(d); dt.setDate(dt.getDate() + n); return chaveDia(dt); }

// ---------- gravação ----------
const NOME_DB = "neru-calorias", LOJA = "kv", CHAVE = "estado";
let conexao = null;

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((ok, erro) => {
    const r = indexedDB.open(NOME_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
  return conexao;
}
async function idb(modo, fn) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const q = fn(db.transaction(LOJA, modo).objectStore(LOJA));
    q.onsuccess = () => ok(q.result);
    q.onerror = () => erro(q.error);
  });
}

function aplicar(dados) {
  const base = padrao();
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, base, dados || {});
  S.cfg = { ...base.cfg, ...(dados?.cfg || {}) };
}

export async function carregar() {
  let dados = null;
  try { dados = await idb("readonly", (s) => s.get(CHAVE)); } catch { /* cai na reserva */ }
  if (!dados) { try { dados = JSON.parse(localStorage.getItem(NOME_DB) || "null"); } catch { /* sem dados */ } }
  aplicar(dados);
  try { navigator.storage?.persist?.(); } catch { /* opcional */ }
}

let espera = null;
export function salvar() {
  clearTimeout(espera);
  espera = setTimeout(gravar, 120);
}
export async function gravar() {
  clearTimeout(espera);
  const copia = JSON.parse(JSON.stringify(S));
  try { await idb("readwrite", (s) => s.put(copia, CHAVE)); }
  catch { try { localStorage.setItem(NOME_DB, JSON.stringify(copia)); } catch { /* sem espaço */ } }
}

// ---------- diário ----------
export const novoId = (prefixo = "i") => prefixo + (++S.seq).toString(36);

export function diaDe(d, criar = false) {
  if (!S.dias[d]) { if (!criar) return { itens: [] }; S.dias[d] = { itens: [] }; }
  return S.dias[d];
}

const num = (x, casas = 0) => { const n = Math.max(0, Number(x) || 0), f = 10 ** casas; return Math.round(n * f) / f; };
export function limparItem(x) {
  return {
    ref: REFEICOES.some((r) => r.id === x.ref) ? x.ref : refPelaHora(),
    nome: String(x.nome || "").trim().slice(0, 80) || "Item",
    qtd: String(x.qtd || "").trim().slice(0, 40),
    kcal: num(x.kcal), protein: num(x.protein, 1), carbs: num(x.carbs, 1), fat: num(x.fat, 1),
  };
}

export function addItem(d, x) {
  const item = { id: novoId(), ...limparItem(x), h: Date.now() };
  diaDe(d, true).itens.push(item);
  salvar();
  return item;
}
export function acharItem(d, id) { return diaDe(d).itens.find((i) => i.id === id) || null; }

// Altera só os campos passados. Devolve a cópia de antes (para desfazer) ou null.
export function editarItem(d, id, campos) {
  const item = acharItem(d, id);
  if (!item) return null;
  const antes = { ...item };
  const limpo = limparItem({ ...item, ...campos });
  Object.assign(item, limpo);
  salvar();
  return antes;
}
export function removerItem(d, id) {
  const dia = diaDe(d), i = dia.itens.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const [fora] = dia.itens.splice(i, 1);
  salvar();
  return fora;
}
export function reporItem(d, item) {
  const dia = diaDe(d, true), i = dia.itens.findIndex((x) => x.id === item.id);
  if (i >= 0) dia.itens[i] = { ...item }; else dia.itens.push({ ...item });
  salvar();
}

export function totais(d) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, porRef: {} };
  for (const r of REFEICOES) t.porRef[r.id] = 0;
  for (const i of diaDe(d).itens) {
    t.kcal += i.kcal; t.protein += i.protein; t.carbs += i.carbs; t.fat += i.fat;
    t.porRef[i.ref] = (t.porRef[i.ref] || 0) + i.kcal;
  }
  return t;
}

// ---------- favoritos ----------
export function addFav(nome, itens) {
  const fav = {
    id: novoId("f"),
    nome: String(nome || "").trim().slice(0, 40) || "Favorito",
    itens: itens.map(({ nome: n, qtd, kcal, protein, carbs, fat }) => ({ nome: n, qtd, kcal, protein, carbs, fat })),
  };
  S.favs.push(fav);
  salvar();
  return fav;
}
export function removerFav(id) { S.favs = S.favs.filter((f) => f.id !== id); salvar(); }
export const kcalFav = (f) => f.itens.reduce((s, i) => s + i.kcal, 0);

// ---------- peso ----------
export function pesos() {
  return Object.keys(S.dias).filter((d) => S.dias[d].peso > 0).sort().map((d) => ({ d, kg: S.dias[d].peso }));
}

// ---------- backup ----------
export function exportar() {
  const copia = JSON.parse(JSON.stringify(S));
  copia.cfg.chave = ""; // a chave da OpenAI nunca vai no backup
  return JSON.stringify({ app: "neru-calorias", exportado: new Date().toISOString(), dados: copia }, null, 1);
}
export async function importar(texto) {
  const obj = JSON.parse(texto);
  const dados = obj?.app === "neru-calorias" ? obj.dados : null;
  if (!dados || typeof dados.dias !== "object") throw new Error("Esse arquivo não é um backup do Neru Calorias.");
  const chave = S.cfg.chave;
  aplicar(dados);
  S.cfg.chave = chave;
  await gravar();
}
