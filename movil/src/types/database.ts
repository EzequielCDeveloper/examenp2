export interface CaseRecord {
  id: number;
  provider_id: string;
  alias: string;
  expediente_num: string;
  expediente_anio: number;
  bis: number;
  clave_juzgado: string;
  tribunal_nombre: string;
  tipo_asunto: string;
  ciudad: string;
  provider_params: string; // JSON string
  status: 'active' | 'archived';
  track_enabled: number; // 1 or 0
  baseline_done: number; // 1 or 0
  last_checked_at: string | null;
  last_ok_at: string | null;
  last_error_code: string | null;
  last_error_msg: string | null;
  warning_code: string | null;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

export interface AgreementRecord {
  id: number;
  case_id: number;
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
  is_modified: number; // 1 or 0
  read_at: string | null;
  discovered_at: string;

  // Joined from cases table
  case_alias?: string;
  case_expediente_num?: string;
  case_expediente_anio?: number;
  case_tribunal_nombre?: string;
}

export interface RemoteAgreementData {
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
