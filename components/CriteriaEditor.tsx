"use client";

import { type FormEvent, type ReactNode, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGroup,
  updateGroup,
  deleteGroup,
  addSubitem,
  updateSubitem,
  deleteSubitem,
  addCriterion,
  updateCriterion,
  deleteCriterion,
  updateSessionMaxScore,
} from "@/app/admin/sessions/actions";
import { groupTotal, isGroupBalanced, criteriaGrandTotal } from "@/lib/criteria";
import { TrashIcon, PencilIcon } from "@/components/icons";
import CriteriaPreviewTable from "@/components/CriteriaPreviewTable";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const inputCls =
  "rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const miniBtn =
  "rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-50";
const okBtn =
  "rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40";
const addBtn =
  "inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100";

type LeafDTO = { id: string; name: string; maxScore: number };
type SubitemDTO = { id: string; name: string; criteria: LeafDTO[] };
type GroupDTO = { id: string; name: string; maxScore: number; subitems: SubitemDTO[] };

type RunFn = (fn: () => Promise<void>) => void;
type AddFn = (id: string, fd: FormData) => void;

// 추가(그룹·세부항목·평가지표) 낙관적 업데이트 — 임시 id로 즉시 삽입, 서버 확정 후 revalidate로 교체
type OptAction =
  | { kind: "group"; id: string; name: string; maxScore: number }
  | { kind: "subitem"; id: string; groupId: string; name: string }
  | { kind: "criterion"; id: string; subitemId: string; name: string; maxScore: number };

export function optReducer(state: GroupDTO[], a: OptAction): GroupDTO[] {
  if (a.kind === "group") {
    return [...state, { id: a.id, name: a.name, maxScore: a.maxScore, subitems: [] }];
  }
  if (a.kind === "subitem") {
    return state.map((g) =>
      g.id === a.groupId ? { ...g, subitems: [...g.subitems, { id: a.id, name: a.name, criteria: [] }] } : g,
    );
  }
  return state.map((g) => ({
    ...g,
    subitems: g.subitems.map((s) =>
      s.id === a.subitemId ? { ...s, criteria: [...s.criteria, { id: a.id, name: a.name, maxScore: a.maxScore }] } : s,
    ),
  }));
}

const COL_COUNT = 5;

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

