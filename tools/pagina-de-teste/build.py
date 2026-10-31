"""Gera a página de teste: o app inteiro (versão web) num único arquivo HTML, com roteiro e dados de exemplo.

Uso (na raiz do projeto):
    python3 tools/pagina-de-teste/build.py [--foto local/mao.jpg --unhas local/unhas.json]

--foto / --unhas (opcionais): foto real de mão (proporção 3:4) e posição das unhas, usadas no botão
"Experimentar com foto de exemplo" do Provador. Guarde-as em tools/pagina-de-teste/local/ (ignorada
pelo Git) — fotos de pessoas não vão para o repositório.

Saída: dist-teste/cores-e-fios-teste.html
"""
import argparse
import base64
import io
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
        env = {**os.environ, "CI": "1", "EXPO_OFFLINE": "1"}
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
    return js.replace("</script", "<\\/script")


def demo_photo_script(photo: Path, nails: Path) -> str:
    from PIL import Image  # só necessário com --foto

    im = Image.open(photo).convert("RGB")
    im.thumbnail((900, 1200))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=86)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    data = {"uri": uri, "nails": json.loads(nails.read_text())}
    return "window.__CORES_DEMO_PHOTO__=" + json.dumps(data) + ";"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--foto", type=Path)
    parser.add_argument("--unhas", type=Path)
    parser.add_argument("--saida", type=Path, default=OUT / "cores-e-fios-teste.html")
    args = parser.parse_args()

    OUT.mkdir(exist_ok=True)
    bundle = inline_bundle(export_web())
    pre = (HERE / "seed.js").read_text()
    if args.foto and args.unhas:
        pre = demo_photo_script(args.foto, args.unhas) + "\n" + pre
    scripts = f"<script>{pre}</script>\n<script>\n{bundle}\n</script>"
    page = (HERE / "wrapper.html").read_text().replace("<!--SCRIPTS-->", scripts)
    target = args.saida
    target.write_text(page)
    print(f"{target} ({len(page) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
