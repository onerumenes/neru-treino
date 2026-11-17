// Corpo: medidas, percentual de gordura pela fórmula da Marinha americana e fotos padronizadas do físico.
// As fotos ficam no IndexedDB (loja "fotos"), nunca no estado nem no backup.

import { S, salvar, novoId, hoje, diaDe, medicoes, pesos, guardarImagem, lerImagem, apagarImagem } from "./store.js";

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

// Composição na data: % de gordura, massa gorda e massa magra (precisa do peso mais próximo)
export function composicao(med) {
  const u = S.user;
  if (!u || !med) return null;
  const bf = gorduraMarinha({ sexo: u.sexo, altura: u.altura, ...med });
  if (bf == null) return null;
  const ps = pesos(), perto = ps.filter((p) => p.d <= med.d).pop() || ps[0];
  const kg = perto?.kg || u.peso;
  return { bf, kg, gorda: Math.round(kg * bf) / 100, magra: Math.round(kg * (100 - bf)) / 100 };
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
