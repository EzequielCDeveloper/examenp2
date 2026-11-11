export interface UnidadJudicial {
  idUnidad: number;
  nombre: string;
  municipio: string;
}

export interface TipoAsunto {
  id: number;
  nombre: string;
}

export const TIPOS_ASUNTO: TipoAsunto[] = [
  { id: 1, nombre: 'EXPEDIENTE' },
  { id: 2, nombre: 'EXHORTO' },
  { id: 3, nombre: 'AMPARO' },
  { id: 4, nombre: 'CUADERNILLO' },
  { id: 6, nombre: 'TOCA' },
];

export const UNIDADES_SONORA: UnidadJudicial[] = [
  { idUnidad: 175, nombre: 'SECRETARIA GENERAL DE ACUERDOS (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 101, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO CIVIL (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 102, nombre: 'JUZGADO SEGUNDO DE PRIMERA INSTANCIA DE LO CIVIL (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 103, nombre: 'JUZGADO TERCERO DE PRIMERA INSTANCIA DE LO CIVIL (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 104, nombre: 'JUZGADO CUARTO DE PRIMERA INSTANCIA DE LO CIVIL (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 105, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO MERCANTIL (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 106, nombre: 'JUZGADO SEGUNDO DE PRIMERA INSTANCIA DE LO MERCANTIL (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 107, nombre: 'JUZGADO TERCERO DE PRIMERA INSTANCIA DE LO MERCANTIL (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 108, nombre: 'JUZGADO CUARTO DE PRIMERA INSTANCIA DE LO MERCANTIL (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 109, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO FAMILIAR (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 110, nombre: 'JUZGADO SEGUNDO DE PRIMERA INSTANCIA DE LO FAMILIAR (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 111, nombre: 'JUZGADO TERCERO DE PRIMERA INSTANCIA DE LO FAMILIAR (HERMOSILLO)', municipio: 'Hermosillo' },
  { idUnidad: 115, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO CIVIL (CD. OBREGON)', municipio: 'Cajeme' },
  { idUnidad: 116, nombre: 'JUZGADO SEGUNDO DE PRIMERA INSTANCIA DE LO CIVIL (CD. OBREGON)', municipio: 'Cajeme' },
  { idUnidad: 117, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO MERCANTIL (CD. OBREGON)', municipio: 'Cajeme' },
  { idUnidad: 118, nombre: 'JUZGADO SEGUNDO DE PRIMERA INSTANCIA DE LO MERCANTIL (CD. OBREGON)', municipio: 'Cajeme' },
  { idUnidad: 119, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO FAMILIAR (CD. OBREGON)', municipio: 'Cajeme' },
  { idUnidad: 121, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO CIVIL (NOGALES)', municipio: 'Nogales' },
  { idUnidad: 122, nombre: 'JUZGADO SEGUNDO DE PRIMERA INSTANCIA DE LO CIVIL (NOGALES)', municipio: 'Nogales' },
  { idUnidad: 123, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO FAMILIAR (NOGALES)', municipio: 'Nogales' },
  { idUnidad: 127, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO CIVIL (AGUA PRIETA)', municipio: 'Agua Prieta' },
  { idUnidad: 131, nombre: 'JUZGADO DE PRIMERA INSTANCIA DE LO CIVIL (CABORCA)', municipio: 'Caborca' },
  { idUnidad: 133, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO CIVIL (GUAYMAS)', municipio: 'Guaymas' },
  { idUnidad: 137, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO CIVIL (NAVOJOA)', municipio: 'Navojoa' },
  { idUnidad: 141, nombre: 'JUZGADO DE PRIMERA INSTANCIA DE LO CIVIL (SAN LUIS RIO COLORADO)', municipio: 'San Luis Rio Colorado' },
  { idUnidad: 143, nombre: 'JUZGADO PRIMERO DE PRIMERA INSTANCIA DE LO FAMILIAR (SAN LUIS RIO COLORADO)', municipio: 'San Luis Rio Colorado' },
];
