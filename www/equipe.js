// A equipe junta o nutri e o personal: regras que cruzam treino, comida, peso e sono, ajustes temporários de meta,
// e o relatório semanal. Tudo por regra; a IA só comenta (equipe-ia.js).

import { S, hoje, somaDias, totais, salvar, paraData } from "./store.js";
import { T, exercicio, proximoDia } from "./treino.js";
import { ritmoPeso, adesao, gastoReal, mudarMetaKcal, aplicarMetas, FONTES, pisoKcal } from "./nutri.js";
import { blocoAtual, recordes, estagnados, volumeFeito, faixaVolume, e1rm, ehComposto } from "./personal.js";
import { GRUPOS } from "./treino.js";

const r10 = (x) => Math.round(x / 10) * 10;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const num = (x) => (Math.round(x * 10) / 10).toLocaleString("pt-BR");

// ---------- sinais ----------
// Força: melhor série (1RM estimado) das 2 últimas semanas contra as 2 anteriores, nos exercícios feitos nos dois períodos
export function tendenciaForca(ate = hoje()) {
  const meio = somaDias(ate, -14), ini = somaDias(ate, -28), rec = new Map(), ant = new Map();
  for (const s of T().sessoes) for (const x of s.ex) {
    const m = x.series.reduce((mx, y) => Math.max(mx, e1rm(y.kg, y.reps)), 0);
    if (!m) continue;
    if (s.d > meio && s.d <= ate) rec.set(x.ex, Math.max(rec.get(x.ex) || 0, m));
    else if (s.d > ini && s.d <= meio) ant.set(x.ex, Math.max(ant.get(x.ex) || 0, m));
  }
  const comuns = [...rec.keys()].filter((k) => ant.has(k));
  if (comuns.length < 3) return null;
  const caindo = comuns.filter((k) => rec.get(k) < ant.get(k) * 0.97).length;
  const subindo = comuns.filter((k) => rec.get(k) > ant.get(k) * 1.01).length;
  return { comuns: comuns.length, caindo, subindo, cai: caindo >= Math.max(2, Math.ceil(comuns.length * 0.4)) };
}

