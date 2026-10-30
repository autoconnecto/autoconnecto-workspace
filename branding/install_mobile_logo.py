"""Install frozen C2A-4 mark into autoconnecto-mobile assets and Android icons."""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw
from render_logo import OCEAN, draw_mark

ROOT = Path(__file__).resolve().parent
MOBILE = ROOT.parent / "autoconnecto-mobile"
FROZEN_SVG = ROOT / "c2a-4-ocean.svg"


def solid(size: int, color=OCEAN) -> Image.Image:
    return Image.new("RGBA", (size, size), color)


def adaptive_foreground(size: int) -> Image.Image:
    """Mark centred with safe padding for Android adaptive icons."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mark_size = int(size * 0.72)
    mark = draw_mark(mark_size)
    x = (size - mark_size) // 2
    y = (size - mark_size) // 2
    canvas.paste(mark, (x, y), mark)
    return canvas


def splash(width: int, height: int) -> Image.Image:
    img = Image.new("RGBA", (width, height), OCEAN)
    mark_size = int(min(width, height) * 0.42)
    mark = draw_mark(mark_size)
    x = (width - mark_size) // 2
    y = (height - mark_size) // 2
    img.paste(mark, (x, y), mark)
    return img


def main() -> None:
    if not MOBILE.is_dir():
        raise SystemExit(f"missing mobile tree: {MOBILE}")

    # Public / assets
    mark_576 = draw_mark(576)
    mark_576.save(MOBILE / "assets" / "logo.png")
    mark_576.save(MOBILE / "public" / "app-icon.png")
    mark_576.save(MOBILE / "public" / "apple-touch-icon.png")
    mark_576.save(MOBILE / "public" / "favicon.png")
    shutil.copy2(FROZEN_SVG, MOBILE / "public" / "favicon.svg")

    android_public = MOBILE / "android" / "app" / "src" / "main" / "assets" / "public"
    if android_public.is_dir():
        mark_576.save(android_public / "app-icon.png")
        mark_576.save(android_public / "apple-touch-icon.png")
        mark_576.save(android_public / "favicon.png")
        if (android_public / "favicon.svg").exists() or True:
            shutil.copy2(FROZEN_SVG, android_public / "favicon.svg")

    res = MOBILE / "android" / "app" / "src" / "main" / "res"
    launcher_sizes = {
        "mipmap-ldpi": 36,
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    foreground_sizes = {
        "mipmap-ldpi": 81,
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }

    for folder, size in launcher_sizes.items():
        d = res / folder
        if not d.is_dir():
            continue
        icon = draw_mark(size)
        icon.save(d / "ic_launcher.png")
        icon.save(d / "ic_launcher_round.png")
        print("launcher", folder, size)

    for folder, size in foreground_sizes.items():
        d = res / folder
        if not d.is_dir():
            continue
        adaptive_foreground(size).save(d / "ic_launcher_foreground.png")
        solid(size).save(d / "ic_launcher_background.png")
        print("adaptive", folder, size)

    # Splash screens: keep each file's dimensions, centre the mark
    for path in res.rglob("splash.png"):
        with Image.open(path) as old:
            w, h = old.size
        splash(w, h).save(path)
        print("splash", path.relative_to(res), f"{w}x{h}")

    print("mobile branding installed")


if __name__ == "__main__":
    main()
