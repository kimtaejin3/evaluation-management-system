# 과제·분과 계층 + 마스터/간사/평가위원 역할 개편 — 설계 (1차)

> 상태: **설계 승인됨(구현 전)**. 이 문서는 구현 계획(writing-plans)의 입력이다.

## Context (왜)
현재 시스템은 **분과(EvaluationSession)** 가 최상위 관리 단위이고, 역할은 **ADMIN·EVALUATOR** 뿐이다. 실제 운영에서는 하나의 **과제(Project)** 아래 여러 **분과**(보통 ≈7개)가 있고, 각 분과는 **간사(SECRETARY)** 가 만들고 구성한다. 상위에는 전체를 보는 **마스터(MASTER)** 가 있다. 따라서 (1) 과제→분과 계층, (2) 마스터/간사/평가위원 3역할, (3) 메뉴/권한 개편이 필요하다.

과거에 `SECRETARY` 역할을 추가했다가 제거한 이력이 있다(마이그레이션 `role_secretary`→`remove_secretary_role`). 이번에 재도입한다.

## 확정된 요구사항 (브레인스토밍 결과)
- **계층/생성 주체**: 과제 = **마스터**가 생성. 분과 = **간사**가 (과제 아래에) 생성.
- **역할**: **마스터 / 간사 / 평가위원** 3역할. 간사는 **자기 분과**에 한해 현재 관리자 기능 수행.
- **책임자**: 기존 **위원장(chairId)** 개념을 그대로 씀 — 간사가 자기 분과에서 지정.
- **1차 범위**: 구조·역할·메뉴 개편 + 간사의 분과 생성·구성(=평가계획 등록). **모니터링/결과는 기존 분과별 화면 유지**, 마스터 통합 대시보드는 **2차**.
- **라우팅**: `/admin` 유지 + **역할 게이트**(별도 영역 신설 안 함).

## 도메인 모델
### 신규: `Project` (과제)
```
model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  dueDate     DateTime?           // 과제 평가 마감/기준일(선택)
  sessions    EvaluationSession[]
  createdAt   DateTime @default(now())
}
```

### 수정: `EvaluationSession` (분과)
- `projectId String?` + `project Project? @relation(...)` — 소속 과제(마이그레이션 위해 nullable; null=미분류).
- `secretaryId String?` + `secretary User? @relation("SessionSecretary", ...)` — 담당 간사(null=마스터가 직접 관리/미배정).
- 기존 `chairId`(=책임자/위원장) 유지.
- 나머지(criteria/subjects/assignments/scores/status 등) 변경 없음.

### 수정: `User.Role`
```
enum Role { MASTER  SECRETARY  EVALUATOR }
```
- 기존 `ADMIN` → `MASTER` 로 데이터 이관. `SECRETARY` 재도입.
- `User`에 역방향 관계: `secretariedSessions EvaluationSession[] @relation("SessionSecretary")`.

## 역할·권한
| 역할 | 접근 범위 | 주요 기능 |
|---|---|---|
| **마스터(MASTER)** | 전역 | 과제 생성·관리, 과제에 분과 배치/간사 배정, 평가위원·기업 전역 관리, 모든 분과 열람 |
| **간사(SECRETARY)** | **자기 분과만** (secretaryId=본인) | 분과 생성(과제 하위) + 평가항목·대상·위원 설정(=평가계획 등록) + 책임자(위원장) 지정 + 진행 모니터링 |
| **평가위원(EVALUATOR)** | 배정 분과 | 채점 (현행 `/evaluate` 그대로) |

**스코핑 규칙(서버 강제)**: 간사가 `/admin/sessions/[id]/*` 접근 시 `session.secretaryId === user.id` 아니면 403/notFound. 마스터는 전부 허용. 이 검증은 **세션 하위 레이아웃(server component)** 과 **모든 분과 관련 서버 액션** 진입부에 공통 헬퍼(`assertSessionAccess(userId, role, sessionId)`)로 적용.

## 라우팅·메뉴 (A안: `/admin` + 역할 게이트)
### 신규 라우트
- `/admin/projects` — 과제 목록(마스터). 과제별 분과 수·상태 요약.
- `/admin/projects/new` — 과제 생성(마스터).
- `/admin/projects/[id]` — 과제 상세: 소속 분과 목록 + (마스터) 간사 배정·분과 추가 진입.

### 기존 라우트 (권한만 조정)
- `/admin/sessions/[id]/*` — 분과 상세/항목/대상/위원/집계. **간사=자기 분과만**, 마스터=전부.
- `/admin/evaluators`, `/admin/companies` — 전역 관리. 1차엔 **마스터·간사 모두 접근 허용**(간사도 위원/기업을 등록해야 배정 가능). 필요 시 2차에 스코프 강화.
- `/admin/sessions/new` — 분과 생성. **과제 선택 필수**(간사=자신이 접근 가능한 과제 하위, 마스터=임의). 생성 시 `secretaryId`=생성자(간사) 자동 지정.

