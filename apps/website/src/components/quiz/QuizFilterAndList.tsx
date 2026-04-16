"use client";

import { useMemo, useState } from "react";
import type { Quiz } from "@/data/types";
import { QuizListWithLocation } from "./QuizListWithLocation";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface QuizFilterAndListProps {
  quizzes: Quiz[];
  maxDisplay?: number;
  /** Show a result count line above the grid when a filter is active. */
  showResultCount?: boolean;
}

export function QuizFilterAndList({
  quizzes,
  maxDisplay,
  showResultCount = true,
}: QuizFilterAndListProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Day name for today (e.g. "Wednesday")
  const todayName = FULL_DAY_NAMES[new Date().getDay()];

  // Only show pills for days that have at least one quiz
  const availableDays = useMemo(
    () => DAY_ORDER.filter((day) => quizzes.some((q) => q.day === day)),
    [quizzes]
  );

  const filtered = useMemo(
    () => (selectedDay ? quizzes.filter((q) => q.day === selectedDay) : quizzes),
    [quizzes, selectedDay]
  );

  return (
    <div>
      {/* Day filter pills — only render if there are multiple days */}
      {availableDays.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {/* All pill */}
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className={[
              "px-4 py-1.5 text-sm font-bold border-[3px] border-quizzer-black rounded-full transition-all duration-100",
              selectedDay === null
                ? "bg-quizzer-black text-quizzer-white shadow-[2px_2px_0_#555]"
                : "bg-quizzer-white text-quizzer-black shadow-[3px_3px_0_#000] hover:shadow-[1px_1px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px]",
            ].join(" ")}
          >
            All
          </button>

          {availableDays.map((day) => {
            const isTonight = day === todayName;
            const isSelected = selectedDay === day;
            return (
              <button
                type="button"
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={[
                  "px-4 py-1.5 text-sm font-bold border-[3px] border-quizzer-black rounded-full transition-all duration-100",
                  isSelected && isTonight
                    ? "bg-quizzer-black text-quizzer-yellow shadow-[2px_2px_0_#555]"
                    : isSelected
                      ? "bg-quizzer-black text-quizzer-white shadow-[2px_2px_0_#555]"
                      : isTonight
                        ? "bg-quizzer-yellow text-quizzer-black shadow-[3px_3px_0_#000] hover:shadow-[1px_1px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px]"
                        : "bg-quizzer-white text-quizzer-black shadow-[3px_3px_0_#000] hover:shadow-[1px_1px_0_#000] hover:translate-x-[1px] hover:translate-y-[1px]",
                ].join(" ")}
              >
                {DAY_SHORT[day]}
                {isTonight && !isSelected ? " · Tonight" : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* Result count when filtered */}
      {showResultCount && selectedDay && (
        <p className="text-sm font-semibold text-quizzer-black/70 mb-4">
          {filtered.length === 0
            ? `No quizzes on ${selectedDay}`
            : `${filtered.length} quiz${filtered.length !== 1 ? "zes" : ""} on ${selectedDay}s`}
        </p>
      )}

      {/* Empty state */}
      {filtered.length === 0 ? (
        <p className="text-quizzer-black/60">
          No quizzes match — try a different day or{" "}
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className="underline font-semibold text-quizzer-black"
          >
            show all
          </button>
          .
        </p>
      ) : (
        <QuizListWithLocation quizzes={filtered} maxDisplay={maxDisplay} />
      )}
    </div>
  );
}
