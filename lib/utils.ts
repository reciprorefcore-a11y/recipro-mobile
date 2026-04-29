import type { Timestamp } from "firebase/firestore";

type DateLike = Timestamp | string | undefined;

export function getDaysAgo(ts: DateLike): number {
  const millis = toMillis(ts);
  if (millis === null) return 0;
  return Math.floor((Date.now() - millis) / (1000 * 60 * 60 * 24));
}

export function formatDaysAgo(ts: DateLike): string {
  if (!ts) return "未更新";
  const days = getDaysAgo(ts);
  if (days === 0) return "今日";
  if (days === 1) return "昨日";
  return `${days}日前`;
}

function toMillis(ts: DateLike): number | null {
  if (!ts) return null;
  if (typeof ts === "string") {
    const time = Date.parse(ts);
    return Number.isFinite(time) ? time : null;
  }
  return ts.toMillis();
}