export function sonoMedio(ate = hoje(), dias = 7) {
  const xs = [];
  for (let n = 0; n < dias; n++) { const s = S.dias[somaDias(ate, -n)]?.sono; if (s > 0) xs.push(s); }
  return xs.length >= 3 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// Proteína abaixo de 85% da meta nos 3 dias anteriores (com registro)
export function proteinaBaixa(ate = hoje()) {
  const m = S.metas;
  if (!m) return null;
  const dias = [1, 2, 3].map((n) => totais(somaDias(ate, -n)));
  if (dias.some((t) => t.kcal < 600) || !dias.every((t) => t.protein < m.protein * 0.85)) return null;
  return Math.round(dias.reduce((s, t) => s + t.protein, 0) / 3);
}

// 0 = descanso, 1 = treino, 2 = treino de perna
const ehPerna = (exs) => exs.some((x) => ["quadriceps", "posterior", "gluteos"].includes(exercicio(x.ex).g) && ehComposto(x.ex));
export function diaDeTreino(d = hoje()) {
  const sessao = T().sessoes.find((s) => s.d === d) || (T().atual?.d === d ? T().atual : null);
  if (sessao) return ehPerna(sessao.ex) ? 2 : 1;
  const dias = S.cfg.lembretes?.diasTreino || [];
  if (d === hoje() && dias.includes(paraData(d).getDay() + 1)) { const p = proximoDia(); return p && ehPerna(p.ex) ? 2 : 1; }
  return 0;
}
// O nutri dá mais peso ao pós-treino nos dias de treino (mais ainda no de perna)
FONTES.diaDeTreino = diaDeTreino;

// ---------- ajuste temporário de meta ----------
export function aplicarTemporario(delta, dias) {
  revisarTemporario(true);
  S.nutri.temporario = { delta, ate: somaDias(hoje(), dias - 1), manual: !!S.metasManuais };
  if (S.metasManuais) S.metas.kcal = Math.max(pisoKcal(), r10(S.metas.kcal + delta)); else aplicarMetas();
  salvar();
}
// Desfaz o temporário vencido (ou à força, antes de aplicar outro)
export function revisarTemporario(forcar = false) {
  const t = S.nutri.temporario;
  if (!t || (!forcar && hoje() <= t.ate)) return false;
  delete S.nutri.temporario;
  if (t.manual && S.metas) S.metas.kcal = Math.max(pisoKcal(), r10(S.metas.kcal - t.delta)); else if (S.user) aplicarMetas();
  salvar();
  return true;
}

// ---------- avisos da equipe ----------
export function avisos(d = hoje()) {
  const u = S.user, m = S.metas;
  if (!u || !m) return [];
  const out = [], forca = tendenciaForca(d), sono = sonoMedio(d), ritmo = ritmoPeso(d), gasto = gastoReal();
  const ult = S.nutri.checkins[S.nutri.checkins.length - 1];
  const deficit = u.objetivo === "perder" || (gasto.ok && m.kcal < gasto.tdee - 250);
  const sonoRuim = (sono != null && sono < 6.5) || (ult && ult.sono <= 2 && somaDias(ult.d, 10) >= d);
  const temp = S.nutri.temporario;

  if (forca?.cai && deficit && !temp) {
    const delta = sonoRuim ? 150 : 100;
    out.push({
      id: `forca-${somaDias(d, -((paraData(d).getDay() + 6) % 7))}`, quem: "Personal e nutri", titulo: "A força está caindo",
      texto: `O personal viu a força cair em ${forca.caindo} de ${forca.comuns} exercícios nas últimas 2 semanas${sonoRuim ? `, com sono ${sono != null ? `de ${num(sono)} h` : "ruim"}` : ""}. Em déficit, isso costuma ser falta de recuperação: o nutri sugere ${delta} kcal a mais por 2 semanas.`,
      acao: { rotulo: `+${delta} kcal por 2 semanas`, tipo: "temporario", delta, dias: 14 },
    });
  }
  if (u.objetivo === "ganhar" && ritmo != null && ritmo > Math.max(0.5, Number(u.ritmo || 0.25) * 1.5)) {
    out.push({
      id: `bulk-${d.slice(0, 7)}`, quem: "Nutri e personal", titulo: "Ganho rápido demais",
      texto: `O peso está subindo ${num(ritmo)} kg por semana, mais que o plano (${num(Number(u.ritmo || 0.25))}). Acima disso, boa parte vira gordura: o nutri tira 100 kcal do superávit e o personal mantém o volume de treino.`,
      acao: { rotulo: "Tirar 100 kcal", tipo: "meta", delta: -100 },
    });
  }
  const b = blocoAtual(d);
  if (b?.deload && u.objetivo === "perder" && !temp) {
    const delta = clamp(r10(gasto.ok ? gasto.tdee - m.kcal : Math.abs(m.ajuste || 300)), 100, 500);
    out.push({
      id: `deload-${b.ini}`, quem: "Personal e nutri", titulo: "Semana de recuperação",
      texto: `O treino está na semana de recuperação. Se quiseres, o nutri sobe a meta para perto da manutenção nesta semana (+${delta} kcal): o corpo recupera melhor e na semana seguinte o déficit volta.`,
      acao: { rotulo: `+${delta} kcal por 7 dias`, tipo: "temporario", delta, dias: 7 },
    });
  }
  const pb = proteinaBaixa(d);
  if (pb != null) {
    out.push({
      id: `prot-${d}`, quem: "Personal", titulo: "Proteína baixa há 3 dias",
      texto: `Média de ${pb} g nos últimos 3 dias para uma meta de ${m.protein} g. Sem proteína o músculo não recupera do treino. O "O que eu como agora?" ajuda a fechar a de hoje.`,
      acao: { rotulo: "O que eu como agora?", tipo: "sugestao" },
    });
  }
  const tr = d === hoje() ? diaDeTreino(d) : 0;
  if (tr === 2) {
    out.push({
      id: `perna-${d}`, quem: "Nutri", titulo: "Dia de perna",
      texto: "Treino pesado de perna hoje: põe mais carboidrato antes e depois (arroz, batata, banana, pão). As sugestões de hoje já dão mais espaço ao pós-treino.",
    });
  }
  if (temp && d <= temp.ate) {
    out.push({ id: `temp-${temp.ate}`, quem: "Nutri", titulo: "Meta temporária", texto: `A meta está ${temp.delta > 0 ? "+" : "−"}${Math.abs(temp.delta)} kcal até ${paraData(temp.ate).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}. Depois volta sozinha.`, fixo: true });
  }
  const disp = S.equipe?.dispensados || {};
  return out.filter((a) => a.fixo || !disp[a.id]);
}

export function executarAviso(a) {
  if (a.acao?.tipo === "temporario") aplicarTemporario(a.acao.delta, a.acao.dias);
  else if (a.acao?.tipo === "meta") mudarMetaKcal(a.acao.delta);
  dispensar(a.id);
}
export function dispensar(id) {
  S.equipe = S.equipe || { dispensados: {} };
  S.equipe.dispensados[id] = hoje();
  // limpa dispensas com mais de 60 dias
  for (const [k, d] of Object.entries(S.equipe.dispensados)) if (somaDias(d, 60) < hoje()) delete S.equipe.dispensados[k];
  salvar();
}

// ---------- relatório semanal ----------
export function relatorioPendente(d = hoje()) {
  if (!S.user || !S.metas) return false;
  const ult = S.relatorios[S.relatorios.length - 1];
  if (ult) return somaDias(ult.d, 7) <= d;
  return adesao(d).registrados >= 5;
}

export function gerarRelatorio(ate = hoje()) {
  const m = S.metas, u = S.user, ad = adesao(ate), ritmo = ritmoPeso(ate), sono = sonoMedio(ate);
  const sessoes = T().sessoes.filter((s) => s.d > somaDias(ate, -7) && s.d <= ate);
  const rec = recordes(ate), est = estagnados(), vol = volumeFeito(ate), forca = tendenciaForca(ate);
  const baixos = Object.entries(vol).filter(([g, v]) => v < faixaVolume(g)[0]).map(([g]) => GRUPOS[g]);
  const alvo = u.objetivo === "perder" ? -Number(u.ritmo || 0.5) : u.objetivo === "ganhar" ? Number(u.ritmo || 0.25) : 0;
  const linhas = [];
  linhas.push(ad.registrados
    ? `Comida: ${ad.registrados} de 7 dias registrados, ${ad.naMeta} perto da meta, média de ${ad.kcalMedia.toLocaleString("pt-BR")} kcal e ${ad.protMedia} g de proteína (meta ${m.kcal.toLocaleString("pt-BR")} kcal e ${m.protein} g).`
    : "Comida: nenhum dia registrado na semana.");
  if (ritmo != null) linhas.push(`Peso: ${ritmo > 0 ? "+" : ritmo < 0 ? "−" : ""}${num(Math.abs(ritmo))} kg por semana pela tendência (plano: ${alvo > 0 ? "+" : alvo < 0 ? "−" : ""}${num(Math.abs(alvo))}).`);
  else linhas.push("Peso: ainda não dá para saber o ritmo. São precisas 3 pesagens cobrindo pelo menos uma semana.");
  if (T().plano.length) {
    let t = `Treino: ${sessoes.length} ${sessoes.length === 1 ? "treino" : "treinos"}`;
    if (rec.length) t += `, ${rec.length} ${rec.length === 1 ? "recorde" : "recordes"} (${rec.slice(0, 3).map((r) => `${r.nome.split(" com ")[0].toLowerCase()} +${num(r.ganho)}%`).join(", ")})`;
    if (est.length) t += `, ${est.length} parado${est.length > 1 ? "s" : ""} (${est.slice(0, 2).map((x) => x.nome.toLowerCase()).join(", ")})`;
    if (baixos.length && sessoes.length) t += `. Pouco volume em ${baixos.slice(0, 3).join(", ").toLowerCase()}`;
    if (forca?.cai) t += `. A força caiu em ${forca.caindo} de ${forca.comuns} exercícios`;
    linhas.push(t + ".");
  }
  if (sono != null) linhas.push(`Sono: média de ${num(sono)} h${sono < 6.5 ? ", abaixo do ideal para recuperar o treino" : ""}.`);
  const foco = [];
  if (ad.registrados < 5) foco.push("registrar a comida todos os dias");
  else if (ad.protOk < ad.registrados * 0.6) foco.push("fechar a proteína (use o \"O que eu como agora?\" à tarde)");
  if (T().plano.length && sessoes.length < Math.min(3, T().plano.length)) foco.push("não pular treino");
  if (sono != null && sono < 6.5) foco.push("dormir mais cedo");
  if (est.length) foco.push(`trocar ${est[0].nome.toLowerCase()}`);
  if (!foco.length) foco.push("manter o que está funcionando");
  linhas.push(`Foco da semana: ${foco.slice(0, 2).join(" e ")}.`);
  const fatos = {
    ate, dias_registrados: ad.registrados, perto_da_meta: ad.naMeta, kcal_media: ad.kcalMedia, proteina_media_g: ad.protMedia,
    meta_kcal: m.kcal, meta_proteina_g: m.protein, ritmo_kg_semana: ritmo, ritmo_planejado: alvo, treinos: sessoes.length,
    recordes: rec.map((r) => ({ exercicio: r.nome, ganho_pct: r.ganho })), parados: est.map((x) => x.nome), volume_baixo: baixos,
    sono_medio_h: sono != null ? Math.round(sono * 10) / 10 : null, foco,
  };
  const r = { d: ate, linhas, fatos, texto: null };
  S.relatorios = [...S.relatorios, r].slice(-26);
  salvar();
  return r;
}

// Chamado ao abrir o app: vence ajustes temporários e gera o relatório da semana se for a hora
export function iniciarEquipe() {
  revisarTemporario();
  if (S.user && !S.metasManuais) aplicarMetas();
  if (relatorioPendente()) gerarRelatorio();
}
