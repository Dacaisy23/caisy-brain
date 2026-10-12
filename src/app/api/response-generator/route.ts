import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const apiKey = (process.env.GEMINI_API_KEY_1 || '').trim();
    const supabase = await createClient();

    // FIXED: get file names + get newest 30 chunks (so invoice shows)
    const { data: chunks } = await supabase
     .from('chunks')
     .select('id, content, documents(file_name)')
     .order('id', { ascending: false })
     .limit(30);

    let contextText = chunks?.map((c:any) => `[FILE: ${c.documents?.file_name}] ${c.content}`).join('\n\n') || 'No files';
    if (contextText.length > 12000) contextText = contextText.slice(0, 12000);

    const modelsToTry = [
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-2.5-flash",
    ];

    for (const modelName of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are CAISY Brain. Use context with FILE names. Always say According to FILE:...\n\nContext:\n${contextText}\n\nQuestion: ${message}` }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
          })
        });
        const txt = await res.text();
        if (!res.ok) { console.log(`${modelName} failed: ${txt.slice(0,200)}`); continue; }
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