"use client";

import { type FormEvent, type ReactNode, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGroup,
  updateGroup,
  deleteGroup,
  addSubitemWithCriterion,
  updateSubitem,
  deleteSubitem,
  addCriterion,
  updateCriterion,
  deleteCriterion,
  updateProjectMaxScore,
} from "@/app/admin/sessions/actions";
import { groupTotal, isGroupBalanced, criteriaGrandTotal, isTotalValid } from "@/lib/criteria";
import { TrashIcon, PencilIcon, PlusIcon } from "@/components/icons";
import {
  optReducer,
  type LeafDTO,
  type SubitemDTO,
  type GroupDTO,
  type OptAction,
} from "@/components/criteria-editor-model";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const inputCls =
  "rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const miniBtn =
  "rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50";
const okBtn =
  "rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40";
const addBtn =
  "inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100";
// 리스트 마지막 아이템의 아이콘 줄에 붙는 작은 추가(+) 버튼 — 편집/삭제 아이콘과 동일한 크기·톤
const plusBtn =
  "rounded p-1 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600";

type RunFn = (fn: () => Promise<void>) => void;
type AddFn = (id: string, fd: FormData) => void;

// 열 구조: 평가항목 · 세부항목 · 평가지표 · 배점 (4칸).
// 삭제는 각 항목의 편집(연필) 아이콘 옆에 인라인으로 배치되어 전용 "삭제" 열이 불필요.
const COL_COUNT = 4;

// 추가 입력 모달 — 제출 시 즉시 닫히고(urgent), onSubmit(낙관적+서버)만 transition으로.
function AddModal({
  title,
  pending,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  children: ReactNode;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onClose(); // 입력창 즉시 닫기
    onSubmit(fd);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {children}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={miniBtn}>취소</button>
          <button
            disabled={pending}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40"
          >
            추가
          </button>
        </div>
      </form>
    </div>
  );
}

