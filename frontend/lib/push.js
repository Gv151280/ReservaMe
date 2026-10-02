import { api } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function pushSoportado() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function suscripcionActual() {
  if (!(await pushSoportado())) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function activarPush() {
  if (!(await pushSoportado())) throw new Error('Este navegador no soporta notificaciones push.');

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado.');

  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const applicationServerKey = urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });

  const json = sub.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
  return sub;
}

export async function desactivarPush() {
  const sub = await suscripcionActual();
  if (!sub) return;
  await api.del('/push/subscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}
