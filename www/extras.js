// Extras: suplementos do dia, registro de sono e exportação do período em texto.

import { S, REFEICOES, salvar, novoId, hoje, somaDias, paraData, diaDe, totais, porcao } from "./store.js";
import { $, esc, int, dec, lerNum, ui, ACOES, FORMS, FOLHAS, render, avisar, abrirFolha } from "./base.js";
import { resumoSeries } from "./treino.js";
import { descreverCardio } from "./cardio.js";
import { podeCompartilhar, compartilhar } from "./nativo.js";

// ---------- suplementos ----------
const tomados = (d) => diaDe(d).supl || [];

// Aparece no diário só quando existe algum suplemento cadastrado
export function secaoSuplementosDia(d) {
  if (!S.supl.length) return "";
  const feitos = tomados(d);
  return `
    <section class="ref supl">
      <h2><i class="ponto"></i><span class="nome">Suplementos</span><span class="sub">${feitos.filter((id) => S.supl.some((s) => s.id === id)).length} de ${S.supl.length}</span></h2>
      <ul class="marcas">
        ${S.supl.map((s) => {
          const ok = feitos.includes(s.id);
          return `<li><button class="${ok ? "on" : ""}" data-acao="tomar-supl" data-id="${esc(s.id)}" aria-pressed="${ok}">
            <i></i><span>${esc(s.nome)}${s.dose ? ` <small>${esc(s.dose)}</small>` : ""}</span></button></li>`;
        }).join("")}
      </ul>
    </section>`;
}

export function secaoSuplementosAjustes() {
  return `
    <section class="secao">
      <h2>Suplementos</h2>
      <p class="texto">O que cadastrares aqui vira uma lista de marcar no fim do diário de cada dia. Suplemento com calorias, como whey, também precisa entrar numa refeição para contar nas metas.</p>
      ${S.supl.length ? `<ul class="linhas com-x">${S.supl.map((s) => `
        <li><span>${esc(s.nome)}${s.dose ? ` <small>${esc(s.dose)}</small>` : ""}</span>
          <button class="tirar" data-acao="apagar-supl" data-id="${esc(s.id)}" aria-label="Remover ${esc(s.nome)}">×</button></li>`).join("")}</ul>` : ""}
      <form class="par" data-form="novo-supl">
        <label class="campo"><span>Nome</span><input name="nome" required maxlength="40" placeholder="Creatina" autocomplete="off"></label>
        <label class="campo curto"><span>Dose</span><input name="dose" maxlength="20" placeholder="5 g" autocomplete="off"></label>
        <button class="botao fraco">Adicionar</button>
      </form>
    </section>`;
}

// ---------- sono ----------
const horas = (h) => `${(Math.round(h * 100) / 100).toLocaleString("pt-BR")} h`;

export function secaoSono() {
  const h = hoje(), dias = [];
  for (let n = 6; n >= 0; n--) { const d = somaDias(h, -n); dias.push({ d, sono: S.dias[d]?.sono || 0 }); }
  const com = dias.filter((x) => x.sono > 0);
  const media = com.length ? com.reduce((s, x) => s + x.sono, 0) / com.length : 0;
  const escala = Math.max(9, ...dias.map((x) => x.sono));
  return `
    <section class="secao">
      <h2>Sono</h2>
      ${com.length ? `
        <ul class="colunas-sono" role="img" aria-label="Horas de sono nos últimos 7 dias, média de ${dec(media)} h">
          ${dias.map((x) => `<li><span class="col"><i style="height:${((x.sono / escala) * 100).toFixed(1)}%"></i></span><b>${x.sono ? (Math.round(x.sono * 100) / 100).toLocaleString("pt-BR") : "–"}</b><small>${x.d === h ? "hoje" : paraData(x.d).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</small></li>`).join("")}
        </ul>
        <p class="legenda"><span>Média de <b>${dec(media)} h</b> nas noites registradas</span></p>`
      : `<p class="vazio">Registra quantas horas dormiste para acompanhar a semana.</p>`}
      <form class="par" data-form="sono">
        <input name="h" type="number" inputmode="decimal" min="0" max="24" step="0.25" required placeholder="Horas dormidas esta noite" value="${S.dias[h]?.sono || ""}" aria-label="Horas dormidas esta noite">
        <button class="botao">Registrar sono</button>
      </form>
    </section>`;
}

