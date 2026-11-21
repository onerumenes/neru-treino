// Cardio: registro (esteira, bicicleta...), o plano de cardio do personal e a progressão.
// Plano em fases: semanas 1-2 só leve; 3-4 leve + intervalado curto (4 x 2 min); 5 em diante leve + 4x4.
// Leve = ritmo de conversa. Na semana de recuperação do bloco, menos cardio e sem intervalado.
// As calorias gastas não entram em conta nenhuma: o nível de atividade e o gasto real já cuidam disso.

import { S, salvar, hoje, somaDias, novoId } from "./store.js";
import { T, exercicio, GANCHOS } from "./treino.js";
import { emRecuperacao, ehComposto } from "./personal.js";

export const APARELHOS = { esteira: "Esteira", bike: "Bicicleta", eliptico: "Elíptico", outro: "Outro" };
export const MODOS = { leve: "Leve contínuo", intervalado: "Intervalado" };
export const ESFORCOS = { 1: "Leve: dava para conversar", 2: "Moderado: só frases curtas", 3: "Forte: só palavras soltas" };
export const LEVE_MAX = 30; // passando disso, a progressão do leve vai para a velocidade

const n1 = (x) => Math.round(x * 10) / 10;
export const fmtNum = (x) => n1(x).toLocaleString("pt-BR");

export const cardios = () => T().cardio;
export const ehPerna = (exs = []) => exs.some((x) => ["quadriceps", "posterior", "gluteos"].includes(exercicio(x.ex).g) && ehComposto(x.ex));
export const velocidade = (c) => (c?.km > 0 && c?.min > 0 ? c.km / (c.min / 60) : null);

// ---------- registro ----------
export function limparCardio(x) {
  const num = (v, max) => { const n = Number(String(v ?? "").replace(",", ".")); return n > 0 ? Math.min(max, n1(n)) : null; };
  const c = {
    aparelho: APARELHOS[x.aparelho] ? x.aparelho : "esteira",
    modo: x.modo === "intervalado" ? "intervalado" : "leve",
    min: Math.round(num(x.min, 600) || 0),
    km: num(x.km, 100), incl: num(x.incl, 30), fc: num(x.fc, 230), vel: num(x.vel, 40),
    esforco: [1, 2, 3].includes(Number(x.esforco)) ? Number(x.esforco) : 1,
  };
  for (const k of ["km", "incl", "fc", "vel"]) if (c[k] == null) delete c[k];
  if (c.modo !== "intervalado") delete c.vel;
  return c;
}

export function registrarCardio(x, d = hoje(), sessao = null) {
  const c = { id: novoId("c"), d, ...limparCardio(x), ...(sessao ? { sessao } : {}) };
  cardios().push(c);
  progredir();
  salvar();
  return c;
}
export function removerCardio(id) {
  const t = T(), i = t.cardio.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const [fora] = t.cardio.splice(i, 1);
  salvar();
  return { fora, i };
}
// O cardio feito dentro de um treino entra quando o treino é concluído (treino.js chama este gancho)
GANCHOS.cardio = (c, d, sessao) => registrarCardio(c, d, sessao);

// ---------- plano ----------
export const planoCardio = () => S.personal.cardio || null;
export function iniciarPlanoCardio(leveMin, aparelho) {
  S.personal.cardio = { ini: hoje(), leveMin: Math.min(LEVE_MAX, Math.max(10, Number(leveMin) || 15)), aparelho: APARELHOS[aparelho] ? aparelho : "esteira", base: contarLeves() };
  salvar();
}
export function desligarPlanoCardio() { S.personal.cardio = null; salvar(); }

export function faseCardio(d = hoje()) {
  const p = planoCardio();
  if (!p) return null;
  const semana = Math.floor(Math.round((new Date(d) - new Date(p.ini)) / 864e5) / 7) + 1;
  return { semana, fase: semana <= 2 ? 1 : semana <= 4 ? 2 : 3 };
}
export const NOMES_FASE = {
  1: "Fase 1: base leve (só ritmo de conversa)",
  2: "Fase 2: leve + intervalado curto (4 × 2 min)",
  3: "Fase 3: leve + intervalado 4×4",
};

const leves = () => cardios().filter((c) => c.modo === "leve");
const contarLeves = () => cardios().filter((c) => c.modo === "leve").length;
const ultimoDe = (modo) => [...cardios()].reverse().find((c) => c.modo === modo) || null;

// Progressão do leve: duas sessões seguidas com o tempo completo e esforço leve → +3 min (até 30), depois +0,3 km/h
function progredir() {
  const p = planoCardio();
  if (!p || emRecuperacao()) return;
  const ls = leves();
  if (ls.length - (p.base || 0) < 2) return;
  const [a, b] = ls.slice(-2);
  if (![a, b].every((c) => c.min >= p.leveMin && c.esforco === 1)) return;
  if (p.leveMin < LEVE_MAX) p.leveMin = Math.min(LEVE_MAX, p.leveMin + 3);
  else if (velocidade(b)) p.leveVel = n1(velocidade(b) + 0.3);
  p.base = ls.length;
}
// Equipe: força caindo com cardio crescendo → menos cardio leve
export function reduzirCardio() {
  const p = planoCardio();
  if (!p) return;
  p.leveMin = Math.max(10, Math.round(p.leveMin * 0.7));
  p.base = contarLeves();
  salvar();
}

