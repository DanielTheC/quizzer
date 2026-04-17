"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function HostQuizForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      let supabase;
      try {
        supabase = createBrowserSupabaseClient();
      } catch {
        setSubmitError("This form is not available right now. Please try again later.");
        return;
      }

      const form = e.currentTarget;
      const fd = new FormData(form);
      const venue = String(fd.get("venue") ?? "").trim();
      const email = String(fd.get("email") ?? "").trim();
      const city = String(fd.get("city") ?? "").trim();
      const message = String(fd.get("message") ?? "").trim();

      if (!venue || !email) {
        setSubmitError("Venue name and email are required.");
        return;
      }

      const experience_notes = [
        "Host quiz enquiry (website)",
        "",
        `City / area: ${city || "—"}`,
        "",
        message || "—",
      ].join("\n");

      const { error } = await supabase.from("host_applications").insert({
        email,
        full_name: venue,
        phone: "Not provided",
        experience_notes,
      });

      if (error) {
        if (error.code === "23505") {
          setSubmitError(
            "You already have a pending enquiry with this email. We'll be in touch soon.",
          );
          return;
        }
        setSubmitError(error.message || "Could not send your message. Please try again.");
        return;
      }

      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-green p-6 text-quizzer-black">
        <p className="font-semibold">Thanks! We’ll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="max-w-xl space-y-4">
      <Input label="Venue name" name="venue" required placeholder="The Red Lion" />
      <Input label="Contact email" name="email" type="email" required placeholder="you@venue.com" />
      <Input label="City / area" name="city" placeholder="e.g. London" />
      <Textarea
        label="Tell us about your quiz"
        name="message"
        placeholder="e.g. Tuesday 8pm, £2 entry, general knowledge..."
      />
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Sending…" : "Send"}
      </Button>
      {submitError ? (
        <p
          className="rounded-[12px] border-[3px] border-solid border-quizzer-red bg-quizzer-white px-4 py-3 text-sm font-semibold text-quizzer-red"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}
    </form>
  );
}
