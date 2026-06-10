import { createSession } from '../actions'

export default function NewSessionPage() {
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">새 회차</h1>
      <form action={createSession} className="space-y-4">
        <div>
          <label className="block text-sm">회차명 *</label>
          <input name="name" required className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm">설명</label>
          <textarea name="description" className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm">일시</label>
          <input name="eventDate" type="datetime-local" className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm">장소</label>
          <input name="location" className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <button className="rounded bg-gray-900 px-4 py-2 text-white">생성</button>
      </form>
    </div>
  )
}
