import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const apiKey = (process.env.GEMINI_API_KEY_1 || '').trim();
    const supabase = await createClient();
    const { data: chunks } = await supabase.from('chunks').select('id, content').limit(15);
    let contextText = chunks?.map((c:any) => c.content).join('\n\n') || 'No files';
    if (contextText.length > 10000) contextText = contextText.slice(0, 10000);

    const modelsToTry = [
      "gemini-2.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.5-flash",
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-3.6-flash"
    ];

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are CAISY Brain. Use this context:\n${contextText}\n\nQuestion: ${message}` }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
          })
        });
        const txt = await res.text();
        if (!res.ok) { console.log(`${modelName} failed: ${txt.slice(0,100)}`); continue; }
        const data = JSON.parse(txt);
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          console.log(`SUCCESS with ${modelName}`);
          return NextResponse.json({ reply, modelUsed: modelName, contextUsed: chunks });
        }
      } catch(e){ continue; }
    }
    throw new Error("All models busy - wait 1 min");
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
