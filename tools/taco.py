#!/usr/bin/env python3
"""Gera www/alimentos.js a partir da planilha oficial da Tabela TACO (4ª edição, NEPA/UNICAMP, 2011).

A planilha (Taco_4a_edicao_2011.xls) é publicada pelo NEPA em http://www.nepa.unicamp.br/taco/
e também está em https://github.com/isaquetdiniz/taco-api/tree/main/references
A TACO permite reprodução, desde que seja citada a fonte.

Uso:
  pip install xlrd
  python3 tools/taco.py caminho/Taco_4a_edicao_2011.xls

Leva só o que o app usa, por 100 g: calorias, proteína, carboidrato e gordura (lipídeos).
"Tr" (traço) e "NA" (não analisado) viram 0. Alimentos sem valor de calorias ("*", em análise na TACO) ficam de fora.
"""

import json
import sys
from pathlib import Path

import xlrd

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "www" / "alimentos.js"
# Colunas da aba CMVCol: 0 número, 1 descrição, 3 energia (kcal), 5 proteína, 6 lipídeos, 8 carboidrato
COLUNAS = (3, 5, 8, 6)  # kcal, proteína, carboidrato, gordura (mesma ordem do app)


def numero(v):
    if isinstance(v, float):
        return v
    s = str(v).strip()
    if s in ("Tr", "NA", ""):
        return 0.0
    if s in ("*", "-"):
        return None
    return float(s.replace(",", "."))


def r1(x):
    x = round(x + 0.0, 1)
    return int(x) if x == int(x) else x


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    aba = xlrd.open_workbook(sys.argv[1]).sheet_by_index(0)
    linhas, fora = [], []
    for r in range(aba.nrows):
        num, nome = aba.cell_value(r, 0), " ".join(str(aba.cell_value(r, 1)).split())
        if not isinstance(num, float) or not nome:
            continue  # títulos de grupo e cabeçalhos de página
        vals = [numero(aba.cell_value(r, c)) for c in COLUNAS]
        if not vals[0]:
            fora.append(nome)
            continue
        linhas.append([int(num), nome] + [r1(v or 0) for v in vals])

    corpo = ",\n".join(json.dumps(l, ensure_ascii=False, separators=(",", ":")) for l in linhas)
    SAIDA.write_text(
        "// Gerado por tools/taco.py. Não editar à mão.\n"
        "// Fonte: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição revisada e ampliada.\n"
        "// NEPA/UNICAMP, Campinas, 2011. Valores por 100 g da parte comestível.\n"
        "// [número na TACO, nome, kcal, proteína g, carboidrato g, gordura g]\n"
        f"export const ALIMENTOS = [\n{corpo},\n];\n",
        encoding="utf-8",
    )
    print(f"{len(linhas)} alimentos em {SAIDA.relative_to(RAIZ)} ({SAIDA.stat().st_size // 1024} KB)")
    if fora:
        print("Sem calorias na TACO, ficaram de fora:", "; ".join(fora))


if __name__ == "__main__":
    main()
