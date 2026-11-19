import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Crash reporting into our own Supabase table (report_crash RPC, viewed in admin web → Crashes).
 * Every report is queued on the phone first, so a crash that kills the app is still sent on
 * the next launch. The same error is reported once per session.
 */
type Source = 'js' | 'boundary' | 'promise';
interface Report {
  message: string;
  stack?: string;
  fatal: boolean;
  source: Source;
  screen?: string;
  at: number;
}

const QUEUE_KEY = 'crash-queue-v1';
const MAX_QUEUE = 20;
const seen = new Set<string>();
let currentScreen: string | undefined;
let flushing = false;

/** Kept up to date by the navigation container (App.tsx). */
export function setCurrentScreen(name: string | undefined) {
  currentScreen = name;
}

async function readQueue(): Promise<Report[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Report[]) : [];
  } catch {
    return [];
  }
}

async function enqueue(report: Report): Promise<void> {
  const queue = await readQueue();
  queue.push(report);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))).catch(() => undefined);
}

/** Sends queued reports; anything that fails stays for the next try. */
export async function flushCrashes(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const queue = await readQueue();
    if (!queue.length) return;
    const left: Report[] = [];
    for (const r of queue) {
      const { error } = await supabase.rpc('report_crash', {
        p_message: r.message,
        p_stack: r.stack ?? null,
        p_fatal: r.fatal,
        p_source: r.source,
        p_screen: r.screen ?? null,
        p_app_version: `${Constants.expoConfig?.version ?? '?'} (${Constants.expoConfig?.android?.versionCode ?? '?'})`,
        p_update_id: Updates.updateId ?? 'embedded',
        p_platform: Platform.OS,
        p_os_version: String(Platform.Version),
      });
      if (error) left.push(r);
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(left)).catch(() => undefined);
  } finally {
    flushing = false;
  }
}

/** Queue + send one error. Resolves once it is safely stored on the phone. */
export function reportCrash(error: unknown, opts: { fatal?: boolean; source?: Source } = {}): Promise<void> {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  const source = opts.source ?? 'js';
  const key = `${source}:${err.message}`;
  if (seen.has(key)) return Promise.resolve();
  seen.add(key);
  const report: Report = {
    message: err.message || 'Unknown error',
    stack: err.stack?.slice(0, 4000),
    fatal: !!opts.fatal,
    source,
    screen: currentScreen,
    at: Date.now(),
  };
  const stored = enqueue(report);
  stored.then(() => flushCrashes()).catch(() => undefined);
  return stored;
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler: () => GlobalHandler;
  setGlobalHandler: (h: GlobalHandler) => void;
}
interface HermesLike {
  enablePromiseRejectionTracker?: (opts: { allRejections: boolean; onUnhandled: (id: number, error: unknown) => void }) => void;
}

let installed = false;

/** Once, at startup: catch every uncaught JS error (and unhandled promise rejection in release). */
export function installCrashReporting(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike; HermesInternal?: HermesLike };
  const errorUtils = g.ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      if (!isFatal) {
        reportCrash(error, { fatal: false });
        previous(error, isFatal);
        return;
      }
      // A fatal error closes the app: store the report first (max 1 s), then let it close.
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        previous(error, isFatal);
      };
      reportCrash(error, { fatal: true }).finally(finish);
      setTimeout(finish, 1000);
    });
  }
  // Dev keeps React Native's own warning box for rejections.
  if (!__DEV__) {
    g.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, error) => reportCrash(error, { source: 'promise' }),
    });
  }
  // Anything a previous launch couldn't send.
  setTimeout(() => flushCrashes().catch(() => undefined), 3000);
}
