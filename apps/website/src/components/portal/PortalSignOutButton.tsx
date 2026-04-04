"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Props = { className?: string };

export function PortalSignOutButton({ className }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void (async () => {
          const supabase = createBrowserSupabaseClient();
          await supabase.auth.signOut();
          router.push("/portal/sign-in");
          router.refresh();
        })();
      }}
      className={`w-full rounded-[var(--radius-button)] border-2 border-quizzer-black bg-quizzer-white px-3 py-2 text-left text-sm font-medium shadow-[var(--shadow-button)] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[var(--shadow-button-hover)] disabled:opacity-50 ${className ?? ""}`}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