export default function CriteriaEditor({
  sessionId,
  groups,
  maxScore,
}: {
  sessionId: string;
  groups: GroupDTO[];
  maxScore: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(false);
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
      await updateSessionMaxScore(sessionId, parsedMax);
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
      await addGroup(sessionId, fd);
      router.refresh();
    });
  };

  const addSubitemOpt: AddFn = (groupId, fd) => {
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    start(async () => {
      applyOptimistic({ kind: "subitem", id: nextTmp(), groupId, name });
      await addSubitem(groupId, fd);
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
  const diff = grandTotal - maxScore; // >0: 가점(만점 초과), <0: 부족, 0: 일치
  const shortfall = diff < 0; // 만점보다 배점 합계가 적음 → 대개 실수
  const tone = shortfall
    ? "border-amber-300 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="space-y-4">
      {/* 기준 만점(집계 환산 분모) — 배점 합계와 별개로 관리(가점 대응) */}
      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-2.5 text-sm ${tone}`}>
        <span className="font-semibold">
          총 배점 합계 {fmt(grandTotal)}
          {diff !== 0 && (
            <span className="ml-1 text-xs font-medium">
              {diff > 0 ? `· 가점 +${fmt(diff)}점 (만점 초과 허용)` : `· 기준 만점보다 ${fmt(-diff)}점 부족`}
            </span>
          )}
          {diff === 0 && <span className="ml-1 text-xs font-medium">✓ 기준 만점과 일치</span>}
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
        집계 결과의 환산·등급은 <span className="font-medium text-slate-500">기준 만점 {fmt(maxScore)}점</span>을 기준으로 계산됩니다. 가점이 있으면 배점 합계가 만점을 넘어 100% 초과 점수가 나올 수 있습니다.
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          {preview ? "편집" : "미리보기"}
        </button>
      </div>

      {preview ? (
        <CriteriaPreviewTable groups={optimisticGroups} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 font-medium">평가항목</th>
                <th className="px-4 py-2.5 font-medium">세부항목</th>
                <th className="px-4 py-2.5 font-medium">평가지표</th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">배점</th>
                <th className="w-px whitespace-nowrap px-4 py-2.5 text-right font-medium">삭제</th>
              </tr>
            </thead>
            <tbody>
              {optimisticGroups.map((g) => (
                <GroupBlock
                  key={g.id}
                  group={g}
                  run={run}
                  pending={pending}
                  onAddSubitem={addSubitemOpt}
                  onAddCriterion={addCriterionOpt}
                />
              ))}
              {optimisticGroups.length === 0 && (
                <tr>
                  <td colSpan={COL_COUNT} className="px-4 py-8 text-center text-slate-400">
                    등록된 평가항목이 없습니다. 아래 버튼으로 시작하세요.
                  </td>
                </tr>
              )}
              <tr className="border-t border-slate-100 bg-slate-50/40">
                <td colSpan={COL_COUNT} className="px-4 py-2.5">
                  <button type="button" onClick={() => setAddingGroup(true)} className={addBtn}>
                    + 평가항목 추가
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

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

// 한 평가항목(그룹)의 모든 행. 열 구조는 항상 5칸(평가항목·세부항목·평가지표·배점·삭제)으로 고정.
// 세부항목 열 하단에 '+ 세부항목' 추가 행, 각 세부항목의 평가지표 열 하단에 '+ 평가지표' 추가 행.
function GroupBlock({
  group,
  run,
  pending,
  onAddSubitem,
  onAddCriterion,
}: {
  group: GroupDTO;
  run: RunFn;
  pending: boolean;
  onAddSubitem: AddFn;
  onAddCriterion: AddFn;
}) {
  // 세부항목 블록 = 평가지표 행 수 + '+ 평가지표' 추가 행 1개. 그룹 = 세부항목 블록 합 + '+ 세부항목' 추가 행 1개.
  const subBlock = (s: SubitemDTO) => s.criteria.length + 1;
  const groupRowSpan = group.subitems.reduce((n, s) => n + subBlock(s), 0) + 1;

  const rows: React.ReactNode[] = [];
  let groupPlaced = false;
  const placeGroup = (cells: React.ReactNode[]) => {
    if (!groupPlaced) {
      cells.push(<GroupNameCell key="g" group={group} rowSpan={groupRowSpan} run={run} pending={pending} />);
      groupPlaced = true;
    }
  };

  group.subitems.forEach((s) => {
    const subRowSpan = subBlock(s);
    // 평가지표 행들
    s.criteria.forEach((c, cIdx) => {
      const cells: React.ReactNode[] = [];
      placeGroup(cells);
      if (cIdx === 0) cells.push(<SubitemNameCell key="s" subitem={s} rowSpan={subRowSpan} run={run} pending={pending} />);
      cells.push(<CriterionRowCells key="cr" criterion={c} run={run} pending={pending} />);
      rows.push(<tr key={c.id} className="border-b border-slate-100">{cells}</tr>);
    });
    // '+ 평가지표' 추가 행 (평가지표 열)
    const addCells: React.ReactNode[] = [];
    placeGroup(addCells);
    if (s.criteria.length === 0) addCells.push(<SubitemNameCell key="s" subitem={s} rowSpan={subRowSpan} run={run} pending={pending} />);
    addCells.push(
      <AddCriterionCell key="ac" subitemId={s.id} pending={pending} onAdd={onAddCriterion} />,
      <td key="m" className="px-4 py-2" />,
      <td key="del" className="px-4 py-2" />,
    );
    rows.push(<tr key={`${s.id}-add`} className="border-b border-slate-100 bg-slate-50/30">{addCells}</tr>);
  });

  // '+ 세부항목' 추가 행 (세부항목 열)
  const subAddCells: React.ReactNode[] = [];
  placeGroup(subAddCells);
  subAddCells.push(
    <AddSubitemCell key="asu" groupId={group.id} pending={pending} onAdd={onAddSubitem} />,
    <td key="ci" className="px-4 py-2" />,
    <td key="m" className="px-4 py-2" />,
    <td key="del" className="px-4 py-2" />,
  );
  rows.push(<tr key={`${group.id}-addsub`} className="border-b border-slate-100 bg-slate-50/30 last:border-0">{subAddCells}</tr>);

  return <>{rows}</>;
}

function AddSubitemCell({ groupId, pending, onAdd }: { groupId: string; pending: boolean; onAdd: AddFn }) {
  const [adding, setAdding] = useState(false);
  return (
    <td className="border-r border-slate-100 px-4 py-2 align-top">
      <button type="button" onClick={() => setAdding(true)} className={addBtn}>+ 세부항목</button>
      {adding && (
        <AddModal title="세부항목 추가" pending={pending} onClose={() => setAdding(false)} onSubmit={(fd) => onAdd(groupId, fd)}>
          <label className="block text-xs text-slate-500">
            세부항목명
            <input name="name" required placeholder="예: 목표 및 내용" className={`mt-1 w-full ${inputCls}`} autoFocus />
          </label>
        </AddModal>
      )}
    </td>
  );
}

function AddCriterionCell({ subitemId, pending, onAdd }: { subitemId: string; pending: boolean; onAdd: AddFn }) {
  const [adding, setAdding] = useState(false);
  return (
    <td className="px-4 py-2 align-top">
      <button type="button" onClick={() => setAdding(true)} className={addBtn}>+ 평가지표</button>
      {adding && (
        <AddModal title="평가지표 추가" pending={pending} onClose={() => setAdding(false)} onSubmit={(fd) => onAdd(subitemId, fd)}>
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
  );
}

function GroupNameCell({
  group,
  rowSpan,
  run,
  pending,
}: {
  group: GroupDTO;
  rowSpan: number;
  run: RunFn;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const total = groupTotal(group.subitems.flatMap((s) => s.criteria));
  const balanced = isGroupBalanced(group.maxScore, total);

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
          </div>
          <div className="text-xs text-slate-400">
            합계 {total} / 목표 {group.maxScore}
            {!balanced && <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-600">⚠ 불일치</span>}
          </div>
        </div>
      )}
    </td>
  );
}

function SubitemNameCell({
  subitem,
  rowSpan,
  run,
  pending,
}: {
  subitem: SubitemDTO;
  rowSpan: number;
  run: RunFn;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
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
        </div>
      )}
    </td>
  );
}

// 평가지표 편집은 이름·배점이 서로 다른 열(td)에 있어 <form>으로 감쌀 수 없으므로,
// 제어 입력 + 버튼 클릭 시 FormData를 구성해 액션을 호출한다(항상 3칸 고정).
function CriterionRowCells({
  criterion,
  run,
  pending,
}: {
  criterion: LeafDTO;
  run: RunFn;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
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
        <td className="px-4 py-3">
          <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full ${inputCls}`} autoFocus />
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={cancel} className={miniBtn}>취소</button>
            <button type="button" onClick={save} disabled={pending} className={okBtn}>저장</button>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <input type="number" step="any" value={score} onChange={(e) => setScore(e.target.value)} className={`w-20 text-right ${inputCls}`} />
        </td>
        <td className="px-4 py-3" />
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
        </div>
      </td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{criterion.maxScore}</td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={onDelete} className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="평가지표 삭제" aria-label="평가지표 삭제">
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      </td>
    </>
  );
}
