"""Render frozen C2A-4 ocean mark to PNG/ICO and install into website/frontend."""
from __future__ import annotations

import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
WS = ROOT.parent
OCEAN = (17, 94, 89, 255)
MINT = (167, 243, 208, 255)
SPOKE = (110, 231, 183, 255)
WORD = (236, 253, 245, 255)


def _font(size: int, bold: bool = True) -> ImageFont.ImageFont:
    candidates = [
        r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_mark(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 128.0
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=max(1, int(28 * s)), fill=OCEAN)

    cx = cy = size / 2
    hub_r = 22 * s
    node_r = 7 * s
    node_dist = 44 * s
    arm_inner = 22 * s
    arm_outer = 37 * s
    stroke = max(2, int(round(3.5 * s)))

    for i in range(6):
        a = math.radians(-90 + i * 60)
        dx, dy = math.cos(a), math.sin(a)
        draw.line(
            [
                (cx + arm_inner * dx, cy + arm_inner * dy),
                (cx + arm_outer * dx, cy + arm_outer * dy),
            ],
            fill=SPOKE,
            width=stroke,
        )
        nx = cx + node_dist * dx
        ny = cy + node_dist * dy
        draw.ellipse((nx - node_r, ny - node_r, nx + node_r, ny + node_r), fill=MINT)

    draw.ellipse((cx - hub_r, cy - hub_r, cx + hub_r, cy + hub_r), fill=MINT)

    font = _font(max(10, int(22 * s)))
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = cx - tw / 2 - bbox[0]
    ty = cy - th / 2 - bbox[1] + 1.5 * s
    draw.text((tx, ty), text, font=font, fill=OCEAN)

    stroke_w = max(1, int(round(1.8 * s)))
    dot_r = max(1.0, 1.4 * s)
    draw.ellipse(
        (cx - dot_r, 55 * s - dot_r, cx + dot_r, 55 * s + dot_r),
        fill=OCEAN,
    )
    for r, y in ((4.5, 52.5), (7.5, 49.8)):
        left = cx - r * s
        right = cx + r * s
        top = y * s - r * s
        bottom = y * s + r * s
        draw.arc((left, top, right, bottom), start=200, end=340, fill=OCEAN, width=stroke_w)

    return img


def draw_wordmark(width: int = 1107, height: int = 246) -> Image.Image:
    img = Image.new("RGBA", (width, height), OCEAN)
    mark_size = int(height * 0.78)
    mark = draw_mark(mark_size)
    mx = int(height * 0.12)
    my = (height - mark_size) // 2
    img.paste(mark, (mx, my), mark)

    draw = ImageDraw.Draw(img)
    font = _font(max(28, int(height * 0.32)))
    text = "Autoconnecto"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = mx + mark_size + int(height * 0.12)
    ty = (height - th) / 2 - bbox[1]
    draw.text((tx, ty), text, font=font, fill=WORD)
    return img


def save_ico(path: Path, sizes: list[int] | None = None) -> None:
    sizes = sizes or [16, 32, 48]
    images = [draw_mark(s).convert("RGBA") for s in sizes]
    images[0].save(path, format="ICO", sizes=[(s, s) for s in sizes], append_images=images[1:])


def main() -> None:
    # Delete non-frozen colour samples
    for name in (
        "c2a-4b-green-blue-mix.svg",
        "c2a-4b-green-blue-mix-wordmark.svg",
    ):
        p = ROOT / name
        if p.exists():
            p.unlink()
            print("deleted", p.name)

    mark_1024 = draw_mark(1024)
    word = draw_wordmark(1107, 246)
    mark_1024.save(ROOT / "autoconnecto-mark.png")
    word.save(ROOT / "autoconnecto-wordmark.png")

    # Canonical SVG copies for install paths
    frozen = ROOT / "c2a-4-ocean.svg"
    word_svg = ROOT / "c2a-4-ocean-wordmark.svg"
    shutil.copy2(frozen, ROOT / "autoconnecto-favicon.svg")
    shutil.copy2(word_svg, ROOT / "autoconnecto-logo-wordmark.svg")

    # --- website ---
    wpub = WS / "website" / "public"
    draw_mark(48).save(wpub / "favicon.png")
    draw_mark(180).save(wpub / "apple-touch-icon.png")
    save_ico(wpub / "favicon.ico")
    draw_mark(764).save(wpub / "assets" / "images" / "app_logo.png")
    word.save(wpub / "assets" / "images" / "autoconnecto-logo-1777694039224.png")

    # --- frontend ---
    fpub = WS / "frontend" / "public"
    shutil.copy2(frozen, fpub / "favicon.svg")
    draw_mark(512).save(fpub / "favicon.png")
    word.save(fpub / "autoconnecto-logo.png")
    word_login = draw_wordmark(1536, 400)
    # Keep a wide default logo for login/sidebar; also a square-friendly export
    word_login.save(WS / "frontend" / "src" / "assets" / "logo" / "autoconnecto-logo.png")

    (ROOT / "README.md").write_text(
        """# Autoconnecto branding (frozen)

**Locked mark:** C2A-4 ocean — hub + six equal arms, centre **A**, compact wifi above A. No black.

| File | Role |
|------|------|
| `c2a-4-ocean.svg` | Source favicon / app icon |
| `c2a-4-ocean-wordmark.svg` | Source header wordmark |
| `autoconnecto-mark.png` / `autoconnecto-wordmark.png` | Raster masters |
| `render_logo.py` | Regenerates PNG/ICO and installs into website + frontend |

Installed into:
- `website/public/favicon.png`, `favicon.ico`, `apple-touch-icon.png`
- `website/public/assets/images/app_logo.png`, `autoconnecto-logo-1777694039224.png`
- `frontend/public/favicon.svg`, `favicon.png`, `autoconnecto-logo.png`
- `frontend/src/assets/logo/autoconnecto-logo.png`

Colours: ocean `#115E59`, mint `#A7F3D0`, spokes `#6EE7B7`, word `#ECFDF5`.
""",
        encoding="utf-8",
    )
    print("installed website + frontend assets")


if __name__ == "__main__":
    main()
