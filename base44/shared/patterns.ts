const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "into",
  "need", "want", "please", "make", "create", "add", "get", "set", "put",
  "send", "have", "will", "just", "about", "what", "when", "next", "week",
  "month", "day", "today", "tomorrow", "all", "out", "our", "you"
]);

export function signatureOf(title: string) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length > 2 && !STOP.has(word))
    .slice(0, 5)
    .join(" ");
}

export function medianGap(gaps: number[]) {
  if (!gaps.length) return 7;
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function roundCadence(days: number) {
  const value = Math.max(1, Math.round(days || 7));
  const steps = [1, 2, 3, 7, 14, 30];
  let best = steps[0];
  let distance = Math.abs(value - steps[0]);
  for (const step of steps) {
    const d = Math.abs(value - step);
    if (d < distance) {
      best = step;
      distance = d;
    }
  }
  return best;
}

export function mostFrequent(values: any[]) {
  const counts = new Map();
  let best = null;
  let bestCount = 0;
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const count = (counts.get(value) || 0) + 1;
    counts.set(value, count);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function isoDate(value: any) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date.getTime() + days * 86400000);
  return next.toISOString().slice(0, 10);
}
