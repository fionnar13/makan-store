# ── سامانه بنکداری هوشمند — Dockerfile ──
# ساخت:      docker compose build
# اجرا:      docker compose up -d
# لاگ‌ها:    docker compose logs -f app
# اپ روی http://localhost:3000 بالا می‌آید.

FROM oven/bun:1 AS base
WORKDIR /app

# ۱) نصب وابستگی‌ها
FROM base AS deps
COPY package.json bun.lock ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# ۲) بیلد پروداکشن
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=file:/app/db/custom.db
RUN bunx prisma generate
RUN bun run build

# ۳) اجرا (خروجی standalone سبک)
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
# CLI پرایسما برای همگام‌سازی اسکیما هنگام استارت:
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
RUN mkdir -p /app/db
EXPOSE 3000
# پیش از هر استارت، اسکیما با دیتابیس همگام می‌شود (بدون حذف داده):
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
