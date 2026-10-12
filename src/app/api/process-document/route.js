import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file) throw new Error("No file");

    const buf = Buffer.from(await file.arrayBuffer());
    const GROQ_KEY = process.env.GROQ_API_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    let text = "";

    // IMAGE = Gemini 2.0 Flash - always works
    if (file.type.startsWith('image/')) {
      const b64 = buf.toString('base64');
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: "Extract ALL text, numbers, amounts, dates from this image verbatim. Return clean text only." },
            { inline_data: { mime_type: file.type, data: b64 } }
          ]}]
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Gemini: ${JSON.stringify(j).slice(0,600)}`);
      text = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    // AUDIO = Groq Whisper - still works
    else {
      const fd = new FormData();
      fd.append("file", new File([buf], file.name || "voice.ogg", { type: file.type }));
      fd.append("model", "whisper-large-v3");
      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: fd
      });
      const j = await r.json();
      if (!r.ok) throw new Error(`Whisper: ${JSON.stringify(j).slice(0,600)}`);
      text = j.text || "";
    }

    if (!text.trim()) throw new Error("Extraction empty");

    // Save to Supabase
    const fileName = file.name || `file-${Date.now()}`;
    const chunks = text.match(/.{1,1000}/g) || [text];
    for (const c of chunks) {
      await supabase.from('brain_chunks').insert({ content: c, file_name: fileName });
    }

    return NextResponse.json({ success: true, fileName, chunksProcessed: chunks.length, extractedPreview: text.slice(0,800) });

  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
