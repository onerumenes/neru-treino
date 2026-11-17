// Ponte com o app Android (Capacitor): atualização do código sem reinstalar o APK,
// e salvar ou compartilhar arquivos. No navegador, cai nas alternativas da web.

const cap = window.Capacitor;
export const nativo = !!cap?.isNativePlatform?.();
const plugin = (nome) => (nativo ? cap.Plugins?.[nome] : null);

const K = { apk: "neru.apk", tentando: "neru.atualizacao.tentando", ruim: "neru.atualizacao.ruim" };

function oferecer(texto, aoTocar) {
  const barra = document.querySelector("#atualizacao");
  if (!barra) return;
  barra.textContent = texto;
  barra.hidden = false;
  barra.onclick = aoTocar;
}

// Fluxo: (1) se o APK foi trocado, volta para o código que veio dentro dele; (2) avisa o plugin que esta
// versão abriu bem, senão ele desfaz sozinho em 10 s; (3) procura latest.json, baixa o pacote novo em
// segundo plano e oferece aplicar. Sem tocar no aviso, a versão nova entra na próxima abertura.
// Os dados do diário não são afetados.
export async function iniciarAtualizador(build) {
  const LU = plugin("LiveUpdate");
  if (!LU) return;
  try {
    const { versionCode } = await LU.getVersionCode();
    if (localStorage.getItem(K.apk) !== String(versionCode)) {
      localStorage.setItem(K.apk, String(versionCode));
      const { bundleId } = await LU.getCurrentBundle();
      if (bundleId) { await LU.reset(); await LU.reload(); return; }
    }

    const pronto = await LU.ready();
    const tentando = localStorage.getItem(K.tentando);
    if (pronto?.rollback && tentando) localStorage.setItem(K.ruim, tentando); // não insiste num pacote que falhou
    localStorage.removeItem(K.tentando);

    if (!build.atualizacoes) return;
    const r = await fetch(`${build.atualizacoes}/latest.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const ult = await r.json();
    const versao = String(ult?.version || "");
    if (!versao || !ult.url || !(versao > String(build.versao)) || versao === localStorage.getItem(K.ruim)) return;

    if (ult.apk_min && Number(versionCode) < Number(ult.apk_min)) {
      oferecer("Esta atualização precisa do APK novo. Toca para baixar.", () => { if (ult.apk_url) window.open(ult.apk_url, "_blank"); });
      return;
    }

    const { bundleIds } = await LU.getBundles();
    if (!bundleIds.includes(versao)) {
      await LU.downloadBundle({ url: ult.url, bundleId: versao, ...(ult.sha256 ? { checksum: ult.sha256 } : {}) });
    }
    await LU.setNextBundle({ bundleId: versao });
    localStorage.setItem(K.tentando, versao);
    oferecer(`Atualização pronta${ult.notes ? ": " + ult.notes : ""}. Toca para aplicar.`, () => LU.reload());
  } catch (e) {
    console.warn("Atualização:", e);
  }
}

// Entrega um arquivo de texto: no app, pela folha de compartilhar do Android; no navegador, como download.
export async function salvarArquivo(nome, texto, tipo = "text/plain") {
  const FS = plugin("Filesystem"), Share = plugin("Share");
  if (FS && Share) {
    const { uri } = await FS.writeFile({ path: nome, data: texto, directory: "CACHE", encoding: "utf8" });
    try { await Share.share({ title: nome, files: [uri] }); } catch { /* fechou sem escolher */ }
    return "compartilhado";
  }
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "baixado";
}

export const podeCompartilhar = nativo || !!navigator.share;
export async function compartilhar(titulo, texto) {
  const Share = plugin("Share");
  try {
    if (Share) await Share.share({ title: titulo, text: texto });
    else if (navigator.share) await navigator.share({ title: titulo, text: texto });
    else return false;
  } catch { /* fechou sem escolher */ }
  return true;
}
