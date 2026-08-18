#!/usr/bin/env bash
# 사내 k8s(ems) Secret 생성 명령을 조립해 출력한다.
# 로컬에서 실행 → 출력된 블록을 103(k8s 마스터) 셸에 그대로 붙여넣는다.
#
#   bash scripts/make-ems-secrets.sh
#
# DB 비밀번호·JWT_SECRET 은 매 실행마다 새로 생성(영숫자만 — URL 인코딩 불필요),
# R2 값 4개는 이 저장소의 .env 에서 읽는다. 이 스크립트는 아무것도 저장하지 않는다.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a

: "${R2_ACCOUNT_ID:?.env 에 R2_ACCOUNT_ID 없음}"
: "${R2_ACCESS_KEY_ID:?.env 에 R2_ACCESS_KEY_ID 없음}"
: "${R2_SECRET_ACCESS_KEY:?.env 에 R2_SECRET_ACCESS_KEY 없음}"
: "${R2_BUCKET:?.env 에 R2_BUCKET 없음}"

DBPW=$(openssl rand -hex 24)
JWT=$(openssl rand -hex 32)

cat <<EOF
# ──── 아래 전체를 103 셸에 붙여넣기 (최초 1회) ────
kubectl create ns ems
kubectl -n ems create secret generic ems-db-secret \\
  --from-literal=POSTGRES_USER=ems \\
  --from-literal=POSTGRES_PASSWORD='${DBPW}' \\
  --from-literal=POSTGRES_DB=ems
kubectl -n ems create secret generic ems-secrets \\
  --from-literal=DATABASE_URL='postgresql://ems:${DBPW}@ems-db:5432/ems' \\
  --from-literal=DATABASE_URL_UNPOOLED='postgresql://ems:${DBPW}@ems-db:5432/ems' \\
  --from-literal=JWT_SECRET='${JWT}' \\
  --from-literal=R2_ACCOUNT_ID='${R2_ACCOUNT_ID}' \\
  --from-literal=R2_ACCESS_KEY_ID='${R2_ACCESS_KEY_ID}' \\
  --from-literal=R2_SECRET_ACCESS_KEY='${R2_SECRET_ACCESS_KEY}' \\
  --from-literal=R2_BUCKET='${R2_BUCKET}'
kubectl -n ems get secret ems-db-secret ems-secrets
# ──── 여기까지 ────
EOF
