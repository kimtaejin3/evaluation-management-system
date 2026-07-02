-- 인쇄 평가표 상단 헤더용 필드(관리자 입력) — 모두 nullable(추가만, 안전)
ALTER TABLE "Subject" ADD COLUMN "region" TEXT;
ALTER TABLE "Subject" ADD COLUMN "taskType" TEXT;
ALTER TABLE "Subject" ADD COLUMN "leadResearcher" TEXT;
