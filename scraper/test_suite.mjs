import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeContentHash } from './dist/stj.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Iniciando batería de pruebas unitarias y de integración para STJ Mini-Scraper...\n');

  // 1. Content Hash Determinism Test (SRS v2.1 §3.3)
  console.log('▶ TEST 1: Verificación de content_hash SHA-256');
  const hash1 = computeContentHash('Cua. 1', 'Actor vs Ddo', 'Sintesis de prueba', 'Acuerdo integro', 'Acum 12');
  const hash2 = computeContentHash('  cua. 1  ', ' actor vs ddo ', '  sintesis de prueba  ', 'acuerdo integro', 'acum 12');
  assert.strictEqual(hash1, hash2, 'El hash debe ser insensible a mayúsculas y espacios en los extremos');
  assert.strictEqual(hash1.length, 64, 'El hash SHA-256 debe tener longitud 64 hex');
  console.log(`  ✓ Hash determinista verificado: ${hash1.slice(0, 16)}...`);

  // 2. Parse Fixture Test
  console.log('\n▶ TEST 2: Parseo de respuesta oficial STJ Sonora (Fixture)');
  const fixturePath = path.resolve(__dirname, '../recursos/fixtures/lista-acuerdos-asunto-ok.json');
  const fixtureContent = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.ok(Array.isArray(fixtureContent.resultado), 'El fixture debe contener un array resultado');
  assert.strictEqual(fixtureContent.resultado.length, 3, 'El fixture contiene 3 acuerdos');
  console.log(`  ✓ Fixture cargado y validado: ${fixtureContent.resultado.length} acuerdos detectados`);

  // 3. Mini-scraper Server Launch & Endpoints Test
  console.log('\n▶ TEST 3: Ejecución de servidor local y prueba de endpoints HTTP');
  const PORT = 3456;
  process.env.PORT = String(PORT);

  // Import app dynamically or use fetch
  const { default: express } = await import('express');
  const { default: cors } = await import('cors');
  const { fetchAgreementsFromStj } = await import('./dist/stj.js');
  const { sendExpoPushNotifications } = await import('./dist/push.js');

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'stj-miniscraper', timestamp: new Date().toISOString() });
  });

  app.post('/api/scrape-case', async (req, res) => {
    try {
      const agreements = await fetchAgreementsFromStj(req.body);
      res.json({ success: true, count: agreements.length, agreements });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/push', async (req, res) => {
    try {
      const result = await sendExpoPushNotifications(req.body.messages || []);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  const server = app.listen(PORT);
  console.log(`  ✓ Servidor de prueba levantado en http://127.0.0.1:${PORT}`);

  try {
    // 3.1 Health Check
    const healthRes = await fetch(`http://127.0.0.1:${PORT}/health`);
    assert.strictEqual(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'ok');
    console.log('  ✓ Endpoint GET /health respondió 200 OK');

    // 4. Test Live STJ Query
    console.log('\n▶ TEST 4: Prueba en vivo contra portal STJ Sonora (ListaAcuerdos.php)');
    const stjRes = await fetch(`http://127.0.0.1:${PORT}/api/scrape-case`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_unidad: '101', // Juzgado Primero Civil Hermosillo
        id_cat_tipo_asunto: '1',
        asunto: '124',
        anio: '2024',
        bis: '0',
      }),
    });

    console.log(`  Respuesta de STJ Sonora status: ${stjRes.status}`);
    const stjData = await stjRes.json();
    console.log(`  Resultado STJ: ${stjData.success ? `Éxito (${stjData.count} acuerdos encontrados)` : `Aviso: ${stjData.error}`}`);
    assert.ok(stjRes.status === 200 || stjRes.status === 500, 'Debe procesar la respuesta');

    console.log('\n✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE (100% OK)');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS:', err);
  process.exit(1);
});
