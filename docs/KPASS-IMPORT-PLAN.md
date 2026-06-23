# K-PASS 엑셀 임포트 — 평가위원·평가항목 일괄 세팅 (구현 계획)

> 상태: **계획만 작성됨(미구현)**. 착수 전 K-PASS 샘플 엑셀 헤더 필요.

## Context (왜)
현재 한 심사(세션)를 준비하려면 **평가위원**과 **평가항목(평가표)** 을 관리자가 화면에서 일일이 등록해야 한다. 실제 운영에서는 이 정보가 상류 시스템 **K-PASS(한국산업기술진흥원 KIAT 과제관리시스템)** 에 이미 있고, 거기서 **엑셀로 내려받거나 화면에서 셀을 드래그해 가져오는** 흐름을 쓴다. 목표: 세션 상세에서 K-PASS 데이터(평가위원 명단 / 평가표)를 **엑셀에서 긁어 붙여넣거나(주) 엑셀 파일로 업로드(보조)** 하면 **그 세션의 평가위원 계정·배정과 평가항목을 자동 생성**한다. (분과 = 세션 1:1, 과제/대상은 이번 범위 제외.)

## 입력 방식 (주: 붙여넣기)
- **주 경로 — 클립보드 붙여넣기(TSV)**: 엑셀에서 셀 범위를 드래그→복사하면 클립보드에 **탭 구분 텍스트(TSV)** 가 담긴다(열=`\t`, 행=`\n`, 줄바꿈 포함 셀은 `"…"` 로 감싸짐). `<textarea>` 에 Ctrl+V → 그 문자열을 그대로 파싱한다. `xlsx` 라이브러리 불필요, 파일 업로드 용량 가드 불필요.
- **보조 경로 — 엑셀 파일 업로드(.xlsx/.xls/.csv)**: 동일 파서로 환원(파일→행/열 2차원 배열). 큰 표나 붙여넣기가 어려운 환경 대비. SheetJS `xlsx` 는 이 경로에서만 필요(미도입 시 붙여넣기만으로도 동작).
- 두 경로 모두 결국 **`string[][]`(행×열) → 매핑** 으로 합류하므로 파싱 코어는 공통.

## 범위 (확정)
- **포함**: 평가위원(계정 생성 + 이 세션 배정), 평가항목(Criterion 생성)
- **제외**: 과제(평가 대상/Company·Subject) — 추후 별도
- **단위**: 세션 상세에서 업로드. 한 세션 = 한 분과.

## ⚠️ 선행 필요 (미확정)
K-PASS 데이터의 **실제 헤더가 없어 컬럼 매핑을 확정 못 함.** 구현 착수 전 **평가위원 표 / 평가표의 헤더 한 줄(엑셀에서 헤더 행만 긁어 붙여넣은 텍스트면 충분)** 필요. 아래 매핑은 일반적 양식 가정이며, 헤더 동의어 맵으로 흡수하되 샘플로 최종 확정한다.

## 데이터 매핑(가정)
**평가위원 엑셀 → User + Assignment**
- 성명 → `User.name`
- 이메일/위원ID(있으면) → `User.username` (안정적 키). 없으면 이름 기반 생성 + 중복 시 숫자 suffix.
- 비밀번호: K-PASS엔 없음 → 임시비밀번호 자동 발급(`tempPassword` 저장, 기존 패턴 재사용)
- role = EVALUATOR, 이 세션에 `Assignment` 생성
- 소속/전문분야 등은 스키마에 필드 없음 → 이번 범위에선 무시(필요 시 후속 스키마 확장)

**평가표 엑셀 → Criterion** (필드: 기존 `addCriterion` 데이터 형태와 동일하게)
- 구분/대분류 → `section` (대제목)
- 세부항목명 → `name`
- 배점 → `maxScore`
- 평가방식(정성/정량) → `type` (QUALITATIVE/QUANTITATIVE). 표기 없으면 등급기준 유무로 추론
- 등급기준(있으면 label+점수) → `gradeOptions` JSON. 없으면 `defaultGradeOptions(maxScore)`
- 가중치(있으면) → `weight`, 없으면 1 (현재 UI는 가중치 숨김 — 값만 저장)
- `order`는 행 순서대로 증가

## 재사용할 기존 코드 (신규 작성 최소화)
- 비밀번호 해시: `hashPassword()` — `lib/auth.ts`
- 평가위원 생성/임시비번 패턴: `createEvaluator`, `resetEvaluatorPassword` — `app/admin/actions.ts`
- 배정(upsert): `assignEvaluator` 로직(`prisma.assignment.upsert`, `@@unique([sessionId,userId])`) — `app/admin/sessions/actions.ts`
- 평가항목 생성 데이터 형태: `addCriterion` — `app/admin/sessions/actions.ts`
- 등급 옵션: `parseGradeOptions`, `defaultGradeOptions`, `GradeOption` — `lib/scoring.ts`
- 업로드 폼 패턴(용량 가드 + `useFormStatus` 로딩): `components/SubjectUploadForm.tsx`
- 모델: `User`/`Assignment`/`Criterion` — `prisma/schema.prisma` (스키마 변경 없음)

