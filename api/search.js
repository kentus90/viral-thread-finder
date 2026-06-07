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

    const oggi = new Date();
    const dataOggi = oggi.toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });

    const systemPrompt = `Sei un ricercatore di tendenze virali. Cerchi discussioni REALI e RECENTI sul web usando web_search. Includi solo thread realmente trovati, con URL veri. Non inventare mai dati. Rispondi SOLO con JSON valido puro, zero testo, zero backtick.`;

    const userPrompt = `Cerca discussioni e thread reali e MOLTO RECENTI su: "${topic}". Fonti: ${sourcesStr}.

DATA DI OGGI: ${dataOggi}.

REGOLA TEMPORALE FONDAMENTALE:
- Includi SOLO contenuti pubblicati nelle ultime 24-48 ore (da ieri a oggi).
- Scarta qualsiasi thread o news piu vecchio di 2 giorni, anche se popolare.
- Nelle query usa termini come "oggi", "ultime ore", la data di oggi, "breaking" per forzare risultati freschi.
- Se non esistono discussioni cosi recenti, restituisci meno risultati ma SOLO recenti. Mai contenuti vecchi.

QUANTITA: trova al massimo 5-6 thread, i piu virali e recenti. Meglio pochi e ottimi che tanti.

STRATEGIA:
- Se il termine e generico, scomponilo in sotto-argomenti specifici e attuali.
- Fai 2-3 ricerche diverse mirate alle ultime ore.

ALTRE REGOLE:
- Solo thread reali con URL verificabili, mai inventati.
- Numeri (upvotes, comments, views) solo se reali, altrimenti null.
- Nel campo "date" indica la data precisa del contenuto.
- Non scrivere MAI testo di rifiuto: rispondi sempre e solo con il JSON.

Formato JSON:
{"threads":[{"title":"titolo reale","source":"reddit","url":"URL reale","summary":"di cosa parla","upvotes":null,"comments":null,"views":null,"date":"data precisa","viral_score":7}]}

Ordina per viral_score decrescente.`;

    const tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    let messages = [{ role: 'user', content: userPrompt }];
    let fullText = '';

    for (let i = 0; i < 6; i++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
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
            content: 'Ricerca completata. Ora restituisci SOLO il JSON con i thread reali e recenti trovati. Nessun testo, solo JSON.'
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
