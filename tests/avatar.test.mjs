// Testes do avatar anatômico. Rodar com: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { REF, escalaMusculo, moverTracado, montarCorpo, svgCorpo, espessurasGordura } from "../www/avatar.js";

const dados = JSON.parse(fs.readFileSync(new URL("../www/corpo-anatomico.json", import.meta.url), "utf8"));
const largura = (cx) => cx[2] - cx[0];

test("os 4 desenhos existem e têm o eixo do corpo", () => {
  for (const sexo of ["m", "f"]) for (const lado of ["front", "back"]) {
    const v = dados[sexo][lado];
    assert.ok(v.partes.length > 50, `${sexo} ${lado}: partes`);
    assert.ok(Number.isFinite(v.meio), `${sexo} ${lado}: meio`);
  }
});

test("cada traçado tem coordenadas aos pares", () => {
  for (const sexo of ["m", "f"]) for (const lado of ["front", "back"]) {
    for (const [, , d] of dados[sexo][lado].partes) {
      assert.equal((d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).length % 2, 0);
    }
  }
});

test("medida igual à de referência não muda o músculo", () => {
  assert.equal(escalaMusculo(34, 34, 15, 15), 1);
});

test("medida maior aumenta, menor diminui, e há limite", () => {
  assert.ok(escalaMusculo(40, 34, 15, 15) > 1);
  assert.ok(escalaMusculo(30, 34, 15, 15) < 1);
  assert.equal(escalaMusculo(200, 34, 15, 15), 1.7);
  assert.equal(escalaMusculo(5, 34, 15, 15), 0.6);
});

test("com a mesma volta, mais gordura deixa o músculo menor", () => {
  assert.ok(escalaMusculo(36, 34, 30, 15) < escalaMusculo(36, 34, 15, 15));
});

test("mover troca x e y separadamente", () => {
  const d = moverTracado("M10 20 L30-40 Z", (x) => x + 1, (y) => y * 2);
  assert.equal(d.replace(/\s+/g, " ").trim(), "M 11.0 40.0 L 31.0 -80.0 Z");
});

test("corpo na referência mantém as caixas originais", () => {
  const v = dados.m.front, c = montarCorpo(v, "m", REF.m);
  for (const k of ["biceps:l", "chest:r", "quadriceps:l"]) {
    c.caixas[k].forEach((n, i) => assert.ok(Math.abs(n - v.grupos[k][i]) < 0.01, `${k}[${i}]`));
  }
});

test("braço maior alarga o bíceps; medida por lado mexe só naquele lado", () => {
  const v = dados.m.front, base = montarCorpo(v, "m", REF.m);
  const grande = montarCorpo(v, "m", { ...REF.m, braco: 40 });
  assert.ok(largura(grande.caixas["biceps:l"]) > largura(base.caixas["biceps:l"]));
  const umLado = montarCorpo(v, "m", { ...REF.m, braco_l: 40 });
  assert.ok(largura(umLado.caixas["biceps:l"]) > largura(base.caixas["biceps:l"]));
  assert.ok(Math.abs(largura(umLado.caixas["biceps:r"]) - largura(base.caixas["biceps:r"])) < 0.01);
});

test("mais gordura engrossa a camada; dobras podem substituir", () => {
  const w10 = espessurasGordura(10), w30 = espessurasGordura(30);
  assert.ok(w30[0] > w10[0]);
  const c = montarCorpo(dados.m.front, "m", REF.m, { gordura: [40, 30, 20, 10, 3] });
  assert.deepEqual(c.gordura.map((g) => g.w), [40, 30, 20, 10, 3]);
});

test("cintura grande com muita gordura vira camada de gordura, não abdômen gigante", () => {
  const v = dados.m.front;
  const magro = montarCorpo(v, "m", { ...REF.m, cintura: 78, bf: 10 });
  const gordo = montarCorpo(v, "m", { ...REF.m, cintura: 112, bf: 33 });
  assert.ok(gordo.gordura[0].w > magro.gordura[0].w * 3, "camada da barriga bem mais grossa");
  const abs = (c) => largura(c.caixas["abs:l"]);
  assert.ok(abs(gordo) < abs(magro) * 1.15, "o músculo do abdômen quase não cresce");
});

test("camadas de cor e SVG", () => {
  const c = montarCorpo(dados.m.back, "m", REF.m, { camada: (s) => (s === "hamstring" ? "destaque" : "musculo") });
  assert.ok(c.camadas.destaque && c.camadas.musculo);
  const svg = svgCorpo(c, { cores: { destaque: "#F27A68" }, rotulo: 'Corpo "teste"' });
  assert.ok(svg.startsWith("<svg") && svg.includes("#F27A68") && svg.includes("&quot;teste&quot;"));
});

test("corpo feminino: cabelo atrás da cabeça", () => {
  const c = montarCorpo(dados.f.front, "f", REF.f);
  assert.ok(c.cabeloAtras.length > 0 && c.cabelo === "");
});
