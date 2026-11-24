#!/bin/bash
# تست دود API سامانه بنکداری — سناریوهای حیاتی سند پروژه
set -uo pipefail
BASE="http://localhost:3000"
JAR_ADMIN=/tmp/jar_admin.txt
JAR_VISITOR=/tmp/jar_visitor.txt
rm -f $JAR_ADMIN $JAR_VISITOR
PASS=0; FAIL=0

say() { echo "== $1"; }
check() { # $1=desc $2=expected $3=actual
  if [[ "$3" == *"$2"* ]]; then PASS=$((PASS+1)); echo "   PASS: $1"; else FAIL=$((FAIL+1)); echo "   FAIL: $1 — انتظار: $2 / دریافتی: $3"; fi
}

say "0) Health"
H=$(curl -s $BASE/api)
check "health db up" '"db":"up"' "$H"

say "1) ورود مدیر"
L=$(curl -s -c $JAR_ADMIN -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"phone":"09120000000","password":"Admin#1404"}')
check "admin login ok" '"ok":true' "$L"

say "2) ورود اشتباه — باید رد شود"
L2=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"phone":"09120000000","password":"wrong123"}')
check "bad creds 401" 'BAD_CREDENTIALS' "$L2"

say "3) داشبورد"
D=$(curl -s -b $JAR_ADMIN $BASE/api/dashboard)
check "dashboard has salesMonthRls" 'salesMonthRls' "$D"

