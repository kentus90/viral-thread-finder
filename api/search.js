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

    const systemPrompt = `Sei un ricercatore di tendenze virali. Cerchi discussioni REALI sul web usando web_search. Includi solo thread che hai effettivamente trovato nelle ricerche, con URL veri. Non inventare mai dati o numeri. Rispondi SOLO con JSON valido puro, zero testo, zero backtick.`;

    const userPrompt = `Cerca discussioni e thread reali e popolari su: "${topic}". Fonti: ${sourcesStr}.

ISTRUZIONI:
- Usa web_search per trovare discussioni REALI con URL verificabili
- Includi SOLO thread che trovi davvero nelle ricerche, mai inventati
- Per i numeri (upvotes, comments, views): inserisci il valore solo se lo trovi nella fonte, altrimenti null
- Includi quanti thread reali riesci a trovare (anche solo 4-5 se sono pochi)
- Non scrivere MAI testo di rifiuto o spiegazioni: rispondi sempre e solo con il JSON

Formato JSON:
{"threads":[{"title":"titolo reale","source":"reddit","url":"URL reale verificabile","summary":"di cosa parla","upvotes":null,"comments":null,"views":null,"date":"quando","viral_score":7}]}

Ordina per viral_score decrescente. Se non trovi nulla, restituisci {"threads":[]}.`;

    const tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    let messages = [{ role: 'user', content: userPrompt }];
    let fullText = '';

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
          tools,
          messages
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
        if (!toolUseBlocks.length) break;
        messages.push({ role: 'assistant', content: data.content });
        messages.push({
          role: 'user',
          content: toolUseBlocks.map(b => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: 'Ricerca completata. Ora restituisci SOLO il JSON con i thread reali trovati. Nessun testo di spiegazione o rifiuto, solo il JSON.'
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
