import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server'; 
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';

// Initialize AI SDK clients using your .env keys
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_1 });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: Request) {
  try {
    // 1. Authenticate user from your stable Supabase client
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized user access' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No audio file received.' }, { status: 400 });
    }

    const cleanFileName = file.name.replace(/[^\x00-\x7F]/g, "").replace(/['"]/g, "");

    // 2. Transcribe the audio file using blazing fast Groq Whisper
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: 'whisper-large-v3',
      response_format: 'text',
    });

    const extractedText = typeof transcription === 'string' ? transcription : (transcription as any).text;

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from this voice note.' }, { status: 400 });
    }

    // 3. Insert file metadata directly into your documents table rows with user_id
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert([
        {
          file_name: cleanFileName,
          file_path: `audio/${Date.now()}-${cleanFileName}`,
          file_type: cleanFileName.split('.').pop() || 'wav',
          user_id: user.id 
        }
      ])
      .select('id')
      .single();

    if (docError) {
      return NextResponse.json({ error: `Database Save Error: ${docError.message}` }, { status: 500 });
    }

    const documentId = docData?.id;
    if (!documentId) {
      return NextResponse.json({ error: 'Failed to retrieve document reference identifier.' }, { status: 500 });
    }

    // 4. Fragment text cleanly into 500-character blocks
    const chunkSize = 500;
    const textChunks: string[] = [];
    for (let i = 0; i < extractedText.length; i += chunkSize) {
      textChunks.push(extractedText.substring(i, i + chunkSize));
    }

    // 5. Generate 768-dimension vector embeddings using Google Gemini
    const chunkInsertRows = await Promise.all(
      textChunks.map(async (chunkText) => {
        const cleanText = chunkText.replace(/[^\x00-\x7F]/g, "");
        
        const embeddingResponse = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: cleanText,
        });

        const embeddingVector = embeddingResponse.embedding?.values;
        if (!embeddingVector) {
          throw new Error('Gemini failed to return embedding values during audio chunking.');
        }

        return {
          document_id: documentId,
          user_id: user.id, 
          content: cleanText,
          embedding: embeddingVector 
        };
      })
    );

    // 6. Bulk insert permanent rows directly into your chunks table layout
    const { error: chunkError } = await supabase
      .from('chunks')
      .insert(chunkInsertRows);

    if (chunkError) {
      return NextResponse.json({ error: chunkError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      fileName: cleanFileName,
      chunksProcessed: textChunks.length 
    });

  } catch (error: any) {
    console.error('Audio ingestion pipeline failure:', error);
    return NextResponse.json({ error: error.message || 'Internal connection mismatch' }, { status: 500 });
  }
}
