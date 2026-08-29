"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { useState } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/providers/auth-provider";
import { ApiError } from "@/lib/api/fetcher";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) =>
              !(error instanceof ApiError && [401, 403].includes(error.status)) &&
              failureCount < 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={350}>
          {children}
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
