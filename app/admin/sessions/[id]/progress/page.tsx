import { Suspense } from 'react'
import { getSessionProgress } from '@/lib/progress'
import StatCard from '@/components/StatCard'
import MonitoringList from '@/components/MonitoringList'
import ReviewTable from '@/components/ReviewTable'
import { SkeletonStats, SkeletonTable } from '@/components/Skeletons'

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonStats count={3} colsClass="lg:grid-cols-3" />
          <SkeletonTable rows={5} cols={5} />
        </div>
      }
    >
      <ProgressContent id={id} />
    </Suspense>
  )
}

async function ProgressContent({ id }: { id: string }) {
  const p = await getSessionProgress(id)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="전체 진행률" value={`${p.pct}%`} accent hint={`${p.doneCells}/${p.totalCells} 칸 완료`} />
        <StatCard label="입력 완료 위원" value={`${p.completedEvaluators}/${p.assignedCount}`} />
        <StatCard label="평가 항목" value={`${p.totalCriteria}개`} />
      </div>
      <MonitoringList data={p} />
      <ReviewTable sessionId={id} rows={p.review} />
    </div>
  )
}
