# 테스트 요구사항 목록 (검증 대상)

> 코드 감사(인증·권한 / 관리자 관리 / 가져오기 / 채점·집계·인쇄 4개 서브시스템)로 추출한 검증 대상.
> 각 줄은 **그대로 테스트 제목(`it`/`test`)으로 쓸 수 있는 서술문**이다.

## 층위 태그
- **[U] unit** — `lib/`의 순수 함수. `npm test`(Vitest)로 즉시 작성 가능. **가장 싸고 촘촘하게.**
- **[C] component** — 컴포넌트 렌더/상호작용(버튼 활성·모달·토글 등). **현재 인프라 없음** → jsdom + @testing-library/react 세팅 필요(또는 로직을 lib로 빼 [U]로 낮추기).
- **[E] e2e** — 로그인·리다이렉트·서버액션·DB·revalidate를 가로지르는 여정. Playwright(`e2e/`). 해피패스 위주로.

우선순위: **[U] 전부 → [E] Tier1 여정 → [C]/[E] 나머지.** 실패·엣지 조합은 [U]로 몰고, [E]는 "여정이 된다"만.

---

## A. 인증 · 로그인

- [ ] [U] 유효하지 않은 아이디/비밀번호는 "아이디 또는 비밀번호가 올바르지 않습니다." 오류를 낸다 (login-rules)
- [ ] [U] 평가위원은 진행 중(IN_PROGRESS) 배정 심사가 0개면 로그인이 차단된다 (login-rules)
- [ ] [U] 평가위원은 진행 중 배정 심사가 1개 이상이면 로그인할 수 있다 (login-rules)
- [ ] [U] 마스터·간사는 배정 유무와 무관하게 항상 로그인할 수 있다 (login-rules)
- [ ] [U] JWT 토큰에 userId·role이 담기고 12시간 유효하다 (auth)
- [ ] [E] 마스터 로그인 후 `/admin/projects`로 이동한다
- [ ] [E] 간사 로그인 후 `/admin/sessions`로 이동한다
- [ ] [E] 평가위원 로그인 후 `/evaluate`로 이동한다
- [ ] [E] 로그인 성공 시 `auth_token` 쿠키(httpOnly, sameSite=lax)가 설정된다
- [ ] [E] 로그아웃하면 `auth_token`이 삭제되고 `/login`으로 이동한다

## B. 권한 · 접근제어 (역할별)

**순수 규칙 [U] (`authz-rules`)**
- [ ] [U] canManageSession: 마스터는 모든 분과, 간사는 secretaryId 일치 분과만, 평가위원은 거부
- [ ] [U] canManageSession: 간사/분과의 id가 빈 문자열이면 `!!` 가드로 거부한다(오탐 방지)
- [ ] [U] canAccessProject: 마스터 전권, 간사는 배정 secretaries 포함 시만, 평가위원은 거부
- [ ] [U] canAccessProject: 배정 목록이 비면 간사는 거부된다

**접근 경계 [E]**
- [ ] [E] 비로그인으로 `/admin/*` 접근 시 `/login`으로 리다이렉트된다
- [ ] [E] 비로그인으로 `/api/evaluate/{home,sheet,chair}` 접근 시 401을 반환한다
- [ ] [E] 평가위원이 `/admin/*` 접근 시 404를 받는다
- [ ] [E] 간사가 담당이 아닌 분과에 접근 시 404를 받는다
- [ ] [E] 간사가 `/admin/sessions`에서 자기 담당 분과만 본다(마스터는 전체)
- [ ] [E] 평가위원이 아닌 위원이 `/api/evaluate/chair` 접근 시 403 → `/evaluate`로 리다이렉트된다
- [ ] [E] 평가위원은 배정된 분과의 대상만 조회/입력할 수 있다(비배정은 404)
- [ ] [U] API 토큰 접근: 평가위원 거부, 마스터 전체, 간사는 자기 분과만 (canTokenAccessSession)

## C. 과제(Project) 관리

