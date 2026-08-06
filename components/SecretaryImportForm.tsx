"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  autoDetectSecretaryMapping,
  secretaryLooksLikeHeader,
  buildSecretaries,
  SECRETARY_FIELDS,
  type SecretaryColumnMapping,
  type SecretaryField,
} from "@/lib/secretary-import";
import { parseTsv } from "@/lib/kpass-import";
import { commitSecretaryImport, type SecretaryImportResult } from "@/app/admin/actions";
import { parseSheetUpload } from "@/app/admin/sessions/actions";
import { parseHtmlTable } from "./clipboard-table";

const inputCls =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

// 현재 담당자 관리 테이블에 맞춘 열: 이름 / 아이디 / 비밀번호 / 연락처
const SAMPLE = `이름\t아이디\t비밀번호\t연락처\n김담당\tgansa1\t\t010-1234-5678\n이담당\t\t\t010-2222-3333`;

export default function SecretaryImportForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileGrid, setFileGrid] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [override, setOverride] = useState<Record<number, SecretaryField | null>>({});
  const [result, setResult] = useState<SecretaryImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const headerTouched = useRef(false);

  const grid = useMemo(() => fileGrid ?? parseTsv(text), [fileGrid, text]);
  const colCount = useMemo(() => grid.reduce((m, r) => Math.max(m, r.length), 0), [grid]);

  useEffect(() => {
    if (headerTouched.current) return;
    setHasHeader(grid.length > 0 ? secretaryLooksLikeHeader(grid[0]) : true);
  }, [grid]);

  const headerRow = hasHeader ? grid[0] ?? [] : [];
  const auto = useMemo<SecretaryColumnMapping>(() => {
    const padded = Array.from({ length: colCount }, (_, i) => headerRow[i] ?? "");
    return autoDetectSecretaryMapping(padded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colCount, headerRow.join(""), hasHeader]);

  const mapping: SecretaryColumnMapping = useMemo(
    () => Array.from({ length: colCount }, (_, i) => (i in override ? override[i] : auto[i] ?? null)),
    [colCount, override, auto],
  );

  const preview = useMemo(() => buildSecretaries(grid, mapping, { hasHeader }), [grid, mapping, hasHeader]);
  const sampleRows = (hasHeader ? grid.slice(1) : grid).slice(0, 3);
  const nameMapped = mapping.includes("name");

  const resetSource = () => {
    setOverride({});
    setResult(null);
    headerTouched.current = false;
  };

  const onFile = async (file: File | null) => {
    setFileError(null);
    if (!file) return;
    setText("");
    setParsing(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await parseSheetUpload(fd);
    setParsing(false);
    if (res.error || res.grid.length === 0) {
      setFileError(res.error ?? "표를 찾지 못했습니다.");
      setFileGrid(null);
      setFileName(null);
      return;
    }
    resetSource();
    setFileGrid(res.grid);
    setFileName(file.name);
  };

  const onPasteCapture = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData?.getData("text/html");
    const g = html ? parseHtmlTable(html) : null;
    if (g && g.length > 1) {
      e.preventDefault();
      setText("");
      setFileError(null);
      resetSource();
      setFileGrid(g);
      setFileName("붙여넣은 표");
    }
  };

  const onPaste = (v: string) => {
    setFileGrid(null);
    setFileName(null);
    setFileError(null);
    resetSource();
    setText(v);
  };

  const setCol = (i: number, v: string) =>
    setOverride((o) => ({ ...o, [i]: v === "" ? null : (v as SecretaryField) }));

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const res = await commitSecretaryImport({ grid, mapping, hasHeader });
      setResult(res);
      if (res.ok) router.refresh();
    });
  };

  // 성공 결과: 계정·임시비번 안내(모달 유지 — 관리자가 비번을 옮겨적도록)
  if (result?.ok && result.accounts) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-emerald-600">
          {result.accounts.length}명을 등록했습니다. 새로 생성된 계정의 비밀번호를 안내하세요.
        </p>
        <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium">이름</th>
                <th className="px-3 py-2 font-medium">아이디</th>
                <th className="px-3 py-2 font-medium">비밀번호</th>
              </tr>
            </thead>
            <tbody>
              {result.accounts.map((a, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-800">{a.name}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{a.username}</td>
                  <td className="px-3 py-2 font-mono">
                    {a.tempPassword ? (
                      <span className="text-indigo-700">{a.tempPassword}</span>
                    ) : (
                      <span className="text-slate-400">기존 계정(비번 유지)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onDone} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            완료
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">1. 담당자 명단 — 엑셀 파일 업로드 또는 붙여넣기</label>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3">
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {parsing && <span className="text-xs text-slate-400">읽는 중…</span>}
          {fileName && !parsing && <span className="text-xs font-medium text-emerald-600">{fileName} 불러옴</span>}
          <span className="text-xs text-slate-400">.xlsx · .xls · .csv (최대 4MB) · 한글(HWP)은 파일 업로드 불가</span>
        </div>
        {fileError && <p className="text-xs font-medium text-rose-600">{fileError}</p>}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">또는 엑셀·한글에서 명단을 드래그·복사해 붙여넣기(한글은 이 방식만 가능)</span>
          <button type="button" onClick={() => onPaste(SAMPLE)} className="text-xs text-slate-400 hover:text-indigo-600">
            예시 채우기
          </button>
        </div>
        <textarea
          value={fileGrid ? "" : text}
          onPaste={onPasteCapture}
          onChange={(e) => onPaste(e.target.value)}
          disabled={!!fileGrid}
          rows={4}
          placeholder={fileGrid ? "파일을 불러왔습니다." : "Ctrl+V 로 붙여넣기"}
          className={`w-full font-mono text-xs ${inputCls} disabled:bg-slate-50`}
        />
        <p className="text-xs text-slate-400">
          아이디가 없으면 자동 생성하고, 비밀번호는 비우면 연락처 끝 4자리(연락처도 없으면 자동)로 발급됩니다.
        </p>
      </section>

      {colCount > 0 && (
        <>
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => {
                  headerTouched.current = true;
                  setHasHeader(e.target.checked);
                }}
              />
              첫 행은 머리글(헤더)
            </label>
            <div className="text-sm font-semibold text-slate-700">2. 각 열을 어떤 항목으로 가져올지 지정</div>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 font-medium">엑셀 열</th>
                  <th className="px-3 py-2 font-medium">샘플 값</th>
                  <th className="px-3 py-2 font-medium">→ 가져올 항목</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: colCount }, (_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {hasHeader ? headerRow[i] || `(빈 머리글 ${i + 1})` : `${i + 1}번째 열`}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {sampleRows.map((r) => r[i]).filter(Boolean).slice(0, 2).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <select value={mapping[i] ?? ""} onChange={(e) => setCol(i, e.target.value)} className={inputCls}>
                        <option value="">무시</option>
                        {SECRETARY_FIELDS.map((f) => (
                          <option key={f.field} value={f.field}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!nameMapped && <p className="text-xs font-medium text-rose-600">* 한 열을 반드시 “이름”으로 지정하세요.</p>}
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold text-slate-700">
              3. 미리보기 <span className="text-xs text-slate-400">{preview.rows.length}명 등록 예정</span>
            </div>
            {preview.warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                {preview.warnings.map((w, i) => (
                  <li key={i}>⚠ {w}</li>
                ))}
              </ul>
            )}
            {preview.rows.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 font-medium">이름</th>
                      <th className="px-3 py-2 font-medium">아이디</th>
                      <th className="px-3 py-2 font-medium">비밀번호</th>
                      <th className="px-3 py-2 font-medium">연락처</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-800">{r.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{r.username ?? "(자동 생성)"}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{r.password ?? (r.phone ? "(연락처 끝 4자리)" : "(자동)")}</td>
                        <td className="px-3 py-2 text-slate-500">{r.phone ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
            {result && !result.ok && <span className="mr-auto text-sm font-medium text-rose-600">{result.error}</span>}
            <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-slate-700">
              취소
            </button>
            <button
              type="button"
              disabled={pending || preview.rows.length === 0 || !nameMapped}
              onClick={submit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "등록 중…" : `${preview.rows.length}명 등록`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
