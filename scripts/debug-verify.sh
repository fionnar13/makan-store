#!/bin/bash
# نسخه اشکال‌زدایی — چاپ کامل خروجی‌ها برای تنظیم refs
set -u
cd /home/z/my-project
step() { echo; echo "===== $1 ====="; }

(setsid nohup bun run dev </dev/null >/dev/null 2>&1 &)
code=000
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && { echo "server UP"; break; }
  sleep 2
done
[ "$code" = "200" ] || { echo "SERVER FAILED"; exit 1; }

step "A. login"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser find label "شماره موبایل" fill "09120000000"
agent-browser find label "رمز عبور" fill "Admin#1404"
agent-browser find role button click --name "ورود"
sleep 4

step "B. dropdown"
agent-browser find role button click --name "حساب کاربری"
sleep 1
agent-browser snapshot -i -c | tail -20

step "C. click menuitem by ref"
MREF=$(agent-browser snapshot -i -c | rg 'تصویر پروفایل' | rg -o '\[ref=(e[0-9]+)\]' | rg -o 'e[0-9]+' | head -1 | sed 's/^/@/')
echo "menuitem ref: $MREF"
agent-browser click "$MREF"
sleep 1
echo "--- dialog snapshot ---"
agent-browser snapshot -i -c | tail -25

step "D. unhide file input + scoped snapshot"
agent-browser eval "document.querySelectorAll('input[type=file]').forEach(i=>{i.classList.remove('hidden'); i.style.display='block'; i.style.width='200px'; i.style.height='40px'})"
sleep 1
agent-browser snapshot -i -c | rg -i 'file|فایل' | head -6
echo "--- scoped ---"
agent-browser snapshot -s "input[type=file]" -i -c | head -10

step "E. eval output format"
agent-browser eval "String(document.title)"
agent-browser eval "String(1+1)"
agent-browser eval "String(document.body.innerText.includes('بنکداری هوشمند'))"

step "F. hash nav + tab"
agent-browser press Escape
agent-browser eval "window.location.hash = '#/admin-data'" >/dev/null
sleep 3
agent-browser eval "String([...document.querySelectorAll('[role=tab]')].map(t=>t.textContent.trim()).join('|'))"
agent-browser eval "(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent.includes('وب‌سایت')); if(t){t.click(); return 'CLICKED'} return 'NOT_FOUND' })()"
sleep 2
agent-browser eval "String(document.body.innerText.includes('نام و شعار وب‌سایت'))"

agent-browser close
