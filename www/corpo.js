// Corpo: medidas, percentual de gordura pela fórmula da Marinha americana e fotos padronizadas do físico.
// As fotos ficam no IndexedDB (loja "fotos"), nunca no estado nem no backup.

import { S, salvar, novoId, hoje, somaDias, diaDe, medicoes, pesos, guardarImagem, lerImagem, apagarImagem } from "./store.js";
import { idadeDe, idadeAtual } from "./metas.js";

export const POSES = [
  { id: "frente", nome: "Frente", dica: "De frente, braços relaxados ao lado do corpo, pés na largura do quadril." },
  { id: "lado", nome: "Lado", dica: "De lado (o direito virado para a câmera), braços relaxados, postura natural." },
  { id: "costas", nome: "Costas", dica: "De costas, braços relaxados, mesma distância das outras." },
];
export const DICAS_FOTO = [
  "De manhã, em jejum e depois do banheiro, como na pesagem.",
  "Mesmo lugar, mesma luz (de frente para a janela ou luz de teto), mesma roupa.",
  "Celular na altura do peito, a uns 2 metros, com timer ou alguém tirando.",
  "Corpo relaxado: sem contrair nem encolher a barriga.",
];

// ---------- percentual de gordura ----------
// U.S. Navy (Hodgdon e Beckett, 1984), medidas em cm. Erro típico de 3 a 4 pontos, mas boa para ver a tendência.
export function gorduraMarinha({ sexo, altura, pescoco, cintura, quadril }) {
  altura = Number(altura); pescoco = Number(pescoco); cintura = Number(cintura); quadril = Number(quadril);
  if (!(altura > 0 && pescoco > 0 && cintura > 0)) return null;
  let bf;
  if (sexo === "f") {
    if (!(quadril > 0) || cintura + quadril - pescoco <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(cintura + quadril - pescoco) + 0.221 * Math.log10(altura)) - 450;
  } else {
    if (cintura - pescoco <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(cintura - pescoco) + 0.15456 * Math.log10(altura)) - 450;
  }
  return bf > 2 && bf < 70 ? Math.round(bf * 10) / 10 : null;
}

// ---------- dobras cutâneas (adipômetro, lado direito do corpo, em mm) ----------
// Pontos do protocolo de 7 dobras; o de 3 usa peitoral, abdominal e coxa (homem) ou tríceps, suprailíaca e coxa (mulher)
export const DOBRAS = [
  { id: "peitoral", nome: "Peitoral", dica: "Diagonal, no meio entre o mamilo e a dobra da axila." },
  { id: "axilar", nome: "Axilar média", dica: "Vertical, na linha do meio da axila, na altura do fim do esterno." },
  { id: "triceps", nome: "Tríceps", dica: "Vertical, atrás do braço, no meio entre o ombro e o cotovelo." },
  { id: "subescapular", nome: "Subescapular", dica: "Diagonal, logo abaixo da ponta da escápula." },
  { id: "abdominal", nome: "Abdominal", dica: "Vertical, 2 cm ao lado do umbigo." },
  { id: "suprailiaca", nome: "Suprailíaca", dica: "Diagonal, logo acima do osso do quadril." },
  { id: "coxa", nome: "Coxa", dica: "Vertical, na frente da coxa, no meio entre a virilha e o joelho." },
];
export const DOBRAS_3 = { m: ["peitoral", "abdominal", "coxa"], f: ["triceps", "suprailiaca", "coxa"] };

