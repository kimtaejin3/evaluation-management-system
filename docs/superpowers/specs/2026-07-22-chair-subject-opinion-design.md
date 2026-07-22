# 위원장 대상별 종합의견 화면 설계

## 배경

현재 종합의견은 **모든 평가위원**이 각자 평가표 맨 아래에 작성한다(`Opinion` 테이블, `(evaluatorId, subjectId)` 유니크). 여기에 더해 위원장만 쓰는 **분과 총괄평가**(`EvaluationSession.chairSummary`)가 따로 있어, 의견 작성 지점이 두 갈래로 나뉘어 있다.

요구사항은 이 구조를 바꾸는 것이다.

1. 종합의견은 **위원장만** 작성한다. 일반 평가위원은 평가항목별 의견만 쓴다.
2. 위원장에게 **평가 대상별 페이지**를 새로 제공한다. 그 페이지에서 각 위원이 해당 대상에 준 점수·항목별 의견·제출 유무를 보면서 종합의견을 작성한다.
3. 분과 전체를 아우르는 총괄평가는 없애고, 의견을 **대상 단위로 일원화**한다.

## 목표와 비목표

**목표**
- 종합의견의 작성 주체를 위원장 하나로 좁힌다.
- 위원장이 한 대상에 대한 위원들의 판단(점수·의견·제출 여부)을 한 화면에서 보며 종합의견을 쓸 수 있게 한다.

**비목표**
- 관리자·간사 화면 개편. 관리자 **평가의견서**는 이미 위원장의 `Opinion`만 읽어 "평가위원장 종합의견"으로 표시하므로 그대로 둔다.
- 점수 계산·집계 로직 변경.
- 기존 데이터 삭제(마이그레이션). 아래 "데이터 처리" 참고.

## 현재 구조

| 요소 | 위치 | 현재 역할 |
|---|---|---|
| `Opinion` (evaluatorId, subjectId) | `prisma/schema.prisma` | 위원별 대상별 종합의견 |
| `GroupComment` (evaluatorId, subjectId, groupId) | 동일 | 평가항목(그룹)별 의견 |
| `Submission` (evaluatorId, subjectId) | 동일 | 제출 상태 + 서명 |
| `EvaluationSession.chairSummary` | 동일 | 분과 총괄평가(위원장 1건) |
| 위원장 총괄표 | `app/evaluate/[sessionId]/chair/` | 대상×위원 점수 격자 + 평균/순위 + 총괄평가 폼 |
| 종합의견 입력 | `app/evaluate/[sessionId]/[subjectId]/ScoreForm.tsx` | 평가표 하단 textarea, 저장 시 `comment`로 전달 |

`/evaluate` 영역은 전부 **풀 CSR**이다. 얇은 서버 페이지가 클라이언트 컴포넌트를 렌더하고, 클라이언트가 `/api/evaluate/*`를 호출하며, 데이터 가공은 `lib/evaluate-data.ts`에 모여 있다. 새 화면도 이 패턴을 따른다.

## 설계

### 1. 데이터 모델 — 스키마 변경 없음

`Opinion`의 **의미만** "위원장이 쓴 대상별 종합의견"으로 좁힌다. 테이블·컬럼은 그대로 둔다.

이 선택의 근거는 관리자 화면이다. `app/admin/sessions/[id]/opinions/page.tsx`와 `components/SessionOpinionsModal.tsx`는 이미 `evaluatorId === chairId`인 `Opinion`만 골라 "평가위원장 종합의견"으로 보여준다. 즉 새 구조가 관리자 화면의 기존 동작과 정확히 일치하므로, 관리자 화면·엑셀 내보내기를 하나도 고치지 않아도 된다.

권한은 **서버 액션에서 강제**한다. 새 액션 `saveChairOpinion`이 `session.chairId === user.id`를 검사하고, 채점 저장 경로에서는 `Opinion`을 더 이상 쓰지 않는다.

### 2. 평가위원 채점 화면

`ScoreForm.tsx`에서 하단 `종합의견` textarea와 글자 수 표시를 **제거한다**(위원장 포함 전원). 평가항목별 의견은 그대로 둔다.

`app/evaluate/actions.ts`의 채점 저장 액션에서 `comment` 처리(`prisma.opinion.upsert` / `deleteMany`)를 제거한다. 이로써 `Opinion`에 쓰는 경로는 `saveChairOpinion` 하나만 남는다.

