import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_SCRAPER_URL = 'https://stj-miniscraper.onrender.com';
const KEY_URL = '@watch_scraper_url';
const CACHE_KEY = '@watch_agreements_cache';

const memoryStore = new Map<string, string>();

async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryStore.get(key) || null;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  memoryStore.set(key, value);
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Graceful in-memory fallback if native module is unavailable in Expo Go
  }
}

export async function getScraperUrl(): Promise<string> {
  try {
    const saved = await safeGetItem(KEY_URL);
    if (!saved || saved.includes('10.0.2.2') || saved.includes('192.168.')) {
      await safeSetItem(KEY_URL, DEFAULT_SCRAPER_URL);
      return DEFAULT_SCRAPER_URL;
    }
    return saved;
  } catch {
    return DEFAULT_SCRAPER_URL;
  }
}

export async function setScraperUrl(url: string): Promise<void> {
  await safeSetItem(KEY_URL, url.trim().replace(/\/+$/, ''));
}

export interface WatchAgreement {
  id_detalle: string;
  expediente: string;
  alias: string;
  fecha: string;
  sintesis: string;
  is_modified: boolean;
}

export async function getCachedAgreements(): Promise<WatchAgreement[]> {
  try {
    const raw = await safeGetItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveCachedAgreements(items: WatchAgreement[]): Promise<void> {
  await safeSetItem(CACHE_KEY, JSON.stringify(items));
}

export async function checkScraperHealth(): Promise<boolean> {
  try {
    const url = await getScraperUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (err) {
    console.warn('checkScraperHealth failed:', err);
    return false;
  }
}
