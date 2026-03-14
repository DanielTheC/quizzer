"use client";

import { useEffect, useState } from "react";
import type { Quiz } from "@/data/types";
import { haversineMiles } from "@/lib/distance";
import { QuizCard } from "@/components/ui/QuizCard";

interface QuizListWithLocationProps {
  quizzes: Quiz[];
  /** If set, only render the first N quizzes (after distance sort when location on). */
  maxDisplay?: number;
}

export function QuizListWithLocation({ quizzes, maxDisplay }: QuizListWithLocationProps) {
  const [displayQuizzes, setDisplayQuizzes] = useState<Quiz[]>(quizzes);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator?.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        const withDistance = quizzes.map((q) => {
          if (q.lat != null && q.lng != null && Number.isFinite(q.lat) && Number.isFinite(q.lng)) {
            const distance = haversineMiles(userLat, userLng, q.lat, q.lng);
            return { ...q, distance };
          }
          return q;
        });

        const withCoords = withDistance.filter((q) => q.distance != null);
        const withoutCoords = withDistance.filter((q) => q.distance == null);
        const sortedWithCoords = [...withCoords].sort(
          (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)
        );
        const sorted = [...sortedWithCoords, ...withoutCoords];

        setDisplayQuizzes(sorted);
      },
      () => {
        setDisplayQuizzes(quizzes);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [quizzes]);

  const toShow = maxDisplay != null ? displayQuizzes.slice(0, maxDisplay) : displayQuizzes;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {toShow.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} />
      ))}
    </div>
  );
}
