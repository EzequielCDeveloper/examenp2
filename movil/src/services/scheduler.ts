import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { getSetting, setSetting } from './db';
import { syncActiveCasesWithScraper, SyncSummary } from './scraperApi';

export interface ScheduleItem {
  id: string;
  time: string; // 24-hour format "HH:MM", e.g. "09:00"
  label: string;
  enabled: boolean;
}

const KEY_SCHEDULES = 'scheduled_sync_slots';
const KEY_AUTO_SYNC_ENABLED = 'auto_sync_enabled';
const KEY_LAST_SYNC_TIMESTAMP = 'last_auto_sync_timestamp';
const KEY_LAST_SYNC_SUMMARY = 'last_auto_sync_summary';

export const DEFAULT_SCHEDULES: ScheduleItem[] = [
  { id: 'sch_1', time: '09:00', label: 'Apertura Matutina', enabled: true },
  { id: 'sch_2', time: '13:30', label: 'Publicación Intermedia', enabled: true },
  { id: 'sch_3', time: '18:00', label: 'Cierre de Lista STJ', enabled: true },
];

/**
 * Retrieves the current configured schedule slots.
 */
export async function getSchedules(): Promise<ScheduleItem[]> {
  try {
    const raw = await getSetting(KEY_SCHEDULES, '');
    if (!raw) {
      await saveSchedules(DEFAULT_SCHEDULES);
      return DEFAULT_SCHEDULES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SCHEDULES;
  } catch {
    return DEFAULT_SCHEDULES;
  }
}

/**
 * Persists the schedule list to SQLite settings.
 */
export async function saveSchedules(items: ScheduleItem[]): Promise<void> {
  // Sort schedules chronologically by time
  const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
  await setSetting(KEY_SCHEDULES, JSON.stringify(sorted));
}

/**
 * Adds a new schedule slot with validation.
 */
export async function addSchedule(time: string, label?: string): Promise<ScheduleItem[]> {
  const normalizedTime = time.trim();
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(normalizedTime)) {
    throw new Error('Formato de hora inválido. Usa formato 24 horas (HH:MM), ej. 14:30');
  }

  const existing = await getSchedules();
  if (existing.some((s) => s.time === normalizedTime)) {
    throw new Error(`Ya existe un horario programado a las ${normalizedTime}.`);
  }

  const newItem: ScheduleItem = {
    id: 'sch_' + Date.now(),
    time: normalizedTime,
    label: label?.trim() || `Revisión ${normalizedTime}`,
    enabled: true,
  };

  const updated = [...existing, newItem];
  await saveSchedules(updated);
  return updated;
}

/**
 * Removes a schedule slot by ID.
 */
export async function removeSchedule(id: string): Promise<ScheduleItem[]> {
  const current = await getSchedules();
  const updated = current.filter((s) => s.id !== id);
  await saveSchedules(updated);
  return updated;
}

/**
 * Toggles or sets the enabled state of a specific schedule slot.
 */
export async function toggleSchedule(id: string, enabled?: boolean): Promise<ScheduleItem[]> {
  const current = await getSchedules();
  const updated = current.map((s) => {
    if (s.id === id) {
      return { ...s, enabled: enabled !== undefined ? enabled : !s.enabled };
    }
    return s;
  });
  await saveSchedules(updated);
  return updated;
}

/**
 * Checks whether automatic scheduled querying is globally active.
 */
export async function isAutoSyncEnabled(): Promise<boolean> {
  const val = await getSetting(KEY_AUTO_SYNC_ENABLED, 'true');
  return val === 'true';
}

/**
 * Enables or disables automatic scheduled querying globally.
 */
export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
  await setSetting(KEY_AUTO_SYNC_ENABLED, enabled ? 'true' : 'false');
  if (enabled) {
    await registerBackgroundFetchAsync();
  } else {
    await unregisterBackgroundFetchAsync();
  }
}

/**
 * Retrieves the last execution timestamp and summary.
 */
