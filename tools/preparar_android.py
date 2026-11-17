#!/usr/bin/env python3
"""Ajusta o projeto android/ gerado pelo Capacitor (`npx cap add android`) para o Neru Calorias:
número da versão, permissão de microfone, ícones, cor de fundo e assinatura do APK.

Rode depois de `npx cap add android` ou `npx cap sync android`. Pode rodar quantas vezes quiser.

A assinatura lê variáveis de ambiente na hora de compilar:
  NERU_KEYSTORE        caminho do arquivo .jks
  NERU_KEYSTORE_SENHA  senha do arquivo
  NERU_KEY_ALIAS       nome da chave dentro dele
  NERU_KEY_SENHA       senha da chave
Sem elas, `assembleRelease` gera um APK sem assinatura (não instala). Use sempre a mesma chave:
o Android só aceita atualizar o app por cima se a chave for a mesma.
"""

import json
import re
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
AND = RAIZ / "android"
RECURSOS = RAIZ / "android-recursos"
FUNDO = "#241A22"


def trocar(caminho: Path, padrao: str, novo: str, obrigatorio=True, flags=0):
    texto = caminho.read_text(encoding="utf-8")
    novo_texto, n = re.subn(padrao, novo, texto, count=1, flags=flags)
    if obrigatorio and n == 0 and novo not in texto:
        sys.exit(f"{caminho.relative_to(RAIZ)}: não achei {padrao!r}")
    caminho.write_text(novo_texto, encoding="utf-8")


def main():
    if not (AND / "app" / "build.gradle").exists():
        sys.exit("Pasta android/ não existe. Rode antes: npx cap add android")

    config = json.loads((RAIZ / "neru.config.json").read_text(encoding="utf-8"))
    codigo = int(config["apk"])
    gradle = AND / "app" / "build.gradle"

    # versão
    trocar(gradle, r"versionCode \d+", f"versionCode {codigo}")
    trocar(gradle, r'versionName "[^"]*"', f'versionName "{codigo}"')

    # assinatura pelo ambiente
    if "signingConfigs" not in gradle.read_text(encoding="utf-8"):
        trocar(gradle, r"(\n    buildTypes \{)", r'''
    signingConfigs {
        release {
            def ks = System.getenv("NERU_KEYSTORE")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("NERU_KEYSTORE_SENHA")
                keyAlias System.getenv("NERU_KEY_ALIAS")
                keyPassword System.getenv("NERU_KEY_SENHA")
            }
        }
    }\1''')
        trocar(gradle, r"(release \{\n\s+minifyEnabled false)", 'release {\n            if (System.getenv("NERU_KEYSTORE")) signingConfig signingConfigs.release\n            minifyEnabled false')

    # microfone (o Capacitor já pede a permissão na hora de gravar)
    manifesto = AND / "app" / "src" / "main" / "AndroidManifest.xml"
    texto = manifesto.read_text(encoding="utf-8")
    for perm in ("android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"):
        if perm not in texto:
            texto = texto.replace("</manifest>", f'    <uses-permission android:name="{perm}" />\n</manifest>')
    manifesto.write_text(texto, encoding="utf-8")

    # ícones e cor de fundo
    res = AND / "app" / "src" / "main" / "res"
    if (RECURSOS / "res").exists():
        shutil.copytree(RECURSOS / "res", res, dirs_exist_ok=True)
        # o ícone vetorial padrão do Capacitor tem prioridade sobre o PNG em Android 7+; tira ele
        (res / "drawable-v24" / "ic_launcher_foreground.xml").unlink(missing_ok=True)
    trocar(res / "values" / "ic_launcher_background.xml", r"#[0-9A-Fa-f]{6}", FUNDO)

    print(f"android/ pronto: versionCode {codigo}, microfone, ícones e assinatura pelo ambiente.")


if __name__ == "__main__":
    main()
