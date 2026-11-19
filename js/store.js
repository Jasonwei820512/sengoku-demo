import {isIOSPlatform, nativeStorage} from './native-storage.js';
export {nativeStorage, haptic} from './native-storage.js';

export const isIOS = isIOSPlatform();
export const DEMO = false;
const params = new URLSearchParams(!isIOS && typeof location !== 'undefined' ? location.search : '');
const previewAll = params.has('all');
const prefix = params.has('demo') ? 'demo:' : '';
const KEY = 'sengoku-store-v1';
const RECEIPT = prefix + 'sengoku-mock-receipt';
const plugin = () => globalThis.Capacitor?.Plugins?.SGStore;

let owned = false;
let revision = 0;
let initialization;
let requestInProgress = false;

function setOwned(unlocked) {
  revision++;
  owned = unlocked;
  if (owned) nativeStorage.setItem(KEY, 'unlocked');
  else nativeStorage.removeItem(KEY);
}

export function initialize() {
  // Only verified StoreKit results grant access. Web and Preferences flags cannot grant access.
  initialization ??= (async () => {
    try {
      await plugin().addListener('change', ({unlocked}) => setOwned(unlocked === true));
    } catch {}
    const before = revision;
    try {
      const {unlocked} = await plugin().status();
      if (before === revision) setOwned(unlocked === true);
    } catch {}
  })();
  return initialization;
}

export function isUnlocked() {
  if (isIOS) return owned;
  try {
    return DEMO || previewAll || localStorage.getItem(prefix + KEY) === 'unlocked';
  } catch {
    return DEMO;
  }
}

export async function getPrice(translate = key => key === 'store.preview' ? 'Preview: Full game unlocked' : 'See the App Store for pricing (web test)') {
  if (!isIOS) return translate(DEMO ? 'store.preview' : 'store.webPrice');
  try {
    const {price} = await plugin().price();
    if (price) return price;
  } catch {}
  return translate('store.appStorePrice');
}

async function nativeRequest(method) {
  if (requestInProgress) return 'fail';
  requestInProgress = true;
  const before = revision;
  try {
    const {result} = await plugin()[method]();
    if (revision === before) {
      if (result === 'ok') setOwned(true);
      if (method === 'restore' && result === 'none') setOwned(false);
    }
    return ['ok', 'cancel', 'pending', 'network', 'none'].includes(result) ? result : 'fail';
  } catch {
    return 'fail';
  } finally {
    requestInProgress = false;
  }
}

export async function purchase() {
  if (isIOS) return nativeRequest('buy');
  localStorage.setItem(RECEIPT, 'purchased');
  localStorage.setItem(prefix + KEY, 'unlocked');
  return true;
}

export async function restore() {
  if (isIOS) return nativeRequest('restore');
  if (DEMO || localStorage.getItem(RECEIPT) === 'purchased') {
    localStorage.setItem(prefix + KEY, 'unlocked');
    return true;
  }
  return false;
}
