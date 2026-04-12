interface StatBadgeProps {
  value: string | number;
  label: string;
  className?: string;
}

export function StatBadge({ value, label, className = "" }: StatBadgeProps) {
  return (
    <div
      className={`rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-white px-5 py-4 shadow-[5px_5px_0_#000] inline-block text-center ${className}`}
    >
      <div className="font-heading text-2xl sm:text-3xl text-quizzer-black">
        {value}
      </div>
      <div className="text-sm font-semibold text-quizzer-black/80 uppercase tracking-wide mt-1">
        {label}
      </div>
    </div>
  );
}
