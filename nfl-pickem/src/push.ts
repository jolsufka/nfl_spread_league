// Web push opt-in for pick reminders. On iOS this only works when the site
// is launched from a Home Screen icon (standalone) — Safari tabs don't
// expose the push API.
import { supabase } from './supabase';

export const VAPID_PUBLIC_KEY =
  'BPvxGycfIS8vSZJax_ruW43yK7eV1anTi0iRUl_r5tZeSt3vniiqhGGMS8VEI_kB5g8T4fCprCrt2h5ehXKReTs';

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(Array.from(raw, (char) => char.charCodeAt(0)));
};

export const pushSupport = (): 'supported' | 'needs-homescreen' | 'unsupported' => {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'supported';
  }
  // iOS Safari in-browser: push exists only for Home Screen apps
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return isIOS ? 'needs-homescreen' : 'unsupported';
};

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/sw.js`);
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function enableReminders(): Promise<'ok' | 'denied' | 'error'> {
  const registration = await registerServiceWorker();
  if (!registration) return 'error';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const { data, error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  });
  if (error || (typeof data === 'string' && data.startsWith('error'))) {
    console.error('Could not save push subscription:', error || data);
    return 'error';
  }
  return 'ok';
}
