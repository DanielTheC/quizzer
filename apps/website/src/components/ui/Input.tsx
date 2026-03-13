import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }
>(function Input({ label, error, className = "", ...props }, ref) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-quizzer-black mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-white px-4 py-3 text-quizzer-black placeholder:text-quizzer-black/50 focus:outline-none focus:ring-2 focus:ring-quizzer-yellow focus:ring-offset-2 ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-quizzer-red">{error}</p>
      )}
    </div>
  );
});
