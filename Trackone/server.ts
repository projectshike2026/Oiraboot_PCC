import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      await new Promise((r) => setTimeout(r, 500));
      return await fn();
    }
    throw err;
  }
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.post('/api/ai/document-qa', async (req, res) => {
    try {
      const { corpus, query, lang } = req.body as {
        corpus?: string;
        query?: string;
        lang?: string;
      };
      if (typeof corpus !== 'string' || !corpus.trim() || typeof query !== 'string' || !query.trim()) {
        res.status(400).json({ error: 'Missing required corpus or query.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.json({ ok: false, fallback: true, reason: 'GEMINI_API_KEY is not configured.' });
        return;
      }

      const response = await runWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `DOCUMENTS:\n${corpus.slice(0, 28000)}\n\nQUESTION: ${query.trim()}`,
          config: {
            systemInstruction: `You are a strict Document Assistant. Answer ONLY using the provided PDF pages. Do NOT use external knowledge. If the answer is not explicitly supported in the provided pages, set found=false, answer="Not found in the document.", sourceDoc="", pageNumber=0, and excerpt="". Match the user's language (${lang === 'bn' ? 'Bangla' : 'English'}) for the answer field while keeping the excerpt verbatim from the cited PDF page. Never invent page numbers, filenames, or quotes.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                found: { type: Type.BOOLEAN },
                answer: { type: Type.STRING },
                sourceDoc: { type: Type.STRING },
                pageNumber: { type: Type.INTEGER },
                excerpt: { type: Type.STRING },
              },
              required: ['found', 'answer', 'sourceDoc', 'pageNumber', 'excerpt'],
            },
          },
        })
      );

      const text = response.text?.trim();
      if (!text) {
        res.json({ ok: false, fallback: true, reason: 'Empty response from Gemini API.' });
        return;
      }
      const parsed = JSON.parse(text);
      res.json({ ok: true, data: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upstream Gemini error.';
      res.json({ ok: false, fallback: true, reason: message });
    }
  });

  app.post('/api/ai/generate-quiz', async (req, res) => {
    try {
      const { corpus, count, difficulty, lang } = req.body as {
        corpus?: string;
        count?: number;
        difficulty?: string;
        lang?: string;
      };
      if (typeof corpus !== 'string' || !corpus.trim()) {
        res.status(400).json({ error: 'Missing document corpus.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.json({ ok: false, fallback: true, reason: 'GEMINI_API_KEY is not configured.' });
        return;
      }

      const safeCount = Math.min(Math.max(Number(count) || 5, 5), 10);
      const response = await runWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: corpus.slice(0, 24000),
          config: {
            systemInstruction: `Create exactly ${safeCount} multiple-choice questions at "${difficulty || 'Intermediate'}" difficulty strictly from the provided PDF text. Language for questions & options: ${lang === 'bn' ? 'Bangla' : 'English'}. Each question must have exactly 4 distinct options, 1 valid correctIndex (0-3, varied across questions), exact integer pageNumber, exact sourceDoc filename, and a verbatim explanationQuote copied from that page.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER },
                  pageNumber: { type: Type.INTEGER },
                  sourceDoc: { type: Type.STRING },
                  explanationQuote: { type: Type.STRING },
                },
                required: [
                  'question',
                  'options',
                  'correctIndex',
                  'pageNumber',
                  'sourceDoc',
                  'explanationQuote',
                ],
              },
            },
          },
        })
      );

      const text = response.text?.trim();
      if (!text) {
        res.json({ ok: false, fallback: true, reason: 'Empty response from Gemini API.' });
        return;
      }
      const parsed = JSON.parse(text);
      res.json({ ok: true, data: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upstream Gemini error.';
      res.json({ ok: false, fallback: true, reason: message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Document Intelligence Studio listening on http://localhost:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
