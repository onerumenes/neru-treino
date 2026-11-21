// Cálculo das metas diárias a partir do perfil.
// Gasto: Mifflin-St Jeor (taxa metabólica basal) x fator de atividade.
// Ajuste: ritmo em kg por semana, a 7700 kcal por kg de gordura.

export const ATIVIDADE = {
  sedentario: { f: 1.2, nome: "Sedentário", desc: "pouco ou nenhum exercício" },
  leve: { f: 1.375, nome: "Leve", desc: "1 a 3 treinos por semana" },
  moderado: { f: 1.55, nome: "Moderado", desc: "3 a 5 treinos por semana" },
  intenso: { f: 1.725, nome: "Intenso", desc: "6 a 7 treinos por semana" },
  atleta: { f: 1.9, nome: "Muito intenso", desc: "treino pesado todo dia ou trabalho físico" },
};

export const RITMOS = [0.25, 0.5, 0.75];
// Tipo de trabalho, para separar o movimento do dia a dia do exercício (entra no gasto mais adiante)
export const TRABALHO = { sentado: "Sentado", em_pe: "Em pé", bracal: "Trabalho braçal" };
const KCAL_POR_KG = 7700;
// Proteína em g por kg de peso corporal, conforme o objetivo
const PROTEINA_G_KG = { perder: 2.0, manter: 1.6, ganhar: 1.8 };

// Idade em anos completos na data (nascimento "AAAA-MM-DD"); null se a data não serve
export function idadeDe(nascimento, em = new Date()) {
  const p = String(nascimento || "").split("-").map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
  let a = em.getFullYear() - p[0];
  if (em.getMonth() + 1 < p[1] || (em.getMonth() + 1 === p[1] && em.getDate() < p[2])) a--;
  return a >= 0 && a < 130 ? a : null;
}
// A idade de hoje: pela data de nascimento; perfis antigos, sem ela, usam a idade digitada
export const idadeAtual = (u) => (u ? idadeDe(u.nascimento) ?? (Number(u.idade) || null) : null);

// ---------- ritmo automático ----------
// Em % do peso por semana. Perder: 0,5 a 1% (Helms 2014), mais devagar quanto mais magro ou mais experiente.
// Ganhar: 0,25 a 0,5% para iniciante e intermediário, menos para avançado (Iraki 2019).
// ctx: { nivel, bf, forcaCaindo }
export function ritmoAutomatico(u, ctx = {}) {
  const peso = Number(u?.peso) || 0, f = u?.sexo === "f", motivos = [];
  let pct = 0;
  if (u?.objetivo === "perder") {
    pct = { iniciante: 0.8, intermediario: 0.7, avancado: 0.5 }[ctx.nivel] ?? 0.7;
    if (ctx.nivel) motivos.push({ iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" }[ctx.nivel]);
    if (ctx.bf != null) {
      const alto = f ? 32 : 25, baixo = f ? 20 : 12;
      if (ctx.bf >= alto) { pct = Math.min(1, pct + 0.2); motivos.push(`${Math.round(ctx.bf)}% de gordura: dá para ir mais rápido`); }
      else if (ctx.bf <= baixo) { pct = Math.min(pct, 0.4); motivos.push(`${Math.round(ctx.bf)}% de gordura: devagar para não perder músculo`); }
      else motivos.push(`${Math.round(ctx.bf)}% de gordura`);
    }
    if (ctx.forcaCaindo) { pct = Math.max(0.3, pct - 0.1); motivos.push("Força caindo: um pouco mais devagar"); }
  } else if (u?.objetivo === "ganhar") {
    pct = { iniciante: 0.4, intermediario: 0.3, avancado: 0.2 }[ctx.nivel] ?? 0.3;
    if (ctx.nivel) motivos.push({ iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado: ganho lento, menos gordura" }[ctx.nivel]);
  }
  return { pct, kg: Math.round(((peso * pct) / 100) * 100) / 100, motivos };
}

// Proteína em g por kg de massa magra, quando o app sabe a composição (Helms 2014: 2,3 a 3,1 em déficit)
const PROTEINA_G_KG_MAGRA = { perder: 2.5, manter: 2.2, ganhar: 2.2 };

// extra: { fator (atividade estimada pelos treinos), ritmoKg (ritmo automático), magra (kg de massa magra) }
export function calcMetas(u, extra = {}) {
  if (!u) return null;
  const idade = Number(idadeAtual(u)), altura = Number(u.altura), peso = Number(u.peso);
  if (!(idade > 0 && altura > 0 && peso > 0)) return null;

  const tmb = 10 * peso + 6.25 * altura - 5 * idade + (u.sexo === "f" ? -161 : 5);
  const gasto = tmb * (extra.fator || ATIVIDADE[u.atividade]?.f || 1.2);
  const ritmo = extra.ritmoKg ?? (Number(u.ritmo) || 0.5);
  const ajuste = u.objetivo === "perder" ? (-ritmo * KCAL_POR_KG) / 7
    : u.objetivo === "ganhar" ? (ritmo * KCAL_POR_KG) / 7 : 0;

  // Piso de segurança: abaixo disso fica difícil cobrir nutrientes sem acompanhamento
  const piso = u.sexo === "f" ? 1200 : 1500;
  let kcal = gasto + ajuste;
  const noPiso = kcal < piso;
  if (noPiso) kcal = piso;
  kcal = Math.round(kcal / 10) * 10;

  const protein = extra.magra > 0
    ? Math.round((extra.magra * (PROTEINA_G_KG_MAGRA[u.objetivo] || 2.2)) / 5) * 5
    : Math.round((peso * (PROTEINA_G_KG[u.objetivo] || 1.6)) / 5) * 5;
  const fat = Math.round((kcal * 0.25) / 9 / 5) * 5;
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);

  return {
    kcal, protein, carbs, fat,
    tmb: Math.round(tmb), gasto: Math.round(gasto), ajuste: Math.round(ajuste), noPiso,
    proteinaPela: extra.magra > 0 ? "magra" : "peso",
  };
}
