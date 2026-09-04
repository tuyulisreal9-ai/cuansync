import { Capacitor, registerPlugin } from "@capacitor/core";

export const CuansyncWidget = registerPlugin("CuansyncWidget");

export function isNativeWidgetAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export const isNativeWidgetSupported = isNativeWidgetAvailable;

/* Browser, PWA, dan iOS tidak memiliki plugin widget Android. Mengembalikan
   status eksplisit membuat pemanggil dapat menyembunyikan aksi tanpa perlu
   menangani galat "plugin is not implemented". */
export async function updateNativeWidgetSnapshot(snapshot = {}) {
  if (!isNativeWidgetAvailable()) {
    return { supported: false, updated: false };
  }

  const result = await CuansyncWidget.updateSnapshot(snapshot);
  return { supported: true, updated: true, ...(result || {}) };
}

export async function requestPinNativeWidget(options = {}) {
  if (!isNativeWidgetAvailable()) {
    return { supported: false, requested: false };
  }

  const result = await CuansyncWidget.requestPin(options);
  return { supported: true, requested: true, ...(result || {}) };
}
