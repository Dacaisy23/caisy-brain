import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

async function sleep(ms:number){ return new Promise(r=>setTimeout(r, ms)); }

async function embedWithRetry(text: string, apiKey: string, retries=5): Promise<number[]|null> {
  for(let i=0; i<retries; i++){
    try{
      const embUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
      const embRes = await fetch(embUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "models/text-embedding-004", content: { parts: [{ text }] } })
      });
      const embData = await embRes.json();
      if(embData.error){
        if(embData.error.code === 429){
          console.log(`Rate limit, waiting 12s...`);
          await sleep(12000);
          continue;
        }
        throw new Error(JSON.stringify(embData.error));
      }
      return embData.embedding?.values || null;
    }catch(e){
      await sleep(2000 * (i+1));
    }
  }
  return null;
}

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    if (name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    if (name.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let fullText = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        fullText += `\n--- Sheet: ${sheetName} ---\n${XLSX.utils.sheet_to_csv(sheet)}\n`;
      });
      return fullText;
    }
    return buffer.toString('utf-8');
  } catch (err: any) {
    return buffer.toString('utf-8').slice(0, 50000);
  }
}
function chunkText(text: string, size = 2000, overlap = 200): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.filter(c => c.trim().length > 100);
}
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    if (!files || files.length === 0) return NextResponse.json({ error: 'No files' }, { status: 400 });
    const supabase = await createClient();
    const apiKey = (process.env.GEMINI_API_KEY_1 || '').trim();
    let totalChunks = 0;
    for (const file of files) {
      console.log(`Processing: ${file.name}`);
      const fullText = await extractTextFromFile(file);
      if (!fullText || fullText.trim().length < 20) continue;
      const textChunks = chunkText(fullText);
      console.log(` -> ${textChunks.length} chunks`);
      for (const chunkContent of textChunks) {
        const embedding = await embedWithRetry(chunkContent, apiKey);
        if(!embedding) continue;
        await supabase.from('chunks').insert({ content: chunkContent, file_name: file.name, embedding });
        totalChunks++;
        await sleep(400);
      }
    }
    return NextResponse.json({ success: true, chunksCreated: totalChunks });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
