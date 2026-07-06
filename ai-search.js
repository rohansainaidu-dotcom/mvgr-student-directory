const GROQ_API_KEY = "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";

async function aiSearch(query) {
  const prompt = `You are a student directory assistant for MVGR College.
The user typed this search query: "${query}"

Based on this query, extract the following filters:
- name: (string or null)
- roll: (string or null)
- branch: (one of CSE, ECE, MECH, CIVIL, EEE or null)
- sem: (number 1-8 or null)
- section: (one of A, B, C or null)

Respond ONLY with a valid JSON object like this example:
{"name": null, "roll": null, "branch": "CSE", "sem": 3, "section": "A"}

Rules:
- No explanation
- No markdown
- No backticks
- Just the raw JSON object`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 150,
        temperature: 0,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error("Groq API error:", errData);
      return null;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const clean = text.replace(/```json|```/g, "").trim();
    const filters = JSON.parse(clean);
    return filters;

  } catch (error) {
    console.error("AI search error:", error);
    return null;
  }
}