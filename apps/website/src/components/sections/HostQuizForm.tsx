"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

const frequencyOptions = [
  { label: "One-off", value: "one_off" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Not sure", value: "not_sure" },
];

const existingOptions = [
  { label: "We already run a quiz", value: "already_runs" },
  { label: "We want to start one", value: "wants_to_start" },
];

export function HostQuizForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const form = e.currentTarget;
      const fd = new FormData(form);
      const venueName = String(fd.get("venue_name") ?? "").trim();
      const contactName = String(fd.get("contact_name") ?? "").trim();
      const email = String(fd.get("email") ?? "").trim();
      const phone = String(fd.get("phone") ?? "").trim();
      const city = String(fd.get("city") ?? "").trim();
      const frequency = fd.get("frequency");
      const existing = fd.get("existing");
      const message = String(fd.get("message") ?? "").trim();
      const website = String(fd.get("website") ?? "");

      if (!venueName || !contactName || !email) {
        setSubmitError("Please check the details and try again.");
        return;
      }

      let res: Response;
      try {
        res = await fetch("/api/venue-enquiry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venue_name: venueName,
            contact_name: contactName,
            email,
            phone: phone || undefined,
            city: city || undefined,
            frequency: typeof frequency === "string" ? frequency : undefined,
            existing: typeof existing === "string" ? existing : undefined,
            message: message || undefined,
            website,
          }),
        });
      } catch {
        setSubmitError("Could not send your message. Please try again.");
        return;
      }

      if (!res.ok) {
        if (res.status === 429) {
          setSubmitError(
            "We've already got a recent enquiry from this email — we'll be in touch.",
          );
          return;
        }
        if (res.status === 400) {
          setSubmitError("Please check the details and try again.");
          return;
        }
        setSubmitError("Could not send your message. Please try again.");
        return;
      }

      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-[var(--radius-card)] border-[3px] border-quizzer-black border-solid bg-quizzer-green p-6 text-quizzer-black">
        <p className="font-semibold">Thanks! We'll be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="max-w-xl space-y-4">
      <Input label="Venue name" name="venue_name" required placeholder="The Red Lion" disabled={submitting} />
      <Input label="Your name" name="contact_name" required placeholder="Alex Smith" disabled={submitting} />
      <Input label="Contact email" name="email" type="email" required placeholder="you@venue.com" disabled={submitting} />
      <Input label="Phone" name="phone" type="tel" placeholder="Optional" maxLength={30} disabled={submitting} />
      <Input label="City / area" name="city" placeholder="e.g. London" maxLength={120} disabled={submitting} />
      <fieldset className="space-y-3 rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-white p-4">
        <legend className="px-1 text-sm font-semibold text-quizzer-black">How often?</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {frequencyOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-3 text-sm font-semibold text-quizzer-black">
              <input
                type="radio"
                name="frequency"
                value={option.value}
                disabled={submitting}
                className="h-4 w-4 accent-quizzer-yellow"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3 rounded-[12px] border-[3px] border-quizzer-black border-solid bg-quizzer-white p-4">
        <legend className="px-1 text-sm font-semibold text-quizzer-black">Quiz status</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {existingOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-3 text-sm font-semibold text-quizzer-black">
              <input
                type="radio"
                name="existing"
                value={option.value}
                disabled={submitting}
                className="h-4 w-4 accent-quizzer-yellow"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea
        label="Anything else?"
        name="message"
        maxLength={4000}
        disabled={submitting}
        placeholder="e.g. Tuesday 8pm, £2 entry, general knowledge..."
      />
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", height: 0, width: 0, opacity: 0 }}
      />
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Sending…" : "Send"}
      </Button>
      {submitError ? (
        <p
          className="rounded-[var(--radius-card)] border-[3px] border-solid border-quizzer-red bg-quizzer-cream px-4 py-3 text-sm font-semibold text-quizzer-red"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}
    </form>
  );
}
