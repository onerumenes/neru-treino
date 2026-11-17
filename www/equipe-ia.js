// A voz da equipe: a IA (celular ou OpenAI) explica com palavras o que os motores do nutri e do personal já
// calcularam. Ela recebe só os números prontos e é instruída a não inventar valores. Também comenta as fotos do
// físico, que por padrão só são vistas pela IA do celular.

import { S, nomeRef, hoje, somaDias, salvar, porcao } from "./store.js";
import { esc, dataCurta, ui, ACOES, render, avisar } from "./base.js";
import { falar, temIA, ultimaRota } from "./ia.js";
import { NARRAR } from "./tela-nutri.js";
import { NARRAR_PLANO } from "./tela-plano.js";
import { NARRAR_PERSONAL } from "./tela-personal.js";
import { NARRAR_RELATORIO } from "./tela-relatorio.js";
import { SECOES, hidratarFotos } from "./tela-equipe.js";
import { adesao, ritmoPeso, gastoReal } from "./nutri.js";
import { recordes, estagnados, volumeFeito, faixaVolume, blocoAtual } from "./personal.js";
import { T, GRUPOS } from "./treino.js";
import { POSES, sessoesDeFotos, fotoParaIA, ultimasMedidas, composicao } from "./corpo.js";
import { resumoCardio, faseCardio, planoCardio, evolucaoLeve } from "./cardio.js";

const REGRAS = "Fale português do Brasil, em tom de amigo, direto, sem markdown e sem listas. Use apenas os números que estão nos DADOS; não invente valores. Não dê diagnóstico médico; se algo parecer de saúde, sugira procurar um profissional.";
export const SISTEMA = {
  nutri: `Você é o nutricionista do app Neru Calorias. ${REGRAS}`,
  personal: `Você é o personal trainer do app Neru Calorias. ${REGRAS}`,
  equipe: `Você é a equipe do app Neru Calorias: um nutricionista e um personal trainer que trabalham juntos pelo objetivo da pessoa. ${REGRAS}`,
};
const pedir = (dados, pedido) => `DADOS:\n${JSON.stringify(dados)}\n\nPEDIDO:\n${pedido}`;
const objetivo = () => ({ perder: "perder gordura", manter: "manter o peso", ganhar: "ganhar massa" }[S.user?.objetivo] || null);

// Contexto do treino e do corpo, que o nutri e o personal compartilham
export function contextoEquipe() {
  const ad = adesao(), b = blocoAtual(), feito = volumeFeito();
  const sono = Object.keys(S.dias).sort().slice(-7).map((d) => S.dias[d].sono).filter((x) => x > 0);
  return {
    objetivo: objetivo(),
    metas: S.metas ? { kcal: S.metas.kcal, proteina_g: S.metas.protein } : null,
    semana_comida: { dias_registrados: ad.registrados, perto_da_meta: ad.naMeta, kcal_media: ad.kcalMedia, proteina_media_g: ad.protMedia },
    peso_kg_por_semana: ritmoPeso(),
    sono_medio_h: sono.length ? Math.round((sono.reduce((s, x) => s + x, 0) / sono.length) * 10) / 10 : null,
    treino: {
      bloco: b ? { semana: b.semana, de: b.semanas, recuperacao: b.deload } : null,
      treinos_7_dias: T().sessoes.filter((s) => s.d > somaDias(hoje(), -7)).length,
      recordes: recordes().map((r) => ({ exercicio: r.nome, ganho_pct: r.ganho })),
      parados: estagnados().map((x) => x.nome),
      series_por_musculo_7_dias: Object.fromEntries(Object.entries(feito).map(([g, v]) => [GRUPOS[g] || g, { feitas: v, faixa: faixaVolume(g) }])),
    },
    cardio: contextoCardio(),
  };
}

function contextoCardio() {
  const r = resumoCardio(), p = planoCardio(), f = faseCardio(), ev = evolucaoLeve();
  return {
    ultimos_7_dias: { sessoes: r.sessoes, minutos: r.min, km: r.km, intervalados: r.intervalados },
    folego_nos_treinos_1a5: r.folego,
    plano: p ? { semana: f.semana, fase: f.fase, leve_min: p.leveMin } : null,
    velocidade_leve_kmh: ev.length > 1 ? { antes: ev[0].v, agora: ev[ev.length - 1].v } : null,
  };
}

