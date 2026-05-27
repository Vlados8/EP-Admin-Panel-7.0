import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiClient } from '../api/client';
import Constants from 'expo-constants';

// Configure foreground notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Requests device push permissions and generates/registers the Expo Push Token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // 1. Enforce physical device constraint (Expo push notifications do not work on emulators)
    if (!Device.isDevice) {
      console.log('[PushHelper] Bypassed token registry: push notifications require a physical device.');
      return null;
    }

    // 2. Query existing notification permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 3. Prompt user for permissions if not previously granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[PushHelper] Push permissions were denied.');
      return null;
    }

    // 4. Retrieve unique Expo Push Token (requires projectId under EAS starting from recent Expo SDKs)
    const projectId = 
      Constants.expoConfig?.extra?.eas?.projectId || 
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('[PushHelper] Successfully generated Expo Push Token:', token);

    // 5. Submit token to the backend
    await apiClient.post('/notifications/push-token', { token });
    console.log('[PushHelper] Successfully registered token on backend server.');

    // 6. Specific Android channel configurations
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB', // Blue matching our primary brand theme
      });
    }

    return token;
  } catch (err: any) {
    console.error('[PushHelper] Error during push notification registration:', err.message || err);
    return null;
  }
}
