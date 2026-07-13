export default function EvaluatorImportButton({ sessionId }: { sessionId: string }) {
  return (
    <a
      href={`/api/sessions/${sessionId}/export/evaluators`}
      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
    >
      엑셀 내보내기
    </a>
  );
}
