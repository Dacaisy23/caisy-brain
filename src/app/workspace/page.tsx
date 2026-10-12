'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function WorkspacePage() {
  const [isClient, setIsClient] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [docCount, setDocCount] = useState(1); 
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Welcome to your Second Brain workspace. Gemini embeddings and your Groq retrieval grid are officially online and connected to your Supabase memory rows!' }
  ]);
  const [inputValue, setInputValue] = useState('');
  
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleBoxClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setChatMessages((prev) => [
      ...prev,
      { role: 'user', text: `📁 Attempting upload: "${file.name}"` },
      { role: 'assistant', text: `⚡ Reading text strings and inserting rows into Supabase database tables...` }
    ]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setDocCount((prev) => prev + 1);
        setChatMessages((prev) => [
          ...prev.filter(msg => !msg.text.includes('Reading text strings')),
          { role: 'assistant', text: `✅ File successfully parsed! Saved "${data.fileName}" into your Supabase storage. Generated ${data.chunksProcessed} searchable knowledge chunks inside database memory.` }
        ]);
      } else {
        throw new Error(data.error || 'Upload insertion failed');
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev.filter(msg => !msg.text.includes('Reading text strings')),
        { role: 'assistant', text: `❌ Document Reader Database Error: ${err.message || 'Could not map stream'}` }
      ]);
    }
  };

  const startRecording = async () => {
    if (!isClient) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/wav' });
        setChatMessages((prev) => [
          ...prev,
          { role: 'user', text: `🎙️ Voice Note Captured (${audioBlob.size} bytes). Uploading to Supabase...` }
        ]);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err: any) {
      alert(`Microphone block: ${err.message || 'Access denied.'}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setChatMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setInputValue('');

    setChatMessages((prev) => [...prev, { role: 'assistant', text: '🧠 Caisy Brain is reviewing database memory rows...' }]);

    try {
      const response = await fetch('/api/response-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await response.json();

      if (data.reply) {
        setChatMessages((prev) => [
          ...prev.filter(msg => !msg.text.includes('reviewing database memory')),
          { role: 'assistant', text: data.reply }
        ]);
      } else {
        throw new Error(data.error || 'AI request dropped');
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev.filter(msg => !msg.text.includes('reviewing database memory')),
        { role: 'assistant', text: `❌ AI Chat Error: ${err.message || 'Could not fetch text response'}` }
      ]);
    }
  };

  if (!isClient) {
    return <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">Booting Workspace Interface...</div>;
  }

  return (
    <main className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden">
      {/* LEFT PANEL */}
      <section className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            🧠 CAISY BRAIN
          </h1>
          <p className="text-xs text-slate-500 mt-1">Operational Mode</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300">Feed Documents</label>
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden" 
            accept=".pdf,.docx,.pptx,.txt,image/*"
          />
          <div 
            onClick={handleBoxClick}
            className="border-2 border-dashed border-slate-800 rounded-xl p-4 text-center hover:border-indigo-500 transition-colors cursor-pointer group bg-slate-950"
          >
            <span className="text-2xl group-hover:scale-110 inline-block transition-transform">📄</span>
            <p className="text-xs text-slate-400 mt-1 font-medium">Upload PDF, DOCX, PPTX, Images</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Click to process document file</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300">Listen to Meetings</label>
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 border shadow-md ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-500 border-red-500 animate-pulse text-white' 
                : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200'
            }`}
          >
            <span>{isRecording ? '🛑' : '🎙️'}</span>
            {isRecording ? 'Recording... Click to Stop' : 'Record Conversation'}
          </button>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-800/60">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Brain Memory</label>
          <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/40 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between"><span>Total Documents:</span> <span className="font-mono text-indigo-400">{docCount}</span></div>
            <div className="flex justify-between"><span>Audio Minutes:</span> <span className="font-mono text-purple-400">0m</span></div>
          </div>
        </div>
      </section>

      {/* RIGHT PANEL - CHAT TERMINAL CONTAINER */}
      <section className="flex-1 flex flex-col h-full bg-slate-950">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {chatMessages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xl rounded-2xl p-4 text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-200'}`}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* INPUT SUBMISSION CONSOLE */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-900 bg-slate-950/80 backdrop-blur flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Query your database vectors or reflect on voice notes..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-slate-200"
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors">
            Ask Brain
          </button>
        </form>
      </section>
    </main>
  );
}
