// Lembretes do nutri e do personal (notificações locais do Android, plugin @capacitor/local-notifications).
// Horários saem da consulta (hora de acordar e do treino); tocar no lembrete abre a tela certa do app.

import { S, REFEICOES, salvar } from "./store.js";
import { ui, ACOES, MUDANCAS, render } from "./base.js";
import { SECOES_AJUSTES } from "./tela-ia-ajustes.js";

const cap = window.Capacitor;
const plugin = () => (cap?.isNativePlatform?.() && cap.isPluginAvailable?.("LocalNotifications") ? cap.Plugins.LocalNotifications : null);
export const lembretesExistem = () => !!plugin();

// Dias no formato do plugin: domingo = 1 ... sábado = 7
const DIAS = [[2, "Seg"], [3, "Ter"], [4, "Qua"], [5, "Qui"], [6, "Sex"], [7, "Sáb"], [1, "Dom"]];
const HORA_REF = { cafe: null, almoco: "12:15", pos_treino: null, janta: "19:30", ceia: "21:45" };

const hm = (txt, padrao) => { const [h, m] = String(txt || padrao).split(":").map(Number); return { hour: h || 0, minute: m || 0 }; };
const somaMin = ({ hour, minute }, min) => { const t = (hour * 60 + minute + min + 1440) % 1440; return { hour: Math.floor(t / 60), minute: t % 60 }; };

export function planoLembretes() {
  const L = S.cfg.lembretes, p = S.perfil || {}, acorda = hm(p.acorda, "07:00"), lista = [];
  const base = (id, title, body, on, extra) => ({ id, title, body, schedule: { on, allowWhileIdle: true }, extra, smallIcon: "ic_stat_neru" });
  if (L.refeicoes) {
    const refs = p.refs?.length ? p.refs : ["cafe", "almoco", "janta"];
    REFEICOES.forEach((r, i) => {
      if (!refs.includes(r.id)) return;
      const on = r.id === "cafe" ? somaMin(acorda, 40) : r.id === "pos_treino" ? (p.treinoHora ? somaMin(hm(p.treinoHora), 75) : null) : hm(HORA_REF[r.id]);
      if (!on) return;
      lista.push(base(100 + i, r.nome, r.id === "cafe" ? "Bom dia! Abre o app para ver a meta de hoje." : "Na dúvida do que comer, toca em \"O que eu como agora?\".", on, { aba: "hoje" }));
    });
  }
  if (L.pesagem) {
    for (const wd of [2, 4, 6]) lista.push(base(200 + wd, "Pesagem", "Em jejum, depois do banheiro. Leva 10 segundos.", { weekday: wd, ...somaMin(acorda, 5) }, { aba: "equipe", sub: "corpo" }));
  }
  if (L.checkin) lista.push(base(300, "Check-in da semana", "2 minutos para o nutri ajustar teu plano.", { weekday: 1, hour: 10, minute: 0 }, { aba: "equipe", acao: "checkin" }));
  if (L.treino) {
    const quando = somaMin(hm(p.treinoHora, "18:00"), -60);
    for (const wd of L.diasTreino || []) lista.push(base(400 + wd, "Treino daqui a 1 hora", "Come algo com carboidrato e proteína agora, se ainda não comeu.", { weekday: wd, ...quando }, { aba: "treino" }));
  }
  return lista;
}

export async function agendarLembretes() {
  const P = plugin();
  if (!P) return { ok: false, motivo: "web" };
  const pend = await P.getPending();
  if (pend.notifications?.length) await P.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
  if (!S.cfg.lembretes.ativo) return { ok: true, n: 0 };
  const perm = await P.requestPermissions();
  if (perm.display !== "granted") return { ok: false, motivo: "permissao" };
  const lista = planoLembretes();
  if (lista.length) await P.schedule({ notifications: lista });
  return { ok: true, n: lista.length };
}

// Tocar no lembrete abre a tela dele
let ouvindo = false;
export function ouvirLembretes(abrir) {
  const P = plugin();
  if (!P || ouvindo) return;
  ouvindo = true;
  P.addListener("localNotificationActionPerformed", (a) => { const x = a.notification?.extra; if (x?.aba) abrir(x); });
}

// ---------- Ajustes ----------
const marcado = (c) => (c ? "checked" : "");
SECOES_AJUSTES.push(() => {
  const L = S.cfg.lembretes;
  if (!lembretesExistem()) {
    return `<section class="secao"><h2>Lembretes</h2><p class="texto">Os lembretes de refeição, pesagem, check-in e treino funcionam no app Android a partir do APK 3.</p></section>`;
  }
  return `
    <section class="secao">
      <h2>Lembretes</h2>
      <label class="chave-liga"><input type="checkbox" id="lem-ativo" ${marcado(L.ativo)}><span>Ligar lembretes</span></label>
      <div ${L.ativo ? "" : "hidden"}>
        <label class="chave-liga"><input type="checkbox" id="lem-refeicoes" ${marcado(L.refeicoes)}><span>Refeições (pelos horários da consulta)</span></label>
        <label class="chave-liga"><input type="checkbox" id="lem-pesagem" ${marcado(L.pesagem)}><span>Pesagem (seg, qua e sex de manhã)</span></label>
        <label class="chave-liga"><input type="checkbox" id="lem-checkin" ${marcado(L.checkin)}><span>Check-in da semana (domingo às 10h)</span></label>
        <label class="chave-liga"><input type="checkbox" id="lem-treino" ${marcado(L.treino)}><span>Treino (1 hora antes)</span></label>
        <fieldset class="opcoes dias-treino" ${L.treino ? "" : "hidden"}><legend>Dias de treino</legend>
          ${DIAS.map(([n, nome]) => `<label><input type="checkbox" name="dia-treino" value="${n}" ${marcado((L.diasTreino || []).includes(n))}><span>${nome}</span></label>`).join("")}
        </fieldset>
        <button class="botao fraco cheio" data-acao="salvar-lembretes">Salvar lembretes</button>
        ${ui.lembretesInfo ? `<p class="resultado ${ui.lembretesInfo.ok ? "ok" : "ruim"}">${ui.lembretesInfo.texto}</p>` : ""}
      </div>
    </section>`;
});

ACOES["salvar-lembretes"] = async () => {
  try {
    const r = await agendarLembretes();
    ui.lembretesInfo = r.ok ? { ok: true, texto: r.n ? `${r.n} lembretes agendados.` : "Lembretes desligados." }
      : { ok: false, texto: r.motivo === "permissao" ? "O Android não deu permissão para notificações. Libera em Configurações > Apps > Neru Calorias." : "Lembretes só no app Android." };
  } catch (e) { ui.lembretesInfo = { ok: false, texto: e.message || "Não deu para agendar." }; }
  render();
};

MUDANCAS.push((el) => {
  const L = S.cfg.lembretes;
  const mapa = { "lem-ativo": "ativo", "lem-refeicoes": "refeicoes", "lem-pesagem": "pesagem", "lem-checkin": "checkin", "lem-treino": "treino" };
  if (mapa[el.id]) { L[mapa[el.id]] = el.checked; ui.lembretesInfo = null; salvar(); render(); return true; }
  if (el.name === "dia-treino") {
    const n = Number(el.value);
    L.diasTreino = el.checked ? [...new Set([...(L.diasTreino || []), n])] : (L.diasTreino || []).filter((x) => x !== n);
    salvar(); return true;
  }
  return false;
});

