-- 분과 평가 기간(시작일/종료일) 추가. 기존 eventDate를 두 날짜로 이관.
ALTER TABLE "EvaluationSession" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "EvaluationSession" ADD COLUMN "endDate" TIMESTAMP(3);
UPDATE "EvaluationSession" SET "startDate" = "eventDate", "endDate" = "eventDate" WHERE "eventDate" IS NOT NULL;
