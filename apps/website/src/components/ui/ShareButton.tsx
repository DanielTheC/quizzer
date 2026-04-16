"use client";

import { useState } from "react";

export function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled — do nothing
        return;
      }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex-1 inline-flex items-center justify-center gap-2 font-bold text-sm border-[3px] border-solid border-quizzer-black rounded-[12px] px-4 py-3 bg-quizzer-black text-quizzer-white shadow-[3px_3px_0_#555] hover:shadow-[1px_1px_0_#555] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-150"
    >
      {copied ? "✓ Copied!" : "Share"}
    </button>
  );
}