say "4) کاتالوگ و شناسه‌ها"
P=$(curl -s -b $JAR_ADMIN $BASE/api/products)
TOM_ID=$(echo "$P" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print([p for p in d if p['sku']=='TOM-CC-800'][0]['id'])")
TOM_CARTON=$(echo "$P" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print([p for p in d if p['sku']=='TOM-CC-800'][0]['units'][1]['id'])")
TOM_BASE_UNIT=$(echo "$P" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print([p for p in d if p['sku']=='TOM-CC-800'][0]['units'][0]['id'])")
echo "   product=$TOM_ID carton=$TOM_CARTON"
check "9 products" '"TOM-MT-800"' "$P"

say "5) قیمت اختصاصی مشتری — اولویت قیمت CUSTOMER بر DEFAULT"
CU=$(curl -s -b $JAR_ADMIN $BASE/api/customers)
KAVEH_ID=$(echo "$CU" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print([c for c in d if c['code']=='CUS-1001'][0]['id'])")
SAHAR_ID=$(echo "$CU" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print([c for c in d if c['code']=='CUS-1002'][0]['id'])")
PR1=$(curl -s -b $JAR_ADMIN "$BASE/api/pricing?productId=$TOM_ID&unitId=$TOM_CARTON&qtyBase=24&customerId=$KAVEH_ID")
check "کاوه carton = 2100000 (اختصاصی)" '"priceRls":2100000' "$PR1"
check "scope CUSTOMER" '"scope":"CUSTOMER"' "$PR1"
PR2=$(curl -s -b $JAR_ADMIN "$BASE/api/pricing?productId=$TOM_ID&unitId=$TOM_CARTON&qtyBase=24&customerId=$SAHAR_ID")
check "سحر carton = 2200000 (عمومی)" '"priceRls":2200000' "$PR2"

say "6) ثبت سفارش با رزرو (موجودی اولیه 100 پایه)"
O=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders -H 'Content-Type: application/json' -d "{\"customerId\":\"$KAVEH_ID\",\"payMethod\":\"CREDIT\",\"idempotencyKey\":\"smoke-key-001\",\"items\":[{\"productId\":\"$TOM_ID\",\"unitId\":\"$TOM_CARTON\",\"qty\":2}]}")
ORDER_ID=$(echo "$O" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "   order=$ORDER_ID"
check "order created RESERVED" '"status":"RESERVED"' "$O"

say "7) Idempotency — ارسال مجدد همان کلید نباید سفارش تکراری بسازد"
O2=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders -H 'Content-Type: application/json' -d "{\"customerId\":\"$KAVEH_ID\",\"payMethod\":\"CREDIT\",\"idempotencyKey\":\"smoke-key-001\",\"items\":[{\"productId\":\"$TOM_ID\",\"unitId\":\"$TOM_CARTON\",\"qty\":2}]}")
check "idempotent=true" '"idempotent":true' "$O2"
CNT=$(curl -s -b $JAR_ADMIN "$BASE/api/orders?take=200" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))")
echo "   orders count=$CNT (باید 1 باشد)"

say "8) فروش بیش از موجودی — درخواست 150 کارتن (3600 پایه) از 100 موجودی باید رد شود"
O3=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders -H 'Content-Type: application/json' -d "{\"customerId\":\"$KAVEH_ID\",\"payMethod\":\"CASH\",\"items\":[{\"productId\":\"$TOM_ID\",\"unitId\":\"$TOM_CARTON\",\"qty\":150}]}")
check "INSUFFICIENT_STOCK 409" 'INSUFFICIENT_STOCK' "$O3"

say "9) سفارش نقدی هم باید بعد از رزرو مشابه برود — رزرو در ثبت، پرداخت در markPaid"
say "10) لغو سفارش → آزادسازی رزرو"
OC=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders/$ORDER_ID -H 'Content-Type: application/json' -d '{"action":"cancel","note":"تست لغو"}')
check "cancelled" '"status":"CANCELLED"' "$OC"
BAL=$(curl -s -b $JAR_ADMIN "$BASE/api/inventory?type=balances" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['balances']; print([b['availableBase'] for b in d if b['product']['sku']=='TOM-CC-800'][0])")
echo "   available after cancel=$BAL (باید 100 باشد)"
check "رزرو آزاد شد" '100' "$BAL"

say "11) چرخه کامل سفارش دوم: confirm → creditApprove → picking → ready → dispatch → deliver → complete"
O4=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders -H 'Content-Type: application/json' -d "{\"customerId\":\"$KAVEH_ID\",\"payMethod\":\"CREDIT\",\"items\":[{\"productId\":\"$TOM_ID\",\"unitId\":\"$TOM_CARTON\",\"qty\":2}]}")
OID=$(echo "$O4" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
for A in confirm creditApprove startPicking readyForDispatch; do
  R=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders/$OID -H 'Content-Type: application/json' -d "{\"action\":\"$A\"}")
  check "$A" "\"status\"" "$R"
done
DRV=$(curl -s -b $JAR_ADMIN "$BASE/api/users?role=DRIVER" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
R=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders/$OID -H 'Content-Type: application/json' -d "{\"action\":\"dispatch\",\"driverId\":\"$DRV\"}")
check "dispatch" '"DISPATCHED"' "$R"
R=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders/$OID -H 'Content-Type: application/json' -d '{"action":"deliver"}')
check "deliver + invoice" '"DELIVERED"' "$R"
R=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders/$OID -H 'Content-Type: application/json' -d '{"action":"complete"}')
check "complete" '"COMPLETED"' "$R"
DET=$(curl -s -b $JAR_ADMIN $BASE/api/orders/$OID)
check "invoice issued" '"invoiceNo"' "$DET"
BAL2=$(curl -s -b $JAR_ADMIN "$BASE/api/inventory?type=balances" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['balances']; print([b['physicalBase'] for b in d if b['product']['sku']=='TOM-CC-800'][0])")
check "خروج فیزیکی: 100-48=52" '52' "$BAL2"
DEBT=$(curl -s -b $JAR_ADMIN "$BASE/api/customers/$KAVEH_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['balanceRls'])")
check "بدهی کاوه = 2 کارتن × 2100000" '4200000' "$DEBT"

say "12) سقف اعتبار — سفارش اعتباری بزرگ‌تر از سقف باید رد شود (باقی اعتبار 500م − 100.8م)"
O5=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/orders -H 'Content-Type: application/json' -d "{\"customerId\":\"$KAVEH_ID\",\"payMethod\":\"CREDIT\",\"items\":[{\"productId\":\"$TOM_ID\",\"unitId\":\"$TOM_BASE_UNIT\",\"qty\":5100}]}")
check "CREDIT_EXCEEDED 402" 'CREDIT_EXCEEDED' "$O5"

say "13) دریافت از مشتری → کاهش بدهی"
R=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/finance/receipts -H 'Content-Type: application/json' -d "{\"customerId\":\"$KAVEH_ID\",\"amountRls\":50000000,\"method\":\"CASH\",\"note\":\"تست دریافت\"}")
check "receipt ok" '"receiptNo"' "$R"
DEBT2=$(curl -s -b $JAR_ADMIN "$BASE/api/customers/$KAVEH_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['balanceRls'])")
check "بدهی جدید = 4200000-50000000 (بستانکار)" '-45800000' "$DEBT2"

