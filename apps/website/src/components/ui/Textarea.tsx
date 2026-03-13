import { forwardRef, type TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }
>(function Textarea({ label, error, className = "", ...props }, ref) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-quizzer-black mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={`w-full rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-white px-4 py-3 text-quizzer-black placeholder:text-quizzer-black/50 focus:outline-none focus:ring-2 focus:ring-quizzer-yellow focus:ring-offset-2 min-h-[120px] ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-quizzer-red">{error}</p>
      )}
    </div>
  );
});
