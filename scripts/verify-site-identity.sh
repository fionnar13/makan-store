#!/bin/bash
# راستی‌آزمایی مرورگری هویت وب‌سایت + تصویر پروفایل — نسخه نهایی با refs دقیق
set -u
cd /home/z/my-project
FAILED=0
step() { echo; echo "===== $1 ====="; }
ev()   { agent-browser eval "$1" 2>/dev/null | tail -1 | tr -d '"'; }
chk()  { if [ "$2" = "true" ]; then echo "PASS: $1"; else echo "FAIL: $1 (got: $2)"; FAILED=1; fi; }
chkEq() { if [ "$2" = "$3" ]; then echo "PASS: $1"; else echo "FAIL: $1 (got: $2, want: $3)"; FAILED=1; fi; }
refOf() { # refOf <pattern> — اولین ref متناظر در snapshot
  echo "$SNAP" | rg "$1" | rg -o '\[ref=(e[0-9]+)\]' | rg -o 'e[0-9]+' | head -1 | sed 's/^/@/'
}

# ── سرور ──
(setsid nohup bun run dev </dev/null >/dev/null 2>&1 &)
code=000
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && { echo "server UP (try $i)"; break; }
  sleep 2
done
[ "$code" = "200" ] || { echo "SERVER FAILED TO START"; exit 1; }

