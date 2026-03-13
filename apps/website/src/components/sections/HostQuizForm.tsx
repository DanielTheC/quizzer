"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export function HostQuizForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Placeholder: wire to API or Sanity action later
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-green p-6 text-quizzer-black">
        <p className="font-semibold">Thanks! We’ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl space-y-4"
    >
      <Input label="Venue name" name="venue" required placeholder="The Red Lion" />
      <Input label="Contact email" name="email" type="email" required placeholder="you@venue.com" />
      <Input label="City / area" name="city" placeholder="e.g. London" />
      <Textarea
        label="Tell us about your quiz"
        name="message"
        placeholder="e.g. Tuesday 8pm, £2 entry, general knowledge..."
      />
      <Button type="submit" size="lg">
        Send
      </Button>
    </form>
  );
}
