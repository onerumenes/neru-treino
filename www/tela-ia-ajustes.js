// Ajustes da equipe: modo do plano alimentar, IA no celular (modelo, teste) e o que pode ir para a OpenAI.

import { S, salvar } from "./store.js";
import { $, esc, ui, ACOES, MUDANCAS, render, avisar } from "./base.js";
import {
  iaLocalExiste, MODELOS, local, observarLocal, atualizarLocal, escolherModelo, baixarModelo, apagarModelo, carregarModelo, gerarLocal,
} from "./ia-local.js";

const gb = (b) => `${(b / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
const marcado = (c) => (c ? "checked" : "");
// Seções extras penduradas por outros módulos (lembretes, fase 5)
export const SECOES_AJUSTES = [];

function blocoLocal() {
  if (!iaLocalExiste()) {
    return `<p class="texto">Disponível no app Android a partir do APK 3. No navegador, a IA usa a OpenAI.</p>`;
  }
  const L = local, p = L.progresso;
  const pct = p && p.total > 0 ? Math.round((p.feitos / p.total) * 100) : null;
  const ocupado = L.ocupado ? `
    <div class="progresso"><span>${{ baixando: "Baixando o modelo", copiando: "Copiando o modelo", carregando: "Carregando na memória (até 10 s)", apagando: "Apagando", liberando: "Liberando a memória", testando: "Testando" }[L.ocupado] || "Trabalhando"}${pct != null ? ` ${pct}%` : p ? ` ${gb(p.feitos)}` : "…"}</span>
      ${pct != null ? `<i style="width:${pct}%"></i>` : ""}</div>` : "";
  return `
    <p class="texto">Um modelo Gemma roda no próprio celular: as fotos do físico nunca saem do aparelho e o dia a dia não gasta créditos. O arquivo tem de 2,6 a 3,7 GB; baixa pelo Wi-Fi.</p>
    <p class="estado-ia">${L.temModelo ? `Modelo no aparelho: <b>${gb(L.bytes)}</b>${L.carregado ? `, carregado (${L.backend === "gpu" ? "GPU" : "CPU"})` : ""}` : "Nenhum modelo no aparelho."}</p>
    ${ocupado}
    ${L.erro ? `<p class="resultado ruim">${esc(L.erro)}</p>` : ""}
    ${ui.testeLocal ? `<p class="resultado ${ui.testeLocal.ok ? "ok" : "ruim"}">${esc(ui.testeLocal.texto)}</p>` : ""}
    <label class="chave-liga"><input type="checkbox" id="usar-local" ${marcado(S.cfg.iaLocal)} ${L.temModelo ? "" : "disabled"}><span>Usar a IA do celular</span></label>
    ${L.ocupado ? "" : `
      ${L.temModelo ? `<div class="par botoes">
          <button class="botao fraco" data-acao="testar-local">Carregar e testar</button>
          <button class="botao perigo" data-acao="apagar-modelo">Apagar modelo</button>
        </div>` : ""}
      <details ${L.temModelo ? "" : "open"}>
        <summary>${L.temModelo ? "Trocar o modelo" : "Baixar um modelo"}</summary>
        <label class="campo"><span>Modelo</span><select id="modelo-local">${MODELOS.map((m) => `<option value="${m.id}">${m.nome}</option>`).join("")}</select></label>
        <div class="par botoes">
          <button class="botao" data-acao="baixar-modelo">Baixar</button>
          <button class="botao fraco" data-acao="escolher-modelo">Escolher arquivo</button>
        </div>
        <p class="dica">Se o download pedir login, baixa o arquivo .litertlm pelo navegador (Hugging Face, litert-community) e usa "Escolher arquivo".</p>
      </details>`}`;
}

export function secaoIALocal() {
  const c = S.cfg;
  return `
    <section class="secao">
      <h2>Plano do nutri</h2>
      <fieldset class="opcoes"><legend>Modo do plano alimentar</legend>
        <label><input type="radio" name="modo-plano" value="flexivel" ${marcado(S.nutri.modo !== "fechado")}><span>Flexível</span></label>
        <label><input type="radio" name="modo-plano" value="fechado" ${marcado(S.nutri.modo === "fechado")}><span>Fechado</span></label>
      </fieldset>
      <p class="dica">Flexível: metas e sugestões na hora. Fechado: as sugestões seguem o cardápio do plano, com substituições.</p>
    </section>

    <section class="secao" id="sec-ia-local">
      <h2>IA no celular</h2>
      ${blocoLocal()}
    </section>

    <section class="secao">
      <h2>O que vai para a OpenAI</h2>
      <p class="texto">Com a IA do celular ligada, só vai para a OpenAI o que marcares aqui (e o áudio, que é transcrito lá). Sem o modelo no celular, tudo vai para a OpenAI, menos as fotos do físico.</p>
      <label class="chave-liga"><input type="checkbox" id="nuvem-prato" ${marcado(c.nuvemFotoPrato)}><span>Fotos de prato e rótulo (a OpenAI acerta mais as porções)</span></label>
      <label class="chave-liga"><input type="checkbox" id="nuvem-revisao" ${marcado(c.nuvemRevisao)}><span>Análise do retorno mensal</span></label>
      <label class="chave-liga"><input type="checkbox" id="nuvem-corpo" ${marcado(c.nuvemFotoCorpo)}><span>Fotos do físico (desligado: ficam só no celular)</span></label>
    </section>
    ${SECOES_AJUSTES.map((fn) => fn()).join("")}`;
}

// Atualiza só a seção da IA local (progresso do download), sem redesenhar a tela toda
observarLocal(() => {
  const el = $("#sec-ia-local");
  if (ui.aba === "ajustes" && el) el.innerHTML = `<h2>IA no celular</h2>${blocoLocal()}`;
});

async function rodar(fn, okMsg) {
  try { await fn(); if (okMsg) avisar(okMsg); } catch (e) { if (!/cancel|escolhido/i.test(e.message || "")) avisar(e.message || "Não deu certo."); }
  if (ui.aba === "ajustes") render();
}

Object.assign(ACOES, {
  "baixar-modelo"() {
    const m = MODELOS.find((x) => x.id === $("#modelo-local")?.value) || MODELOS[0];
    rodar(() => baixarModelo(m.url), "Modelo baixado. Liga \"Usar a IA do celular\"");
  },
  "escolher-modelo"() { rodar(() => escolherModelo(), "Modelo copiado para o app"); },
  "apagar-modelo"(b) {
    if (!b.dataset.certeza) { b.dataset.certeza = "1"; b.textContent = "Apagar mesmo?"; return; }
    S.cfg.iaLocal = false; salvar();
    rodar(() => apagarModelo(), "Modelo apagado");
  },
  "testar-local"() {
    ui.testeLocal = null;
    rodar(async () => {
      if (!local.carregado) await carregarModelo();
      local.ocupado = "testando"; render();
      const t0 = Date.now();
      try {
        const r = await gerarLocal({ sistema: "Responda em português, numa frase curta.", texto: "Diga oi e quantas calorias tem 100 g de arroz branco cozido." });
        ui.testeLocal = { ok: true, texto: `Respondeu em ${((Date.now() - t0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s: “${r.slice(0, 160)}”` };
      } catch (e) { ui.testeLocal = { ok: false, texto: e.message }; }
      finally { local.ocupado = ""; await atualizarLocal(); }
    });
  },
});

MUDANCAS.push((el) => {
  const mapa = { "usar-local": "iaLocal", "nuvem-prato": "nuvemFotoPrato", "nuvem-revisao": "nuvemRevisao", "nuvem-corpo": "nuvemFotoCorpo" };
  if (!mapa[el.id]) return false;
  S.cfg[mapa[el.id]] = el.checked;
  salvar();
  if (el.id === "usar-local") avisar(el.checked ? "A IA do celular cuida do dia a dia" : "IA do celular desligada");
  return true;
});