## 신규/변경 파일
1. **`package.json`** — (붙여넣기 전용이면 의존성 0) TSV에 **줄바꿈 포함 셀**(`"…"` 인용)이 있으므로 따옴표 인식 파서 필요: 직접 ~40줄 구현 또는 **`papaparse`**(`delimiter:'\t'`, 서버 전용 가능). 엑셀 **파일 업로드**까지 지원할 때만 **SheetJS `xlsx`**(`.xlsx/.xls/.csv`) 추가. 서버 액션에서만 사용(클라 번들 영향 없음).
2. **`lib/kpass-import.ts`** (신규) — 순수 파싱/매핑 유틸:
   - `parseTsv(text): string[][]` (따옴표·줄바꿈 셀 처리) — 붙여넣기·파일 공통 입력 정규화
   - `mapEvaluatorRows(rows): EvaluatorRow[]`, `mapCriteriaRows(rows): CriterionRow[]`
   - 헤더 **동의어 맵**(예: 성명|위원명|이름 → name; 구분|대분류|평가항목 → section; 배점|점수|만점 → maxScore …) + **헤더 행 자동 감지**(첫 행이 동의어 맵에 매칭되면 헤더로 간주, 아니면 헤더 없는 것으로 처리)
   - username 생성기, type/gradeOptions 추론 헬퍼. 서버 전용.
3. **`app/admin/sessions/actions.ts`** (추가) — 서버 액션 2개:
   - `previewKpassImport(sessionId, formData)` → 붙여넣은 텍스트(또는 파일)만 파싱해 **미리보기 JSON**(위원 n명, 항목 m개, 경고/스킵 목록) 반환. DB 변경 없음.
   - `commitKpassImport(sessionId, formData, opts)` → `prisma.$transaction`으로 위원 upsert(by username) + assignment upsert + criteria 생성. 옵션 `replaceCriteria`(기존 항목 대체) 지원. `revalidatePath` 호출.
4. **`app/admin/sessions/[id]/import/page.tsx`** (신규) — 세션 하위 라우트(기존 criteria/subjects/evaluators와 동일 패턴). 서버 페이지 → 클라 컴포넌트 렌더.
5. **`components/KpassImportForm.tsx`** (신규, client) — 평가위원/평가표 각각 **붙여넣기용 `<textarea>`** (Ctrl+V로 엑셀 셀 그대로) + "헤더 포함" 토글 + 옵션. (선택) 파일 input 보조. `onPaste`로 즉시 또는 `previewKpassImport` 호출 → **미리보기 표** 렌더 → "가져오기" 확정. `SubjectUploadForm`의 `useFormStatus` 로딩 패턴 재사용(용량 가드는 붙여넣기엔 불필요).
6. **`components/AdminSidebar.tsx`** (변경) — 세션 내 메뉴에 "K-PASS 가져오기"(`/admin/sessions/[id]/import`) 항목 추가.

## 흐름
1. 세션 상세 → "K-PASS 가져오기" → 엑셀에서 셀 드래그→복사 → textarea에 **붙여넣기**(또는 파일 선택) → `previewKpassImport`로 파싱 결과·경고 확인
2. 확인 후 "가져오기" → `commitKpassImport`가 위원/배정/항목을 트랜잭션 생성
3. 결과: 평가위원 페이지에 계정·임시비번 표시, 평가 항목 페이지에 항목 생성됨

## 멱등성/중복
- 위원: username 기준 upsert + 배정 upsert(`@@unique`) → 재임포트 안전
- 항목: 자연 키 없음 → 기본은 "추가". `replaceCriteria` 옵션으로 기존 세션 항목 삭제 후 재생성(중복 방지)

## 미해결(샘플 확정 필요)
- 평가위원 엑셀에 **이메일/위원ID** 컬럼 유무(username 키 결정)
- 평가표에 **등급기준(점수)·가중치·평가방식** 컬럼 유무
- 분과 컬럼이 있으면 단순 무시(세션=분과) 또는 검증용으로만 사용

## 검증
1. `npm run build` 통과 (파일 업로드도 지원하면 `npm install xlsx` 후)
2. 엑셀(또는 구글시트)에서 평가위원/평가표 셀 범위 드래그→복사 → 로컬 dev admin 로그인 → 세션 상세 "K-PASS 가져오기" textarea에 붙여넣기 → 미리보기 카운트 확인
3. 가져오기 실행 → `/admin/evaluators`·세션 평가위원 페이지에 위원·임시비번/배정 생성, `/admin/sessions/[id]/criteria`에 항목 생성 확인
4. 동일 내용 재임포트 → 위원/배정 중복 없음(멱등), `replaceCriteria` 동작 확인
5. 헤더 포함/미포함 붙여넣기 둘 다, **줄바꿈 포함 셀**(등급기준 설명) 붙여넣기 → 행 깨짐 없이 파싱되는지 확인
6. 잘못된 헤더/빈 입력 → 친절한 오류·스킵 메시지
