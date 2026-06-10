# 심사·평가 관리 시스템 — 설계 문서

작성일: 2026-06-10

## 1. 목적과 범위

원본 와이어프레임(`사업평가시스템__와이어프레임.pdf`)은 투자 운용사 심사 도메인에
특화되어 있다. 본 프로젝트는 그 도메인 색채를 제거하고 다음 **세 단계의 큰 흐름**만
일반화하여 구현한다.

1. **심사 항목 설정** — 심사 회차 생성 → 평가 항목/배점/가중치 정의 → 평가 대상 등록 → 평가위원 배정
2. **평가** — 평가위원이 대상별로 항목 점수를 입력
3. **결과 출력·보관** — 점수 집계 → 결과표 생성 → 화면 조회·인쇄·CSV 출력

### 일반화 매핑

| 와이어프레임(투자) | 일반화 |
|---|---|
| 회차/리그 (성장형 리그 등) | 심사 회차 (EvaluationSession) |
| 운용사/펀드 | 평가 대상 (Subject) |
| 영업수지율·부채비율 등 항목 | 평가 항목 (Criterion) |
| 심사위원 | 평가위원 (Evaluator) |

### 제거하는 요소 (YAGNI)

- 1·2차 가중 합산, 영업수지율 구간 자동 산출 같은 도메인 특화 산식
- 친필 서명 결합, 폐쇄망/1회용 코드 인증, 무이벤트 화면 off 타이머
- 실시간 위원×대상 모니터링 그리드의 셀 단위 상태 애니메이션
- 열람 전용(감사) 역할 및 전용 화면

### 유지하는 요소 (일반화하여)

- 평가 항목의 **가중치**와 **정량/정성 구분**
- 회차 **마감·잠금** (점수 위변조 방지)
- 관리자/평가위원 **권한 분리**
- 입력 **검증**(배점 초과·누락 방지)

## 2. 기술 스택

- **프레임워크**: Next.js (App Router) + TypeScript
- **DB**: PostgreSQL + Prisma ORM
- **인증**: 경량 커스텀 — bcrypt 비밀번호 해시 + `jose` JWT(httpOnly 쿠키) + Next middleware 라우트 보호
- **테스트**: Vitest (집계·검증 순수 함수 단위 테스트)
- **출력**: 인쇄 전용 CSS(`@media print`) + CSV 다운로드

## 3. 역할

- **ADMIN(관리자)**: 회차/항목/대상/위원 설정, 상태 전환·마감, 결과 출력
- **EVALUATOR(평가위원)**: 배정된 회차의 대상별 점수 입력

열람 전용 역할은 범위에서 제외(추후 확장 가능).

## 4. 데이터 모델 (Prisma)

```prisma
model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  name         String
  role         Role
  assignments  Assignment[]
  scores       Score[]
  createdAt    DateTime @default(now())
}

enum Role {
  ADMIN
  EVALUATOR
}

model EvaluationSession {
  id          String   @id @default(cuid())
  name        String
  description String?
  eventDate   DateTime?
  location    String?
  status      SessionStatus @default(DRAFT)
  criteria    Criterion[]
  subjects    Subject[]
  assignments Assignment[]
  scores      Score[]
  createdAt   DateTime @default(now())
}

enum SessionStatus {
  DRAFT
  IN_PROGRESS
  CLOSED
}

model Criterion {
  id          String   @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name        String
  description String?
  type        CriterionType
  maxScore    Float    // 배점
  weight      Float    @default(1) // 가중치
  order       Int      @default(0)
  scores      Score[]
}

enum CriterionType {
  QUANTITATIVE  // 정량: 0~maxScore 숫자 직접 입력
  QUALITATIVE   // 정성: 등급 선택 → maxScore 비율 환산
}

model Subject {
  id          String   @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  name        String
  description String?
  order       Int      @default(0)
  scores      Score[]
}

model Assignment {
  id        String   @id @default(cuid())
  sessionId String
  session   EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([sessionId, userId])
}

model Score {
  id          String   @id @default(cuid())
  sessionId   String
  session     EvaluationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  evaluatorId String
  evaluator   User     @relation(fields: [evaluatorId], references: [id], onDelete: Cascade)
  subjectId   String
  subject     Subject  @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  criterionId String
  criterion   Criterion @relation(fields: [criterionId], references: [id], onDelete: Cascade)
  value       Float    // 환산된 점수(0~maxScore)
  grade       String?  // 정성 항목의 선택 등급 (A~E), 정량이면 null
  comment     String?
  updatedAt   DateTime @updatedAt
  @@unique([evaluatorId, subjectId, criterionId])
}
```

