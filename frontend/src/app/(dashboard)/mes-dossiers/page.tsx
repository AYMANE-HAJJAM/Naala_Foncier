"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy path — redirects to Mes terrains */
export default function MesDossiersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/mes-terrains");
  }, [router]);
  return null;
}