- [ ] [E] 마스터만 과제를 생성할 수 있다 (그 외 assertMaster로 404)
- [ ] [U] 과제 생성 시 과제명은 필수, 설명·기준일은 선택이다 (createProject)
- [ ] [E] 마스터만 과제를 삭제할 수 있고, 삭제 전 확인 모달이 뜬다
- [ ] [E] 과제 삭제 시 소속 분과는 삭제되지 않고 projectId=null(미분류)로 남는다 (SetNull)
- [ ] [C] 과제 삭제 모달은 과제명·소속 분과 수·미분류 안내를 표시하고 Esc로 닫힌다 (DeleteProjectButton)
- [ ] [E] 기존 간사 배정 / 새 간사 생성·즉시 배정 / 배정 해제가 동작한다
- [ ] [U] 새 간사의 임시 비밀번호는 연락처 끝 4자리로 발급된다 (passwordFromPhone)
- [ ] [C] 간사 배정 모달: 기존/신규 탭, 필수 입력, 비활성 상태, Esc 닫기 (AssignSecretaryModal)
- [ ] [U] 과제 상태는 소속 분과에서 파생된다: 하나라도 IN_PROGRESS면 진행중, 전부 CLOSED면 마감, 그 외 준비중 (project-status)

## D. 분과(Session) 관리 · 상태 전이

- [ ] [E] 마스터/배정 간사만 분과를 생성할 수 있고, 과제 선택·분과명은 필수다
- [ ] [E] 간사가 분과를 생성하면 본인이 담당 간사가 된다(마스터는 폼에서 선택)
- [ ] [U] 종료일(endDate)이 마감 판정용 eventDate로 동기화된다
- [ ] [E] 분과 삭제 시 항목·대상·배정·점수가 Cascade 삭제되고, 전용 자료는 삭제·공통 자료(sessionId=null)는 보존된다
- [ ] [C] 분과 삭제 모달은 "되돌릴 수 없음" 경고·삭제 범위를 안내하고 Esc로 닫힌다 (DeleteSessionButton)
- [ ] [U] 마감(CLOSED) 규칙: eventDate 없으면 언제든 가능, 있으면 그 시각 이후만 가능 (session-rules)
- [ ] [U] eventDate가 미래면 마감이 차단되고 안내 메시지를 낸다 (session-rules / CLOSE_BLOCKED_MESSAGE)
- [ ] [C] 상태 컨트롤: 평가시작(DRAFT→IN_PROGRESS)·마감(→CLOSED)·마감해제(CLOSED→IN_PROGRESS) 버튼, 미래 eventDate면 마감 비활성 (SessionStatusControl)
- [ ] [E] CLOSED 분과에서는 평가항목·대상·위원 배정·위원장 지정·자료가 모두 수정 잠금된다

## E. 평가대상(Subject) 관리

- [ ] [E] 기존 기업 선택 또는 신규 기업명으로 대상을 편입할 수 있다
- [ ] [E] 같은 분과에 이미 편입된 기업은 중복 추가되지 않는다 (sessionId_companyId 유니크)
- [ ] [E] 분과에서 대상을 제외할 수 있다
- [ ] [E] 인쇄 헤더 정보(taskName·region·taskType·leadResearcher)를 편집·저장할 수 있다 (updateSubjectMeta)
- [ ] [U] 헤더 정보는 공란 입력 시 null로 저장된다 (updateSubjectMeta의 str 헬퍼)
- [ ] [E] 과제명(taskName)은 기업명과 별개 필드이며 미입력 시 인쇄에서 빈칸이다
- [ ] [E] 대상 자료는 PDF만 허용되고 분과 전용(sessionId)으로 저장된다

## F. 평가항목 3단계 (평가항목 → 세부항목 → 평가지표)

- [ ] [E] 평가항목/세부항목/평가지표를 각각 추가·수정·삭제할 수 있다
- [ ] [E] 평가항목 삭제 시 하위 세부항목·평가지표·점수가 Cascade 삭제된다
- [ ] [U] 전체 배점 합계 = 모든 평가지표(리프) maxScore의 합이다
- [ ] [C] 편집기: 편집/미리보기 토글, 7열 고정 구조, 항목/세부항목/지표 추가 버튼 (CriteriaEditor)

## G. 가져오기(Import) — 파싱 · 매핑 · 검증 · 변환

**파싱 [U]**
- [ ] [U] parseSheet: 첫 시트만, 숫자/불리언→문자열, 빈 셀 '' 유지, 짧은 행 패딩 (kpass-sheet)
- [ ] [U] parseTsv: 탭=열·개행=행, 따옴표 셀 내 줄바꿈 유지, 이스케이프 따옴표 복원, 빈 행 제거 (kpass-import)
- [ ] [U] 파일 4MB 초과는 거부한다

