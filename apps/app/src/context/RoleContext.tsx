import React, { createContext, useContext } from "react";
import type { QuizzerRole } from "../lib/roleStorage";

type RoleContextValue = {
  role: QuizzerRole;
  setRole: (role: QuizzerRole | null) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({
  role,
  setRole,
  children,
}: {
  role: QuizzerRole;
  setRole: (role: QuizzerRole | null) => void;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (ctx == null) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return ctx;
}
