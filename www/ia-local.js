// Ponte com a IA no celular (plugin nativo IALocal, LiteRT-LM + Gemma). Só existe no app Android a partir do APK 3.
// O modelo é carregado na primeira vez que for preciso e fica na memória enquanto o app estiver aberto.

const cap = window.Capacitor;
const plugin = () => (cap?.isNativePlatform?.() && cap.isPluginAvailable?.("IALocal") ? cap.Plugins.IALocal : null);

export const iaLocalExiste = () => !!plugin();
// Modelos sugeridos (litert-community no Hugging Face). O E2B é mais leve; o E4B entende melhor e pesa mais.
export const MODELOS = [
  { id: "e2b", nome: "Gemma 4 E2B (2,6 GB, mais rápido)", url: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm" },
  { id: "e4b", nome: "Gemma 4 E4B (3,7 GB, mais esperto)", url: "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm" },
];

export const local = { temModelo: false, bytes: 0, carregado: false, backend: "", ocupado: "", progresso: null, erro: "" };
const aoMudar = new Set();
export const observarLocal = (fn) => { aoMudar.add(fn); return () => aoMudar.delete(fn); };
const avisarMudanca = () => aoMudar.forEach((fn) => { try { fn(local); } catch { /* tela fechada */ } });

let ouvindo = false;
function ouvirProgresso() {
  if (ouvindo || !plugin()) return;
  ouvindo = true;
  plugin().addListener("progresso", (p) => { local.progresso = p; avisarMudanca(); });
}

export async function atualizarLocal() {
  const P = plugin();
  if (!P) return local;
  try { Object.assign(local, await P.info(), { erro: "" }); } catch (e) { local.erro = e.message; }
  avisarMudanca();
  return local;
}

async function tarefa(nome, fn) {
  local.ocupado = nome; local.erro = ""; local.progresso = null; avisarMudanca();
  try { return await fn(); } catch (e) { local.erro = e.message || String(e); throw e; } finally { local.ocupado = ""; local.progresso = null; await atualizarLocal(); }
}

export const escolherModelo = () => { ouvirProgresso(); return tarefa("copiando", () => plugin().escolherModelo()); };
export const baixarModelo = (url) => { ouvirProgresso(); return tarefa("baixando", () => plugin().baixarModelo({ url })); };
export const apagarModelo = () => tarefa("apagando", () => plugin().apagarModelo());
export const carregarModelo = () => tarefa("carregando", () => plugin().carregar({ backend: "gpu" }));
export const descarregarModelo = () => tarefa("liberando", () => plugin().descarregar());

// Gera uma resposta. imagens: data URLs JPEG (no máximo 2).
export async function gerarLocal({ sistema = "", texto, imagens = [] }) {
  const P = plugin();
  if (!P) throw new Error("A IA do celular só funciona no app Android.");
  if (!local.carregado) {
    await atualizarLocal();
    if (!local.temModelo) throw new Error("Nenhum modelo no celular. Baixa um em Ajustes > IA no celular.");
    await carregarModelo();
  }
  const r = await P.gerar({ sistema, texto, imagens: imagens.slice(0, 2) });
  return String(r.texto || "").trim();
}

// Pronta para usar: existe, está ligada nos Ajustes e tem modelo no aparelho
export const localPronta = (cfg) => iaLocalExiste() && !!cfg.iaLocal && local.temModelo;

atualizarLocal();