NARRAR.sugestao = (s) => falar({
  sistema: SISTEMA.nutri,
  texto: pedir({
    objetivo: objetivo(), meta: { kcal: s.meta.kcal, proteina_g: s.meta.protein },
    ja_comeu: { kcal: Math.round(s.consumido.kcal), proteina_g: Math.round(s.consumido.protein) },
    sugestao: s.refeicoes.map((r) => ({
      refeicao: nomeRef(r.ref), itens: r.escolha?.itens.map((i) => ({ alimento: i.nome, porcao: porcao(i), kcal: i.kcal, proteina_g: i.protein })) || [],
      total_kcal: r.escolha?.kcal, origem: r.escolha?.origem,
    })),
    dia_fecha_em: s.total ? { kcal: Math.round(s.consumido.kcal + s.total.kcal), proteina_g: Math.round(s.consumido.protein + s.total.protein) } : null,
  }, "Em 2 a 3 frases, explique por que essas porções fecham o dia sem passar da meta e dê uma dica prática (preparo, tempero ou troca)."),
});

NARRAR.checkin = (a) => falar({
  sistema: SISTEMA.equipe,
  texto: pedir({
    ...contextoEquipe(),
    checkin: { fome_1a5: a.respostas.fome, energia_1a5: a.respostas.energia, sono_1a5: a.respostas.sono },
    ritmo_planejado_kg_semana: a.alvoRitmo, gasto_real_kcal: a.gasto.ok ? a.gasto.tdee : null,
    decisao: { mudanca_kcal: a.delta, nova_meta_kcal: a.nova, motivos: a.motivos },
  }, "Comente o check-in da semana em 3 a 4 frases: o que foi bem, o que muda na meta e por quê, e uma coisa para focar (comida ou treino)."),
});

NARRAR_PLANO.retorno = (r) => falar({
  tarefa: "revisao",
  sistema: SISTEMA.equipe,
  texto: pedir({
    ...contextoEquipe(),
    mes: {
      desde: r.desde, peso_inicio: r.pesoIni && Math.round(r.pesoIni * 10) / 10, peso_agora: r.pesoFim && Math.round(r.pesoFim * 10) / 10,
      gordura_pct: r.cIni && r.cFim ? { antes: r.cIni.bf, agora: r.cFim.bf } : null,
      massa_magra_kg: r.cIni && r.cFim ? { antes: r.cIni.magra, agora: r.cFim.magra } : null,
      cintura_cm: r.medIni?.cintura && r.medFim?.cintura && r.medIni !== r.medFim ? { antes: r.medIni.cintura, agora: r.medFim.cintura } : null,
      dias_perto_da_meta_pct: r.adesao, dias_registrados: r.diasRegistrados, gasto_real_kcal: r.gasto.ok ? r.gasto.tdee : null,
    },
  }, "Faça a análise do retorno mensal em 4 a 6 frases, falando como nutri e personal juntos: o que o corpo mostrou no mês, se a perda (ou ganho) foi de gordura ou de massa magra, e os 2 ajustes mais importantes para o próximo mês (um de comida, um de treino)."),
});

NARRAR_PERSONAL.revisao = () => falar({
  sistema: SISTEMA.personal,
  texto: pedir(contextoEquipe(), "Comente a semana de treino em 3 a 4 frases: recordes, volume por músculo comparado à faixa, exercícios parados, o cardio e o fôlego, e como a comida, o peso e o sono estão ajudando ou atrapalhando a recuperação."),
});

NARRAR_RELATORIO.relatorio = (r) => falar({
  sistema: SISTEMA.equipe,
  texto: pedir({ objetivo: objetivo(), semana: r.fatos, resumo: r.linhas }, "Comente o relatório da semana em 3 a 5 frases, como nutri e personal juntos: o que foi bem, o que preocupa e o plano concreto para a próxima semana."),
});

