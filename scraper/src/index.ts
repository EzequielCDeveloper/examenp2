import express, { Request, Response } from 'express';
import cors from 'cors';
import { fetchAgreementsFromStj, StjCaseParams } from './stj.js';
import { sendExpoPushNotifications, PushMessage } from './push.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'stj-miniscraper', timestamp: new Date().toISOString() });
});

// Scrape single case
app.post('/api/scrape-case', async (req: Request, res: Response): Promise<void> => {
  try {
    const params: StjCaseParams = req.body;
    if (!params.id_unidad || !params.asunto || !params.anio) {
      res.status(400).json({ error: 'Missing required parameters: id_unidad, asunto, anio' });
      return;
    }

    const agreements = await fetchAgreementsFromStj(params);
    res.json({
      success: true,
      caseParams: params,
      count: agreements.length,
      agreements,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error scraping STJ' });
  }
});

// Scrape multiple cases with polite rate-limiting (1,200 ms between requests)
app.post('/api/scrape-batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { cases }: { cases: Array<{ id: number; params: StjCaseParams }> } = req.body;

    if (!Array.isArray(cases)) {
      res.status(400).json({ error: 'Body must contain an array of cases' });
      return;
    }

    const results: Array<{
      id: number;
      success: boolean;
      agreements?: any[];
      error?: string;
    }> = [];

    for (let i = 0; i < cases.length; i++) {
      const item = cases[i];
      try {
        const agreements = await fetchAgreementsFromStj(item.params);
        results.push({
          id: item.id,
          success: true,
          agreements,
        });
      } catch (err: any) {
        results.push({
          id: item.id,
          success: false,
          error: err.message || 'Scrape failed',
        });
      }

      // Respect rate limit between court inquiries
      if (i < cases.length - 1) {
        await sleep(1200);
      }
    }

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Push notification gateway
app.post('/api/push', async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages }: { messages: PushMessage[] } = req.body;
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: 'Messages must be an array' });
      return;
    }

    const result = await sendExpoPushNotifications(messages);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`⚖️ STJ Sonora Miniscraper listening on port ${PORT}`);
});
