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
const KCAL_POR_KG = 7700;
// Proteína em g por kg de peso corporal, conforme o objetivo
const PROTEINA_G_KG = { perder: 2.0, manter: 1.6, ganhar: 1.8 };

export function calcMetas(u) {
  if (!u) return null;
  const idade = Number(u.idade), altura = Number(u.altura), peso = Number(u.peso);
  if (!(idade > 0 && altura > 0 && peso > 0)) return null;

  const tmb = 10 * peso + 6.25 * altura - 5 * idade + (u.sexo === "f" ? -161 : 5);
  const gasto = tmb * (ATIVIDADE[u.atividade]?.f || 1.2);
  const ritmo = Number(u.ritmo) || 0.5;
  const ajuste = u.objetivo === "perder" ? (-ritmo * KCAL_POR_KG) / 7
    : u.objetivo === "ganhar" ? (ritmo * KCAL_POR_KG) / 7 : 0;

  // Piso de segurança: abaixo disso fica difícil cobrir nutrientes sem acompanhamento
  const piso = u.sexo === "f" ? 1200 : 1500;
  let kcal = gasto + ajuste;
  const noPiso = kcal < piso;
  if (noPiso) kcal = piso;
  kcal = Math.round(kcal / 10) * 10;

  const protein = Math.round((peso * (PROTEINA_G_KG[u.objetivo] || 1.6)) / 5) * 5;
  const fat = Math.round((kcal * 0.25) / 9 / 5) * 5;
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);

  return {
    kcal, protein, carbs, fat,
    tmb: Math.round(tmb), gasto: Math.round(gasto), ajuste: Math.round(ajuste), noPiso,
  };
}
