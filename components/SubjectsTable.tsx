"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editSubject, deleteSubject, deleteSubjectDocument } from "@/app/admin/sessions/actions";
import SubjectUploadForm from "@/components/SubjectUploadForm";

export type SubjectRow = {
  id: string;
  companyId: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  businessNo: string | null;
  region: string | null;
  leadResearcher: string | null;
  description: string | null;
  documents: { id: string; originalName: string; size: number }[];
};

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 평가 대상 상태 — 텍스트만(대기=회색, 승인=검정, 반려=빨강)
function StatusText({ status }: { status: SubjectRow["status"] }) {
  const map = {
    PENDING: { label: "대기", cls: "text-slate-500" },
    APPROVED: { label: "승인", cls: "font-semibold text-slate-900" },
    REJECTED: { label: "반려", cls: "text-rose-600" },
  } as const;
  const s = map[status];
  return <span className={`text-xs whitespace-nowrap ${s.cls}`}>{s.label}</span>;
}

// 담당자의 평가 대상 목록 — 체크박스 상시 + 하단 '평가 대상 정보 변경'(수정·삭제 통합).
// 서류(문서) 관리는 행별 '서류' 버튼 모달에서. 편집은 canEdit(작성/반려)일 때만.
export default function SubjectsTable({
  sessionId,
  subjects,
  canEdit,
}: {
  sessionId: string;
  subjects: SubjectRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manageOpen, setManageOpen] = useState(false);
  const [docRow, setDocRow] = useState<SubjectRow | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = subjects.length > 0 && selected.size === subjects.length;
  const toggleAll = () =>
    setSelected((prev) => (prev.size === subjects.length ? new Set() : new Set(subjects.map((s) => s.id))));

  const removeDoc = (docId: string) => {
    start(async () => {
      await deleteSubjectDocument(sessionId, docId);
      router.refresh();
    });
  };

  const selectedSubjects = subjects.filter((s) => selected.has(s.id));
  const curDoc = docRow ? subjects.find((s) => s.id === docRow.id) ?? docRow : null;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {subjects.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">
            편입된 평가 대상이 없습니다.{canEdit && " 위에서 기업을 추가하세요."}
          </p>
        ) : (
          <table className="table-grid w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b border-slate-100 bg-slate-50/60">
                {canEdit && (
                  <th className="w-12 px-5 py-2.5">
                    <button type="button" onClick={toggleAll} aria-label="전체 선택">
                      <PrettyCheck checked={allChecked} />
                    </button>
                  </th>
                )}
                <th className="w-12 px-5 py-2.5 font-medium">번호</th>
                <th className="px-5 py-2.5 font-medium">기업명</th>
                <th className="px-5 py-2.5 font-medium">사업자번호</th>
                <th className="px-5 py-2.5 font-medium">지역</th>
                <th className="px-5 py-2.5 font-medium">연구책임자</th>
                <th className="px-5 py-2.5 font-medium">서류</th>
                <th className="px-5 py-2.5 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={canEdit ? () => toggle(s.id) : undefined}
                  className={`border-b border-slate-50 last:border-0 ${
                    canEdit ? `cursor-pointer ${selected.has(s.id) ? "bg-indigo-50" : "hover:bg-slate-50/60"}` : "hover:bg-slate-50/60"
                  }`}
                >
                  {canEdit && (
                    <td className="px-5 py-2.5">
                      <PrettyCheck checked={selected.has(s.id)} />
                    </td>
                  )}
                  <td className="px-5 py-2.5 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{s.name}</td>
                  <td className="px-5 py-2.5 text-slate-600">
                    {s.businessNo ?? <span className="text-slate-300">미등록</span>}
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">
                    {s.region ?? <span className="text-slate-300">미등록</span>}
                  </td>
                  <td className="px-5 py-2.5 text-slate-600">
                    {s.leadResearcher ?? <span className="text-slate-300">미등록</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocRow(s);
                      }}
                      className="text-xs font-medium whitespace-nowrap text-slate-600 transition hover:text-indigo-700 hover:underline"
                    >
                      {canEdit ? "관리" : "보기"} ({s.documents.length})
                    </button>
                  </td>
                  <td className="px-5 py-2.5">
                    <StatusText status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 표 밖 오른쪽: 선택 후 '평가 대상 정보 변경'(수정·삭제 통합) */}
      {canEdit && subjects.length > 0 && (
        <div className="flex items-center justify-end gap-2">
          {selected.size > 0 && <span className="mr-auto text-sm text-slate-500">{selected.size}개 선택됨</span>}
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => setManageOpen(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            평가 대상 정보 변경
          </button>
        </div>
      )}

      {manageOpen && (
        <ManageSubjectsModal
          sessionId={sessionId}
          subjects={selectedSubjects}
          onClose={() => setManageOpen(false)}
          onDone={() => {
            setManageOpen(false);
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}

      {/* 서류 모달 */}
      {curDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/30 p-4" onClick={() => setDocRow(null)}>
          <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-lg space-y-3 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-slate-800">{curDoc.name} — 분과 서류</h3>
              <button type="button" onClick={() => setDocRow(null)} className="text-slate-400 hover:text-slate-600" aria-label="닫기">✕</button>
            </div>
            <ul className="space-y-1">
              {curDoc.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <a href={`/viewer/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
                    <span>📄</span>
                    <span>{d.originalName}</span>
                    <span className="text-xs text-slate-400">{formatSize(d.size)}</span>
                  </a>
                  {canEdit && (
                    <button type="button" onClick={() => removeDoc(d.id)} disabled={pending} className="ml-2 shrink-0 text-xs text-slate-400 hover:text-rose-600 hover:underline disabled:opacity-50">
                      삭제
                    </button>
                  )}
                </li>
              ))}
              {curDoc.documents.length === 0 && (
                <li className="text-sm text-slate-400">등록된 자료가 없습니다.{canEdit && " 아래에서 업로드하세요."}</li>
              )}
            </ul>
            {canEdit && <SubjectUploadForm sessionId={sessionId} companyId={curDoc.companyId} />}
          </div>
        </div>
      )}
    </div>
  );
}

// 평가 대상 정보 변경 모달 — 1개 선택 시 정보 수정 + 삭제, 여러 개면 삭제만.
function ManageSubjectsModal({
  sessionId,
  subjects,
  onClose,
  onDone,
}: {
  sessionId: string;
  subjects: SubjectRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const single = subjects.length === 1 ? subjects[0] : null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();

  const save = (fd: FormData) => {
    if (!single) return;
    start(async () => {
      await editSubject(sessionId, single.id, fd);
      onDone();
    });
  };
  const remove = () => {
    start(async () => {
      for (const s of subjects) await deleteSubject(sessionId, s.id);
      onDone();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-8 w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">평가 대상 정보 변경</h3>
            {single && <p className="mt-0.5 text-xs text-slate-400">{single.name} · 정보 수정 시 관리자 재검토(대기)로 전환됩니다.</p>}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="닫기">✕</button>
        </div>

        {single ? (
          <>
            <form action={save} className="space-y-4">
              <label className="block text-xs text-slate-500">
                지역
                <input name="region" required defaultValue={single.region ?? ""} placeholder="지역" className={`mt-1 w-full ${inputCls}`} />
              </label>
              <label className="block text-xs text-slate-500">
                연구책임자
                <input name="leadResearcher" required defaultValue={single.leadResearcher ?? ""} placeholder="연구책임자" className={`mt-1 w-full ${inputCls}`} />
              </label>
              <label className="block text-xs text-slate-500">
                사업자등록번호 <span className="text-slate-400">(선택)</span>
                <input name="businessNo" defaultValue={single.businessNo ?? ""} placeholder="사업자등록번호" className={`mt-1 w-full ${inputCls}`} />
              </label>
              {single.status === "REJECTED" && single.rejectionReason && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">반려 사유: {single.rejectionReason}</p>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pending}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  삭제
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">닫기</button>
                  <button disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-40">
                    {pending ? "저장 중…" : "정보 저장"}
                  </button>
                </div>
              </div>
            </form>

            {/* 분과 서류 — 정보 폼과 별도로 관리(업로드/삭제) */}
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-2 text-xs font-medium text-slate-500">분과 서류 ({single.documents.length})</div>
              <ul className="space-y-1">
                {single.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <a href={`/viewer/${d.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-indigo-600 hover:underline">
                      <span>📄</span>
                      <span>{d.originalName}</span>
                      <span className="text-xs text-slate-400">{formatSize(d.size)}</span>
                    </a>
                  </li>
                ))}
                {single.documents.length === 0 && <li className="text-sm text-slate-400">등록된 자료가 없습니다. 행의 ‘서류’에서 업로드하세요.</li>}
              </ul>
            </div>
          </>
        ) : (
          <div>
            <p className="text-sm text-slate-600">선택한 평가 대상 {subjects.length}개:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <span key={s.id} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">{s.name}</span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">여러 개는 삭제만 가능합니다. 정보 수정은 한 개씩 선택하세요.</p>
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                삭제
              </button>
              <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">닫기</button>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <span className="text-sm text-rose-700">{subjects.length}개 평가 대상을 이 분과에서 제외할까요?</span>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-2 py-1 text-sm text-slate-500">취소</button>
              <button type="button" onClick={remove} disabled={pending} className="rounded-md bg-rose-600 px-3 py-1 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
                {pending ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 예쁜 체크박스 — 선택 상태에 따라 남색 배경 + 흰 체크.
function PrettyCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition ${
        checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
      }`}
      aria-hidden
    >
      {checked && (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 10 3.5 3.5L15 6" />
        </svg>
      )}
    </span>
  );
}
