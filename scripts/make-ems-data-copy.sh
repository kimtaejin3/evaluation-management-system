#!/usr/bin/env bash
# Neon(프로덕션) → 사내 클러스터 DB(ems-db) 데이터 복사 명령을 조립해 출력한다.
# 로컬에서 실행 → 출력 블록을 103(k8s 마스터) 셸에 붙여넣는다.
#
#   bash scripts/make-ems-data-copy.sh
#
# 방식: Neon 이 PG17 이라 로컬(14)·클러스터(16) pg_dump 로는 덤프가 안 된다.
# postgres:17-alpine 임시 pod 를 띄워 그 안에서 pg_dump(Neon) | psql(ems-db) 로
# 데이터만 흘려보낸다. 스키마는 이미 prisma migrate 로 만들어져 있으므로
# --data-only, 마이그레이션 이력(_prisma_migrations)은 제외한다.
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a

SRC="${DATABASE_URL_UNPOOLED:?.env 에 DATABASE_URL_UNPOOLED 없음}"

# 클러스터 DB 비밀번호 — ems-secrets 와 같은 값. 첫 번째 인자로 넘기거나 물어본다.
DBPW="${1:-}"
if [ -z "$DBPW" ]; then
  read -r -p "클러스터 DB 비밀번호(ems-db-secret 의 POSTGRES_PASSWORD): " DBPW
fi
DST="postgresql://ems:${DBPW}@ems-db:5432/ems"

# 대상 테이블(FK 순서 무관하게 세션 replica 모드로 복원). _prisma_migrations 제외.
TABLES='"Assignment","Company","Criterion","CriterionGroup","CriterionSubitem","Document","EditingPresence","EvaluationSession","GroupComment","MonitorView","Opinion","Project","Score","Subject","Submission","User","_ProjectEvaluators","_ProjectSecretaries"'

cat <<EOF
# ──── 아래 전체를 103 셸에 붙여넣기 ────
# 1) 대상 DB 의 기존 데이터 비우기 (스키마·마이그레이션 이력은 유지)
kubectl -n ems exec ems-db-0 -- psql -U ems -d ems -c 'TRUNCATE TABLE ${TABLES} CASCADE;'

# 2) Neon → ems-db 데이터 복사 (PG17 임시 pod, 끝나면 자동 삭제)
kubectl -n ems run datacopy --rm -i --restart=Never --image=postgres:17-alpine --command -- sh -c "pg_dump '${SRC}' --data-only --no-owner -T public._prisma_migrations | psql '${DST}' -v ON_ERROR_STOP=1 -c 'SET session_replication_role = replica;' -f -"

# 3) 확인 — 사용자 수와 사업 목록
kubectl -n ems exec ems-db-0 -- psql -U ems -d ems -c 'SELECT count(*) AS users FROM "User"; SELECT name FROM "Project";'
# ──── 여기까지 ────
EOF