// Jackson-Pollock (densidade do corpo) e Siri (gordura). Precisa de todas as dobras do protocolo.
export function gorduraDobras(dobras, sexo, idade, sete = true) {
  const ids = sete ? DOBRAS.map((x) => x.id) : DOBRAS_3[sexo === "f" ? "f" : "m"];
  if (!dobras || !(idade > 0) || ids.some((id) => !(dobras[id] > 0))) return null;
  const s = ids.reduce((t, id) => t + Number(dobras[id]), 0);
  let dens;
  if (sexo === "f") dens = sete ? 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * idade
    : 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * idade;
  else dens = sete ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * idade
    : 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * idade;
  const bf = 495 / dens - 450;
  return bf > 2 && bf < 70 ? Math.round(bf * 10) / 10 : null;
}
// Gordura pelas dobras de um dia: tenta as 7, senão as 3
export function gorduraDoDia(d) {
  const u = S.user, dob = S.dias[d]?.dobras;
  if (!u || !dob) return null;
  const idade = idadeDe(u.nascimento, new Date(d + "T12:00")) ?? idadeAtual(u);
  const sete = gorduraDobras(dob, u.sexo, idade, true);
  if (sete != null) return { bf: sete, metodo: "dobras7" };
  const tres = gorduraDobras(dob, u.sexo, idade, false);
  return tres != null ? { bf: tres, metodo: "dobras3" } : null;
}
// Dobras valem por 60 dias: a mais recente até a data
export function dobrasAte(d = hoje()) {
  const ini = somaDias(d, -60);
  const ds = Object.keys(S.dias).filter((x) => x <= d && x > ini && S.dias[x].dobras && gorduraDoDia(x)).sort();
  return ds.length ? { d: ds[ds.length - 1], dobras: S.dias[ds[ds.length - 1]].dobras } : null;
}
export function registrarDobras(valores, d = hoje()) {
  const dob = {};
  for (const x of DOBRAS) { const n = Math.round(Number(valores[x.id]) * 10) / 10; if (n > 0 && n < 100) dob[x.id] = n; }
  const dia = diaDe(d, true);
  if (Object.keys(dob).length) dia.dobras = dob; else delete dia.dobras;
  salvar();
  return dia.dobras || null;
}

// ---------- exame de referência (DEXA, InBody...) e calibração ----------
// Calibrar desconta, das estimativas do mesmo método, a diferença que ele teve para o exame mais recente
export function calibracao(metodo) {
  const ex = S.corpo?.exames?.filter((e) => e.ref?.metodo === metodo && e.ref.bf != null).slice(-1)[0];
  return S.corpo?.calibrar && ex ? Math.round((ex.ref.bf - ex.bf) * 10) / 10 : 0;
}
export function registrarExame({ tipo, bf, magra, d = hoje() }) {
  const ref = gorduraEm(d, { semCalibrar: true });
  const ex = {
    d, tipo, bf: Math.round(Number(bf) * 10) / 10, ...(magra > 0 ? { magra: Math.round(Number(magra) * 10) / 10 } : {}),
    ...(ref ? { ref: { metodo: ref.metodo, bf: ref.bf } } : {}),
  };
  S.corpo.exames = [...S.corpo.exames.filter((e) => e.d !== d), ex].sort((a, b) => (a.d < b.d ? -1 : 1));
  salvar();
  return ex;
}

// Gordura na data: dobras (se houver nos últimos 60 dias), senão a fita (Marinha), com a calibração se ligada
export function gorduraEm(d, { med, semCalibrar } = {}) {
  const u = S.user;
  if (!u) return null;
  const dob = dobrasAte(d);
  let r = dob ? gorduraDoDia(dob.d) : null;
  if (!r) {
    const m = med || ultimaMedicaoAte(d);
    const bf = m ? gorduraMarinha({ sexo: u.sexo, altura: u.altura, ...m }) : null;
    r = bf != null ? { bf, metodo: "fita" } : null;
  }
  if (!r) return null;
  const c = semCalibrar ? 0 : calibracao(r.metodo);
  return c ? { ...r, bf: Math.round((r.bf - c) * 10) / 10, calibrada: c } : r;
}
function ultimaMedicaoAte(d) {
  const m = {};
  for (const x of medicoes()) { if (x.d > d) break; Object.assign(m, x); }
  return Object.keys(m).length ? m : null;
}
export const NOME_METODO = { fita: "pela fita", dobras7: "pelas 7 dobras", dobras3: "pelas 3 dobras" };

// Composição na data: % de gordura, massa gorda e massa magra (precisa do peso mais próximo)
export function composicao(med) {
  const u = S.user;
  if (!u || !med) return null;
  const d = med.d || hoje(), g = gorduraEm(d, { med });
  if (!g) return null;
  const ps = pesos(), perto = ps.filter((p) => p.d <= d).pop() || ps[0];
  const kg = perto?.kg || u.peso;
  return { bf: g.bf, metodo: g.metodo, calibrada: g.calibrada || 0, kg, gorda: Math.round(kg * g.bf) / 100, magra: Math.round(kg * (100 - g.bf)) / 100 };
}

