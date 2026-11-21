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
  v: 2,
  seq: 0,
  user: null,          // { apelido, sexo, nascimento (AAAA-MM-DD), idade (antiga, sem nascimento), altura, peso, atividade, trabalho, objetivo, ritmo }
  metas: null,         // { kcal, protein, carbs, fat, ... }
  metasManuais: false,
  dias: {},            // "2026-11-16": { itens: [...], peso: 80.2, sono: 7.5, supl: [ids] }
  favs: [],            // { id, nome, itens: [{ nome, qtd, kcal, protein, carbs, fat }] }
  chat: [],
  treino: null,        // { plano, custom, sessoes, atual } (ver treino.js)
  supl: [],            // { id, nome, dose }; o que foi tomado fica em dias[d].supl
  fotos: [],           // { id, d, pose }; a imagem fica na loja "fotos" do IndexedDB, fora do backup
  perfil: null,        // anamnese da consulta inicial (consulta.js)
  nutri: { modo: "flexivel", plano: null, checkins: [], consultas: [] },
  personal: { avaliacao: null, bloco: null },
  // avaliação corporal e saúde (corpo.js): dores por ponto do corpo, exames de referência e a saúde básica
  corpo: { dores: {}, exames: [], calibrar: false, pressao: [], fc: [], sangue: [] },
  relatorios: [],      // relatórios semanais da equipe (equipe.js)
  equipe: { dispensados: {} }, // avisos da equipe já dispensados
  cfg: {
    chave: "", modeloChat: "gpt-6-luna", modeloFoto: "gpt-6-luna", modeloAudio: "gpt-transcribe",
    iaLocal: false,          // usar o modelo no celular quando estiver carregado
    nuvemFotoPrato: true,    // foto de prato vai para a OpenAI (mais precisa)
    nuvemRevisao: true,      // retorno mensal com a OpenAI
    nuvemFotoCorpo: false,   // fotos do físico nunca saem do aparelho, salvo se ligar aqui
    doisLados: false,        // medir os membros dos dois lados (simetria)
    tema: "auto",            // "auto" (segue o celular), "claro" ou "escuro"
    lembretes: { ativo: false, refeicoes: true, pesagem: true, checkin: true, treino: true, diasTreino: [2, 3, 4, 5, 6] },
  },
});

export const S = padrao();

// ---------- datas ----------
const p2 = (n) => String(n).padStart(2, "0");
export const chaveDia = (dt) => `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`;
export const hoje = () => chaveDia(new Date());
export const paraData = (d) => { const [a, m, dia] = d.split("-").map(Number); return new Date(a, m - 1, dia); };
export function somaDias(d, n) { const dt = paraData(d); dt.setDate(dt.getDate() + n); return chaveDia(dt); }

// ---------- gravação ----------
const NOME_DB = "neru-calorias", LOJA = "kv", FOTOS = "fotos", CHAVE = "estado";
let conexao = null;

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((ok, erro) => {
    const r = indexedDB.open(NOME_DB, 2);
    r.onupgradeneeded = () => {
      for (const loja of [LOJA, FOTOS]) if (!r.result.objectStoreNames.contains(loja)) r.result.createObjectStore(loja);
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { conexao = null; erro(r.error); };
  });
  return conexao;
}
async function idb(modo, fn, loja = LOJA) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const q = fn(db.transaction(loja, modo).objectStore(loja));
    q.onsuccess = () => ok(q.result);
    q.onerror = () => erro(q.error);
  });
}

// Imagens grandes (fotos do físico) ficam numa loja separada, para o estado continuar leve
export const guardarImagem = (id, blob) => idb("readwrite", (s) => s.put(blob, id), FOTOS);
export const lerImagem = (id) => idb("readonly", (s) => s.get(id), FOTOS);
export const apagarImagem = (id) => idb("readwrite", (s) => s.delete(id), FOTOS);

function aplicar(dados) {
  const base = padrao();
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, base, dados || {});
  // objetos com campos novos: junta o padrão com o que veio, para dados antigos ganharem os campos
  for (const k of ["cfg", "nutri", "personal", "corpo"]) S[k] = { ...base[k], ...(dados?.[k] || {}) };
  S.cfg.lembretes = { ...base.cfg.lembretes, ...(dados?.cfg?.lembretes || {}) };
  S.v = base.v;
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
const vazio = (v) => v == null || v === "" || !Number.isFinite(Number(v));

