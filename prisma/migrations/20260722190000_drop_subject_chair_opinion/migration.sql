-- 통합의견을 별도 필드로 두려던 설계를 되돌린다 — 통합의견은 위원장의 종합의견(Opinion)과 같은 것이라
-- Subject.chairOpinion 은 쓰이지 않는다. 멱등(존재할 때만 삭제).
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "chairOpinion";
