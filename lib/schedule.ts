export const DAYS_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type AnnouncementDurationHours = 1 | 24 | 168;

export const ANNOUNCEMENT_DURATION_OPTIONS: {
  hours: AnnouncementDurationHours;
  label: string;
}[] = [
  { hours: 1, label: '1 hour' },
  { hours: 24, label: '24 hours' },
  { hours: 168, label: '7 days' },
];

export type DatedActivity = {
  activity_at?: string | null;
  day?: string | null;
  time?: string | null;
};

/** Parse "6:30 AM" / "18:30" into hours+minutes. */
export function parseClockTime(value: string | null | undefined): {
  hours: number;
  minutes: number;
} | null {
  const match = value?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (!meridiem && hours > 23) return null;

  return { hours, minutes };
}

/**
 * Resolve the concrete Date for an activity.
 * Prefers activity_at. Legacy weekday-only rows use this week's occurrence
 * (Mon–Sun containing `now`) — never rolled forward to next week, so once
 * that slot has passed the activity can be archived.
 */
export function getActivityDate(activity: DatedActivity, now = new Date()): Date | null {
  if (activity.activity_at) {
    const d = new Date(activity.activity_at);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dayName = activity.day ?? '';
  const target = DAYS_ORDER.indexOf(dayName as (typeof DAYS_ORDER)[number]);
  if (target < 0) return null;

  const clock = parseClockTime(activity.time) ?? { hours: 23, minutes: 59 };
  const today = (now.getDay() + 6) % 7; // Monday=0

  // Pin to the same week as `now` (Monday-based), even if that day is already past.
  const candidate = new Date(now);
  candidate.setHours(clock.hours, clock.minutes, 0, 0);
  candidate.setDate(now.getDate() - today + target);
  return candidate;
}

export function sortActivitiesSoonestFirst<T extends DatedActivity>(
  activities: T[],
  now = new Date()
): T[] {
  return [...activities].sort((a, b) => {
    const aAt = getActivityDate(a, now)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bAt = getActivityDate(b, now)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aAt - bAt;
  });
}

export function sortActivitiesLatestFirst<T extends DatedActivity>(
  activities: T[],
  now = new Date()
): T[] {
  return [...activities].sort((a, b) => {
    const aAt = getActivityDate(a, now)?.getTime() ?? 0;
    const bAt = getActivityDate(b, now)?.getTime() ?? 0;
    return bAt - aAt;
  });
}

export function weekdayNameFromDate(date: Date): string {
  return DAYS_ORDER[(date.getDay() + 6) % 7];
}

export function formatActivityWhen(activity: DatedActivity, now = new Date()): string {
  const at = getActivityDate(activity, now);
  if (!at) return activity.day || 'Scheduled';

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThat = new Date(at);
  startOfThat.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startOfThat.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000)
  );

  const timeLabel =
    activity.time?.trim() ||
    at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (dayDiff === 0) return `Today · ${timeLabel}`;
  if (dayDiff === 1) return `Tomorrow · ${timeLabel}`;
  if (dayDiff > 1 && dayDiff < 7) {
    return `${weekdayNameFromDate(at)} · ${timeLabel}`;
  }

  const dateLabel = at.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${dateLabel} · ${timeLabel}`;
}

export function formatCountdownFromActivity(
  activity: DatedActivity,
  now = new Date()
): string | null {
  const at = getActivityDate(activity, now);
  if (!at) return null;

  const diffMs = at.getTime() - now.getTime();
  if (diffMs < 0) return 'Past';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return diffMins <= 1 ? 'Soon' : `In ${diffMins}m`;
  if (diffHours < 24) return diffHours === 1 ? 'In 1 hour' : `In ${diffHours} hours`;
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}

export type ExpiringPost = {
  created_at?: string | null;
  expires_at?: string | null;
};

export function isActiveAnnouncement(post: ExpiringPost, now = new Date()): boolean {
  if (!post.expires_at) {
    // Legacy posts without expiry stay visible.
    return true;
  }
  const exp = new Date(post.expires_at);
  if (Number.isNaN(exp.getTime())) return true;
  return exp.getTime() > now.getTime();
}

export function sortAnnouncementsNewestFirst<T extends ExpiringPost>(posts: T[]): T[] {
  return [...posts].sort((a, b) => {
    const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bT - aT;
  });
}

export function expiresAtFromDurationHours(
  hours: AnnouncementDurationHours,
  from = new Date()
): string {
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function combineDateAndTime(datePart: Date, timePart: Date): Date {
  // Use local Y/M/D + local H:M so Android/iOS date pickers that use UTC
  // midnight don't shift the calendar day when hours are applied.
  return new Date(
    datePart.getFullYear(),
    datePart.getMonth(),
    datePart.getDate(),
    timePart.getHours(),
    timePart.getMinutes(),
    0,
    0
  );
}

/** Local calendar day key, e.g. "2026-9-6". */
function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Upcoming through the activity's local calendar day; archived once that day
 * has ended (local midnight). If you also want same-day sessions to drop after
 * their start time, we treat a passed start time on a past day as archived via
 * day key, and on the same day we hide once the start time has passed.
 */
export function isUpcomingActivity(activity: DatedActivity, now = new Date()): boolean {
  const at = getActivityDate(activity, now);
  if (!at) return false;

  const dayCmp = localDayKey(at).localeCompare(localDayKey(now), undefined, { numeric: true });
  if (dayCmp > 0) return true; // future calendar day
  if (dayCmp < 0) return false; // past calendar day
  // Same calendar day: keep only until the scheduled start time has passed.
  return at.getTime() >= now.getTime();
}

export function isPastActivity(activity: DatedActivity, now = new Date()): boolean {
  const at = getActivityDate(activity, now);
  if (!at) return false;
  return !isUpcomingActivity(activity, now);
}
