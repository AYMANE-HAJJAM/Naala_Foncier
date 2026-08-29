"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AgendaRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/calendrier");
  }, [router]);
  return null;
}
