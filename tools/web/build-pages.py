"""Gera a versão web para o GitHub Pages (https://<usuario>.github.io/<repositorio>/).

Uso (na raiz, com o .env do Supabase preenchido):
    python3 tools/web/build-pages.py [--saida pasta] [--sem-protecao]
Saída: dist-pages/ (é o conteúdo do branch gh-pages).

O código publicado sai embaralhado (tools/web/proteger.mjs), para dificultar cópias do app.

O site fica num subcaminho; por isso o app é exportado com experiments.baseUrl e os endereços do
index.html e do manifesto são ajustados. O 404.html é uma cópia do index.html: assim links diretos
(ex.: /Cores---fios/agendamento/novo) abrem o app.
"""
import argparse
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dist-pages"
# Onde o site fica. Para um endereço só com o nome do salão (ex.: conta coresefios.github.io, servida na raiz),
# publique com:  SITE_BASE= SITE_URL=https://coresefios.github.io python3 tools/web/build-pages.py
# SITE_BASE vazio ("") = site na raiz; senão é o subcaminho (ex.: "/Cores---fios"), sempre começando com "/".
BASE = os.environ.get("SITE_BASE", "/Cores---fios").rstrip("/")
SITE = os.environ.get("SITE_URL", f"https://jrs-studio.github.io{BASE}").rstrip("/")
# Versão desta publicação (data e hora): muda a cada vez que o site é gerado.
VERSION = time.strftime("%Y%m%d%H%M%S")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", type=Path, default=OUT)
    parser.add_argument("--sem-protecao", action="store_true", help="publica sem embaralhar o código (só para investigar erros)")
    args = parser.parse_args()
    out = args.saida.resolve()
    app_json = ROOT / "app.json"
    original = app_json.read_text()
    config = json.loads(original)
    config["expo"].setdefault("experiments", {})["baseUrl"] = BASE
    shutil.rmtree(out, ignore_errors=True)
    try:
        app_json.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n")
        env = {**os.environ, "CI": "1", "EXPO_OFFLINE": "1", "EXPO_PUBLIC_WEB_URL": SITE, "EXPO_PUBLIC_APP_VERSION": VERSION}
        subprocess.run(["npx", "expo", "export", "-p", "web", "--output-dir", str(out)], cwd=ROOT, env=env, check=True)
    finally:
        app_json.write_text(original)

    index = out / "index.html"
    html = index.read_text()
    for path in ['"/manifest.json"', '"/icons/']:
        html = html.replace(path, path.replace('"/', f'"{BASE}/'))
    index.write_text(html)
    shutil.copy(index, out / "404.html")

    manifest = out / "manifest.json"
    data = json.loads(manifest.read_text())
    data["start_url"] = data["scope"] = f"{BASE}/"
    for icon in data["icons"]:
        icon["src"] = BASE + icon["src"]
    manifest.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    # O app instalado confere este arquivo para saber se há versão nova (src/features/update/AutoUpdate.tsx).
    (out / "version.json").write_text(json.dumps({"version": VERSION}) + "\n")

    if not args.sem_protecao:
        subprocess.run(["node", str(ROOT / "tools/web/proteger.mjs"), str(out)], cwd=ROOT, check=True)

    # Sem isto o GitHub Pages ignora a pasta _expo (onde fica o app).
    (out / ".nojekyll").write_text("")
    (out / "_redirects").unlink(missing_ok=True)
    print(f"Pronto: {out} -> {SITE}/")


if __name__ == "__main__":
    main()
