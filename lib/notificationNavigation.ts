import { Router } from 'expo-router';

export type NotificationType = 'bill' | 'announcement' | 'post' | 'activity' | string;

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read_at: string | null;
  created_at: string;
  reference_id?: string | null;
  data?: Record<string, unknown> | null;
}

export function navigateForNotification(
  router: Router,
  notification: Pick<AppNotification, 'type'>
) {
  const type = (notification.type || '').toLowerCase();

  switch (type) {
    case 'bill':
      router.push({
        pathname: '/(app)',
        params: { openBills: '1' },
      });
      break;
    case 'activity':
      router.push('/(app)/activities');
      break;
    case 'announcement':
    case 'post':
    default:
      router.push('/(app)');
      break;
  }
}

export function navigateForPushData(router: Router, data: Record<string, unknown> | undefined) {
  const type = typeof data?.type === 'string' ? data.type : 'announcement';
  navigateForNotification(router, { type });
}
