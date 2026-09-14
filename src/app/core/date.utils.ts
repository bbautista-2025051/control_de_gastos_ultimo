export function todayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function localDateToIso(dateInput: string): string | undefined {
  if (!dateInput) {
    return undefined;
  }
  const [y, m, d] = dateInput.split("-").map(Number);
  if (!y || !m || !d) {
    return undefined;
  }
  return new Date(y, m - 1, d).toISOString();
}

export function formatDisplayDate(value: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return date.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "short",
  });
}
