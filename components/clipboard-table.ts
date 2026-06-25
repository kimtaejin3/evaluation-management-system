// 클립보드의 HTML 표(<table>)를 격자(string[][])로 변환 — 브라우저 전용.
// HWP/엑셀/워드/웹 표를 복사하면 text/html 에 실제 표 구조가 담긴다. 이를 파싱하면
// 병합셀(rowspan/colspan)·여러 줄 셀까지 정확히 복원되어, 깨지기 쉬운 text/plain TSV보다 안전하다.
export function parseHtmlTable(html: string): string[][] | null {
  if (typeof window === "undefined" || !html) return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }
  const table = doc.querySelector("table");
  if (!table) return null;

  const grid: string[][] = [];
  // 위쪽 rowspan 셀이 차지한 칸: "r,c" → 값
  const occupied = new Map<string, string>();
  const trs = Array.from(table.querySelectorAll("tr"));

  trs.forEach((tr, r) => {
    const row = grid[r] ?? (grid[r] = []);
    let c = 0;
    const skipOccupied = () => {
      while (occupied.has(`${r},${c}`)) {
        row[c] = occupied.get(`${r},${c}`)!;
        c++;
      }
    };
    Array.from(tr.children).forEach((el) => {
      if (!/^(td|th)$/i.test(el.tagName)) return;
      skipOccupied();
      const cell = el as HTMLTableCellElement;
      const text = cellText(cell);
      const cs = cell.colSpan || 1;
      const rs = cell.rowSpan || 1;
      for (let i = 0; i < cs; i++) {
        row[c + i] = text;
        for (let j = 1; j < rs; j++) occupied.set(`${r + j},${c + i}`, text);
      }
      c += cs;
    });
    skipOccupied(); // 행 끝에 걸린 rowspan 채우기
  });

  if (grid.length === 0) return null;
  const width = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const norm = grid.map((r) => Array.from({ length: width }, (_, i) => (r[i] ?? "").trim()));
  // 완전히 빈 행 제거
  const out = norm.filter((r) => r.some((c) => c !== ""));
  return out.length ? out : null;
}

// 셀 텍스트 추출: <br>·블록 종료를 줄바꿈으로 보존(여러 줄 평가기준 등)
function cellText(cell: HTMLElement): string {
  const html = cell.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent ?? "")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
