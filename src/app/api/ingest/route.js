import { NextResponse } from 'next/server';
export async function POST(req) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    const GROQ_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
    const buf = Buffer.from(await file.arrayBuffer());
    let text = "";
    if (file.type.startsWith('image/')) {
      const base64 = `data:${file.type};base64,${buf.toString('base64')}`;
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.2-11b-vision-preview",
          messages: [{ role: "user", content: [
            { type: "text", text: "Extract ALL text, numbers, dates, amounts from this image. Be exhaustive." },
            { type: "image_url", image_url: { url: base64 } }
          ]}]
        })
      });
      const j = await r.json();
      text = j.choices?.[0]?.message?.content || "";
    } else if (file.type.startsWith('audio/') || file.type.includes('ogg') || file.type.includes('webm') || file.name.endsWith('.ogg')) {
      const fd = new FormData();
      fd.append("file", new File([buf], file.name, { type: file.type }));
      fd.append("model", "whisper-large-v3");
      const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_KEY}` },
        body: fd
      });
      const j = await r.json();
      text = j.text || "";
    } else {
      text = buf.toString('utf8');
    }
    return NextResponse.json({ text, fileName: file.name, fileType: file.type });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
