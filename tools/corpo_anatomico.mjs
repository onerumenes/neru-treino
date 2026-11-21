// Gera www/corpo-anatomico.json a partir do react-native-body-highlighter (MIT, ELABBASSI Hicham).
// Cada traçado vira coordenadas absolutas só com M/L/C/Q/Z, para o avatar.js escalar cada músculo
// trocando os números aos pares, e cada grupo (músculo + lado) ganha a caixa onde cabe.
//
// Uso (precisa de Node 20+):
//   git clone --depth 1 https://github.com/HichamELBSI/react-native-body-highlighter /tmp/rnbh
//   npm i --no-save svgpath svg-path-bbox
//   node tools/corpo_anatomico.mjs /tmp/rnbh www/corpo-anatomico.json

import fs from "node:fs";
import path from "node:path";
import svgpath from "svgpath";
import { svgPathBbox } from "svg-path-bbox";

const [base, saida] = process.argv.slice(2);
if (!base || !saida) {
  console.error("uso: node tools/corpo_anatomico.mjs <pasta do body-highlighter> <saída.json>");
  process.exit(1);
}

const r = (n) => Math.round(n * 10) / 10;
const caixa = (d) => svgPathBbox(d).map(r);

// Os arquivos de assets são TypeScript simples: um array exportado
function lerTS(arq) {
  const t = fs.readFileSync(path.join(base, "assets", arq), "utf8")
    .replace(/^import .*$/m, "")
    .replace(/export const \w+: BodyPart\[\] =/, "return");
  return new Function(t)();
}
// Contorno do corpo, só para achar o meio (eixo de simetria) e o chão
function contorno(arq, lado) {
  const blocos = fs.readFileSync(path.join(base, "components", arq), "utf8").split(`side === "${lado}"`);
  return blocos[blocos.length - 1]?.match(/d="([^"]+)"/)?.[1] || null;
}

function plano(d) {
  const out = [];
  let x = 0, y = 0, x0 = 0, y0 = 0;
  svgpath(d).abs().unshort().unarc().iterate((seg) => {
    const c = seg[0];
    if (c === "M") { x = x0 = seg[1]; y = y0 = seg[2]; out.push("M", r(x), r(y)); }
    else if (c === "L") { x = seg[1]; y = seg[2]; out.push("L", r(x), r(y)); }
    else if (c === "H") { x = seg[1]; out.push("L", r(x), r(y)); }
    else if (c === "V") { y = seg[1]; out.push("L", r(x), r(y)); }
    else if (c === "C") { out.push("C", ...seg.slice(1).map(r)); x = seg[5]; y = seg[6]; }
    else if (c === "Q") { out.push("Q", ...seg.slice(1).map(r)); x = seg[3]; y = seg[4]; }
    else if (c === "Z") { out.push("Z"); x = x0; y = y0; }
    else throw new Error("comando inesperado: " + c);
  });
  return out.join(" ").replace(/ (-)/g, "$1").replace(/([A-Z]) /g, "$1");
}

const FONTES = {
  m: { front: ["bodyFront.ts", "SvgMaleWrapper.tsx", "0 0 724 1448"], back: ["bodyBack.ts", "SvgMaleWrapper.tsx", "724 0 724 1448"] },
  f: { front: ["bodyFemaleFront.ts", "SvgFemaleWrapper.tsx", "-50 -40 734 1538"], back: ["bodyFemaleBack.ts", "SvgFemaleWrapper.tsx", "756 0 774 1448"] },
};

const out = {};
for (const [sexo, lados] of Object.entries(FONTES)) {
  out[sexo] = {};
  for (const [lado, [ts, wrapper, vb]] of Object.entries(lados)) {
    const partes = [], grupos = {};
    for (const p of lerTS(ts)) {
      for (const [k, lista] of Object.entries(p.path || {})) {
        for (const d of lista) {
          const l = k[0], chave = `${p.slug}:${l}`, b = caixa(d), g = grupos[chave] || [1e9, 1e9, -1e9, -1e9];
          grupos[chave] = [Math.min(g[0], b[0]), Math.min(g[1], b[1]), Math.max(g[2], b[2]), Math.max(g[3], b[3])];
          partes.push([p.slug, l, plano(d)]);
        }
      }
    }
    const c = contorno(wrapper, lado), cb = c ? caixa(c) : null;
    out[sexo][lado] = { vb, meio: cb ? r((cb[0] + cb[2]) / 2) : null, caixa: cb, grupos, partes };
  }
}
fs.writeFileSync(saida, JSON.stringify(out));
console.log(`${saida}: ${fs.statSync(saida).size} bytes`);