function prescricaoLeve(perna, deload) {
  const p = planoCardio(), ult = ultimoDe("leve");
  const min = deload ? Math.max(10, Math.round((p.leveMin * 0.7) / 5) * 5) : p.leveMin;
  let vel = p.leveVel || velocidade(ult), motivo;
  if (!ult) motivo = "Primeira vez: escolhe uma velocidade em que consigas conversar o tempo todo.";
  else if (ult.esforco >= 2) { vel = vel ? Math.max(3, vel - 0.5) : null; motivo = "Da última vez não ficou leve: vai mais devagar, a ponto de conseguir conversar."; }
  else motivo = p.leveVel ? "O tempo já está no máximo do plano: agora sobe um pouco a velocidade." : "Ritmo de conversa. Duas vezes seguidas assim e o tempo sobe.";
  if (perna && p.aparelho === "esteira") motivo += " Hoje é perna: prefere caminhada com inclinação (ou bicicleta) a correr.";
  if (deload) motivo = "Semana de recuperação: cardio mais curto. " + motivo;
  return { modo: "leve", min, vel: vel ? n1(vel) : null, motivo, texto: `${min} min leve${vel ? `, por volta de ${fmtNum(vel)} km/h` : ""}` };
}

function prescricaoForte(fase) {
  const [tiros, forte, rec] = fase >= 3 ? [4, 4, 3] : [4, 2, 2];
  const ult = ultimoDe("intervalado");
  let vel = ult?.vel || null, motivo;
  if (!ult) motivo = "Primeira vez: no fim de cada tiro deves conseguir dizer só palavras soltas. Começa com uma velocidade que dê para manter nos 4 tiros.";
  else if (ult.esforco < 3) { vel = vel ? vel + 0.5 : null; motivo = "Da última vez não chegou a forte: sobe meio km/h nos tiros."; }
  else motivo = "Mantém a velocidade dos tiros e completa os 4.";
  const min = 5 + tiros * (forte + rec);
  return {
    modo: "intervalado", min, vel: vel ? n1(vel) : null, tiros, forte, rec, motivo,
    texto: `5 min de aquecimento + ${tiros} × (${forte} min forte / ${rec} min caminhando)${vel ? `, tiros a ${fmtNum(vel)} km/h` : ""}`,
  };
}

// Cardio prescrito para um dia do plano (null = sem cardio nesse dia). diaId vazio = treino livre (leve).
export function cardioDoDiaPlano(diaId, d = hoje()) {
  const p = planoCardio();
  if (!p) return null;
  const plano = T().plano, deload = emRecuperacao(d), { fase } = faseCardio(d);
  const dia = plano.find((x) => x.id === diaId) || null;
  if (!dia) return prescricaoLeve(false, deload);
  // intervalado no primeiro dia sem perna; leve nos outros, até 3 por semana (2 na recuperação)
  const forte = fase >= 2 && !deload ? (plano.find((x) => !ehPerna(x.ex)) || plano[0])?.id : null;
  if (dia.id === forte) return prescricaoForte(fase);
  const comLeve = plano.filter((x) => x.id !== forte).slice(0, deload ? 2 : 3).map((x) => x.id);
  return comLeve.includes(dia.id) ? prescricaoLeve(ehPerna(dia.ex), deload) : null;
}

// ---------- acompanhamento ----------
export function resumoCardio(ate = hoje(), dias = 7) {
  const ini = somaDias(ate, -dias);
  const cs = cardios().filter((c) => c.d > ini && c.d <= ate);
  const fol = T().sessoes.filter((s) => s.d > ini && s.d <= ate && s.folego > 0).map((s) => s.folego);
  return {
    sessoes: cs.length, min: cs.reduce((s, c) => s + c.min, 0), km: n1(cs.reduce((s, c) => s + (c.km || 0), 0)),
    intervalados: cs.filter((c) => c.modo === "intervalado").length,
    folego: fol.length ? n1(fol.reduce((s, x) => s + x, 0) / fol.length) : null,
  };
}

// Velocidade no cardio leve (esforço leve) ao longo do tempo: subir com o mesmo esforço = fôlego melhor
export function evolucaoLeve(n = 20) {
  return leves().filter((c) => c.esforco === 1 && velocidade(c)).slice(-n).map((c) => ({ d: c.d, v: n1(velocidade(c)) }));
}

// Fôlego (1 a 5) das últimas sessões de musculação
export function evolucaoFolego(n = 12) {
  return T().sessoes.filter((s) => s.folego > 0).slice(-n).map((s) => ({ d: s.d, v: s.folego }));
}

export function descreverCardio(c) {
  const v = velocidade(c);
  return `${APARELHOS[c.aparelho]}, ${c.modo === "intervalado" ? "intervalado" : "leve"}: ${c.min} min`
    + `${c.km ? `, ${fmtNum(c.km)} km` : ""}${v ? ` (${fmtNum(v)} km/h)` : ""}${c.incl ? `, inclinação ${fmtNum(c.incl)}%` : ""}`
    + `${c.vel ? `, tiros a ${fmtNum(c.vel)} km/h` : ""}${c.fc ? `, FC ${Math.round(c.fc)}` : ""}`;
}