### 사이드바(AdminSidebar) 역할 분기
- **마스터**: `과제 관리`(→ 과제 목록/상세, 그 아래 분과) · `평가위원 관리` · `기업 관리`
- **간사**: `내 분과`(secretaryId=본인 분과, 과제별 그룹) · (분과 진입 시 기존 하위메뉴) · `평가위원 관리` · `기업 관리`
- 분과 이름 옆 진행상태 텍스트(초안/진행중/마감)는 현행 유지.

### 로그인 분기 (`app/login/actions.ts`)
- `MASTER` → `/admin/projects`
- `SECRETARY` → `/admin/sessions`(내 분과 목록) 또는 `/admin/projects`(내 과제) — **내 분과 목록**으로.
- `EVALUATOR` → `/evaluate` (현행 게이트 유지: 진행중 배정 분과 있어야 로그인)

## 접근 제어 구현 방식
- `lib/session.ts`(현 `getCurrentUser`)에 역할 헬퍼 추가: `requireRole`, `canManageSession(user, session)`.
- **미들웨어**(`middleware.ts`)는 로그인 여부/영역(`/admin` vs `/evaluate`)만 거르고, **세부 역할·소유 검증은 서버 컴포넌트/액션**에서(분과 데이터가 필요하므로).
- 공통 가드: `assertMaster()`, `assertSessionSecretaryOrMaster(sessionId)` — 위반 시 `notFound()`(정보 노출 최소화).

## 기존 데이터 마이그레이션
1. `ALTER TYPE Role`: `ADMIN`→`MASTER` 이관 + `SECRETARY` 추가 (enum 재생성 방식, 과거 remove 마이그레이션 역순 참고).
   - 기존 `ADMIN` 유저 → `MASTER`.
2. `EvaluationSession`에 `projectId`, `secretaryId` **nullable** 컬럼 추가.
   - 기존 분과: `projectId=null`(미분류), `secretaryId=null`(마스터 관리). 마스터가 UI에서 과제 편입·간사 배정.
3. 최소 1명의 간사 계정 필요 → 시드(과거 `seed_gansa` 패턴 재사용, username `gansa`) 또는 마스터가 평가위원 관리에서 역할 지정.
   - 참고: 현재 평가위원 관리 UI는 EVALUATOR만 생성. **간사 계정 생성/역할 지정 UI**가 마스터에게 필요(1차 포함).

## 신규/변경 파일 (개요)
- `prisma/schema.prisma` (+마이그레이션): Project 모델, Session 필드, Role enum.
- `app/admin/projects/**` (신규): 과제 목록/생성/상세 페이지 + 서버 액션(`createProject`, `assignSecretary`, `attachSessionToProject` 등).
- `app/admin/sessions/actions.ts`, `app/admin/sessions/[id]/layout.tsx`: 소유/역할 가드, `createSession`에 projectId·secretaryId.
- `components/AdminSidebar.tsx`: 역할별 메뉴 분기.
- `app/login/actions.ts`: 역할별 리다이렉트.
- `app/admin/evaluators/**`: **간사 계정 생성/역할 지정**(마스터용) 추가.
- `lib/session.ts`(또는 신규 `lib/authz.ts`): 역할·소유 가드 헬퍼.
- 시드/데모: `prisma/seed.ts`, `scripts/demo-seed.ts` 역할 반영.

## 검증(수용 기준)
1. 마스터 로그인 → 과제 생성 → 과제 아래 분과 목록이 보인다.
2. 간사 로그인 → **자기 분과만** 보이고, 남의 분과 URL 직접 접근 시 차단(notFound).
3. 간사가 분과 생성(과제 선택) → 평가항목·대상·위원 설정·책임자(위원장) 지정 = 평가계획 등록 완료.
4. 평가위원 로그인·채점은 기존과 동일하게 동작.
5. 기존 분과(마이그레이션 후)가 "미분류"로 뜨고, 마스터가 과제 편입·간사 배정 가능.
6. `npm run build`·단위·e2e 통과(로그인 리다이렉트 e2e는 새 역할에 맞게 갱신).

## 범위 밖 (2차 이후)
- 마스터 **통합 모니터링 대시보드**("오늘 N개 분과·총 M과제 평가 예정").
- 결과관리(과제 단위 집계/내보내기), 간사에 대한 평가위원·기업 스코프 강화.

## 열린 가정(구현 중 확정)
- 간사↔과제 관계: 1차에선 **간사는 어떤 과제 아래로든 분과 생성 가능**(과제별 간사 제한 없음)으로 단순화. 필요 시 2차에 과제-간사 배정 도입.
- `secretaryId`가 null인 분과는 마스터만 관리.
