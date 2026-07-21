// 엑셀(.xlsx) 내보내기 버튼 — 역할·상태와 무관하게 항상 노출되는 고정 버튼.
// 서버 라우트(/api/sessions/[id]/export/*)로 이동해 파일을 내려받는다.
export default function ExcelExportButton({
  href,
  label = "엑셀 내보내기",
}: {
  href: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4" aria-hidden>
        <path d="M10 3v9m0 0 3-3m-3 3-3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </a>
  );
}
