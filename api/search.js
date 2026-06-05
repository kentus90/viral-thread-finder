export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurata nelle variabili d\'ambiente Vercel.' });

  try {
    const { topic, sources, messages } = req.body;

    const systemPrompt = `Sei un esperto di social media e tendenze virali. Quando ti viene chiesto di trovare thread virali, usa il web search per cercare informazioni aggiornate, poi rispondi SEMPRE e SOLO con un JSON valido, senza testo prima o dopo, senza markdown, senza backtick. Solo JSON puro.`;

    const sourcesStr = (sources && sources.length > 0) ? sources.join(', ') : 'tutte le piattaforme';
    const userPrompt = `Trova i thread e le discussioni piÃ¹ virali su: "${topic}". Cerca su: ${sourcesStr}.

Rispondi SOLO con questo JSON (nessun testo, nessun backtick, nessun markdown):
{"threads":[{"title":"...","source":"reddit|telegram|twitter|web|news|youtube","url":"...o null","summary":"...","upvotes":null,"comments":null,"shares":null,"views":null,"date":"...","viral_score":8,"subreddit":null,"channel":null}]}

Trova 8-12 thread reali. Ordina per viral_score decrescente. Metti null dove non conosci i numeri.`;

    const tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    let convMessages = messages || [{ role: 'user', content: userPrompt }];

    // Multi-turn loop for web search
    let fullText = '';
    let loopCount = 0;

    while (loopCount < 6) {
      loopCount++;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          system: systemPrompt,
          tools,
          messages: convMessages
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: err.error?.message || `HTTP ${response.status}` });
      }

      const data = await response.json();

      const textBlocks = data.content.filter(b => b.type === 'text');
      if (textBlocks.length > 0) fullText = textBlocks.map(b => b.text).join('\n');

      if (data.stop_reason === 'end_turn') break;

      if (data.stop_reason === 'tool_use') {
        const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
        if (toolUseBlocks.length === 0) break;

        convMessages.push({ role: 'assistant', content: data.content });
        const toolResults = toolUseBlocks.map(b => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: 'Risultati trovati, ora genera il JSON richiesto.'
        }));
        convMessages.push({ role: 'user', content: toolResults });
        continue;
      }

      break;
    }

    return res.status(200).json({ text: fullText });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
