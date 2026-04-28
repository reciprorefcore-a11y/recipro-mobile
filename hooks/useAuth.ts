"use client";

import { useAuthContext } from "@/app/providers";

export function useAuth() {
  return useAuthContext();
}
