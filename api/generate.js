module.exports = async (req, res) => {
    // Разрешаем только POST-запросы
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (!process.env.TextGenerator) {
            return res.status(500).json({ error: 'Server misconfiguration: TextGenerator API key env var is not set' });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.TextGenerator}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.error?.message || 'Gemini API request failed' });
        }

        // Extract the actual generated text from Gemini's nested response shape
        const candidate = data.candidates && data.candidates[0];
        const text = candidate?.content?.parts?.map(p => p.text).join('') || '';

        if (!text) {
            // e.g. blocked by safety filters -> data.promptFeedback.blockReason
            const blockReason = data.promptFeedback?.blockReason;
            return res.status(502).json({
                error: blockReason
                    ? `Gemini blocked the request: ${blockReason}`
                    : 'Gemini returned no content'
            });
        }

        return res.status(200).json({ result: text });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
