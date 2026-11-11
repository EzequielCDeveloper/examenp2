import {
  getAllCases,
  saveAgreementsFromRemote,
  updateCaseSyncStatus,
  getSetting,
  setSetting,
} from './db';
import { scheduleLocalNotification, sendToWatch } from './notifications';
import { RemoteAgreementData } from '../types/database';

export const DEFAULT_SCRAPER_URL = 'https://stj-miniscraper.onrender.com';
const KEY_SCRAPER_URL = 'scraper_api_url';

export async function getScraperUrl(): Promise<string> {
  const saved = await getSetting(KEY_SCRAPER_URL, '');
  if (!saved || saved.includes('10.0.2.2') || saved.includes('192.168.')) {
    await setSetting(KEY_SCRAPER_URL, DEFAULT_SCRAPER_URL);
    return DEFAULT_SCRAPER_URL;
  }
  return saved;
}

export async function saveScraperUrl(url: string): Promise<void> {
  await setSetting(KEY_SCRAPER_URL, url.trim().replace(/\/+$/, ''));
}

export interface SyncSummary {
  casesChecked: number;
  newAgreements: number;
  modifiedAgreements: number;
  errors: string[];
}

/**
 * Connects to the cloud mini-scraper and synchronizes all active cases.
 * Dispatches local notifications for detected agreements (which auto-mirror to smartwatch).
 */
export async function syncActiveCasesWithScraper(): Promise<SyncSummary> {
  const baseUrl = await getScraperUrl();
  const cases = await getAllCases();
  const activeCases = cases.filter((c) => c.status === 'active' && c.track_enabled === 1);

  const summary: SyncSummary = {
    casesChecked: 0,
    newAgreements: 0,
    modifiedAgreements: 0,
    errors: [],
  };

  if (activeCases.length === 0) {
    return summary;
  }

  // Build batch payload
  const batchPayload = {
    cases: activeCases.map((c) => {
      let params = {};
      try {
        params = JSON.parse(c.provider_params);
      } catch {
        params = {};
      }
      return {
        id: c.id,
        params,
      };
    }),
  };

  try {
    const response = await fetch(`${baseUrl}/api/scrape-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchPayload),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`Servidor scraper respondió HTTP ${response.status}`);
    }

    const data = await response.json();
    const results: Array<{ id: number; success: boolean; agreements?: RemoteAgreementData[]; error?: string }> =
      data.results || [];

    for (const res of results) {
      summary.casesChecked++;
      const currentCase = activeCases.find((c) => c.id === res.id);

      if (res.success && res.agreements) {
        const { newCount, modifiedCount, newAgreements, modifiedAgreements } = await saveAgreementsFromRemote(
          res.id,
          res.agreements
        );
        await updateCaseSyncStatus(res.id, true);

        summary.newAgreements += newCount;
        summary.modifiedAgreements += modifiedCount;

        // Dispatch alerts and sync each item to the smartwatch via Wearable Data Layer
        if (newCount > 0 && currentCase) {
          for (const agr of newAgreements) {
            try {
              await sendToWatch({
                id_detalle: String(agr.id_detalle),
                expediente: `Exp. ${currentCase.expediente_num}/${currentCase.expediente_anio}`,
                alias: currentCase.alias,
                fecha: agr.fecha_publicacion || new Date().toLocaleDateString('es-MX'),
                sintesis: agr.sintesis || '',
                is_modified: false,
              });
            } catch (err) {
              console.warn('[Sync] Error syncing new agreement to watch:', err);
            }
          }

          await scheduleLocalNotification(
            `Acuerdo Nuevo (${newCount})`,
            `Exp. ${currentCase.expediente_num}/${currentCase.expediente_anio} (${currentCase.alias})`,
            { caseId: currentCase.id }
          );
        }

        if (modifiedCount > 0 && currentCase) {
          for (const agr of modifiedAgreements) {
            try {
              await sendToWatch({
                id_detalle: String(agr.id_detalle),
                expediente: `Exp. ${currentCase.expediente_num}/${currentCase.expediente_anio}`,
                alias: currentCase.alias,
                fecha: agr.fecha_publicacion || new Date().toLocaleDateString('es-MX'),
                sintesis: agr.sintesis || '',
                is_modified: true,
              });
            } catch (err) {
              console.warn('[Sync] Error syncing modified agreement to watch:', err);
            }
          }

          await scheduleLocalNotification(
            `Acuerdo Modificado`,
            `Exp. ${currentCase.expediente_num}/${currentCase.expediente_anio} (${currentCase.alias})`,
            { caseId: currentCase.id }
          );
        }
      } else {
        const errMsg = res.error || 'Error de consulta';
        await updateCaseSyncStatus(res.id, false, errMsg);
        summary.errors.push(`Exp ${currentCase?.expediente_num}: ${errMsg}`);
      }
    }
  } catch (err: any) {
    summary.errors.push(err.message || 'Error de conexión con el scraper');
  }

  return summary;
}
