import { Suspense } from "react";
import { SkeletonCard } from "@/components/Skeletons";
import OpinionsContent from "./OpinionsContent";

export default async function OpinionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      }
    >
      <OpinionsContent id={id} />
    </Suspense>
  );
}
