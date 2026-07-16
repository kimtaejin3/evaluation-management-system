import Link from "next/link";

// 정렬 가능한 테이블 헤더 셀(서버 컴포넌트) — 클릭 시 ?sort=&dir= 쿼리로 서버 정렬.
// 같은 컬럼을 다시 누르면 오름/내림차순 토글.
export default function SortableTh({
  label,
  field,
  sort,
  dir,
  basePath,
}: {
  label: string;
  field: string;
  sort?: string;
  dir?: string;
  basePath: string;
}) {
  const active = sort === field;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  return (
    <th className="px-5 py-3 font-medium">
      <Link
        href={`${basePath}?sort=${field}&dir=${nextDir}`}
        className="inline-flex items-center gap-1 whitespace-nowrap hover:underline"
        title={`${label} 정렬`}
      >
        {label}
        <span className="text-[10px] opacity-80" aria-hidden>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}