export function registrarMedidas(valores, d = hoje()) {
  const med = {};
  for (const [k, v] of Object.entries(valores)) { const n = Math.round(Number(v) * 10) / 10; if (n > 0) med[k] = n; }
  const dia = diaDe(d, true);
  if (Object.keys(med).length) dia.med = med; else delete dia.med;
  salvar();
  return dia.med || null;
}

export function ultimasMedidas() {
  const ms = medicoes();
  return { atual: ms[ms.length - 1] || null, primeira: ms[0] || null, todas: ms };
}

// Dias desde a última medição (para lembrar o retorno)
export function diasDesdeMedidas() {
  const u = ultimasMedidas().atual;
  if (!u) return null;
  return Math.round((new Date(hoje()) - new Date(u.d)) / 864e5);
}

// ---------- fotos ----------
async function reduzirParaBlob(arquivo, max = 1280, qualidade = 0.85) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error("sem imagem"))), "image/jpeg", qualidade));
  } finally { URL.revokeObjectURL(url); }
}

// Uma foto por pose por dia: tirar de novo no mesmo dia substitui
export async function guardarFoto(arquivo, pose, d = hoje()) {
  const blob = await reduzirParaBlob(arquivo);
  const antiga = S.fotos.find((f) => f.d === d && f.pose === pose);
  const id = novoId("p");
  await guardarImagem(id, blob);
  if (antiga) { S.fotos = S.fotos.filter((f) => f !== antiga); apagarImagem(antiga.id).catch(() => {}); }
  S.fotos.push({ id, d, pose });
  salvar();
  return id;
}

export async function apagarFoto(id) {
  S.fotos = S.fotos.filter((f) => f.id !== id);
  salvar();
  try { await apagarImagem(id); } catch { /* já não estava lá */ }
}

// Datas com fotos, da mais nova para a mais antiga
export function sessoesDeFotos() {
  const porData = new Map();
  for (const f of S.fotos) (porData.get(f.d) || porData.set(f.d, {}).get(f.d))[f.pose] = f.id;
  return [...porData.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([d, poses]) => ({ d, poses }));
}

// URL para mostrar a foto (guardada em memória enquanto o app está aberto)
const urls = new Map();
export async function urlFoto(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await lerImagem(id).catch(() => null);
  const url = blob ? URL.createObjectURL(blob) : null;
  urls.set(id, url);
  return url;
}

// Data URL reduzida, para mandar à IA
export async function fotoParaIA(id, max = 768) {
  const blob = await lerImagem(id).catch(() => null);
  if (!blob) return null;
  const arq = new File([blob], "foto.jpg", { type: "image/jpeg" });
  const menor = await reduzirParaBlob(arq, max, 0.8);
  return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(menor); });
}

