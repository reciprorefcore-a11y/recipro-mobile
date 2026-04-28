import type { Timestamp } from "firebase/firestore";

export function getDaysAgo(ts: Timestamp): number {
  return Math.floor((Date.now() - ts.toMillis()) / (1000 * 60 * 60 * 24));
}

export function formatDaysAgo(ts: Timestamp): string {
  const days = getDaysAgo(ts);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  return `${days}日前`;
}
