"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UtilisateursRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/administration/utilisateurs");
  }, [router]);
  return null;
}
