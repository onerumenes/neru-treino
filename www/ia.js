// Conversa com a OpenAI direto do aparelho, com a chave do próprio usuário.
// Texto e foto vão para a Responses API; áudio vai para a transcrição e volta como texto.

import { S, REFEICOES, diaDe, totais, hoje } from "./store.js";

const API = "https://api.openai.com/v1";

export class ErroIA extends Error {
  constructor(tipo, mensagem) { super(mensagem); this.tipo = tipo; }
}

const PROMPT = `Você é o assistente de nutrição do app Neru Calorias, um diário de calorias e proteína.
Fale português do Brasil, em tom de amigo, curto e direto: 1 a 3 frases, sem markdown.

Em cada mensagem você recebe o ESTADO do dia (metas, itens já registrados com seus ids, totais, hora atual), a CONVERSA recente e a MENSAGEM atual, que pode vir com uma foto.

Regras:
1. Quando a pessoa disser que comeu ou bebeu algo, registre cada alimento separado em "add", estimando kcal, proteína, carboidrato e gordura em gramas. Baseie-se na Tabela TACO e em rótulos comuns no Brasil. Se a quantidade não for dita, assuma uma porção típica e diga qual assumiu.
2. Foto de prato: identifique os alimentos e estime as porções pelo que aparece. Foto de rótulo ou tabela nutricional: use os valores do rótulo para a porção consumida; se a porção não estiver clara, assuma uma porção do rótulo e avise.
3. "meal" é um dos ids de refeição do estado. Use a refeição que a pessoa disser; se não disser, deduza pela hora atual.
4. Para corrigir ou apagar algo já registrado, use "update" (id e só os campos que mudam; os demais ficam null) ou "remove" (lista de ids). Use somente ids que existem no estado.
5. Para perguntas (quanto falta, o que comer, como está o dia), responda com os números reais do estado. As metas que importam são calorias e proteína; carboidrato e gordura são só informativos. Sugestões devem ser concretas, com quantidade e kcal aproximadas.
6. Se não houver nada para registrar, deixe "add", "update" e "remove" vazios.
7. Em "reply", confirme o que foi registrado com o total de kcal e proteína, e diga quanto falta para as metas quando elas existirem.

Responda sempre com um objeto JSON neste formato:
{"reply": "texto", "add": [{"meal": "id", "name": "alimento", "qty": "quantidade", "kcal": 0, "protein": 0, "carbs": 0, "fat": 0}], "update": [{"id": "id", "meal": null, "name": null, "qty": null, "kcal": null, "protein": null, "carbs": null, "fat": null}], "remove": ["id"]}`;

function esquema() {
  const refs = REFEICOES.map((r) => r.id);
  const txt = { type: "string" }, n = { type: "number" };
  const txtOuNada = { type: ["string", "null"] }, nOuNada = { type: ["number", "null"] };
  return {
    type: "object", additionalProperties: false, required: ["reply", "add", "update", "remove"],
    properties: {
      reply: txt,
      add: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          required: ["meal", "name", "qty", "kcal", "protein", "carbs", "fat"],
          properties: { meal: { type: "string", enum: refs }, name: txt, qty: txt, kcal: n, protein: n, carbs: n, fat: n },
        },
      },
      update: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          required: ["id", "meal", "name", "qty", "kcal", "protein", "carbs", "fat"],
          properties: {
            id: txt, meal: { type: ["string", "null"], enum: [...refs, null] },
            name: txtOuNada, qty: txtOuNada, kcal: nOuNada, protein: nOuNada, carbs: nOuNada, fat: nOuNada,
          },
        },
      },
      remove: { type: "array", items: txt },
    },
  };
}

function estado(d) {
  const t = totais(d), m = S.metas, r1 = (x) => Math.round(x * 10) / 10;
  return {
    agora: new Date().toLocaleString("pt-BR", { weekday: "long", hour: "2-digit", minute: "2-digit" }),
    dia_do_registro: d === hoje() ? "hoje" : d,
    refeicoes: REFEICOES.map((r) => ({ id: r.id, nome: r.nome })),
    objetivo: S.user?.objetivo || null,
    metas: m ? { kcal: m.kcal, proteina_g: m.protein } : null,
    registrado: diaDe(d).itens.map((i) => ({
      id: i.id, refeicao: i.ref, nome: i.nome, quantidade: i.qtd,
      kcal: i.kcal, proteina_g: i.protein, carbo_g: i.carbs, gordura_g: i.fat,
    })),
    totais: { kcal: Math.round(t.kcal), proteina_g: r1(t.protein), carbo_g: r1(t.carbs), gordura_g: r1(t.fat) },
    falta: m ? { kcal: Math.round(m.kcal - t.kcal), proteina_g: r1(m.protein - t.protein) } : null,
  };
}