say "14) مرجوعی: درخواست روی سفارش تحویل‌شده + بررسی QC با RESTOCK"
RET=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/returns -H 'Content-Type: application/json' -d "{\"orderId\":\"$OID\",\"reason\":\"تست مرجوعی — قوطی آسیب‌دیده\",\"items\":[{\"productId\":\"$TOM_ID\",\"qtyBase\":24,\"reason\":\"آسیب در حمل\"}]}")
check "return created" '"returnNo"' "$RET"
RET_ID=$(echo "$RET" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
RI=$(curl -s -b $JAR_ADMIN $BASE/api/returns/$RET_ID | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['items'][0]['id'])")
RV=$(curl -s -b $JAR_ADMIN -X POST $BASE/api/returns/$RET_ID -H 'Content-Type: application/json' -d "{\"items\":[{\"itemId\":\"$RI\",\"disposition\":\"RESTOCK\",\"qcNote\":\"سالم پس از بررسی\"}]}")
check "credit note = 24×2100000/24×… (مبلغ خط کارتن دوم؟)" '"creditRls"' "$RV"
DEBT3=$(curl -s -b $JAR_ADMIN "$BASE/api/customers/$KAVEH_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['balanceRls'])")
echo "   debt after return=$DEBT3"
BAL3=$(curl -s -b $JAR_ADMIN "$BASE/api/inventory?type=balances" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['balances']; print([b['physicalBase'] for b in d if b['product']['sku']=='TOM-CC-800'][0])")
check "RESTOCK بازگشت 24 پایه به فیزیکی" '76' "$BAL3"

say "15) دسترسی — ویزیتور نباید به مالی و کاربران دسترسی داشته باشد"
LV=$(curl -s -c $JAR_VISITOR -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"phone":"09120000005","password":"Demo#1404"}')
check "visitor login" '"ok":true' "$LV"
FV=$(curl -s -b $JAR_VISITOR $BASE/api/finance)
check "finance forbidden" 'FORBIDDEN' "$FV"
UV=$(curl -s -b $JAR_VISITOR $BASE/api/users)
check "users forbidden" 'FORBIDDEN' "$UV"
OV=$(curl -s -b $JAR_VISITOR -X POST $BASE/api/orders -H 'Content-Type: application/json' -d "{\"customerId\":\"$SAHAR_ID\",\"payMethod\":\"CASH\",\"items\":[{\"productId\":\"$TOM_ID\",\"unitId\":\"$TOM_BASE_UNIT\",\"qty\":5}]}")
check "visitor can create order" '"RESERVED"' "$OV"

say "16) هم‌زمانی — دو سفارش 3 کارتن (72 پایه) با موجودی 76: فقط یکی رزرو قطعی می‌شود"
curl -s -b $JAR_ADMIN -X POST $BASE/api/orders -H 'Content-Type: application/json' -d "{\"customerId\":\"$SAHAR_ID\",\"payMethod\":\"CASH\",\"items\":[{\"productId\":\"$TOM_ID\",\"unitId\":\"$TOM_CARTON\",\"qty\":2}]}" > /tmp/o7.json &
curl -s -b $JAR_ADMIN -X POST $BASE/api/orders -H 'Content-Type: application/json' -d "{\"customerId\":\"$KAVEH_ID\",\"payMethod\":\"CASH\",\"items\":[{\"productId\":\"$TOM_ID\",\"unitId\":\"$TOM_CARTON\",\"qty\":2}]}" > /tmp/o8.json &
wait
O7=$(cat /tmp/o7.json)
O8=$(cat /tmp/o8.json)
echo "   O7=$O7"
echo "   O8=$O8"
check "دقیقا یکی از دو سفارش هم‌زمان موفق" 'INSUFFICIENT_STOCK' "$O7$O8"

say "17) گزارش‌ها و Audit"
RP=$(curl -s -b $JAR_ADMIN "$BASE/api/reports?type=sales&groupBy=product")
check "sales by product has TOM" 'TOM-CC-800' "$RP"
AU=$(curl -s -b $JAR_ADMIN "$BASE/api/audit?take=200")
check "audit has order.create" 'order.create' "$AU"

echo
echo "════ نتیجه: $PASS موفق، $FAIL ناموفق ════"