**헤더 자동 매핑 [U]**
- [ ] [U] 평가항목 헤더 동의어 매핑: section/name/description/maxScore/weight/grade, 괄호 제거 정규화, 단일필드 첫 열·grade 다중 열 (kpass-import)
- [ ] [U] 위원 헤더 동의어 매핑: name/username/phone (evaluator-import)
- [ ] [U] 대상 헤더 동의어 매핑: name/businessNo/description (subject-import)
- [ ] [U] 첫 행이 헤더처럼 보이는지 판별한다(looksLikeHeader)
- [ ] [U] 2행 머리글(상위 평점 + 하위 등급)을 매핑 수 비교로 자동 인식한다

**검증·필수 규칙 [U]**
- [ ] [U] 평가항목: name(세부항목명) 미매핑 시 경고 후 중단
- [ ] [U] 위원: name·phone 둘 다 필수, 미매핑 시 각 경고 후 중단
- [ ] [U] 대상: name(기업명) 미매핑 시 경고 후 중단
- [ ] [U] hasHeader 설정에 따라 첫 행을 스킵/포함한다
- [ ] [U] 빈 행·합계행(합계|총계|소계|계|총점)을 자동 스킵한다
- [ ] [U] 같은 입력 내 중복 제거: 위원=username/name키, 대상=기업명(소문자)키
- [ ] [U] 연락처 없는 위원 행은 제외하고 제외 인원을 경고한다

**변환 규칙 [U]**
- [ ] [U] 배점 숫자 추출: "30점"/"20 점"/"15.5"→숫자, 실패 시 null→0 + 경고
- [ ] [U] section 세로 병합셀을 이전 값으로 채우고 합계 표기 "(25)"를 제거한다
- [ ] [U] 이름/설명 줄머리 불릿(-·•※*)을 제거한다
- [ ] [U] 정성 grade 열이 있으면 label+points로 GradeOption 생성, 가로 병합셀은 직전 점수로 채움
- [ ] [U] 정량(등급 없음)은 배점 기준 A~E(100/80/60/40/20%) 기본 등급을 생성한다 (scoring.defaultGradeOptions)
- [ ] [U] weight 기본값은 1(미매핑·빈 값)

**3단계 변환·서버 반영 [U/E]**
- [ ] [U] 평탄 결과를 section=그룹, 각 행=세부항목+평가지표로 3단 변환한다
- [ ] [U] Criterion.name = description || row.name, 그룹 maxScore = 하위 합
- [ ] [U] commitKpassImport는 숫자 전용 처리라 gradeOptions를 무시한다
- [ ] [E] 이미 점수가 있는 세션은 "기존 항목 대체"가 차단된다 (replaceCriteria 안전장치)
- [ ] [E] (UI 배선) 붙여넣기 → 자동 매핑 → 미리보기에 예정 항목 수·경고가 표시된다

**위원/대상 upsert [U/E]**
- [ ] [U] 위원 username 없으면 자동 생성('ev'+6자), 있으면 유지
- [ ] [U] 새 위원 임시비번=연락처 끝4자리(4자 미만이면 자동 8자), 기존 위원은 비번 유지·이름/연락처만 갱신
- [ ] [E] 위원 가져오기 시 모두 이 분과에 자동 배정된다(중복 배정 방지)
- [ ] [E] 대상 가져오기: Company는 기업명 키로 upsert, 같은 분과 편입분은 skip 카운트
- [ ] [U] 결과 형식: K-PASS{created,warnings}, 위원{accounts[{tempPassword}],warnings}, 대상{created,skipped,warnings}

## H. 채점 흐름 (평가위원)

- [ ] [E] `/evaluate`에서 진행 중(IN_PROGRESS) 배정 분과와 대상 목록을 본다(없으면 안내)
- [ ] [E] 대상을 열면 점수 폼·현재 점수·입력 진행률·종합의견이 로드된다
- [ ] [C] 점수 입력은 700ms 디바운스로 자동 저장되고 "저장 중→저장됨"이 표시된다 (ScoreForm)
- [ ] [U] 점수 유효 범위는 0~maxScore이다 (scoring.isValidScoreValue)
- [ ] [C] 범위 이탈 입력은 빨간 테두리 + "0~N 범위" 경고를 표시한다
- [ ] [E] 제출은 전체 항목 필수, 임시저장은 부분 허용된다
- [ ] [E] 제출하면 같은 분과 다음 대상으로 이동하고, 마지막이면 목록으로 돌아가 완료 안내를 본다
- [ ] [U] 종합의견은 있으면 upsert, 비우면 삭제된다 (saveScores opinion)
- [ ] [E] IN_PROGRESS가 아니거나 미배정 위원의 저장은 차단된다(not-active / not-assigned)
- [ ] [C] 탭 숨김 시 '입력 중' 표시가 즉시 해제된다 (clearEditing)
- [ ] ⚠️ [E] 제출 후 위원은 재오픈 불가·관리자만 재오픈 — **관리자 재오픈 기능이 코드에 없음(구현 필요, 테스트 전 확인)**

