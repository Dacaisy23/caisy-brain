const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY;
const fileToBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

export async function smartIngest(file, saveToBrain) {
  let text = "";
  console.log("Ingesting:", file.name, file.type);
  if (file.type.startsWith('image/')) {
    const base64 = await fileToBase64(file);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.2-11b-vision-preview", messages: [{ role: "user", content: [{ type: "text", text: "Extract ALL text, numbers, dates, amounts from this image. If check, give all details." }, { type: "image_url", image_url: { url: base64 } }] }] })
    });
    const data = await res.json();
    text = data.choices[0].message.content;
  } else if (file.type.startsWith('audio/') || file.type.includes('ogg') || file.type.includes('webm') || file.name.includes('voice')) {
    const form = new FormData(); form.append("file", file); form.append("model", "whisper-large-v3");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { "Authorization": `Bearer ${GROQ_API_KEY}` }, body: form });
    const data = await res.json(); text = data.text;
  } else {
    text = await file.text();
  }
  if (saveToBrain) await saveToBrain(text, file.name);
  return text;
}
