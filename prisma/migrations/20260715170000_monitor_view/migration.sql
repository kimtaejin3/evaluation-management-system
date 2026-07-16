-- 관리자 실시간 모니터링 '자세히 보기' 조회 기록 — (사용자×분과) 마지막 클릭 시점
CREATE TABLE IF NOT EXISTS "MonitorView" (
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorView_pkey" PRIMARY KEY ("userId", "sessionId")
);
