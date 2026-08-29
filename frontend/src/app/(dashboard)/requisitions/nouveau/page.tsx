"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — creation is now a modal on /requisitions */
export default function NouveauTerrainRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/requisitions?nouveau=1");
  }, [router]);
  return null;
}