## 5. 점수·집계 규칙

### 입력

- **정량(QUANTITATIVE)**: 평가위원이 `0 ~ maxScore` 범위의 숫자를 직접 입력. `value`에 그대로 저장.
- **정성(QUALITATIVE)**: 5단계 등급 선택. 등급→비율 매핑(고정):
  `A=100%, B=80%, C=60%, D=40%, E=20%`. `value = maxScore × 비율`, 선택 등급은 `grade`에 저장.

### 검증

- `0 ≤ value ≤ maxScore`
- 제출(완료) 전 해당 대상의 모든 항목이 입력되어야 함
- `CLOSED` 상태 회차의 점수는 수정 불가

### 집계 (조회 시 실시간 계산, 저장하지 않음)

- 위원별 대상 점수: `weightedScore(evaluator, subject) = Σ_criteria (value_i × weight_i)`
- 대상 최종 점수: `finalScore(subject) = mean over evaluators of weightedScore`
- 순위: `finalScore` 내림차순. 동점은 동순위 처리.

집계·환산·검증 로직은 UI와 분리된 순수 함수(`lib/scoring.ts`)로 작성하여 단위 테스트한다.

## 6. 회차 상태 흐름 (마감·잠금)

```
DRAFT ──(평가 시작)──> IN_PROGRESS ──(마감)──> CLOSED
```

- **DRAFT**: 관리자가 항목·대상·위원을 자유롭게 편집. 평가위원에게는 보이지 않음.
- **IN_PROGRESS**: 평가위원이 점수 입력. 관리자는 진행률(위원별 완료 대상 수) 모니터링. 항목/대상 구조 변경은 잠금.
- **CLOSED**: 모든 점수 잠금(수정 불가). 결과표 확정·출력 활성화.

## 7. 화면 구조 (App Router)

```
/login                                   로그인 (역할별 라우팅)
/admin                                   관리자 대시보드 (회차 목록·상태·진행률)
/admin/sessions/new                      회차 생성
/admin/sessions/[id]                     회차 상세·설정 (상태 전환/마감)
/admin/sessions/[id]/criteria            평가 항목 관리 (추가·수정·삭제·정렬)
/admin/sessions/[id]/subjects            평가 대상 관리
/admin/sessions/[id]/evaluators          평가위원 배정 (계정 생성·매핑)
/admin/sessions/[id]/results             집계 결과표 (인쇄·CSV)
/evaluate                                평가위원: 배정 회차·대상 목록
/evaluate/[sessionId]/[subjectId]        점수 입력 시트
```

- 읽기: Server Components / 쓰기: Server Actions
- 결과 출력: `/admin/sessions/[id]/results`에서 인쇄 전용 CSS + `/api/sessions/[id]/results.csv` CSV 다운로드

## 8. 인증·인가

- 로그인: username/password → bcrypt 검증 → JWT(역할 포함) 발급, httpOnly 쿠키 저장
- 미들웨어: `/admin/*`는 ADMIN, `/evaluate/*`는 EVALUATOR만 허용. 그 외 로그인 리다이렉트
- 평가위원 계정은 관리자가 회차 위원 배정 화면에서 생성(username/임시 비밀번호)
- 시드: 초기 관리자 계정 1개를 seed 스크립트로 생성

## 9. 에러 처리

- 인증 실패 → `/login` 리다이렉트
- 권한 없는 접근 → 403
- 잠금(CLOSED) 회차 점수 수정 시도 → 거부 + 메시지
- 폼 검증 실패 → 인라인 에러
- 미배정 회차 접근(평가위원) → 404/403

## 10. 테스트 전략

- **단위(Vitest)**: `lib/scoring.ts` — 가중 집계, 등급 환산, 순위, 검증 경계값
- 핵심 비즈니스 로직은 순수 함수로 분리하여 DB·UI 없이 테스트 가능하게 설계
- (선택) 추후 Server Action 통합 테스트 추가 가능

## 11. 범위 밖 (추후 확장 후보)

- 열람 전용(감사) 역할 및 화면
- PDF 양식 생성, 친필 서명
- 폐쇄망/1회용 코드 인증, 화면 off 타이머
- 평가 대상 서류 업로드/열람
- 항목 템플릿 저장·불러오기, 회차 복사
