"""Gera os ícones e a tela de abertura do app a partir do desenho da marca.

Uso (na raiz do projeto):  python3 tools/brand/generate_icons.py
Requer Pillow. Os arquivos vão para assets/.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
S = 2048  # desenha em 2x e reduz, para bordas suaves

WINE = (122, 46, 74)
PLUM = (43, 18, 32)
ROSE_LIGHT = (240, 214, 192)
ROSE = (201, 162, 126)
ROSE_DEEP = (168, 124, 90)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient(size, top_left, bottom_right):
    """Degradê diagonal."""
    w, h = size
    small = Image.new("RGB", (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            px[x, y] = lerp(top_left, bottom_right, (x + y) / 126)
    return small.resize(size, Image.BICUBIC)


def bezier(p0, p1, p2, p3, steps=60):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        pts.append((
            mt**3 * p0[0] + 3 * mt**2 * t * p1[0] + 3 * mt * t**2 * p2[0] + t**3 * p3[0],
            mt**3 * p0[1] + 3 * mt**2 * t * p1[1] + 3 * mt * t**2 * p2[1] + t**3 * p3[1],
        ))
    return pts


def nail_polygon(cx, cy, w, h):
    """Unha amendoada (mesmo desenho do formato 'Amendoada' do provador), ponta para cima."""
    a = w / 2
    base = cy + h / 2
    tip = cy - h / 2
    side = cy + h * 0.05
    rise = a * 0.9
    pts = bezier((-a, base - rise), (-a, base + rise * 0.3), (a, base + rise * 0.3), (a, base - rise))
    pts += [(a, side)]
    span = tip - side
    pts += bezier((a, side), (a, side + span * 0.55), (a * 0.3, tip), (0, tip))[1:]
    pts += bezier((0, tip), (-a * 0.3, tip), (-a, side + span * 0.55), (-a, side))[1:]
    return [(cx + x, y) for x, y in pts]


def sparkle(draw, cx, cy, r, fill):
    """Estrela de quatro pontas."""
    k = r * 0.22
    pts = [(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)]
    draw.polygon(pts, fill=fill)


def motif(size, scale=1.0, mono=False):
    """Unha + brilho em fundo transparente, centralizados."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx, cy = size / 2, size / 2 + size * 0.02 * scale
    w, h = size * 0.30 * scale, size * 0.50 * scale
    poly = nail_polygon(cx - size * 0.03 * scale, cy, w, h)

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    if mono:
        layer.paste(Image.new("RGBA", (size, size), (255, 255, 255, 255)), (0, 0), mask)
    else:
        fill = gradient((size, size), ROSE_LIGHT, ROSE_DEEP).convert("RGBA")
        layer.paste(fill, (0, 0), mask)
        # Reflexo do top coat: faixa suave na lateral esquerda.
        shine = Image.new("L", (size, size), 0)
        sd = ImageDraw.Draw(shine)
        x0 = cx - size * 0.03 * scale - w * 0.30
        sd.rounded_rectangle(
            (x0, cy - h * 0.28, x0 + w * 0.12, cy + h * 0.22), radius=w * 0.06, fill=150
        )
        shine = shine.filter(ImageFilter.GaussianBlur(size * 0.006))
        shine = Image.composite(shine, Image.new("L", (size, size), 0), mask)
        layer.paste(Image.new("RGBA", (size, size), (255, 255, 255, 255)), (0, 0), shine)

    d = ImageDraw.Draw(layer)
    star = (255, 255, 255, 255) if mono else ROSE_LIGHT + (255,)
    sparkle(d, cx + w * 0.78, cy - h * 0.36, size * 0.075 * scale, star)
    sparkle(d, cx + w * 1.05, cy - h * 0.08, size * 0.035 * scale, star)
    return layer


def down(img, size):
    return img.resize((size, size), Image.LANCZOS)


def main():
    bg = gradient((S, S), WINE, PLUM).convert("RGBA")

    # Ícone (iOS e lojas): fundo cheio, sem transparência.
    icon = Image.alpha_composite(bg, motif(S))
    down(icon, 1024).convert("RGB").save(ASSETS / "icon.png")

    # Android adaptativo: o sistema recorta em círculo/squircle, então o desenho fica na zona segura.
    down(motif(S, scale=0.72), 1024).save(ASSETS / "android-icon-foreground.png")
    down(bg, 1024).save(ASSETS / "android-icon-background.png")
    down(motif(S, scale=0.72, mono=True), 1024).save(ASSETS / "android-icon-monochrome.png")

    # Tela de abertura: só o desenho, sobre o fundo ameixa definido no app.json.
    down(motif(S, scale=0.9), 1024).save(ASSETS / "splash-icon.png")

    # Favicon da versão web.
    down(icon, 48).save(ASSETS / "favicon.png")
    print("Ícones gerados em", ASSETS)


if __name__ == "__main__":
    main()