export async function getLastSyncInfo(): Promise<{ timestamp: string | null; summary: SyncSummary | null }> {
  const timestamp = await getSetting(KEY_LAST_SYNC_TIMESTAMP, '');
  const summaryRaw = await getSetting(KEY_LAST_SYNC_SUMMARY, '');
  let summary: SyncSummary | null = null;
  if (summaryRaw) {
    try {
      summary = JSON.parse(summaryRaw);
    } catch {
      summary = null;
    }
  }
  return {
    timestamp: timestamp || null,
    summary,
  };
}

/**
 * Executes an automated synchronization cycle against the STJ scraper and records the result.
 */
export async function executeScheduledCheck(): Promise<SyncSummary> {
  console.log('[Scheduler] Iniciando ciclo de consulta automática de acuerdos STJ...');
  const summary = await syncActiveCasesWithScraper();

  const now = new Date().toISOString();
  await setSetting(KEY_LAST_SYNC_TIMESTAMP, now);
  await setSetting(KEY_LAST_SYNC_SUMMARY, JSON.stringify(summary));

  console.log(
    `[Scheduler] Ciclo completado: ${summary.casesChecked} revisados, ${summary.newAgreements} nuevos, ${summary.modifiedAgreements} modificados.`
  );
  return summary;
}

export const BACKGROUND_SYNC_TASK = 'STJ_BACKGROUND_SYNC_TASK';

// Define the headless background task (runs outside React lifecycle via Android WorkManager)
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log('[BackgroundFetch] Despertando proceso en segundo plano...');
    const enabled = await isAutoSyncEnabled();
    if (!enabled) {
      console.log('[BackgroundFetch] Monitoreo automático pausado por el usuario.');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const summary = await executeScheduledCheck();
    if (summary.newAgreements > 0 || summary.modifiedAgreements > 0) {
      console.log(
        `[BackgroundFetch] Éxito: ${summary.newAgreements} nuevos, ${summary.modifiedAgreements} modificados.`
      );
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    console.error('[BackgroundFetch] Error ejecutando tarea en segundo plano:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Registers the background fetch task with Android WorkManager.
 */
export async function registerBackgroundFetchAsync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (Android WorkManager standard minimum interval)
        stopOnTerminate: false,   // Continue running when app is closed / killed
        startOnBoot: true,        // Automatically restart task when phone reboots
      });
      console.log('[BackgroundFetch] Tarea en segundo plano registrada con éxito (WorkManager).');
    }
  } catch (err) {
    console.warn('[BackgroundFetch] No se pudo registrar la tarea en segundo plano:', err);
  }
}

/**
 * Unregisters the background fetch task.
 */
export async function unregisterBackgroundFetchAsync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
      console.log('[BackgroundFetch] Tarea en segundo plano desregistrada.');
    }
  } catch (err) {
    console.warn('[BackgroundFetch] Error desregistrando tarea:', err);
  }
}

let lastExecutedMinute = '';

/**
 * Background scheduler daemon that checks active schedules every 25 seconds while the app is active.
 * Prevents redundant runs in the same minute and invokes callback on sync completion.
 */
export function startSchedulerDaemon(onSyncExecuted?: (summary: SyncSummary) => void): () => void {
  const checkInterval = setInterval(async () => {
    try {
      const enabled = await isAutoSyncEnabled();
      if (!enabled) return;

      const now = new Date();
      const currentMinuteKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Avoid executing multiple times within the same clock minute
      if (lastExecutedMinute === currentMinuteKey) {
        return;
      }

      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const schedules = await getSchedules();
      const matchingSchedule = schedules.find((s) => s.enabled && s.time === currentTime);

      if (matchingSchedule) {
        lastExecutedMinute = currentMinuteKey;
        console.log(`[Scheduler] Horario activado: ${matchingSchedule.time} (${matchingSchedule.label})`);
        const summary = await executeScheduledCheck();
        if (typeof onSyncExecuted === 'function') {
          onSyncExecuted(summary);
        }
      }
    } catch (err) {
      console.warn('[Scheduler] Error en ciclo del daemon:', err);
    }
  }, 25000);

  return () => clearInterval(checkInterval);
}
