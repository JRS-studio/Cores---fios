"""Gera a página de teste: o app inteiro (versão web) num único arquivo HTML, com roteiro e dados de exemplo.

Uso (na raiz do projeto):
    python3 tools/pagina-de-teste/build.py [--saida arquivo.html]

Saída: dist-teste/cores-e-fios-teste.html
"""
import argparse
import base64
import json
import os
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "dist-teste"

# Fontes que o app usa de fato; vão embutidas no HTML (a página não pode buscar arquivos externos).
FONTS = [
    "Poppins_400Regular.", "Poppins_500Medium.", "Poppins_600SemiBold.",
    "PlayfairDisplay_600SemiBold.", "PlayfairDisplay_600SemiBold_Italic.", "/Ionicons.",
]


def export_web():
    """Exporta a versão web com todas as rotas num só bundle (sem carregamento sob demanda)."""
    app_json = ROOT / "app.json"
    original = app_json.read_text()
    config = json.loads(original)
    config["expo"]["plugins"] = [
        ["expo-router", {"asyncRoutes": False}] if p == "expo-router" else p for p in config["expo"]["plugins"]
    ]
    web = OUT / "web"
    shutil.rmtree(web, ignore_errors=True)
    try:
        app_json.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n")
        # A página de teste roda sem servidor: ignora o .env (servidor só se as variáveis vierem do terminal).
        env = {**os.environ, "CI": "1", "EXPO_OFFLINE": "1", "EXPO_NO_DOTENV": "1"}
        subprocess.run(["npx", "expo", "export", "-p", "web", "--output-dir", str(web)], cwd=ROOT, env=env, check=True)
    finally:
        app_json.write_text(original)
    return web


def inline_bundle(web: Path) -> str:
    js_files = list((web / "_expo/static/js/web").glob("entry-*.js"))
    assert len(js_files) == 1, "esperava um único bundle (asyncRoutes desligado)"
    js = js_files[0].read_text()
    for path in web.glob("assets/**/*.ttf"):
        rel = "/" + path.relative_to(web).as_posix()
        if any(name in rel for name in FONTS) and f'"{rel}"' in js:
            data = base64.b64encode(path.read_bytes()).decode()
            js = js.replace(f'"{rel}"', f'"data:font/ttf;base64,{data}"')
    # Imagens do próprio app (ex.: logo do studio) também vão dentro do arquivo.
    for path in web.glob("assets/assets/**/*.png"):
        rel = "/" + path.relative_to(web).as_posix()
        if f'"{rel}"' in js:
            data = base64.b64encode(path.read_bytes()).decode()
            js = js.replace(f'"{rel}"', f'"data:image/png;base64,{data}"')
    return js.replace("</script", "<\\/script")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", type=Path, default=OUT / "cores-e-fios-teste.html")
    args = parser.parse_args()

    OUT.mkdir(exist_ok=True)
    bundle = inline_bundle(export_web())
    pre = (HERE / "seed.js").read_text()
    scripts = f"<script>{pre}</script>\n<script>\n{bundle}\n</script>"
    page = (HERE / "wrapper.html").read_text().replace("<!--SCRIPTS-->", scripts)
    target = args.saida
    target.write_text(page)
    print(f"{target} ({len(page) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
