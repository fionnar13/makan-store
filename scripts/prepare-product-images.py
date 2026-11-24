#!/usr/bin/env python3
"""آماده‌سازی تصاویر محصولات — بهینه‌سازی برای فروشگاه
تبدیل به JPEG سبک (حداکثر ۱۰۰۰ پیکسل، کیفیت ۸۲) و کپی به public/products/
"""
from PIL import Image
from pathlib import Path

SRC = Path('/home/z/my-project/upload')
DST = Path('/home/z/my-project/public/products')
DST.mkdir(parents=True, exist_ok=True)

# نگاشت فایل مبدأ → نام مقصد (بر اساس محتوای تصویر)
MAPPING = {
    '0- (1).png': 'tomato-paste-chinchin.jpg',
    '0- (2).png': 'tomato-paste-mit.jpg',
    '0- (3).png': 'tomato-paste-spadana.jpg',
    '0- (4).png': 'tuna-babarar-180.jpg',
    '0- (5).png': 'beans-mushroom-entekhab.jpg',
    '0- (6).jpeg': 'beans-chiti-vay.jpg',
    '0- (7).png': 'sani-nice-notfilz.jpg',
    '0- (8).png': 'fire-power-energy.jpg',
    '0- (9).jpeg': 'vitamin-c-24.jpg',
    '10  (4).png': 'juice-hero-500.jpg',
    '10  (5).png': 'basil-seed-rezoti.jpg',
    '10  (6).png': 'water-uranus-500.jpg',
    '10  (7).png': 'compote-cherry-bamdis.jpg',
    '10  (8).png': 'vinegar-apple-dastchin.jpg',
    '10  (9).png': 'vinegar-grape-dastchin.jpg',
    '10  (10).png': 'lime-juice-dastchin.jpg',
}

def find_file(name: str) -> Path | None:
    exact = SRC / name
    if exact.exists():
        return exact
    # جستجوی متغیر برای فاصله‌های متفاوت در نام فایل
    base = name.split()[0]
    for f in SRC.glob(f'{base}*.png') | SRC.glob(f'{base}*.jpeg') | SRC.glob(f'{base}*.jpg'):
        return f
    return None

total_in, total_out = 0, 0
for src_name, dst_name in MAPPING.items():
    f = find_file(src_name)
    if not f:
        print(f'!! NOT FOUND: {src_name}')
        continue
    img = Image.open(f)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    # تغییر اندازه — حداکثر ضلع ۱۰۰۰ پیکسل
    w, h = img.size
    scale = min(1.0, 1000 / max(w, h))
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    out = DST / dst_name
    img.save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    kb_in, kb_out = f.stat().st_size // 1024, out.stat().st_size // 1024
    total_in += kb_in; total_out += kb_out
    print(f'{f.name:>18} {w}x{h}  ->  {dst_name}  {img.size[0]}x{img.size[1]}  {kb_in}KB -> {kb_out}KB')

print(f'\nDone: {total_in}KB -> {total_out}KB  ({len(MAPPING)} images)')
