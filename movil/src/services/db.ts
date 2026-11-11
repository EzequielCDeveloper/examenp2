import * as SQLite from 'expo-sqlite';
import { CaseRecord, AgreementRecord, RemoteAgreementData } from '../types/database';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('acuerdos_local.db');
    await initSchema(dbInstance);
  }
  return dbInstance;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL DEFAULT 'sonora_stj',
      alias TEXT NOT NULL,
      expediente_num TEXT NOT NULL,
      expediente_anio INTEGER NOT NULL,
      bis INTEGER NOT NULL DEFAULT 0,
      clave_juzgado TEXT NOT NULL,
      tribunal_nombre TEXT NOT NULL,
      tipo_asunto TEXT NOT NULL,
      ciudad TEXT NOT NULL,
      provider_params TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      track_enabled INTEGER NOT NULL DEFAULT 1,
      baseline_done INTEGER NOT NULL DEFAULT 0,
      last_checked_at TEXT,
      last_ok_at TEXT,
      last_error_code TEXT,
      last_error_msg TEXT,
      warning_code TEXT,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider_id, provider_params)
    );

    CREATE TABLE IF NOT EXISTS agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      id_detalle TEXT NOT NULL,
      fecha_publicacion TEXT NOT NULL,
      secretaria TEXT NOT NULL DEFAULT '',
      tipo_asunto TEXT NOT NULL DEFAULT '',
      cuadernillo TEXT NOT NULL DEFAULT '',
      partes TEXT NOT NULL DEFAULT '',
      sintesis TEXT NOT NULL,
      texto_completo TEXT NOT NULL DEFAULT '',
      acumulado TEXT NOT NULL DEFAULT '',
      content_hash TEXT NOT NULL,
      is_modified INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, id_detalle)
    );

    CREATE TABLE IF NOT EXISTS agreement_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agreement_id INTEGER NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
      previous_sintesis TEXT NOT NULL,
      previous_partes TEXT NOT NULL DEFAULT '',
      previous_cuadernillo TEXT NOT NULL DEFAULT '',
      previous_texto_completo TEXT NOT NULL DEFAULT '',
      previous_acumulado TEXT NOT NULL DEFAULT '',
      previous_hash TEXT NOT NULL,
      detected_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agreements_unread ON agreements(read_at, fecha_publicacion DESC);
    CREATE INDEX IF NOT EXISTS idx_cases_active ON cases(status, track_enabled);
  `);
}

// Settings helpers
export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// Cases CRUD
export async function getAllCases(): Promise<CaseRecord[]> {
  const db = await getDb();
  return await db.getAllAsync<CaseRecord>(
    'SELECT * FROM cases ORDER BY updated_at DESC, id DESC'
  );
}

export async function insertCase(data: {
  alias: string;
  expediente_num: string;
  expediente_anio: number;
  bis: number;
  clave_juzgado: string;
  tribunal_nombre: string;
  tipo_asunto: string;
  ciudad: string;
  provider_params: string;
}): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO cases (
      alias, expediente_num, expediente_anio, bis,
      clave_juzgado, tribunal_nombre, tipo_asunto, ciudad, provider_params
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.alias,
      data.expediente_num,
      data.expediente_anio,
      data.bis,
      data.clave_juzgado,
      data.tribunal_nombre,
      data.tipo_asunto,
      data.ciudad,
      data.provider_params,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateCase(
  id: number,
  data: {
    alias: string;
    expediente_num: string;
    expediente_anio: number;
    bis: number;
    clave_juzgado: string;
    tribunal_nombre: string;
    tipo_asunto: string;
    ciudad: string;
    provider_params: string;
  }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE cases SET
      alias = ?,
      expediente_num = ?,
      expediente_anio = ?,
      bis = ?,
      clave_juzgado = ?,
      tribunal_nombre = ?,
      tipo_asunto = ?,
      ciudad = ?,
      provider_params = ?,
      updated_at = datetime('now')
    WHERE id = ?`,
    [
      data.alias,
      data.expediente_num,
      data.expediente_anio,
      data.bis,
      data.clave_juzgado,
      data.tribunal_nombre,
      data.tipo_asunto,
      data.ciudad,
      data.provider_params,
      id,
    ]
  );
}

export async function deleteCase(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM cases WHERE id = ?', [id]);
}

export async function setCaseStatus(id: number, status: 'active' | 'archived'): Promise<void> {
  const db = await getDb();
  if (status === 'archived') {
    await db.runAsync(
      `UPDATE cases SET status = 'archived', track_enabled = 0, updated_at = datetime('now') WHERE id = ?`,
      [id]
    );
  } else {
    await db.runAsync(
      `UPDATE cases SET status = 'active', updated_at = datetime('now') WHERE id = ?`,
      [id]
    );
  }
}

export async function toggleCaseTrack(id: number, track: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE cases SET track_enabled = ?, updated_at = datetime("now") WHERE id = ?', [
    track ? 1 : 0,
    id,
  ]);
}

