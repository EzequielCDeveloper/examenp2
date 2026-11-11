import { createHash } from 'node:crypto';

export const STJ_BASE_URL = 'https://stjsonora.gob.mx/api/ListaAcuerdos.php';
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
export const DEFAULT_REFERER = 'https://stjsonora.gob.mx/Publicaciones/ListaAcuerdos.html';

export interface StjCaseParams {
  id_unidad: string | number;
  id_cat_tipo_asunto: string | number;
  asunto: string | number;
  anio: string | number;
  bis?: string | number;
  id_cat_grupo_ramo?: string | number;
}

export interface RemoteAgreement {
  id_detalle: string;
  fecha_publicacion: string;
  secretaria: string;
  tipo_asunto: string;
  cuadernillo: string;
  partes: string;
  sintesis: string;
  texto_completo: string;
  acumulado: string;
  content_hash: string;
}

/**
 * Deterministic calculation of content_hash:
 * cuadernillo | partes | sintesis | texto_completo | acumulado
 * Trimmed and lowercased before joining. Strictly conforms to SRS v2.1 §3.3.
 */
export function computeContentHash(
  cuadernillo: string,
  partes: string,
  sintesis: string,
  textoCompleto: string,
  acumulado: string
): string {
  const norm = (s: string) => s.trim().toLowerCase();
  const raw = [
    norm(cuadernillo),
    norm(partes),
    norm(sintesis),
    norm(textoCompleto),
    norm(acumulado),
  ].join('|');

  return createHash('sha256').update(raw).digest('hex');
}

export async function fetchAgreementsFromStj(params: StjCaseParams): Promise<RemoteAgreement[]> {
  const query = new URLSearchParams({
    IdUnidad: String(params.id_unidad),
    TipoConsulta: 'Asunto',
    IdCatTipoAsunto: String(params.id_cat_tipo_asunto || '1'),
    Asunto: String(params.asunto),
    Anio: String(params.anio),
    Bis: String(params.bis || '0'),
  });

  if (params.id_cat_grupo_ramo) {
    query.set('IdCatGrupoRamo', String(params.id_cat_grupo_ramo));
  }

  const url = `${STJ_BASE_URL}?${query.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Referer': DEFAULT_REFERER,
      'Accept': 'application/json, text/plain, */*',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`STJ API respondió con estado HTTP ${response.status}`);
  }

  const rawJson: any = await response.json();

  // Handle logical errors from STJ
  if (rawJson && typeof rawJson.error === 'string' && rawJson.error.trim().length > 0) {
    throw new Error(`Error lógico STJ: ${rawJson.error.trim()}`);
  }

  // Extract records array: can be raw array or rawJson.resultado
  let records: any[] = [];
  if (Array.isArray(rawJson)) {
    records = rawJson;
  } else if (rawJson && Array.isArray(rawJson.resultado)) {
    records = rawJson.resultado;
  } else {
    return [];
  }

  const agreements: RemoteAgreement[] = [];

  for (const item of records) {
    const idDetalle = String(item.IdDetalle ?? item.Id ?? '').trim();
    if (!idDetalle) continue;

    const fechaPub =
      String(item.FechaPublicacion || item.Fecha || '').split('T')[0].trim() ||
      new Date().toISOString().split('T')[0];

    const secretaria = String(item.Secretaria || '').trim();
    const tipoAsunto = String(item.TipoAsunto || '').trim();

    let cuadernillo = String(item.Cuadernillo || '').trim();
    const isCuadernillo = String(item.IsCuadernillo || '').trim();
    if (isCuadernillo === '1' && !cuadernillo.toLowerCase().startsWith('cua')) {
      cuadernillo = cuadernillo.length > 0 ? `Cua. ${cuadernillo}` : 'Cua.';
    }

    const partes = String(item.Partes || '').trim();
    const sintesis = String(item.Sintesis || '').trim();
    const textoCompleto = String(item.Acuerdo || item.TextoCompleto || '').trim();
    const acumulado = String(item.Acumulado || '').trim();

    const content_hash = computeContentHash(
      cuadernillo,
      partes,
      sintesis,
      textoCompleto,
      acumulado
    );

    agreements.push({
      id_detalle: idDetalle,
      fecha_publicacion: fechaPub,
      secretaria,
      tipo_asunto: tipoAsunto,
      cuadernillo,
      partes,
      sintesis,
      texto_completo: textoCompleto,
      acumulado,
      content_hash,
    });
  }

  return agreements;
}
