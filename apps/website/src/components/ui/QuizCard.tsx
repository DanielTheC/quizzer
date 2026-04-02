import Link from "next/link";
import type { Quiz } from "@/data/types";
import { Badge } from "./Badge";

interface QuizCardProps {
  quiz: Quiz;
}

export function QuizCard({ quiz }: QuizCardProps) {
  return (
    <Link
      href={`/find-a-quiz/quiz/${quiz.id}`}
      className="block rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-white p-5 shadow-[5px_5px_0_#000] transition-all duration-150 hover:shadow-[3px_3px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] text-quizzer-black no-underline"
    >
      <h3 className="font-heading text-xl font-normal text-quizzer-black mb-1">
        {quiz.venueName}
      </h3>
      <p className="text-sm text-quizzer-black/80 mb-3">
        {quiz.area}, {quiz.day} · {quiz.time}
        {quiz.distance != null && (
          <span className="block mt-1 text-quizzer-pink font-semibold">
            {quiz.distance < 0.1
              ? "Under 0.1 miles away"
              : `${quiz.distance.toFixed(1)} miles away`}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-sm font-semibold">Entry {quiz.entryFee}</span>
        <span className="text-sm">· Prize: {quiz.prize}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {quiz.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="yellow">
            {tag}
          </Badge>
        ))}
      </div>
    </Link>
  );
}
