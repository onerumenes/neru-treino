// Avatar anatômico: o desenho do corpo do react-native-body-highlighter (MIT), com cada músculo
// escalado pela medida da fita e uma camada de gordura em volta, mais grossa onde ela se acumula.
// Os traçados ficam em corpo-anatomico.json (gerado por tools/corpo_anatomico.mjs), já em coordenadas
// absolutas só com M/L/C/Q/Z, para mover cada músculo trocando os números aos pares (x, y).

export const LICENCA_CORPO = `MIT License

Copyright (c) 2022 ELABBASSI Hicham

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

// ---------- dados ----------
let dados = null;
// Carrega os traçados uma vez (ficam no cache do app junto com o resto)
export function carregarCorpo(url = "corpo-anatomico.json") {
  if (!dados) {
    dados = fetch(url)
      .then((r) => { if (!r.ok) throw new Error("Não deu para carregar o desenho do corpo."); return r.json(); })
      .catch((e) => { dados = null; throw e; });
  }
  return dados;
}

// ---------- regras do desenho ----------
// Medidas que o desenho original representa. Calibrar aqui muda o avatar de todo mundo.
export const REF = {
  m: { pescoco: 38, ombros: 115, peito: 100, braco: 34, antebraco: 28, cintura: 82, quadril: 96, coxa: 56, panturrilha: 37, bf: 15 },
  f: { pescoco: 32, ombros: 100, peito: 90, braco: 28, antebraco: 24, cintura: 70, quadril: 98, coxa: 56, panturrilha: 35, bf: 24 },
};
export const EXAGERO = 1.6;      // a diferença de medida aparece 1,6 vez maior, para ser visível
// Quanto da volta medida é gordura, por ponto de % de gordura: na cintura e no quadril, bem mais
const GORDURA_NA_VOLTA = { cintura: 0.012, quadril: 0.012 };
const GORDURA_NA_VOLTA_PADRAO = 0.006;

// Músculo do desenho → medida que manda nele
export const MEDIDA_DO_MUSCULO = {
  chest: "peito", "upper-back": "peito", abs: "cintura", obliques: "cintura", "lower-back": "cintura",
  trapezius: "ombros", deltoids: "ombros", neck: "pescoco", gluteal: "quadril",
  biceps: "braco", triceps: "braco", forearm: "antebraco",
  quadriceps: "coxa", adductors: "coxa", hamstring: "coxa", calves: "panturrilha", tibialis: "panturrilha",
};
const TRONCO = new Set(["chest", "upper-back", "abs", "obliques", "lower-back", "trapezius", "neck", "gluteal"]);
const BRACO = new Set(["biceps", "triceps", "forearm", "hands"]);
const PERNA = new Set(["quadriceps", "adductors", "hamstring", "knees", "tibialis", "calves", "ankles", "feet"]);
export const PELE = new Set(["head", "hands", "feet", "knees", "ankles"]);
// Onde a gordura se acumula mais (classe 0) ou menos (classe 4)
export const CLASSE_GORDURA = {
  abs: 0, obliques: 0, "lower-back": 0,
  gluteal: 1, quadriceps: 1, adductors: 1, hamstring: 1,
  chest: 2, "upper-back": 2, biceps: 2, triceps: 2,
  trapezius: 3, neck: 3, deltoids: 3, forearm: 3, calves: 3, tibialis: 3,
  knees: 4, ankles: 4, hands: 4, feet: 4, head: 4,
};
const PESO_GORDURA = [1.6, 1.2, 0.9, 0.6, 0.15];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Espessura da camada de gordura de cada classe só pela % de gordura (o corpo de referência)
export const espessurasGordura = (bf) => PESO_GORDURA.map((p) => Math.max(3, (2 + bf * 0.95) * p));

// Escala de um músculo: a volta medida contra a de referência, descontando a parte que é gordura
export function escalaMusculo(medida, ref, bf, refBf, k = GORDURA_NA_VOLTA_PADRAO) {
  if (!(medida > 0) || !(ref > 0)) return 1;
  const ms = (medida / ref) * ((1 - k * bf) / (1 - k * refBf));
  return clamp(1 + (ms - 1) * EXAGERO, 0.6, 1.7);
}
// Escala do corpo inteiro naquela altura (músculo + gordura): só a volta medida
export const escalaVolta = (medida, ref) => (medida > 0 && ref > 0 ? clamp(1 + (medida / ref - 1) * EXAGERO, 0.6, 2.2) : 1);

// A gordura de cada classe é o que falta entre o tamanho total (a volta) e o músculo,
// em cima da camada do corpo de referência. Meia-largura do desenho em cada região, em unidades do desenho.
const GORDURA_POR_CLASSE = [["cintura", 108], ["coxa", 43], ["peito", 109], ["braco", 25]];

const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
// Aplica fx aos x e fy aos y de um traçado já em coordenadas absolutas
export function moverTracado(d, fx, fy) {
  let i = 0;
  return d.replace(NUM, (n) => " " + (i++ % 2 === 0 ? fx(+n) : fy(+n)).toFixed(1));
}

/**
 * Monta o corpo de uma vista.
 * vista: dados[sexo].front ou .back · sexo: "m" ou "f"
 * m: medidas em cm e bf em %; aceita medida por lado (braco_l, braco_r: l é o lado esquerdo da tela)
 * op.camada(slug, lado) → nome da camada de cor do músculo (padrão "musculo")
 * op.gordura: espessuras das 5 classes, prontas; senão saem das medidas e da % de gordura
 * op.ajusteGordura: multiplicador de cada classe (as dobras dizem em que região a gordura está)
 * Devolve { vb, meio, chao, gordura: [{ d, w }], pele, cabelo, cabeloAtras, camadas: { nome: d }, caixas }
 */
export function montarCorpo(vista, sexo, m, op = {}) {
  const ref = REF[sexo] || REF.m, meio = vista.meio, G = vista.grupos;
  const bf = Number(m.bf) || ref.bf;
  const medida = (k, l) => Number(m[`${k}_${l}`] ?? m[k]) || ref[k];
  const esc = (k, l) => escalaMusculo(medida(k, l), ref[k], bf, ref.bf, GORDURA_NA_VOLTA[k]);
  const centro = (k) => { const b = G[k]; return b ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : null; };
  const sOmb = esc("ombros"), sPeito = esc("peito"), sQuad = esc("quadril");
  const camada = op.camada || (() => "musculo");
  const gordura = ["", "", "", "", ""], camadas = {}, tf = {};
  let pele = "", cabelo = "";
  for (const [s, l, d] of vista.partes) {
    const k = `${s}:${l}`;
    if (!tf[k]) {
      const ck = centro(k) || [meio, 0], sx = MEDIDA_DO_MUSCULO[s] ? esc(MEDIDA_DO_MUSCULO[s], l) : 1;
      let fx = (x) => x, fy = (y) => y;
      if (TRONCO.has(s)) {
        const sy = 1 + (sx - 1) * 0.2;
        fx = (x) => meio + (x - meio) * sx; fy = (y) => ck[1] + (y - ck[1]) * sy;
      } else if (s === "deltoids") {
        const tx = (sOmb - 1) * (ck[0] - meio) * 0.9;
        fx = (x) => ck[0] + (x - ck[0]) * sx + tx; fy = (y) => ck[1] + (y - ck[1]) * (1 + (sx - 1) * 0.3);
      } else if (BRACO.has(s)) {
        // o braço acompanha o ombro e o peito, para não entrar no tronco
        const dl = centro(`deltoids:${l}`), off = dl ? dl[0] - meio : 0;
        const tx = (sOmb - 1) * off * 0.9 + (sPeito - 1) * Math.sign(off) * 50;
        fx = (x) => ck[0] + (x - ck[0]) * sx + tx; fy = (y) => ck[1] + (y - ck[1]) * (1 + (sx - 1) * 0.15);
      } else if (PERNA.has(s)) {
        // a perna acompanha o quadril
        const q = centro(`quadriceps:${l}`) || centro(`hamstring:${l}`), tx = (sQuad - 1) * (q ? q[0] - meio : 0);
        fx = (x) => ck[0] + (x - ck[0]) * sx + tx; fy = (y) => ck[1] + (y - ck[1]) * (1 + (sx - 1) * 0.15);
      }
      tf[k] = [fx, fy];
    }
    const nd = moverTracado(d, tf[k][0], tf[k][1]);
    if (s === "hair") { cabelo += nd; continue; }
    if (CLASSE_GORDURA[s] != null) gordura[CLASSE_GORDURA[s]] += nd;
    if (PELE.has(s)) pele += nd;
    else { const c = camada(s, l) || "musculo"; camadas[c] = (camadas[c] || "") + nd; }
  }
  const caixas = {};
  for (const k in tf) {
    const b = G[k];
    if (b) caixas[k] = [tf[k][0](b[0]), tf[k][1](b[1]), tf[k][0](b[2]), tf[k][1](b[3])];
  }
  let w = op.gordura;
  if (!w) {
    const base = espessurasGordura(ref.bf);
    w = base.map((b, i) => {
      if (!GORDURA_POR_CLASSE[i]) return b;
      const [k, meia] = GORDURA_POR_CLASSE[i];
      return b + 2 * (escalaVolta(medida(k), ref[k]) - esc(k)) * meia;
    });
    // a % de gordura também conta quando as medidas não dizem nada (ex.: só peso e altura)
    const pelaBf = espessurasGordura(bf);
    w = w.map((x, i) => Math.max(x, pelaBf[i] * 0.6));
    // as dobras dizem onde a gordura está: cada classe engrossa ou afina pela dobra da região
    if (op.ajusteGordura) w = w.map((x, i) => x * (op.ajusteGordura[i] ?? 1));
  }
  const vb = vista.vb.split(" ").map(Number), pad = 70;
  return {
    vb: [vb[0] - pad, vb[1] - 10, vb[2] + pad * 2, vb[3] + 40].join(" "),
    meio, chao: vista.caixa[3] + 12,
    gordura: gordura.map((d, i) => ({ d, w: Math.max(3, w[i]) })),
    pele, camadas, caixas,
    // o cabelo comprido (corpo feminino) fica atrás da cabeça; o curto, por cima
    cabelo: sexo === "f" ? "" : cabelo, cabeloAtras: sexo === "f" ? cabelo : "",
  };
}

// ---------- SVG ----------
export const CORES_CORPO = { contorno: "#241A22", pele: "#F3E6D2", pontas: "#E4CFAE", musculo: "#3A2B35", cabelo: "#241A22" };

/**
 * SVG do corpo montado, como texto (as telas do app são montadas em HTML).
 * op: { largura, altura, rotulo, cores: { camada: cor }, sombra: true, extra: SVG a mais por cima }
 */
export function svgCorpo(c, op = {}) {
  const cores = { ...CORES_CORPO, ...(op.cores || {}) };
  const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const contorno = c.gordura.map((g) => g.d && `<path d="${g.d}" fill="${cores.contorno}" stroke="${cores.contorno}" stroke-width="${(g.w + 9).toFixed(1)}" stroke-linejoin="round"/>`).join("");
  const pele = c.gordura.map((g) => g.d && `<path d="${g.d}" fill="${cores.pele}" stroke="${cores.pele}" stroke-width="${g.w.toFixed(1)}" stroke-linejoin="round"/>`).join("");
  const ordem = ["musculo", ...Object.keys(c.camadas).filter((k) => k !== "musculo")];
  const musculos = ordem.filter((k) => c.camadas[k]).map((k) => `<path d="${c.camadas[k]}" fill="${cores[k] || cores.musculo}"/>`).join("");
  const rot = op.rotulo ? ` role="img" aria-label="${attr(op.rotulo)}"` : ` aria-hidden="true"`;
  return `<svg class="corpo" viewBox="${c.vb}"${op.largura ? ` width="${op.largura}"` : ""}${op.altura ? ` height="${op.altura}"` : ""}${rot}>`
    + (op.sombra ? `<ellipse cx="${c.meio}" cy="${c.chao}" rx="230" ry="26" fill="${cores.contorno}" fill-opacity="0.14"/>` : "")
    + contorno + pele
    + (c.cabeloAtras ? `<path d="${c.cabeloAtras}" fill="${cores.cabelo}"/>` : "")
    + (c.pele ? `<path d="${c.pele}" fill="${cores.pontas}"/>` : "")
    + musculos
    + (c.cabelo ? `<path d="${c.cabelo}" fill="${cores.cabelo}"/>` : "")
    + (op.extra || "")
    + `</svg>`;
}
