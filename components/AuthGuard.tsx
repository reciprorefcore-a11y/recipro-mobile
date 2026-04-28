"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { ReactNode, useEffect } from "react";

const PUBLIC_PATHS = ["/login", "/signup"];

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user && !PUBLIC_PATHS.includes(pathname)) {
      router.replace("/login");
    }

    if (user && PUBLIC_PATHS.includes(pathname)) {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        読み込み中...
      </div>
    );
  }

  return <>{children}</>;
}