export async function updateCaseSyncStatus(
  id: number,
  success: boolean,
  errorMessage: string | null = null
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  if (success) {
    await db.runAsync(
      `UPDATE cases SET
        last_checked_at = ?,
        last_ok_at = ?,
        last_error_code = NULL,
        last_error_msg = NULL,
        consecutive_failures = 0,
        baseline_done = 1,
        updated_at = ?
      WHERE id = ?`,
      [now, now, now, id]
    );
  } else {
    await db.runAsync(
      `UPDATE cases SET
        last_checked_at = ?,
        last_error_code = 'SYNC_ERROR',
        last_error_msg = ?,
        consecutive_failures = consecutive_failures + 1,
        updated_at = ?
      WHERE id = ?`,
      [now, errorMessage || 'Fallo de consulta', now, id]
    );
  }
}

// Agreements CRUD
export async function getAgreements(onlyUnread = true): Promise<AgreementRecord[]> {
  const db = await getDb();
  const query = `
    SELECT 
      a.*,
      c.alias as case_alias,
      c.expediente_num as case_expediente_num,
      c.expediente_anio as case_expediente_anio,
      c.tribunal_nombre as case_tribunal_nombre
    FROM agreements a
    JOIN cases c ON a.case_id = c.id
    ${onlyUnread ? 'WHERE a.read_at IS NULL' : ''}
    ORDER BY a.fecha_publicacion DESC, a.id DESC
    LIMIT 100
  `;
  return await db.getAllAsync<AgreementRecord>(query);
}

export async function getUnreadCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM agreements WHERE read_at IS NULL'
  );
  return row ? row.count : 0;
}

export async function toggleAgreementRead(id: number, markRead: boolean): Promise<void> {
  const db = await getDb();
  const val = markRead ? new Date().toISOString() : null;
  await db.runAsync('UPDATE agreements SET read_at = ? WHERE id = ?', [val, id]);
}

export async function markAllAgreementsRead(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE agreements SET read_at = datetime("now") WHERE read_at IS NULL');
}

/**
 * Saves or updates agreements retrieved from the scraper microservice.
 * Detects modifications using content_hash, records agreement_revisions,
 * and returns counts of new and modified agreements.
 */
export async function saveAgreementsFromRemote(
  caseId: number,
  remotes: RemoteAgreementData[]
): Promise<{
  newCount: number;
  modifiedCount: number;
  newAgreements: RemoteAgreementData[];
  modifiedAgreements: RemoteAgreementData[];
}> {
  const db = await getDb();
  let newCount = 0;
  let modifiedCount = 0;
  const newAgreements: RemoteAgreementData[] = [];
  const modifiedAgreements: RemoteAgreementData[] = [];

  for (const item of remotes) {
    const existing = await db.getFirstAsync<AgreementRecord>(
      'SELECT id, content_hash, sintesis, partes, cuadernillo, texto_completo, acumulado FROM agreements WHERE case_id = ? AND id_detalle = ?',
      [caseId, item.id_detalle]
    );

    if (!existing) {
      // New agreement
      await db.runAsync(
        `INSERT INTO agreements (
          case_id, id_detalle, fecha_publicacion, secretaria,
          tipo_asunto, cuadernillo, partes, sintesis,
          texto_completo, acumulado, content_hash, is_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          caseId,
          item.id_detalle,
          item.fecha_publicacion,
          item.secretaria,
          item.tipo_asunto,
          item.cuadernillo,
          item.partes,
          item.sintesis,
          item.texto_completo,
          item.acumulado,
          item.content_hash,
        ]
      );
      newCount++;
      newAgreements.push(item);
    } else if (existing.content_hash !== item.content_hash) {
      // Modified agreement
      await db.runAsync(
        `INSERT INTO agreement_revisions (
          agreement_id, previous_sintesis, previous_partes, previous_cuadernillo,
          previous_texto_completo, previous_acumulado, previous_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          existing.id,
          existing.sintesis,
          existing.partes,
          existing.cuadernillo,
          existing.texto_completo,
          existing.acumulado,
          existing.content_hash,
        ]
      );

      await db.runAsync(
        `UPDATE agreements SET
          secretaria = ?,
          tipo_asunto = ?,
          cuadernillo = ?,
          partes = ?,
          sintesis = ?,
          texto_completo = ?,
          acumulado = ?,
          content_hash = ?,
          is_modified = 1,
          read_at = NULL
        WHERE id = ?`,
        [
          item.secretaria,
          item.tipo_asunto,
          item.cuadernillo,
          item.partes,
          item.sintesis,
          item.texto_completo,
          item.acumulado,
          item.content_hash,
          existing.id,
        ]
      );
      modifiedCount++;
      modifiedAgreements.push(item);
    }
  }

  return { newCount, modifiedCount, newAgreements, modifiedAgreements };
}
