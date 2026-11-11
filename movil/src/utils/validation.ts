/**
 * Input validation utilities for STJ Sonora Mobile App.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates case alias.
 * Must be non-empty, between 2 and 100 characters.
 */
export function validateAlias(alias: string): ValidationResult {
  const trimmed = alias.trim();
  if (!trimmed) {
    return { valid: false, error: 'El alias no puede estar vacío.' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'El alias debe tener al menos 2 caracteres.' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'El alias no puede exceder 100 caracteres.' };
  }
  return { valid: true };
}

/**
 * Validates expediente / asunto number.
 * Must be 1 to 6 digits, strictly positive integer.
 */
export function validateExpedienteNum(num: string): ValidationResult {
  const trimmed = num.trim();
  if (!trimmed) {
    return { valid: false, error: 'El número de asunto es obligatorio.' };
  }
  if (!/^\d{1,6}$/.test(trimmed)) {
    return { valid: false, error: 'El asunto debe ser un número entero de 1 a 6 dígitos sin letras ni símbolos.' };
  }
  if (parseInt(trimmed, 10) <= 0) {
    return { valid: false, error: 'El número de asunto debe ser mayor a 0.' };
  }
  return { valid: true };
}

/**
 * Validates expediente year.
 * Must be exactly 4 digits, between 1980 and 2100.
 */
export function validateExpedienteAnio(anioStr: string | number): ValidationResult {
  const trimmed = String(anioStr).trim();
  if (!trimmed) {
    return { valid: false, error: 'El año es obligatorio.' };
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return { valid: false, error: 'El año debe constar de 4 dígitos (ej. 2026).' };
  }
  const anio = parseInt(trimmed, 10);
  const currentYear = new Date().getFullYear();
  if (anio < 1980 || anio > currentYear + 5) {
    return { valid: false, error: `El año debe estar entre 1980 y ${currentYear + 5}.` };
  }
  return { valid: true };
}

/**
 * Validates 'bis' field.
 * Optional or 0-99 digits.
 */
export function validateBis(bisStr: string): ValidationResult {
  const trimmed = bisStr.trim();
  if (!trimmed) {
    return { valid: true };
  }
  if (!/^\d{1,2}$/.test(trimmed)) {
    return { valid: false, error: 'El campo Bis debe ser un valor numérico entre 0 y 99.' };
  }
  return { valid: true };
}

/**
 * Validates HTTP/HTTPS URL for scraper service.
 */
export function validateUrl(url: string): ValidationResult {
  const trimmed = url.trim();
  if (!trimmed) {
    return { valid: false, error: 'La URL no puede estar vacía.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'La URL debe iniciar con http:// o https://' };
    }
    if (!parsed.hostname) {
      return { valid: false, error: 'El formato del host en la URL es inválido.' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'La URL ingresada no es válida (ej. https://stj-miniscraper.onrender.com).' };
  }
}

/**
 * Sanitizes search input to prevent injection or invalid characters.
 */
export function sanitizeSearch(query: string, maxLen = 80): string {
  return query.slice(0, maxLen).replace(/[\r\n\t]/g, ' ');
}