// g: peso em gramas (opcional). b: [kcal, proteína, carbo, gordura] por 100 g (opcional; cada um pode ser null).
// Com os dois, mudar as gramas recalcula os nutrientes.
export function limparItem(x) {
  const g = num(x.g, 1), t = Math.round(Number(x.t) || 0);
  const b = Array.isArray(x.b) && x.b.length === 4 && x.b.some((v) => !vazio(v))
    ? x.b.map((v) => (vazio(v) ? null : num(v, 2))) : null;
  return {
    ref: REFEICOES.some((r) => r.id === x.ref) ? x.ref : refPelaHora(),
    nome: String(x.nome || "").trim().slice(0, 80) || "Item",
    qtd: String(x.qtd || "").trim().slice(0, 40),
    kcal: num(x.kcal), protein: num(x.protein, 1), carbs: num(x.carbs, 1), fat: num(x.fat, 1),
    ...(g > 0 ? { g } : {}), ...(b ? { b } : {}), ...(t > 0 ? { t } : {}),
  };
}

// Texto da porção: a medida caseira e o peso, sem repetir o peso se a medida já diz
export function porcao(i) {
  const g = i.g > 0 ? `${(Math.round(i.g * 10) / 10).toLocaleString("pt-BR")} g` : "";
  if (!g || !i.qtd) return i.qtd || g;
  const junto = (s) => s.replace(/\s+/g, "").toLowerCase();
  return junto(i.qtd).includes(junto(g)) ? i.qtd : `${i.qtd}, ${g}`;
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
  for (const k of ["g", "b", "t"]) if (!(k in limpo)) delete item[k];
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
    itens: itens.map(({ nome: n, qtd, kcal, protein, carbs, fat, g, b, t }) =>
      ({ nome: n, qtd, kcal, protein, carbs, fat, ...(g ? { g } : {}), ...(b ? { b } : {}), ...(t ? { t } : {}) })),
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

// ---------- medidas (cm) ----------
// Na ordem do corpo, de cima para baixo (é a ordem da tela de medidas)
export const MEDIDAS = [
  { id: "pescoco", nome: "Pescoço", dica: "logo abaixo do pomo de adão" },
  { id: "ombros", nome: "Ombros", dica: "na parte mais larga dos ombros, braços relaxados" },
  { id: "peito", nome: "Peito", dica: "na linha dos mamilos, braços relaxados" },
  { id: "braco", nome: "Braço", dica: "contraído, na parte mais grossa" },
  { id: "antebraco", nome: "Antebraço", dica: "na parte mais grossa, perto do cotovelo, mão aberta" },
  { id: "cintura", nome: "Cintura", dica: "na altura do umbigo, sem encolher a barriga" },
  { id: "quadril", nome: "Quadril", dica: "na parte mais larga do bumbum" },
  { id: "coxa", nome: "Coxa", dica: "no meio da coxa, em pé" },
  { id: "panturrilha", nome: "Panturrilha", dica: "na parte mais grossa, em pé e relaxado" },
];
export function medicoes() {
  return Object.keys(S.dias).filter((d) => S.dias[d].med).sort().map((d) => ({ d, ...S.dias[d].med }));
}
// Membros que dá para medir dos dois lados: a medida principal é o lado direito; o esquerdo fica em <id>_esq
export const LADOS = ["braco", "antebraco", "coxa", "panturrilha"];
// Medidas que incham logo depois do treino: numa avaliação marcada como pós-treino, não entram nas conclusões
const INCHAM = new Set(["peito", "ombros", ...LADOS, ...LADOS.map((k) => k + "_esq")]);
export const posTreino = (d) => !!S.dias[d]?.avaliacao?.posTreino;

// A última medida conhecida de cada parte do corpo até a data (medidas parciais se completam com as anteriores)
export function medidasAte(ate = hoje()) {
  const out = {}, ids = [...MEDIDAS.map((x) => x.id), ...LADOS.map((k) => k + "_esq")];
  for (const m of medicoes()) {
    if (m.d > ate) break;
    const inchado = posTreino(m.d);
    for (const id of ids) if (m[id] > 0 && !(inchado && INCHAM.has(id))) out[id] = { v: m[id], d: m.d };
  }
  return out;
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
