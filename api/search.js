export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurata.' });

  try {
    const { topic, sources } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic mancante' });

    const sourcesStr = (sources && sources.length > 0) ? sources.join(', ') : 'tutte le piattaforme';

    const systemPrompt = `Sei un esperto di social media. Rispondi SEMPRE e SOLO con JSON valido puro. Zero testo aggiuntivo. Zero backtick. Solo il JSON.`;

    const userPrompt = `Trova i thread piu virali su: "${topic}". Fonti: ${sourcesStr}.

Rispondi SOLO con questo JSON, nient altro:
{"threads":[{"title":"titolo","source":"reddit","url":"https://...","summary":"perche e virale","upvotes":1000,"comments":500,"shares":null,"views":null,"date":"giugno 2026","viral_score":9}]}

Trova 8 thread reali. Ordina per viral_score decrescente. Null dove non sai i numeri.`;

    let messages = [{ role: 'user', content: userPrompt }];
    let fullText = '';
    let lastData = null;

    for (let i = 0; i < 8; i++) {
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
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: err.error?.message || `Anthropic HTTP ${response.status}` });
      }

      lastData = await response.json();

      const textBlocks = lastData.content.filter(b => b.type === 'text');
      if (textBlocks.length > 0) fullText = textBlocks.map(b => b.text).join('\n');

      if (lastData.stop_reason === 'end_turn') break;

      if (lastData.stop_reason === 'tool_use') {
        const toolUseBlocks = lastData.content.filter(b => b.type === 'tool_use');
        if (!toolUseBlocks.length) break;
        messages.push({ role: 'assistant', content: lastData.content });
        messages.push({
          role: 'user',
          content: toolUseBlocks.map(b => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: 'Ricerca completata. Ora genera il JSON richiesto e nient altro.'
          }))
        });
        continue;
      }
      break;
    }

    return res.status(200).json({ text: fullText });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
