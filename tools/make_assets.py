"""Erzeugt Logo-Ausschnitte und App-Icons aus eberhard_logo.png.

Aufruf (aus dem Projektordner):  python3 tools/make_assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "eberhard_logo.png"
IMG = ROOT / "app" / "img"
BLUE = (2, 126, 153)
YELLOW = (255, 212, 0)


def plate_bbox(im):
    """Bounding box of the black-bordered yellow plate in the logo."""
    w, h = im.size
    px = im.load()
    mid_y = h // 2
    xs = [x for x in range(w) if sum(px[x, mid_y][:3]) < 60]
    left, right = xs[0], xs[-1]
    mid_x = (left + right) // 2
    # Scan the column left of the lettering for the border rows.
    col = left + 120
    ys = [y for y in range(h) if sum(px[col, y][:3]) < 60]
    return left, ys[0], right + 1, ys[-1] + 1


def rounded_mask(size, radius, scale=4):
    w, h = size
    big = Image.new("L", (w * scale, h * scale), 0)
    ImageDraw.Draw(big).rounded_rectangle(
        (0, 0, w * scale - 1, h * scale - 1), radius * scale, fill=255
    )
    return big.resize(size, Image.LANCZOS)


def isolate_first_glyph(crop):
    """Keep only the left-most dark connected component (the "E"), trimmed."""
    w, h = crop.size
    px = crop.load()
    dark = [[sum(px[x, y][:3]) < 300 for x in range(w)] for y in range(h)]
    seed = next((x, y) for x in range(w) for y in range(h) if dark[y][x])
    keep = set()
    stack = [seed]
    while stack:
        x, y = stack.pop()
        if (x, y) in keep or not (0 <= x < w and 0 <= y < h) or not dark[y][x]:
            continue
        keep.add((x, y))
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    out = crop.copy()
    opx = out.load()
    for y in range(h):
        for x in range(w):
            if (x, y) not in keep:
                opx[x, y] = YELLOW
    xs = [p[0] for p in keep]
    ys = [p[1] for p in keep]
    return out.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    logo = Image.open(SRC).convert("RGB")
    box = plate_bbox(logo)
    plate = logo.crop(box)
    pw, ph = plate.size
    radius = int(ph * 0.11)
    plate_rgba = plate.convert("RGBA")
    plate_rgba.putalpha(rounded_mask(plate.size, radius))
    plate_rgba.resize((900, int(900 * ph / pw)), Image.LANCZOS).save(IMG / "logo-plate.png", optimize=True)

    # Lettering "E" for the square icons: left part of the plate interior.
    e_box = (int(pw * 0.06), int(ph * 0.15), int(pw * 0.29), int(ph * 0.8))
    glyph = isolate_first_glyph(plate.crop(e_box))

    def icon(size, maskable=False):
        s = size * 4
        im = Image.new("RGB", (s, s), YELLOW)
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, s, int(s * 0.42)), fill=BLUE)
        inset = int(s * (0.2 if maskable else 0.1))
        plate_box = (inset, int(s * 0.22), s - inset, s - int(s * 0.16))
        bw = max(4, s // 64)
        d.rounded_rectangle(plate_box, radius=int(s * 0.08), fill=YELLOW, outline=(0, 0, 0), width=bw)
        gh = int((plate_box[3] - plate_box[1]) * 0.72)
        gw = int(glyph.width * gh / glyph.height)
        g = glyph.resize((gw, gh), Image.LANCZOS)
        cx = (plate_box[0] + plate_box[2]) // 2 - gw // 2
        cy = (plate_box[1] + plate_box[3]) // 2 - gh // 2
        im.paste(g, (cx, cy))
        im = im.resize((size, size), Image.LANCZOS)
        if not maskable:
            out = im.convert("RGBA")
            out.putalpha(rounded_mask((size, size), int(size * 0.18)))
            return out
        return im

    for size in (192, 512):
        icon(size).save(IMG / f"icon-{size}.png", optimize=True)
        icon(size, maskable=True).save(IMG / f"icon-maskable-{size}.png", optimize=True)
    icon(180, maskable=True).save(IMG / "icon-180.png", optimize=True)  # iOS rounds itself
    icon(64).save(IMG / "favicon.png", optimize=True)
    icon(256).save(ROOT / "desktop" / "icon.png")
    icon(256).save(ROOT / "desktop" / "icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("plate", box, "->", IMG)


if __name__ == "__main__":
    main()
