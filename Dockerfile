# 사내 k8s(라인월드 103) 배포용 운영 이미지. Vercel 배포는 이 파일을 쓰지 않는다.
#
# 2단계 빌드: 빌드 스테이지에서 전체 의존성으로 `next build`(standalone 출력)를 만들고,
# 실행 스테이지에는 standalone 산출물 + 정적 파일 + prisma CLI(마이그레이션용)만 싣는다.

# ── 1단계: 빌드 ──────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# postinstall 이 `prisma generate` 를 돌리므로 schema 를 의존성 설치 전에 복사한다.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# 빌드 시 DB 접속은 불필요(전 페이지 동적 렌더링, env 는 런타임 주입).
RUN npm run build

# ── 2단계: 실행 ──────────────────────────────────────────────
FROM node:22-alpine

# Prisma 엔진(linux-musl-openssl)이 요구하는 openssl.
RUN apk add --no-cache openssl

ENV TZ=Asia/Seoul
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# standalone 서버(트레이싱된 node_modules 포함) + 정적 파일.
# server.js 는 public/.next/static 을 같은 디렉터리에 두면 직접 서빙한다.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# 마이그레이션(initContainer 의 `prisma migrate deploy`)용 — schema + migrations + prisma CLI.
# @prisma(client·engines)는 standalone 에 이미 트레이싱돼 있지만, CLI 와 버전을 맞추기
# 위해 빌드 스테이지 것으로 통째로 덮는다.
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

CMD ["node", "server.js"]
