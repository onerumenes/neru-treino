#!/usr/bin/env python3
"""Gera a versão publicável do Neru Calorias a partir de www/.

Saída:
  dist/app/                 código do app com a versão carimbada (vai dentro do APK)
  dist/site/                o que vai para o GitHub Pages:
    (app web instalável)    mesma coisa de dist/app
    atualizacoes/latest.json         o que o app Android consulta ao abrir
    atualizacoes/bundle-<versão>.zip o pacote que ele baixa

Uso:
  python3 tools/build.py [--base URL] [--notas "texto"]

--base é o endereço público da pasta atualizacoes. No GitHub Actions ele é montado sozinho
a partir do dono e do nome do repositório. Sem ele, o app gerado não procura atualizações.
"""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WWW = RAIZ / "www"
DIST = RAIZ / "dist"
FUSO = timezone(timedelta(hours=-3))  # Brasília


def base_padrao():
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if "/" not in repo:
        return ""
    dono, nome = repo.split("/", 1)
    if nome.lower() == f"{dono.lower()}.github.io":
        return f"https://{dono.lower()}.github.io/atualizacoes"
    return f"https://{dono.lower()}.github.io/{nome}/atualizacoes"


def notas_padrao():
    try:
        r = subprocess.run(["git", "log", "-1", "--pretty=%s"], cwd=RAIZ, capture_output=True, text=True, check=True)
        return r.stdout.strip()[:140]
    except Exception:
        return ""


def zipar(origem: Path, destino: Path):
    # Data fixa nos arquivos: o mesmo código gera sempre o mesmo zip
    with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for arq in sorted(origem.rglob("*")):
            if arq.is_file():
                info = zipfile.ZipInfo(arq.relative_to(origem).as_posix(), date_time=(2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, arq.read_bytes())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default=None, help="URL pública da pasta atualizacoes")
    ap.add_argument("--notas", default=None, help="texto curto mostrado no aviso de atualização")
    ap.add_argument("--versao", default=None, help="força a versão (formato AAAA.MM.DD.HHMM)")
    a = ap.parse_args()

    config = json.loads((RAIZ / "neru.config.json").read_text(encoding="utf-8"))
    base = (a.base if a.base is not None else base_padrao()).rstrip("/")
    notas = a.notas if a.notas is not None else notas_padrao()
    versao = a.versao or datetime.now(FUSO).strftime("%Y.%m.%d.%H%M")

    if not (WWW / "index.html").exists():
        sys.exit("www/index.html não encontrado")

    shutil.rmtree(DIST, ignore_errors=True)
    app = DIST / "app"
    shutil.copytree(WWW, app)

    build = {"versao": versao, "atualizacoes": base}
    (app / "version.js").write_text(
        "// Gerado por tools/build.py. Não editar à mão.\n"
        f"window.NERU_BUILD = {json.dumps(build, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    # Nome do cache muda a cada versão, para o app web pegar os arquivos novos
    sw = app / "sw.js"
    texto = sw.read_text(encoding="utf-8")
    if 'const CACHE = "' not in texto:
        sys.exit("sw.js: não achei a linha do CACHE")
    linhas = [f'const CACHE = "neru-calorias-{versao}";' if l.startswith("const CACHE = ") else l for l in texto.splitlines()]
    sw.write_text("\n".join(linhas) + "\n", encoding="utf-8")

    site = DIST / "site"
    shutil.copytree(app, site)
    atu = site / "atualizacoes"
    atu.mkdir()
    nome_zip = f"bundle-{versao}.zip"
    zipar(app, atu / nome_zip)
    sha = hashlib.sha256((atu / nome_zip).read_bytes()).hexdigest()

    repo = os.environ.get("GITHUB_REPOSITORY", "")
    latest = {
        "version": versao,
        "url": f"{base}/{nome_zip}" if base else nome_zip,
        "sha256": sha,
        "notes": notas,
        "apk_min": int(config.get("apk_min", 1)),
        "apk_url": f"https://github.com/{repo}/releases/latest/download/neru-calorias.apk" if repo else "",
    }
    (atu / "latest.json").write_text(json.dumps(latest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (site / ".nojekyll").write_text("", encoding="utf-8")

    tam = (atu / nome_zip).stat().st_size // 1024
    print(f"Versão {versao}  ({tam} KB)")
    print(f"  dist/app   -> vai dentro do APK")
    print(f"  dist/site  -> GitHub Pages")
    print(f"  atualizações em: {base or '(sem --base: o app não vai procurar atualizações)'}")


if __name__ == "__main__":
    main()
