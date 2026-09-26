import { createClient } from './server';
import { GoogleGenAI } from '@google/genai';

// Initialize the Google Gen AI client with your .env key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY_1 });

export interface DocumentRow {
  fileName: string;
  filePath: string;
  fileType: string;
  userId: string;
}

/**
 * Saves document or voice note metadata to the permanent database.
 */
export async function saveDocumentMetadata(fileName: string, filePath: string, fileType: string, userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('documents')
    .insert([
      {
        file_name: fileName,
        file_path: filePath,
        file_type: fileType,
        user_id: userId,
      }
    ])
    .select('id')
    .single();

  if (error) {
    console.error('Database insertion failure:', error.message);
    throw new Error(error.message);
  }

  return data.id;
}

/**
 * Generates a 768-dimension Gemini vector embedding for a text chunk 
 * and securely saves it forever inside your chunks table.
 */
export async function saveDocumentChunk(documentId: string, userId: string, content: string) {
  const supabase = await createClient();

  try {
    // 1. Generate the vector embedding using the Gemini API
    const embeddingResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: content,
    });

    const embeddingVector = embeddingResponse.embedding?.values;
    if (!embeddingVector) {
      throw new Error('Gemini failed to return embedding values.');
    }

    // 2. Insert the data directly into your 'chunks' table matching your exact schema
    const { error } = await supabase
      .from('chunks')
      .insert([
        {
          document_id: documentId,
          user_id: userId,
          content: content,
          embedding: embeddingVector, // Saves your 768 float array straight into pgvector
        }
      ]);

    if (error) {
      console.error('Chunk insertion failure:', error.message);
      throw new Error(error.message);
    }

    return true;
  } catch (error: any) {
    console.error('Error generating embedding or saving chunk:', error.message);
    throw error;
  }
}