// 평가항목은 과제(Project) 단위 — 관리자가 과제 평가항목 페이지에서 편집한다.
export default function CriteriaEditor({
  projectId,
  groups,
  maxScore,
}: {
  projectId: string;
  groups: GroupDTO[];
  maxScore: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addingGroup, setAddingGroup] = useState(false);
  const [maxInput, setMaxInput] = useState(String(maxScore));
  const [optimisticGroups, applyOptimistic] = useOptimistic<GroupDTO[], OptAction>(groups, optReducer);
  const tmpRef = useRef(0);
  const nextTmp = () => `tmp-${tmpRef.current++}`;

  const parsedMax = Math.round(Number(maxInput));
  const maxValid = Number.isFinite(parsedMax) && parsedMax > 0;
  const maxDirty = maxValid && parsedMax !== maxScore;
  const saveMax = () => {
    if (!maxDirty) return;
    start(async () => {
      await updateProjectMaxScore(projectId, parsedMax);
      router.refresh();
    });
  };

  const run: RunFn = (fn) => {
    start(async () => {
      await fn();
      router.refresh();
    });
  };

  const submitAddGroup = (fd: FormData) => {
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    const maxScore = Number(fd.get("maxScore") ?? 0) || 0;
    start(async () => {
      applyOptimistic({ kind: "group", id: nextTmp(), name, maxScore });
      await addGroup(projectId, fd);
      router.refresh();
    });
  };

  // 세부항목 + 첫 평가지표를 세트로 추가(낙관적: 세부항목 → 평가지표 순으로 즉시 삽입)
  const addSubitemOpt: AddFn = (groupId, fd) => {
    const name = String(fd.get("name") ?? "").trim();
    const criterionName = String(fd.get("criterionName") ?? "").trim();
    if (!name || !criterionName) return;
    const maxScore = Number(fd.get("maxScore") ?? 0) || 0;
    start(async () => {
      const tmpSub = nextTmp();
      applyOptimistic({ kind: "subitem", id: tmpSub, groupId, name });
      applyOptimistic({ kind: "criterion", id: nextTmp(), subitemId: tmpSub, name: criterionName, maxScore });
      await addSubitemWithCriterion(groupId, fd);
      router.refresh();
    });
  };

  const addCriterionOpt: AddFn = (subitemId, fd) => {
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    const maxScore = Number(fd.get("maxScore") ?? 0) || 0;
    start(async () => {
      applyOptimistic({ kind: "criterion", id: nextTmp(), subitemId, name, maxScore });
      await addCriterion(subitemId, fd);
      router.refresh();
    });
  };

  const grandTotal = criteriaGrandTotal(optimisticGroups);
  const totalValid = isTotalValid(grandTotal, maxScore); // 배점 합계 == 기준 만점(strict)
  const diff = grandTotal - maxScore; // >0: 초과, <0: 부족 (둘 다 오류)
  // 일치 시엔 뉴트럴(흰 배경)로 두고 확인 문구만 은은하게 — 화면 메인 컬러와의 조화 우선.
  // 불일치만 앰버(주의) 톤으로 드러낸다.
  const tone = totalValid
    ? "border-slate-200 bg-white text-slate-700"
    : "border-amber-300 bg-amber-50 text-amber-700";

  return (
    <div className="space-y-4">
      {/* 배점 합계는 기준 만점과 정확히 일치해야 함(초과 불가) */}
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-2.5 text-sm ${tone}`}>
        <span className="font-semibold">
          총 배점 합계 {fmt(grandTotal)} / {fmt(maxScore)}
          <span className={`ml-1 text-xs font-medium ${totalValid ? "text-emerald-600" : ""}`}>
            {totalValid
              ? "✓ 기준 만점과 일치"
              : `⚠ 기준 만점과 같아야 합니다 — ${diff > 0 ? `${fmt(diff)}점 초과` : `${fmt(-diff)}점 부족`}`}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">기준 만점</label>
          <input
            type="number"
            min={1}
            step={1}
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button type="button" onClick={saveMax} disabled={pending || !maxDirty} className={okBtn}>
            적용
          </button>
        </span>
      </div>
      <p className="-mt-2 px-1 text-xs text-slate-400">
        배점 합계는 <span className="font-medium text-slate-500">기준 만점 {fmt(maxScore)}점</span>과 정확히 일치해야 합니다. 집계 결과의 환산·등급이 이 만점을 기준으로 계산됩니다.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 font-medium">평가항목</th>
              <th className="px-4 py-2.5 font-medium">세부항목</th>
              <th className="px-4 py-2.5 font-medium">평가지표</th>
              <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">배점</th>
            </tr>
          </thead>
          <tbody>
            {optimisticGroups.map((g, idx) => (
              <GroupBlock
                key={g.id}
                group={g}
                isLastGroup={idx === optimisticGroups.length - 1}
                run={run}
                pending={pending}
                onAddGroup={() => setAddingGroup(true)}
                onAddSubitem={addSubitemOpt}
                onAddCriterion={addCriterionOpt}
              />
            ))}
            {optimisticGroups.length === 0 && (
              <tr>
                <td colSpan={COL_COUNT} className="px-4 py-8 text-center text-slate-400">
                  <p className="mb-3">등록된 평가항목이 없습니다.</p>
                  <button type="button" onClick={() => setAddingGroup(true)} className={addBtn}>
                    + 평가항목 추가
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addingGroup && (
        <AddModal title="평가항목 추가" pending={pending} onClose={() => setAddingGroup(false)} onSubmit={submitAddGroup}>
          <label className="block text-xs text-slate-500">
            평가항목명
            <input name="name" required placeholder="예: 사업계획" className={`mt-1 w-full ${inputCls}`} autoFocus />
          </label>
          <label className="block text-xs text-slate-500">
            목표배점
            <input name="maxScore" type="number" step="any" defaultValue={0} className={`mt-1 w-full ${inputCls}`} />
          </label>
        </AddModal>
      )}
    </div>
  );
}

// 한 평가항목(그룹)의 모든 행. 열 구조는 항상 4칸(평가항목·세부항목·평가지표·배점)으로 고정.
// 추가 트리거는 각 리스트 마지막 아이템의 아이콘 줄에 있는 +버튼(그룹/세부항목/평가지표 각각) — 전용 추가 행은 없음.
function GroupBlock({
  group,
  isLastGroup,
  run,
  pending,
  onAddGroup,
  onAddSubitem,
  onAddCriterion,
}: {
  group: GroupDTO;
  isLastGroup: boolean;
  run: RunFn;
  pending: boolean;
  onAddGroup: () => void;
  onAddSubitem: AddFn;
  onAddCriterion: AddFn;
}) {
  // 세부항목 1개가 차지하는 행 수 = 평가지표 개수(0이면 1행으로 자기 자신만 표시)
  const subBlock = (s: SubitemDTO) => Math.max(s.criteria.length, 1);
  const groupRowSpan = group.subitems.length === 0 ? 1 : group.subitems.reduce((n, s) => n + subBlock(s), 0);

  const rows: React.ReactNode[] = [];
  let groupPlaced = false;
  const placeGroup = (cells: React.ReactNode[]) => {
    if (!groupPlaced) {
      cells.push(
        <GroupNameCell
          key="g"
          group={group}
          rowSpan={groupRowSpan}
          run={run}
          pending={pending}
          isLastGroup={isLastGroup}
          onAddGroup={onAddGroup}
          onAddSubitem={onAddSubitem}
        />,
      );
      groupPlaced = true;
    }
  };

  if (group.subitems.length === 0) {
    // 세부항목이 하나도 없는 그룹 — 그룹 셀만 있는 빈 행 1개("+ 세부항목"은 GroupNameCell 안에 표시)
    const cells: React.ReactNode[] = [];
    placeGroup(cells);
    cells.push(<td key="s" className="border-r border-slate-100 px-4 py-2" />);
    cells.push(<td key="c" className="px-4 py-2" />);
    cells.push(<td key="m" className="px-4 py-2" />);
    rows.push(<tr key={`${group.id}-empty`} className="border-b border-slate-100 last:border-0">{cells}</tr>);
    return <>{rows}</>;
  }

  group.subitems.forEach((s, sIdx) => {
    const isLastSubitem = sIdx === group.subitems.length - 1;
    const subRowSpan = subBlock(s);

    if (s.criteria.length === 0) {
      // 평가지표가 하나도 없는 세부항목 — 세부항목 셀만 있는 빈 행 1개("+ 평가지표"는 SubitemNameCell 안에 표시)
      const cells: React.ReactNode[] = [];
      placeGroup(cells);
      cells.push(
        <SubitemNameCell
          key="s"
          subitem={s}
          rowSpan={subRowSpan}
          run={run}
          pending={pending}
          groupId={group.id}
          isLastSubitem={isLastSubitem}
          onAddSubitem={onAddSubitem}
          onAddCriterion={onAddCriterion}
        />,
      );
      cells.push(<td key="c" className="px-4 py-2" />);
      cells.push(<td key="m" className="px-4 py-2" />);
      rows.push(<tr key={`${s.id}-empty`} className="border-b border-slate-100">{cells}</tr>);
      return;
    }

    s.criteria.forEach((c, cIdx) => {
      const isLastCriterion = cIdx === s.criteria.length - 1;
      const cells: React.ReactNode[] = [];
      placeGroup(cells);
      if (cIdx === 0) {
        cells.push(
          <SubitemNameCell
            key="s"
            subitem={s}
            rowSpan={subRowSpan}
            run={run}
            pending={pending}
            groupId={group.id}
            isLastSubitem={isLastSubitem}
            onAddSubitem={onAddSubitem}
            onAddCriterion={onAddCriterion}
          />,
        );
      }
      cells.push(
        <CriterionRowCells
          key="cr"
          criterion={c}
          run={run}
          pending={pending}
          subitemId={s.id}
          isLastCriterion={isLastCriterion}
          onAddCriterion={onAddCriterion}
        />,
      );
      rows.push(<tr key={c.id} className="border-b border-slate-100 last:border-0">{cells}</tr>);
    });
  });

  return <>{rows}</>;
}

function GroupNameCell({
  group,
  rowSpan,
  run,
  pending,
  isLastGroup,
  onAddGroup,
  onAddSubitem,
}: {
  group: GroupDTO;
  rowSpan: number;
  run: RunFn;
  pending: boolean;
  isLastGroup: boolean;
  onAddGroup: () => void;
  onAddSubitem: AddFn;
}) {
  const [editing, setEditing] = useState(false);
  const [addingSubitem, setAddingSubitem] = useState(false);
  const total = groupTotal(group.subitems.flatMap((s) => s.criteria));
  const balanced = isGroupBalanced(group.maxScore, total);
  const showAddSubitem = group.subitems.length === 0;

  const submit = (fd: FormData) =>
    run(async () => {
      await updateGroup(group.id, fd);
      setEditing(false);
    });
  const onDelete = () => {
    if (!confirm(`'${group.name}' 평가항목과 하위 세부항목·평가지표를 모두 삭제할까요?`)) return;
    run(() => deleteGroup(group.id));
  };

  return (
    <td rowSpan={rowSpan} className="border-r border-slate-100 px-4 py-3 align-top">
      {editing ? (
        <form action={submit} className="flex flex-col gap-2">
          <input name="name" defaultValue={group.name} className={inputCls} autoFocus />
          <label className="flex items-center gap-1 text-xs text-slate-500">
            목표배점
            <input name="maxScore" type="number" step="any" defaultValue={group.maxScore} className={`w-24 ${inputCls}`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className={miniBtn}>취소</button>
            <button disabled={pending} className={okBtn}>저장</button>
          </div>
        </form>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-800">{group.name}</span>
            <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" title="수정" aria-label="평가항목 수정">
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={onDelete} className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="평가항목 삭제" aria-label="평가항목 삭제">
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
            {showAddSubitem && (
              <button type="button" onClick={() => setAddingSubitem(true)} className={plusBtn} title="세부항목 추가" aria-label="세부항목 추가">
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {isLastGroup && (
              <button type="button" onClick={onAddGroup} className={plusBtn} title="평가항목 추가" aria-label="평가항목 추가">
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="text-xs text-slate-400">
            합계 {total} / 목표 {group.maxScore}
            {!balanced && <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-600">⚠ 불일치</span>}
          </div>
        </div>
      )}
      {addingSubitem && (
        <AddModal title="세부항목·평가지표 추가" pending={pending} onClose={() => setAddingSubitem(false)} onSubmit={(fd) => onAddSubitem(group.id, fd)}>
          <SubitemWithCriterionFields />
        </AddModal>
      )}
    </td>
  );
}

// 세부항목 + 첫 평가지표를 함께 입력하는 폼 필드(세트 추가 공용)
function SubitemWithCriterionFields() {
  return (
    <>
      <label className="block text-xs text-slate-500">
        세부항목명
        <input name="name" required placeholder="예: 목표 및 내용" className={`mt-1 w-full ${inputCls}`} autoFocus />
      </label>
      <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
        <div className="mb-1.5 text-[11px] font-medium text-slate-500">첫 평가지표</div>
        <label className="block text-xs text-slate-500">
          평가지표명
          <input name="criterionName" required placeholder="예: 사업 타당성" className={`mt-1 w-full ${inputCls}`} />
        </label>
        <label className="mt-2 block text-xs text-slate-500">
          배점
          <input name="maxScore" type="number" step="any" defaultValue={0} className={`mt-1 w-full ${inputCls}`} />
        </label>
      </div>
    </>
  );
}

function SubitemNameCell({
  subitem,
  rowSpan,
  run,
  pending,
  groupId,
  isLastSubitem,
  onAddSubitem,
  onAddCriterion,
}: {
  subitem: SubitemDTO;
  rowSpan: number;
  run: RunFn;
  pending: boolean;
  groupId: string;
  isLastSubitem: boolean;
  onAddSubitem: AddFn;
  onAddCriterion: AddFn;
}) {
  const [editing, setEditing] = useState(false);
  const [addingSubitem, setAddingSubitem] = useState(false);
  const [addingCriterion, setAddingCriterion] = useState(false);
  const showAddCriterion = subitem.criteria.length === 0;

  const submit = (fd: FormData) =>
    run(async () => {
      await updateSubitem(subitem.id, fd);
      setEditing(false);
    });
  const onDelete = () => {
    if (!confirm(`'${subitem.name}' 세부항목과 하위 평가지표를 모두 삭제할까요?`)) return;
    run(() => deleteSubitem(subitem.id));
  };
  return (
    <td rowSpan={rowSpan} className="border-r border-slate-100 px-4 py-3 align-top">
      {editing ? (
        <form action={submit} className="flex flex-col gap-2">
          <input name="name" defaultValue={subitem.name} className={inputCls} autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className={miniBtn}>취소</button>
            <button disabled={pending} className={okBtn}>저장</button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-700">{subitem.name}</span>
          <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" title="수정" aria-label="세부항목 수정">
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="세부항목 삭제" aria-label="세부항목 삭제">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
          {/* 세부항목 +버튼은 하나만: 비어있으면 첫 평가지표 추가, 아니면 새 세부항목(+평가지표) 세트 추가 */}
          {showAddCriterion ? (
            <button type="button" onClick={() => setAddingCriterion(true)} className={plusBtn} title="평가지표 추가" aria-label="평가지표 추가">
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          ) : isLastSubitem ? (
            <button type="button" onClick={() => setAddingSubitem(true)} className={plusBtn} title="세부항목·평가지표 추가" aria-label="세부항목·평가지표 추가">
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      )}
      {addingCriterion && (
        <AddModal title="평가지표 추가" pending={pending} onClose={() => setAddingCriterion(false)} onSubmit={(fd) => onAddCriterion(subitem.id, fd)}>
          <label className="block text-xs text-slate-500">
            평가지표명
            <input name="name" required placeholder="예: 사업 타당성" className={`mt-1 w-full ${inputCls}`} autoFocus />
          </label>
          <label className="block text-xs text-slate-500">
            배점
            <input name="maxScore" type="number" step="any" defaultValue={0} className={`mt-1 w-full ${inputCls}`} />
          </label>
        </AddModal>
      )}
      {addingSubitem && (
        <AddModal title="세부항목·평가지표 추가" pending={pending} onClose={() => setAddingSubitem(false)} onSubmit={(fd) => onAddSubitem(groupId, fd)}>
          <SubitemWithCriterionFields />
        </AddModal>
      )}
    </td>
  );
}

// 평가지표 편집은 이름·배점이 서로 다른 열(td)에 있어 <form>으로 감쌀 수 없으므로,
// 제어 입력 + 버튼 클릭 시 FormData를 구성해 액션을 호출한다(항상 2칸 고정: 이름/배점).
function CriterionRowCells({
  criterion,
  run,
  pending,
  subitemId,
  isLastCriterion,
  onAddCriterion,
}: {
  criterion: LeafDTO;
  run: RunFn;
  pending: boolean;
  subitemId: string;
  isLastCriterion: boolean;
  onAddCriterion: AddFn;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(criterion.name);
  const [score, setScore] = useState(String(criterion.maxScore));

  const save = () => {
    const fd = new FormData();
    fd.set("name", name);
    fd.set("maxScore", score);
    run(async () => {
      await updateCriterion(criterion.id, fd);
      setEditing(false);
    });
  };
  const cancel = () => {
    setName(criterion.name);
    setScore(String(criterion.maxScore));
    setEditing(false);
  };
  const onDelete = () => {
    if (!confirm(`'${criterion.name}' 평가지표를 삭제할까요?`)) return;
    run(() => deleteCriterion(criterion.id));
  };

  if (editing) {
    return (
      <>
        <td className="px-4 py-3 align-top">
          <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full ${inputCls}`} autoFocus />
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={cancel} className={miniBtn}>취소</button>
            <button type="button" onClick={save} disabled={pending} className={okBtn}>저장</button>
          </div>
        </td>
        <td className="px-4 py-3 text-right align-top">
          <input type="number" step="any" value={score} onChange={(e) => setScore(e.target.value)} className={`w-20 text-right ${inputCls}`} />
        </td>
      </>
    );
  }

  return (
    <>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-700">{criterion.name}</span>
          <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600" title="수정" aria-label="평가지표 수정">
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="평가지표 삭제" aria-label="평가지표 삭제">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
          {isLastCriterion && (
            <button type="button" onClick={() => setAdding(true)} className={plusBtn} title="평가지표 추가" aria-label="평가지표 추가">
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {adding && (
          <AddModal title="평가지표 추가" pending={pending} onClose={() => setAdding(false)} onSubmit={(fd) => onAddCriterion(subitemId, fd)}>
            <label className="block text-xs text-slate-500">
              평가지표명
              <input name="name" required placeholder="예: 사업 타당성" className={`mt-1 w-full ${inputCls}`} autoFocus />
            </label>
            <label className="block text-xs text-slate-500">
              배점
              <input name="maxScore" type="number" step="any" defaultValue={0} className={`mt-1 w-full ${inputCls}`} />
            </label>
          </AddModal>
        )}
      </td>
      <td className="px-4 py-3 text-right align-top font-semibold tabular-nums text-slate-800">{criterion.maxScore}</td>
    </>
  );
}
