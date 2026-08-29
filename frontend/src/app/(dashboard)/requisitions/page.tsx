import { Suspense } from "react";
import { PortfolioPage } from "@/features/requisitions/portfolio-page";
import { Skeleton } from "@/components/ui/core";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <PortfolioPage />
    </Suspense>
  );
}
