'use client'
export default function PrintButton() {
  return <button onClick={() => window.print()} className="rounded bg-gray-900 px-4 py-2 text-white">인쇄</button>
}
