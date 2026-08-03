#!/usr/bin/env python3
"""Generate a project-specific favicon for 调音实验室 (Tuning Lab).

The note is defined by a BAKED closed B-SPLINE (note_spline.npz in this
directory): the reference contour was decimated to key points and fitted with
scipy.splprep (per=True, s=48) — 23 control points, C²-smooth, no raster
jaggies. The script samples the spline densely at render time and no longer
depends on the reference image.

Finish: note filled with the site's blue→teal gradient (#7c9cff → #5eead4) on
the dark rounded-square background (#0d1324 → #080c18). Rendered at 4x
supersample and downscaled with LANCZOS for anti-aliased edges.

Usage:  python gen_favicon.py [out_dir]
Output: <out_dir>/favicon.ico, <out_dir>/favicon.png  (default: project root)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy.interpolate import splev

SIZE = 256       # ico logical canvas
PNG_SIZE = 2048  # PNG master resolution
RENDER = 8192    # 4x supersample render for smooth AA edges
FILL = 0.88      # how much of the canvas the note should fill
SAMPLES = 6000   # dense spline samples (curve is C²-smooth between them)

# Theme colors (from css/style.css :root)
BG_TOP = (13, 19, 36)     # #0d1324 --bg-soft
BG_BOT = (8, 12, 24)      # #080c18
AC_A = (124, 156, 255)    # #7c9cff --accent
AC_B = (94, 234, 212)     # #5eead4 --accent-2
RING = (124, 156, 255, 95)

HERE = os.path.dirname(os.path.abspath(__file__))
SPLINE = os.path.join(HERE, "note_spline.npz")


def k(v, rw):
    return int(round(v * rw / SIZE))


def vgrad(a, b, size):
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(size[1]):
        t = y / (size[1] - 1)
        c = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
        d.line([(0, y), (size[0] - 1, y)], fill=c)
    return img


def build_note_mask(rw):
    """Baked closed B-spline sampled densely, scaled/centered on the canvas."""
    z = np.load(SPLINE)
    t = z["knots"]
    c = z["coeffs"]  # (2, n_ctrl) — one coefficient array per dimension
    k = int(z["degree"])
    x, y = splev(np.linspace(0, 1, SAMPLES), (t, [c[0], c[1]], k))

    x0, x1 = float(x.min()), float(x.max())
    y0, y1 = float(y.min()), float(y.max())
    h, w = y1 - y0, x1 - x0
    scale = (rw * FILL) / max(h, w)
    ox = (rw - w * scale) / 2
    oy = (rw - h * scale) / 2

    m = Image.new("L", (rw, rw), 0)
    ImageDraw.Draw(m).polygon(
        [(round((xi - x0) * scale + ox), round((yi - y0) * scale + oy))
         for xi, yi in zip(x, y)],
        fill=255,
    )
    return m


def build_icon():
    # Dark rounded-square background at working size.
    box_mask = Image.new("L", (PNG_SIZE, PNG_SIZE), 0)
    ImageDraw.Draw(box_mask).rounded_rectangle(
        [0, 0, PNG_SIZE - 1, PNG_SIZE - 1], radius=k(58, PNG_SIZE), fill=255
    )
    bg = Image.new("RGBA", (PNG_SIZE, PNG_SIZE), (0, 0, 0, 0))
    bg.paste(vgrad(BG_TOP, BG_BOT, (PNG_SIZE, PNG_SIZE)).convert("RGBA"),
             (0, 0), box_mask)
    ring = Image.new("RGBA", (PNG_SIZE, PNG_SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(ring).rounded_rectangle(
        [0, 0, PNG_SIZE - 1, PNG_SIZE - 1],
        radius=k(58, PNG_SIZE), outline=RING, width=k(2, PNG_SIZE),
    )
    bg.alpha_composite(ring)

    # Note: baked spline at 4x supersample → downscale → smooth AA edges.
    note = build_note_mask(RENDER).resize((PNG_SIZE, PNG_SIZE), Image.LANCZOS)
    glyph = Image.new("RGBA", (PNG_SIZE, PNG_SIZE), (0, 0, 0, 0))
    glyph.paste(vgrad(AC_A, AC_B, (PNG_SIZE, PNG_SIZE)).convert("RGBA"),
                (0, 0), note)

    comp = bg.copy()
    comp.alpha_composite(glyph)
    return comp.convert("RGBA")


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..")
    )
    os.makedirs(out_dir, exist_ok=True)

    icon = build_icon()
    icon.save(os.path.join(out_dir, "favicon.png"), "PNG")
    icon.resize((SIZE, SIZE), Image.LANCZOS).save(
        os.path.join(out_dir, "favicon.ico"),
        format="ICO",
        sizes=[(s, s) for s in (16, 32, 48, 64, 128, 256)],
    )
    print("wrote:", os.path.join(out_dir, "favicon.png"))
    print("wrote:", os.path.join(out_dir, "favicon.ico"))


if __name__ == "__main__":
    main()