평가표 상단의 위원장 전용 링크 `다른 위원 평가 · 총평 →`는 목적지를 **현재 대상의 위원장 페이지**(`/evaluate/{sessionId}/chair/{subjectId}`)로 바꾼다. 라벨은 `이 대상 종합의견 →`으로 바꾼다.

### 3. 신설 — 대상별 위원장 페이지

**경로:** `/evaluate/[sessionId]/chair/[subjectId]`

**구성 파일**
- `app/evaluate/[sessionId]/chair/[subjectId]/page.tsx` — 얇은 서버 페이지, `ChairSubjectClient` 렌더
- `app/evaluate/[sessionId]/chair/[subjectId]/ChairSubjectClient.tsx` — 클라이언트, 데이터 fetch·표·종합의견 폼
- `app/api/evaluate/chair/subject/route.ts` — `GET ?sessionId=&subjectId=`
- `lib/evaluate-data.ts` — `getChairSubjectData(userId, sessionId, subjectId)` 추가

**권한:** `getChairSubjectData`가 `session.chairId !== userId`이면 `null`을 반환하고, 라우트는 403을 준다. 클라이언트는 403을 받으면 `/evaluate`로 replace 한다. 기존 `/api/evaluate/chair`와 동일한 방식이다.

**반환 데이터 (`ChairSubjectData`)**

```ts
export interface ChairSubjectEvaluator {
  id: string
  name: string
  isChair: boolean
  /** 전 항목 입력 완료 시 합계, 아니면 null */
  total: number | null
  /** 입력 진행 상태 */
  state: 'none' | 'partial' | 'complete'
  /** 평가항목(그룹)별 의견 — 작성된 것만 */
  groupComments: { groupName: string; text: string }[]
  /** 제출 여부 — Submission.status 가 SUBMITTED/APPROVED 이면 true */
  submitted: boolean
}

export interface ChairSubjectData {
  sessionName: string
  subjectId: string
  subjectName: string
  evaluators: ChairSubjectEvaluator[]
  /** 위원장이 이 대상에 저장해 둔 종합의견 */
  chairOpinion: string
  /** 분과가 마감(CLOSED)되면 읽기 전용 */
  locked: boolean
  /** 대상 간 이동 (이름 오름차순 기준 이웃) */
  prevSubjectId: string | null
  nextSubjectId: string | null
}
```

`total`·`state` 산정 규칙은 기존 `getChairData`의 것을 그대로 따른다 — 전 채점 단위를 입력했을 때만 합계를 내고, 일부만 입력했으면 `partial`에 `total=null`, 하나도 없으면 `none`이다. 다만 `getChairData` 자체는 삭제되므로(5절), 이 계산 로직은 `getChairSubjectData` 안으로 옮겨 구현한다.

**화면 레이아웃**

상단에 `← 대상 목록`, 대상명, 분과명, 그리고 이전/다음 대상 이동 버튼을 둔다.

본문은 좌우 2단이다.
- **좌(넓게): 위원별 표** — 컬럼 `평가위원명 / 종합점수 / 항목당 의견 / 제출 유무`
  - 평가위원명: 위원장이면 `(위원장)` 표기
  - 종합점수: `total`이 있으면 숫자, 없으면 `입력중`(partial) / `입력전`(none)
  - 항목당 의견: `groupComments`를 `평가항목명 — 내용` 형태로 세로 나열. 없으면 `의견 없음`
  - 제출 유무: 프로젝트의 기존 표기 규칙을 따라 텍스트만 — 제출은 검정, 미제출은 빨강
- **우: 종합의견** — textarea + `저장` 버튼. `locked`면 읽기 전용 + 안내 문구

**저장 액션:** `saveChairOpinion(sessionId, subjectId, formData)` — `app/evaluate/actions.ts`
1. 로그인 확인
2. `session.chairId === user.id` 확인, 아니면 `{ ok: false, error: '위원장만 작성할 수 있습니다.' }`
3. 분과 `status === 'CLOSED'`면 `{ ok: false, error: '마감된 분과입니다.' }`
4. 텍스트가 있으면 `Opinion` upsert(`evaluatorId`=위원장, `subjectId`), 비었으면 해당 행 delete
5. `revalidatePath('/evaluate/{sessionId}/chair/{subjectId}')`

