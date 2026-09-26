import { NextResponse } from 'next/server';
import { createClient } from '../../../utils/supabase/server'; 
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_1 });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No document file received.' }, { status: 400 });
    }

    const cleanFileName = file.name.replace(/[^\x00-\x7F]/g, "").replace(/['"]/g, "");
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let extractedText = buffer.toString('utf-8').replace(/\u0000/g, ''); 

    if (!extractedText || extractedText.trim().length === 0 || file.type.includes('image')) {
      extractedText = `Document context placeholder for: ${cleanFileName}.`;
    }

    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([{ file_name: cleanFileName, file_path: `uploads/${Date.now()}-${cleanFileName}`, file_type: cleanFileName.split('.').pop() || 'unknown' }])
      .select('id')
      .single();

    if (docError) return NextResponse.json({ error: docError.message }, { status: 500 });
    const documentId = docData?.id;

    const chunkSize = 500;
    const textChunks: string[] = [];
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      textChunks.push(extractedText.substring(i, i + chunkSize));
    }

    const chunkInsertRows = await Promise.all(
      textChunks.map(async (chunkText) => {
        const cleanText = chunkText.replace(/[^\x00-\x7F]/g, "");
        
        // ⚡ ACTIVE EMBEDDING CONNECTOR
        const embeddingResponse = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: cleanText,
          config: { outputDimensionality: 768 }
        });

        const embeddingVector = embeddingResponse.embedding?.values || (embeddingResponse.embeddings as any)?.[0]?.values;
        if (!embeddingVector) throw new Error('Gemini failed to return embedding values.');

        return {
          document_id: documentId,
          content: cleanText,
          embedding: embeddingVector 
        };
      })
    );

    const { error: chunkError } = await supabase.from('chunks').insert(chunkInsertRows);
    if (chunkError) return NextResponse.json({ error: chunkError.message }, { status: 500 });

    return NextResponse.json({ success: true, fileName: cleanFileName, chunksProcessed: textChunks.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
