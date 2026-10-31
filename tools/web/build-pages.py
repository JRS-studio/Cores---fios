"""Gera a versão web para o GitHub Pages (https://<usuario>.github.io/<repositorio>/).

Uso (na raiz, com o .env do Supabase preenchido):
    python3 tools/web/build-pages.py
Saída: dist-pages/ (é o conteúdo do branch gh-pages).

O site fica num subcaminho; por isso o app é exportado com experiments.baseUrl e os endereços do
index.html e do manifesto são ajustados. O 404.html é uma cópia do index.html: assim links diretos
(ex.: /Cores---fios/agendamento/novo) abrem o app.
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dist-pages"
BASE = "/Cores---fios"
SITE = f"https://jefersonroodrigo-cmyk.github.io{BASE}"


def main():
    app_json = ROOT / "app.json"
    original = app_json.read_text()
    config = json.loads(original)
    config["expo"].setdefault("experiments", {})["baseUrl"] = BASE
    shutil.rmtree(OUT, ignore_errors=True)
    try:
        app_json.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n")
        env = {**os.environ, "CI": "1", "EXPO_OFFLINE": "1", "EXPO_PUBLIC_WEB_URL": SITE}
        subprocess.run(["npx", "expo", "export", "-p", "web", "--output-dir", str(OUT)], cwd=ROOT, env=env, check=True)
    finally:
        app_json.write_text(original)

    index = OUT / "index.html"
    html = index.read_text()
    for path in ['"/manifest.json"', '"/icons/']:
        html = html.replace(path, path.replace('"/', f'"{BASE}/'))
    index.write_text(html)
    shutil.copy(index, OUT / "404.html")

    manifest = OUT / "manifest.json"
    data = json.loads(manifest.read_text())
    data["start_url"] = data["scope"] = f"{BASE}/"
    for icon in data["icons"]:
        icon["src"] = BASE + icon["src"]
    manifest.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    # Sem isto o GitHub Pages ignora a pasta _expo (onde fica o app).
    (OUT / ".nojekyll").write_text("")
    (OUT / "_redirects").unlink(missing_ok=True)
    print(f"Pronto: {OUT} -> {SITE}/")


if __name__ == "__main__":
    main()
