export const PUBLICAN_MESSAGE_TYPE_OPTIONS = [
  { value: "cancellation_request", label: "Cancellation request" },
  { value: "special_request", label: "Special request" },
  { value: "complaint", label: "Complaint" },
  { value: "host_request", label: "Request a host" },
  { value: "general", label: "General" },
] as const;

export type PublicanMessageTypeValue = (typeof PUBLICAN_MESSAGE_TYPE_OPTIONS)[number]["value"];

export function labelForMessageType(value: string): string {
  const f = PUBLICAN_MESSAGE_TYPE_OPTIONS.find((o) => o.value === value);
  return f?.label ?? value.replace(/_/g, " ");
}

export function labelForMessageStatus(value: string): string {
  switch (value) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    default:
      return value;
  }
}
