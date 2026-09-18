"""ゲーム画像を Web 用に変換する。
使い方: python scripts/optimize-image.py <元画像> <id>
  → assets/img/<id>.webp (最大1920px) と assets/img/<id>-sm.webp (最大960px) を作る。
"""
import sys
from PIL import Image
src, name = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
for w, suf in ((1920, ""), (960, "-sm")):
    c = im.copy(); c.thumbnail((w, w), Image.LANCZOS)
    c.save(f"assets/img/{name}{suf}.webp", "WEBP", quality=82, method=6)
    print(f"assets/img/{name}{suf}.webp", c.size)