// ---------- fotos do físico ----------
async function analisarFotos() {
  const sess = sessoesDeFotos();
  if (!sess.length) throw new Error("Tira as fotos primeiro.");
  const cmp = ui.fotoComparar && sess.length > 1 ? ui.fotoComparar : { a: sess[sess.length - 1].d, b: sess[0].d, pose: "frente" };
  const sa = sess.find((s) => s.d === cmp.a), sb = sess.find((s) => s.d === cmp.b);
  const ids = [sa?.poses[cmp.pose], sb && sb !== sa ? sb.poses[cmp.pose] : null].filter(Boolean);
  if (!ids.length) throw new Error("Falta a foto dessa pose.");
  const imagens = (await Promise.all(ids.map((id) => fotoParaIA(id)))).filter(Boolean);
  const meds = ultimasMedidas(), cA = meds.primeira && composicao(meds.primeira), cZ = meds.atual && composicao(meds.atual);
  const dados = {
    pose: POSES.find((p) => p.id === cmp.pose).nome, fotos: ids.length === 2 ? [`antes: ${cmp.a}`, `depois: ${cmp.b}`] : [`foto de ${cmp.a}`],
    objetivo: objetivo(), prioridades_do_treino: (S.personal.avaliacao?.prioridades || []).map((g) => GRUPOS[g]),
    medidas: meds.atual ? { data: meds.atual.d, ...Object.fromEntries(Object.entries(meds.atual).filter(([k]) => k !== "d")) } : null,
    gordura_pela_fita_pct: cA && cZ ? { antes: cA.bf, agora: cZ.bf } : cZ ? { agora: cZ.bf } : null,
  };
  const pedido = ids.length === 2
    ? "A primeira imagem é o ANTES e a segunda o DEPOIS, na mesma pose. Em 3 a 5 frases, diga as mudanças visíveis (definição, volume muscular, cintura, postura) e 1 ou 2 músculos que parecem atrás e valem prioridade no treino. Não estime percentual de gordura nem peso pelas fotos: esses números vêm das medidas nos DADOS. Seja respeitoso e objetivo."
    : "Em 3 a 4 frases, diga os pontos fortes do físico na foto e 1 ou 2 músculos que valem prioridade no treino. Não estime percentual de gordura nem peso pela foto. Seja respeitoso e objetivo.";
  const texto = await falar({ tarefa: "foto_corpo", sistema: SISTEMA.personal, texto: pedir(dados, pedido), imagens });
  S.personal.analises = [...(S.personal.analises || []), { d: hoje(), texto, via: ultimaRota, pose: cmp.pose, de: cmp.a, ate: cmp.b }].slice(-10);
  salvar();
  return texto;
}

function secaoAnalise() {
  if (!sessoesDeFotos().length) return "";
  const ult = (S.personal.analises || []).slice(-1)[0], pode = temIA("foto_corpo");
  return `
    <section class="secao">
      <h2>Olhar do personal</h2>
      ${ult ? `<p class="narracao">${esc(ult.texto)}</p><p class="legenda"><span>${dataCurta(ult.d)}, ${POSES.find((p) => p.id === ult.pose)?.nome.toLowerCase() || ""}${ult.de !== ult.ate ? `, de ${dataCurta(ult.de)} a ${dataCurta(ult.ate)}` : ""}${ult.via === "local" ? ", IA do celular" : ", OpenAI"}</span></p>` : ""}
      ${pode ? `<button class="botao fraco cheio" data-acao="analisar-fotos">${ui.analisando ? "Analisando…" : "Pedir a análise das fotos"}</button>
        <p class="dica">${S.cfg.nuvemFotoCorpo ? "As fotos podem ir para a OpenAI (ligado em Ajustes)." : "Analisadas pela IA do celular; não saem do aparelho."}</p>`
      : `<p class="vazio">A análise das fotos usa a IA do celular, para elas não saírem do aparelho. Baixa o modelo em Ajustes > IA no celular.</p>`}
    </section>`;
}
SECOES.corpo.push(secaoAnalise);

ACOES["analisar-fotos"] = async (b) => {
  if (ui.analisando) return;
  ui.analisando = true; b.disabled = true; b.textContent = "Analisando…";
  try { await analisarFotos(); } catch (e) { avisar(e.message || "Não deu para analisar agora."); }
  ui.analisando = false;
  if (ui.aba === "equipe") { render(); hidratarFotos(document); }
};

