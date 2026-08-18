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

# 마이그레이션 전용 prisma CLI 완전 설치본 — standalone 트레이싱은 앱 코드 기준이라
# CLI 의존성(effect 등)을 포함하지 않는다. node_modules/prisma 만 복사하면
# 런타임에 MODULE_NOT_FOUND 로 죽는다(초기 배포에서 실제 발생).
RUN mkdir -p /opt/prisma-cli && cd /opt/prisma-cli \
  && npm init -y > /dev/null \
  && npm i --no-audit --no-fund prisma@6.19.3

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

# 마이그레이션(initContainer 의 `prisma migrate deploy`)용 — schema + migrations +
# 의존성까지 갖춘 prisma CLI 설치본(별도 디렉터리, standalone node_modules 와 분리).
# ⚠️ 반드시 `node_modules` 라는 이름의 하위 디렉터리로 복사한다 — Node 의 모듈 탐색은
#    그 이름의 폴더만 뒤지므로, 이름을 바꾸면 CLI 가 자기 의존성(@prisma/engines)을
#    못 찾는다(초기 배포에서 실제 발생).
# 실행: node prisma-cli/node_modules/prisma/build/index.js migrate deploy
COPY --from=build /app/prisma ./prisma
COPY --from=build /opt/prisma-cli/node_modules ./prisma-cli/node_modules

EXPOSE 3000

CMD ["node", "server.js"]
