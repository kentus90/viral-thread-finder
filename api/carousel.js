export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurata.' });

  try {
    const { thread } = req.body;
    if (!thread) return res.status(400).json({ error: 'Thread mancante' });

    const systemPrompt = `Sei un social media copywriter esperto in caroselli Instagram virali in ITALIANO. Scrivi copy con HOOK di curiosita che obbligano a scorrere. Stile editoriale ma accattivante. Traduci sempre tutto in italiano corretto, anche se la fonte e in inglese. Rispondi SOLO con JSON valido puro, zero testo, zero backtick.`;

    const userPrompt = `Crea il copy di un carosello Instagram (stile editoriale, hook curiosita, TUTTO IN ITALIANO) basato su questo thread virale REALE:

Titolo: ${thread.title || ''}
Fonte: ${thread.source || ''}
Riassunto: ${thread.summary || ''}
Data: ${thread.date || ''}

REGOLE COPY:
- SCRIVI TUTTO IN ITALIANO. Se la fonte e in inglese, traduci e adatta in italiano naturale.
- 5-6 slide totali
- Slide 1 (cover): un HOOK forte e breve che crea curiosita SENZA spiegare tutto (es. "Nessuno se lo aspettava." / "Sta succedendo qualcosa di strano."). Max 6 parole. Aggiungi una riga sotto-titolo che incuriosisce.
- Slide intermedie: UNA frase per slide, breve e di impatto, che costruisce tensione e fa venire voglia di scorrere. Rivela le info un pezzo alla volta.
- Ultima slide: una conclusione + invito a commentare/seguire.
- Tono: coinvolgente, ritmo da social, frasi brevi. NIENTE banalita tipo "scopri di piu".
- Basati SOLO sui fatti reali del thread. Non inventare dettagli falsi.
- Ogni slide ha: "kicker" (etichetta breve maiuscola in italiano, es "ESCLUSIVA", "IL FATTO", "PERCHE CONTA") e "text" (la frase).

Formato JSON:
{"slides":[{"kicker":"ESCLUSIVA","text":"frase hook breve","sub":"sottotitolo curiosita solo per la prima slide altrimenti vuoto"}]}

Genera ora, tutto in italiano.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error?.message || `HTTP ${response.status}` });
    }

    const data = await response.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