// ---------- exportar em texto ----------
export function secaoExportar() {
  return `
    <section class="secao">
      <h2>Exportar como texto</h2>
      <p class="texto">Metas, peso, refeições, treinos e sono em texto simples, para colar em outro lugar ou mandar para alguém. Quantos dias para trás?</p>
      <div class="par botoes">
        ${[7, 14, 30, 90].map((n) => `<button class="botao fraco" data-acao="exportar-texto" data-n="${n}" aria-label="Exportar os últimos ${n} dias">${n}</button>`).join("")}
      </div>
    </section>`;
}

export function gerarTexto(n) {
  const h = hoje(), ini = somaDias(h, -(n - 1)), L = [];
  const dm = (d) => paraData(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const sem = (d) => paraData(d).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const dias = [];
  for (let d = ini; d <= h; d = somaDias(d, 1)) dias.push(d);

  L.push(`Neru Calorias: últimos ${n} dias (${dm(ini)} a ${dm(h)}/${paraData(h).getFullYear()})`, "");

  const u = S.user, m = S.metas;
  if (u) {
    const obj = { perder: `perder gordura, cerca de ${Number(u.ritmo).toLocaleString("pt-BR")} kg por semana`, manter: "manter o peso", ganhar: `ganhar massa, cerca de ${Number(u.ritmo).toLocaleString("pt-BR")} kg por semana` }[u.objetivo];
    L.push(`Perfil: ${u.sexo === "f" ? "mulher" : "homem"}, ${u.idade} anos, ${u.altura} cm, ${dec(u.peso)} kg. Objetivo: ${obj}.`);
  }
  if (m) L.push(`Metas por dia: ${int(m.kcal)} kcal e ${int(m.protein)} g de proteína${S.metasManuais ? " (definidas à mão)" : ""}.`);
  if (u || m) L.push("");

  const comPeso = dias.filter((d) => S.dias[d]?.peso > 0);
  if (comPeso.length) {
    L.push("Peso");
    for (const d of comPeso) L.push(`${dm(d)}: ${dec(S.dias[d].peso)} kg`);
    if (comPeso.length > 1) {
      const delta = S.dias[comPeso[comPeso.length - 1]].peso - S.dias[comPeso[0]].peso;
      L.push(`Variação no período: ${delta > 0 ? "+" : delta < 0 ? "−" : ""}${dec(Math.abs(delta))} kg`);
    }
    L.push("");
  }

  const comComida = dias.filter((d) => diaDe(d).itens.length);
  if (comComida.length) {
    L.push("Alimentação");
    let sk = 0, sp = 0;
    for (const d of comComida) {
      const t = totais(d);
      sk += t.kcal; sp += t.protein;
      L.push(`${sem(d)} ${dm(d)}: ${int(t.kcal)} kcal, proteína ${int(t.protein)} g, carbo ${int(t.carbs)} g, gordura ${int(t.fat)} g`);
      for (const r of REFEICOES) {
        const itens = diaDe(d).itens.filter((i) => i.ref === r.id);
        if (itens.length) L.push(`  ${r.nome}: ${itens.map((i) => `${i.nome}${porcao(i) ? ` (${porcao(i)})` : ""} ${int(i.kcal)} kcal`).join("; ")}`);
      }
    }
    L.push(`Média ${comComida.length === 1 ? "do dia" : `dos ${comComida.length} dias`} com registro: ${int(sk / comComida.length)} kcal e ${int(sp / comComida.length)} g de proteína`, "");
  }

  const sessoes = (S.treino?.sessoes || []).filter((s) => s.d >= ini && s.d <= h);
  if (sessoes.length) {
    L.push("Treinos");
    for (const s of sessoes) {
      L.push(`${sem(s.d)} ${dm(s.d)}: ${s.nome}${s.folego ? ` (fôlego ${s.folego} de 5)` : ""}`);
      for (const x of s.ex) L.push(`  ${x.nome}: ${resumoSeries(x.series)}`);
    }
    L.push("");
  }

  const cardio = (S.treino?.cardio || []).filter((c) => c.d >= ini && c.d <= h);
  if (cardio.length) {
    L.push("Cardio");
    for (const c of cardio) L.push(`${sem(c.d)} ${dm(c.d)}: ${descreverCardio(c)}`);
    L.push("");
  }

  const comSono = dias.filter((d) => S.dias[d]?.sono > 0);
  if (comSono.length) {
    const media = comSono.reduce((s, d) => s + S.dias[d].sono, 0) / comSono.length;
    L.push("Sono", comSono.map((d) => `${dm(d)}: ${horas(S.dias[d].sono)}`).join("; "), `Média: ${dec(media)} h`, "");
  }

  if (S.supl.length) {
    L.push("Suplementos");
    for (const s of S.supl) {
      const vezes = dias.filter((d) => tomados(d).includes(s.id)).length;
      L.push(`${s.nome}${s.dose ? ` (${s.dose})` : ""}: ${vezes} de ${dias.length} dias`);
    }
    L.push("");
  }

  if (L.length <= 4) L.push("Nada registrado neste período.");
  return L.join("\n").trim() + "\n";
}

FOLHAS.exportar = (f) => `
  <h2 id="folha-titulo">Últimos ${f.n} dias</h2>
  <textarea id="texto-exportado" readonly rows="14" aria-label="Texto exportado">${esc(gerarTexto(f.n))}</textarea>
  <div class="par botoes">
    <button class="botao" data-acao="copiar-exportado">Copiar</button>
    ${podeCompartilhar ? `<button class="botao fraco" data-acao="compartilhar-exportado">Compartilhar</button>` : ""}
  </div>`;

// ---------- ações ----------
Object.assign(ACOES, {
  "tomar-supl"(b) {
    const dia = diaDe(ui.data, true), id = b.dataset.id;
    dia.supl = tomados(ui.data).includes(id) ? dia.supl.filter((x) => x !== id) : [...(dia.supl || []), id];
    salvar(); render();
  },
  "apagar-supl"(b) {
    if (!b.dataset.certeza) { b.dataset.certeza = "1"; b.textContent = "Remover?"; b.classList.add("certeza"); return; }
    S.supl = S.supl.filter((s) => s.id !== b.dataset.id);
    salvar(); render();
  },
  "exportar-texto"(b) { abrirFolha({ tipo: "exportar", n: Number(b.dataset.n) }); },
  async "copiar-exportado"() {
    const campo = $("#texto-exportado");
    try { await navigator.clipboard.writeText(campo.value); avisar("Texto copiado"); }
    catch { campo.focus(); campo.select(); avisar("Seleciona o texto e copia à mão"); }
  },
  "compartilhar-exportado"() { compartilhar("Neru Calorias", $("#texto-exportado").value); },
});

FORMS["novo-supl"] = (form) => {
  const f = new FormData(form), nome = String(f.get("nome") || "").trim().slice(0, 40);
  if (!nome) return;
  S.supl.push({ id: novoId("u"), nome, dose: String(f.get("dose") || "").trim().slice(0, 20) });
  salvar(); render();
  avisar(`${nome} cadastrado. Marca no diário quando tomar`);
};

FORMS.sono = (form) => {
  const h = Math.round(lerNum(new FormData(form).get("h")) * 4) / 4;
  if (!(h > 0 && h <= 24)) return;
  diaDe(hoje(), true).sono = h;
  salvar(); render();
  avisar(`Sono registrado: ${horas(h)}`);
};
