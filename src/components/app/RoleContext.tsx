"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";

const RoleContext = createContext<{ role: UserRole }>({ role: "pegawai" });

export function RoleProvider({
  role,
  children,
}: {
  role: UserRole;
  children: ReactNode;
}) {
  return <RoleContext.Provider value={{ role }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