async function chamar(caminho, { json, form } = {}) {
  if (!S.cfg.chave) throw new ErroIA("sem-chave", "Falta a chave da OpenAI. Cole a tua em Ajustes.");
  let r;
  try {
    r = await fetch(API + caminho, {
      method: json || form ? "POST" : "GET",
      headers: { Authorization: "Bearer " + S.cfg.chave, ...(json ? { "Content-Type": "application/json" } : {}) },
      body: form || (json ? JSON.stringify(json) : undefined),
    });
  } catch {
    throw new ErroIA("rede", "Sem conexão com a OpenAI. Confere a internet e tenta de novo.");
  }
  if (r.ok) return r.json();

  let detalhe = "";
  try { detalhe = (await r.json()).error?.message || ""; } catch { /* resposta sem corpo */ }
  if (r.status === 401) throw new ErroIA("chave", "A OpenAI recusou a chave. Confere se ela está certa em Ajustes.");
  if (r.status === 429) throw new ErroIA("limite", "A OpenAI recusou por limite de uso ou falta de crédito na conta (erro 429).");
  if (r.status === 404) throw new ErroIA("modelo", "A OpenAI não encontrou o modelo configurado. Confere os nomes em Ajustes. " + detalhe);
  const erro = new ErroIA(r.status === 400 ? "pedido" : "servidor", `A OpenAI respondeu com erro ${r.status}. ${detalhe}`.trim());
  erro.status = r.status;
  throw erro;
}

function textoDa(resposta) {
  if (typeof resposta.output_text === "string" && resposta.output_text) return resposta.output_text;
  return (resposta.output || [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content || [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("");
}

function lerJson(texto) {
  const limpo = String(texto).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const obj = JSON.parse(limpo);
  return {
    reply: String(obj.reply || "").trim(),
    add: Array.isArray(obj.add) ? obj.add : [],
    update: Array.isArray(obj.update) ? obj.update : [],
    remove: Array.isArray(obj.remove) ? obj.remove.map(String) : [],
  };
}

// texto: mensagem da pessoa. imagem: data URL JPEG (opcional). d: dia em que registrar.
// historico: mensagens anteriores à atual, no formato do S.chat.
export async function conversar({ texto, imagem, d, historico = [] }) {
  const conversa = historico.slice(-8)
    .map((m) => `${m.de === "eu" ? "Pessoa" : "Assistente"}: ${m.texto || (m.foto ? "(enviou uma foto)" : "")}`)
    .join("\n");
  const bloco = `ESTADO:\n${JSON.stringify(estado(d))}\n\nCONVERSA:\n${conversa || "(começo da conversa)"}\n\nMENSAGEM:\n${texto || "(sem texto, só a foto)"}`;
  const content = [{ type: "input_text", text: bloco }];
  if (imagem) content.push({ type: "input_image", image_url: imagem, detail: "auto" });

  const base = {
    model: imagem ? S.cfg.modeloFoto : S.cfg.modeloChat,
    instructions: PROMPT,
    input: [{ role: "user", content }],
    store: false,
  };
  let resposta;
  try {
    resposta = await chamar("/responses", {
      json: { ...base, reasoning: { effort: "low" }, text: { format: { type: "json_schema", name: "registro", strict: true, schema: esquema() } } },
    });
  } catch (e) {
    // Modelos que não aceitam esquema estrito ou esforço de raciocínio: tenta de novo no modo JSON simples
    if (e.tipo !== "pedido") throw e;
    resposta = await chamar("/responses", { json: { ...base, text: { format: { type: "json_object" } } } });
  }
  try { return lerJson(textoDa(resposta)); }
  catch { throw new ErroIA("formato", "A resposta da IA veio num formato que não deu para ler. Tenta de novo."); }
}

export async function transcrever(blob) {
  const tipo = (blob.type || "audio/webm").split(";")[0];
  const ext = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/wav": "wav" }[tipo] || "webm";
  const form = new FormData();
  form.append("file", new File([blob], "audio." + ext, { type: tipo }));
  form.append("model", S.cfg.modeloAudio);
  form.append("language", "pt");
  const r = await chamar("/audio/transcriptions", { form });
  return String(r.text || "").trim();
}

// Confere a chave e o modelo de conversa com uma chamada que não gasta créditos.
export async function testarChave() {
  await chamar("/models/" + encodeURIComponent(S.cfg.modeloChat));
  return true;
}