### 4. 진입 경로

- **대상 목록**(`app/evaluate/EvaluateHomeClient.tsx`): `HomeSession.isChair`가 참일 때 각 대상 항목에 `종합의견` 버튼을 노출한다. 필드가 이미 있으므로 데이터 변경은 없다.
- **평가표 상단**: 위 2절대로 현재 대상의 위원장 페이지로 연결한다.
- **페이지 내**: 이전/다음 대상 이동.

### 5. 제거 대상

| 파일 | 처리 |
|---|---|
| `app/evaluate/[sessionId]/chair/page.tsx` | 삭제 |
| `app/evaluate/[sessionId]/chair/ChairClient.tsx` | 삭제 |
| `components/ChairSummaryForm.tsx` | 삭제 |
| `components/ChairScoreCell.tsx` | 삭제 (`ChairClient` 전용) |
| `app/api/evaluate/chair/route.ts` | 삭제 |
| `lib/evaluate-data.ts` 의 `getChairData` / `ChairData` / `ChairRow` / `ChairCell` | 삭제 |
| `app/evaluate/actions.ts` 의 `saveChairSummary` | 삭제 |
| `app/admin/sessions/[id]/results/page.tsx` 의 `chairSummary` 표시 블록 | 삭제 |

`ChairScoreCell`은 `ChairClient`에서만 쓰이므로 함께 삭제한다. 대상별 페이지는 항목별 의견을 표에 직접 펼쳐 보여주므로 모달이 필요 없다.

### 6. 데이터 처리

파괴적 마이그레이션을 하지 않는다.

- `EvaluationSession.chairSummary` 컬럼은 **남긴다**. 읽는 곳이 사라져 화면에는 나오지 않지만, 기존에 작성된 총괄평가 원문은 보존된다.
- 위원장이 아닌 위원이 과거에 남긴 `Opinion` 행도 **지우지 않는다**. 새 구조에서는 읽히지도 쓰이지도 않는다.

두 경우 모두 되돌릴 수 있는 상태를 유지하는 쪽을 택했다. 정리가 필요해지면 별도 스크립트로 처리한다.

## 오류 처리

- 위원장이 아닌 사용자가 URL로 직접 접근 → API 403 → 클라이언트가 `/evaluate`로 replace
- 존재하지 않는 `subjectId`, 또는 해당 분과 소속이 아닌 대상 → `getChairSubjectData`가 `null` → 403 → 동일 처리
- 저장 실패 → 폼 하단에 오류 메시지 표시(기존 `ChairSummaryForm`의 저장/오류 표시 방식과 동일한 결)
- 마감된 분과 → 폼 읽기 전용, 저장 액션도 서버에서 재차 거부

## 테스트

`lib/evaluate-data.ts`의 순수 로직을 단위 테스트로 덮는다(`vitest`, 기존 `npm test`).

- `getChairSubjectData`: 위원장이 아니면 `null`
- 점수/상태 산정: 전 항목 입력 시 `complete`+합계, 일부 입력 시 `partial`+`total=null`, 미입력 시 `none`
- `submitted`: `SUBMITTED`/`APPROVED`는 참, `DRAFT`/`REJECTED`는 거짓
- `prevSubjectId`/`nextSubjectId`: 첫 대상과 마지막 대상에서 각각 `null`

화면 동작은 기존 방식대로 Playwright로 확인한다: 위원장 계정으로 대상별 페이지 진입 → 위원별 점수·의견·제출 유무 표시 확인 → 종합의견 저장 → 관리자 **평가의견서**에 "평가위원장 종합의견"으로 나타나는지 확인. 비위원장 계정으로 같은 URL 접근 시 `/evaluate`로 튕기는지 확인.

## 영향 정리

- 평가위원: 종합의견 칸이 사라진다. 항목별 의견은 그대로.
- 위원장: 총괄표(격자·평균·순위)와 분과 총괄평가가 사라지고, 대상별 페이지에서 대상 하나를 깊게 보며 종합의견을 쓴다. **대상 간 비교 뷰는 없어진다** — 요구사항에 따른 의도된 손실이다.
- 관리자·간사: 평가의견서는 변화 없음. 간사 집계 결과에서 분과 총괄평가 블록만 사라진다.