# بازنشانی وضعیت
curl -s -c /tmp/v_cj.txt -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"phone":"09120000000","password":"Admin#1404"}' >/dev/null
curl -s -b /tmp/v_cj.txt -X PUT http://localhost:3000/api/site-settings -H 'Content-Type: application/json' -d '{"name":"بنکداری هوشمند","slogan":"سامانه مدیریت B2B بنکداری مواد غذایی","logoUrl":null,"faviconUrl":null}' >/dev/null
rm -f public/uploads/site/* public/uploads/avatars/* 2>/dev/null
echo "identity reset ok"

step "1. صفحه ورود + ورود مدیر"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
chkEq "عنوان تب پیش‌فرض" "$(ev 'String(document.title)')" "بنکداری هوشمند"
agent-browser find label "شماره موبایل" fill "09120000000"
agent-browser find label "رمز عبور" fill "Admin#1404"
agent-browser find role button click --name "ورود"
sleep 4
chk "نام سایت در هدر" "$(ev "String(document.querySelector('header')?.innerText.includes('بنکداری هوشمند'))")"

step "2. تصویر پروفایل — بارگذاری"
agent-browser find role button click --name "حساب کاربری"
sleep 1
SNAP=$(agent-browser snapshot -i -c 2>/dev/null)
MREF=$(refOf 'تصویر پروفایل')
echo "menuitem ref: $MREF"
agent-browser click "$MREF"
sleep 1
agent-browser eval "document.querySelectorAll('input[type=file]').forEach(i=>{i.classList.remove('hidden'); i.style.display='block'; i.style.width='220px'})" >/dev/null
sleep 1
SNAP=$(agent-browser snapshot -i -c 2>/dev/null)
FREF=$(refOf 'Choose File|فایل|file')
echo "file ref: $FREF"
agent-browser upload "$FREF" /home/z/my-project/public/products/vitamin-c-24.jpg
sleep 1
agent-browser find role button click --name "بارگذاری تصویر جدید"
sleep 3
chk "توست آواتار" "$(ev "String(document.body.innerText.includes('تصویر پروفایل به‌روزرسانی شد'))")"
chk "آواتار در هدر" "$(ev "String(!!document.querySelector('header img[src*=\"/uploads/avatars/\"]'))")"
agent-browser press Escape >/dev/null
sleep 1
agent-browser screenshot /home/z/my-project/download/پیش-نمایش-پروفایل.png >/dev/null 2>&1
agent-browser eval "window.location.hash = '#/users'" >/dev/null
sleep 3
chk "آواتار در جدول کاربران" "$(ev 'String(document.body.innerHTML.includes("/uploads/avatars/"))')"
AVAPI=$(curl -s -b /tmp/v_cj.txt http://localhost:3000/api/users | rg -o '"avatarUrl":"[^"]+"' | head -1)
echo "api users avatar: $AVAPI"
chk "avatarUrl در API کاربران" "$([ -n "$AVAPI" ] && echo true || echo false)"

step "3. تب وب‌سایت — نام و شعار"
agent-browser eval "window.location.hash = '#/admin-data'" >/dev/null
sleep 3
agent-browser find role tab click --name "وب‌سایت" || { SNAP=$(agent-browser snapshot -i -c 2>/dev/null); agent-browser click "$(refOf 'وب‌سایت')"; }
sleep 2
chk "محتوای تب" "$(ev "String(document.body.innerText.includes('نام و شعار وب‌سایت'))")"
SNAP=$(agent-browser snapshot -i -c 2>/dev/null)
echo "$SNAP" | rg 'textbox' | head -5
NREF=$(echo "$SNAP" | rg 'textbox' | rg -o '\[ref=(e[0-9]+)\]' | rg -o 'e[0-9]+' | head -1 | sed 's/^/@/')
SREF=$(echo "$SNAP" | rg 'textbox' | rg -o '\[ref=(e[0-9]+)\]' | rg -o 'e[0-9]+' | sed -n 2p | sed 's/^/@/')
echo "name: $NREF / slogan: $SREF"
agent-browser fill "$NREF" "پخش غذایی گلستان"
agent-browser fill "$SREF" "تأمین عمده مواد غذایی فروشگاه‌ها"
agent-browser find role button click --name "ذخیره تغییرات"
sleep 3
chk "توست ذخیره" "$(ev "String(document.body.innerText.includes('تنظیمات وب‌سایت ذخیره شد'))")"
chk "هدر با نام جدید" "$(ev "String(document.querySelector('header')?.innerText.includes('پخش غذایی گلستان'))")"
chk "عنوان تب جدید" "$(ev "String(document.title === 'پخش غذایی گلستان')")"

step "4. بارگذاری لوگو"
agent-browser eval "document.querySelectorAll('input[type=file]').forEach(i=>{i.classList.remove('hidden'); i.style.display='block'; i.style.width='220px'})" >/dev/null
sleep 1
SNAP=$(agent-browser snapshot -i -c 2>/dev/null)
LREF=$(echo "$SNAP" | rg 'Choose File|فایل|file' | rg -o '\[ref=(e[0-9]+)\]' | rg -o 'e[0-9]+' | head -1 | sed 's/^/@/')
echo "logo file ref: $LREF"
agent-browser upload "$LREF" /home/z/my-project/public/products/juice-hero-500.jpg
sleep 4
chk "توست لوگو" "$(ev "String(document.body.innerText.includes('لوگو به‌روزرسانی شد'))")"
chk "لوگو در هدر" "$(ev "String(!!document.querySelector('header img[src*=\"/uploads/site/\"]'))")"
agent-browser screenshot /home/z/my-project/download/پیش-نمایش-وب‌سایت.png >/dev/null 2>&1

step "5. حذف لوگو"
agent-browser find role button click --name "حذف"
sleep 3
chk "بازگشت کاشی پیش‌فرض" "$(ev "String(!document.querySelector('header img[src*=\"/uploads/site/\"]'))")"

step "6. فایوآیکون"
agent-browser eval "document.querySelectorAll('input[type=file]').forEach(i=>{i.classList.remove('hidden'); i.style.display='block'; i.style.width='220px'})" >/dev/null
sleep 1
SNAP=$(agent-browser snapshot -i -c 2>/dev/null)
IREF=$(echo "$SNAP" | rg 'Choose File|فایل|file' | rg -o '\[ref=(e[0-9]+)\]' | rg -o 'e[0-9]+' | sed -n 2p | sed 's/^/@/')
echo "favicon file ref (second): $IREF"
agent-browser upload "$IREF" /home/z/my-project/public/products/water-uranus-500.jpg
sleep 4
chk "توست فایوآیکون" "$(ev "String(document.body.innerText.includes('فایوآیکون به‌روزرسانی شد'))")"
chk "فایوآیکون سفارشی" "$(ev "String((document.querySelector('link[rel=icon]')?.href||'').includes('uploads/site/'))")"
agent-browser find role button click --name "حذف"
sleep 3
chk "فایوآیکون پیش‌فرض" "$(ev "String((document.querySelector('link[rel=icon]')?.href||'').includes('logo.svg'))")"

step "7. خطاهای کنسول"
agent-browser errors 2>/dev/null | head -12 || true

step "8. بازنشانی نهایی"
agent-browser close >/dev/null 2>&1
curl -s -b /tmp/v_cj.txt -X PUT http://localhost:3000/api/site-settings -H 'Content-Type: application/json' -d '{"name":"بنکداری هوشمند","slogan":"سامانه مدیریت B2B بنکداری مواد غذایی","logoUrl":null,"faviconUrl":null}' >/dev/null
curl -s -b /tmp/v_cj.txt -X DELETE "http://localhost:3000/api/uploads?kind=avatar" >/dev/null
rm -f public/uploads/site/* public/uploads/avatars/* 2>/dev/null
curl -s http://localhost:3000/api/site-settings; echo

echo; echo "RESULT: $([ "$FAILED" = "0" ] && echo ALL_PASS || echo SOME_FAILED)"
