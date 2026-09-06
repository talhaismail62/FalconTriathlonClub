import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { navigateForPushData } from '@/lib/notificationNavigation';

export default function NotificationNavigationHandler() {
  const router = useRouter();

  useEffect(() => {
    let subscription: Notifications.Subscription | undefined;

    try {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        navigateForPushData(router, data);
      });
    } catch (error) {
      console.warn('Push notification navigation unavailable:', error);
    }

    return () => subscription?.remove();
  }, [router]);

  return null;
}
