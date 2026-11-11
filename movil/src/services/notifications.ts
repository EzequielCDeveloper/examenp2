import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { setSetting } from './db';
import { sendMessage } from 'react-native-wear-connectivity';

// Configure notification presentation in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers device for Expo Push Notifications and saves token in local SQLite settings.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('acuerdos_channel', {
        name: 'Acuerdos Judiciales STJ',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (e) {
      console.warn('Advertencia al configurar canal de notificaciones:', e);
    }
  }

  // Request permissions for both physical devices and emulators (required on Android 13+)
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permisos de notificación no otorgados');
      return null;
    }
  } catch (e) {
    console.warn('Error al solicitar permisos de notificación:', e);
  }

  if (Device.isDevice) {
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      const pushTokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      token = pushTokenData.data;

      if (token) {
        await setSetting('expo_push_token', token);
      }
    } catch (e) {
      console.warn('Aviso: Push token no disponible (requiere build EAS o dispositivo físico):', e);
    }
  } else {
    console.log('Emulador detectado: permisos locales configurados para pruebas');
  }

  return token;
}

/**
 * Transmits a payload directly to the smartwatch app via Wearable Data Layer.
 */
export function sendToWatch(payload: Record<string, any>): Promise<string> {
  return new Promise((resolve) => {
    try {
      sendMessage(
        payload,
        (reply) => {
          console.log('[Wearable] Respuesta del reloj:', reply);
          resolve(String(reply));
        },
        (err) => {
          console.warn('[Wearable] Envío al reloj no completado (posiblemente sin nodo conectado):', err);
          resolve(String(err));
        }
      );
    } catch (e) {
      console.warn('[Wearable] Excepción en sendMessage:', e);
      resolve(String(e));
    }
  });
}

/**
 * Emits a high-priority notification and synchronizes with smartwatch.
 */
export async function scheduleLocalNotification(title: string, body: string, data: Record<string, any> = {}) {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('acuerdos_channel', {
        name: 'Acuerdos Judiciales STJ',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (e) {
      console.warn('Advertencia al verificar canal:', e);
    }
  }

  // 1. Emit system notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      vibrate: [0, 250, 250, 250],
    },
    trigger: null, // immediate
  });

  // 2. Transmit payload to smartwatch app via Wearable Data Layer
  await sendToWatch({
    event: 'notification',
    title,
    body,
    ...data,
  });
}