## I. 점수 계산 [전부 U — `scoring`]

- [ ] [U] 위원 합산 = Σ(항목 점수 × weight) (computeWeightedScore)
- [ ] [U] 최종 점수 = 배정(완료) 위원 합의 평균 (computeFinalScores)
- [ ] [U] 환산 = 최종 ÷ 만점합 × 100
- [ ] [U] 등급 = 환산 90↑S · 80↑A · 70↑B · 60↑C · 그 외 D (overallGrade)
- [ ] [U] 순위 = 최종 내림차순, 동점은 동순위 (rankSubjects)

## J. 위원장

- [ ] [E] 위원장만 총괄표에서 타 위원 점수·의견을 열람한다(아니면 403→리다이렉트)
- [ ] [U] 셀 상태 판정: 전부 입력=done, 일부=partial, 없음=none (evaluate-data.cellOf)
- [ ] [E] 위원장만 분과 총평을 저장한다(빈 값은 null), 저장분은 집계결과에 표시된다
- [ ] [U] 총평 저장은 chairId≠userId면 "위원장만 작성" 오류 (saveChairSummary)

## K. 집계결과 · 인쇄

- [ ] [E] 순위표에 항목별 점수 + 최종/환산/등급이 표시된다
- [ ] [C] "점수 보기"로 전체 평균/특정 위원 전환, 인쇄 시 전체 평균 고정 (RankingTable)
- [ ] [U] 위원 간 편차 = 완료 위원 2명↑에서 최고-최저, ±10↑은 재검토 권장 (progress.spread)
- [ ] [E] CSV 다운로드가 동작한다(UTF-8 BOM, 권한: 간사는 자기 분과·평가위원 불가)
- [ ] [E] 총괄표 인쇄 시 화면 컨트롤이 숨고 인쇄 레이아웃(서명란 포함)이 나온다
- [ ] [E] 위원별 평가표 인쇄: 위원 드롭다운 + 기업별 버튼 → sheet 페이지로 이동 (SheetPrintPicker)
- [ ] [C] sheet 진입 시 300ms 뒤 window.print()가 자동 실행된다 (AutoPrint)
- [ ] [E] 평가표 양식: 메타헤더(지역/과제유형/과제명/기관/책임자) + 3단 표(배점·평점) + 합계 자동합 + 평가의견 + 서명란
- [ ] [E] 위원별 평가표 인쇄는 마스터/자기 분과 간사만 접근(그 외 404)

## L. 진행상태 · 인사이트 [주로 U — `progress`]

- [ ] [U] 진행률 = 입력 완료 칸 / 전체 칸(위원×대상) × 100
- [ ] [U] 입력 완료 칸 = 모든 평가항목이 입력된 (위원:대상) 쌍
- [ ] [U] 잠정 순위/편차는 모든 항목을 입력한 위원만으로 계산한다
- [ ] [E] 위원장/입력 중 항목이 진행 화면에 실시간 표시된다 (editingPresence)

## M. 데이터 무결성 (스키마 제약) [E / 통합]

- [ ] [E] 분과 삭제 → 항목·대상·배정·점수 Cascade 삭제
- [ ] [E] 과제 삭제 → 분과 projectId SetNull, 하위 데이터 보존
- [ ] [E] 분과 삭제 → 전용 문서 sessionId SetNull(공통 자료화)

---

## 다음 단계
1. **[U] 항목부터** — `lib/` 순수 함수. 이미 `scoring/authz-rules/*-import/kpass-sheet/criteria/phone/project-status/session-rules` 상당수 테스트 존재하니 **빈 곳만 보강**.
2. **[E] Tier1 여정** — A(로그인 랜딩)·B(접근 차단)·H(채점→제출)·D(CLOSED 잠금). Playwright, 픽스처는 고유 접두어 + afterAll 정리(공유 DB 주의).
3. **[C] 컴포넌트** — 필요 크면 jsdom+@testing-library/react 세팅. 아니면 로직을 lib로 빼 [U]로 낮추기.
4. ⚠️ **H의 "관리자 재오픈"** 은 기능 자체가 없어 보임 — 테스트 전 구현 여부 확정.