// ---------- dores e lesões ----------
// Pontos do mapa: [id, nome, vista, músculo do desenho, posição dentro da caixa dele (x, y), lesão do personal]
// De frente, o lado esquerdo da tela é o direito da pessoa; de costas, é o esquerdo.
export const PONTOS_DOR = [
  ["pescoco", "Pescoço", "front", "neck:c", 0.5, 0.75, null],
  ["ombro_d", "Ombro direito", "front", "deltoids:l", 0.5, 0.45, "ombro"], ["ombro_e", "Ombro esquerdo", "front", "deltoids:r", 0.5, 0.45, "ombro"],
  ["cotovelo_d", "Cotovelo direito", "front", "forearm:l", 0.85, 0.04, "cotovelo"], ["cotovelo_e", "Cotovelo esquerdo", "front", "forearm:r", 0.15, 0.04, "cotovelo"],
  ["punho_d", "Punho direito", "front", "hands:l", 0.82, 0.04, "punho"], ["punho_e", "Punho esquerdo", "front", "hands:r", 0.18, 0.04, "punho"],
  ["quadril_d", "Quadril direito", "front", "quadriceps:l", 0.55, 0.02, null], ["quadril_e", "Quadril esquerdo", "front", "quadriceps:r", 0.45, 0.02, null],
  ["joelho_d", "Joelho direito", "front", "knees:l", 0.5, 0.5, "joelho"], ["joelho_e", "Joelho esquerdo", "front", "knees:r", 0.5, 0.5, "joelho"],
  ["tornozelo_d", "Tornozelo direito", "front", "ankles:l", 0.5, 0.5, null], ["tornozelo_e", "Tornozelo esquerdo", "front", "ankles:r", 0.5, 0.5, null],
  ["cervical", "Cervical", "back", "neck:l", 1.05, 0.55, null],
  ["escapula_e", "Escápula esquerda", "back", "upper-back:l", 0.5, 0.42, "ombro"], ["escapula_d", "Escápula direita", "back", "upper-back:r", 0.5, 0.42, "ombro"],
  ["lombar", "Lombar", "back", "lower-back:l", 1.04, 0.5, "lombar"],
  ["gluteo_e", "Glúteo esquerdo", "back", "gluteal:l", 0.5, 0.5, null], ["gluteo_d", "Glúteo direito", "back", "gluteal:r", 0.5, 0.5, null],
  ["posterior_e", "Posterior da coxa esquerda", "back", "hamstring:l", 0.5, 0.5, null], ["posterior_d", "Posterior da coxa direita", "back", "hamstring:r", 0.5, 0.5, null],
  ["panturrilha_e", "Panturrilha esquerda", "back", "calves:l", 0.5, 0.4, null], ["panturrilha_d", "Panturrilha direita", "back", "calves:r", 0.5, 0.4, null],
];
export const QUANDO_DOI = { treino: "No treino", repouso: "Em repouso", acordar: "Ao acordar", escada: "Na escada" };
export const pontoDor = (id) => PONTOS_DOR.find((p) => p[0] === id) || null;

// Dor do dia no ponto (0 a 10). Uma anotação por dia: anotar de novo no mesmo dia substitui.
export function registrarDor(id, nivel, d = hoje()) {
  const dores = S.corpo.dores, atual = dores[id] || { hist: [], quando: [], desde: d };
  const n = Math.max(0, Math.min(10, Math.round(Number(nivel) || 0)));
  if (!dores[id] && n === 0) return null;
  atual.hist = [...atual.hist.filter((h) => h[0] !== d), [d, n]].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-30);
  dores[id] = atual;
  salvar();
  return atual;
}
export function alternarQuandoDoi(id, q) {
  const dor = S.corpo.dores[id];
  if (!dor) return;
  dor.quando = dor.quando.includes(q) ? dor.quando.filter((x) => x !== q) : [...dor.quando, q];
  salvar();
}
export const nivelDor = (id) => { const h = S.corpo.dores[id]?.hist; return h?.length ? h[h.length - 1][1] : 0; };
export function situacaoDor(id) {
  const dor = S.corpo.dores[id];
  if (!dor?.hist.length) return null;
  const n = nivelDor(id), max = Math.max(...dor.hist.map((h) => h[1]));
  return n === 0 ? "resolvida" : dor.hist.length > 1 && n < max ? "melhorando" : "ativa";
}
// Lesões do personal (as que tiram exercícios do plano) vindas das dores ativas do mapa
export function lesoesAtivas() {
  const out = new Set();
  for (const id of Object.keys(S.corpo?.dores || {})) { const p = pontoDor(id); if (p?.[6] && nivelDor(id) > 0) out.add(p[6]); }
  return out;
}

// ---------- saúde básica ----------
// Só guardada, com histórico; não entra nas contas do app. Pressão e FC: uma por dia; exames de sangue: vários.
export function registrarSaude(tipo, valor, d = hoje()) {
  const lista = S.corpo[tipo];
  if (!Array.isArray(lista)) return;
  S.corpo[tipo] = [...lista.filter((x) => x.d !== d || tipo === "sangue"), { d, ...valor }].slice(-200);
  salvar();
}
export function apagarSaude(tipo, i) {
  if (!Array.isArray(S.corpo[tipo])) return;
  S.corpo[tipo] = S.corpo[tipo].filter((_, j) => j !== i);
  salvar();
}
