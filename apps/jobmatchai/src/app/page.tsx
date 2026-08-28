'use client';

import { useState } from 'react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'candidate' | 'recruiter'>('candidate');

  // Candidate State
  const [resumeText, setResumeText] = useState('');
  const [candidateResult, setCandidateResult] = useState<any>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);

  // Recruiter Match State
  const [jobDescription, setJobDescription] = useState('');
  const [matchResult, setMatchResult] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  // Recruiter Chat State
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const handleParseResume = async () => {
    setCandidateLoading(true);
    setCandidateResult(null);
    try {
      const res = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText })
      });
      const data = await res.json();
      setCandidateResult(data);
    } catch (e) {
      console.error(e);
      setCandidateResult({ error: 'Failed to parse' });
    }
    setCandidateLoading(false);
  };

  const handleFindMatches = async () => {
    setMatchLoading(true);
    setMatchResult(null);
    try {
      const res = await fetch('/api/jobs/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription })
      });
      const data = await res.json();
      setMatchResult(data);
    } catch (e) {
      console.error(e);
      setMatchResult({ error: 'Failed to match' });
    }
    setMatchLoading(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    
    const newMessages = [...messages, { role: 'user', content: chatInput }];
    setMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (e) {
      console.error(e);
    }
    setChatLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-blue-600">JobMatch<span className="text-gray-900">AI</span></h1>
          <p className="text-lg text-gray-500">Powered by the AUREXARA AI Engine</p>
        </header>

        {/* Tabs */}
        <div className="flex justify-center space-x-4 border-b border-gray-200 pb-4">
          <button 
            onClick={() => setActiveTab('candidate')}
            className={`px-6 py-2 rounded-full font-semibold transition-colors ${activeTab === 'candidate' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
            Candidate Portal
          </button>
          <button 
            onClick={() => setActiveTab('recruiter')}
            className={`px-6 py-2 rounded-full font-semibold transition-colors ${activeTab === 'recruiter' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
            Recruiter Portal
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          
          {/* Candidate Tab */}
          {activeTab === 'candidate' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold">Upload Your Resume</h2>
              <p className="text-gray-500">Paste your resume text below. Our AI will extract your details and add you to the talent pool.</p>
              
              <textarea 
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume text here (Markdown or Plain Text)..."
                className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
              
              <button 
                onClick={handleParseResume}
                disabled={candidateLoading || !resumeText}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all"
              >
                {candidateLoading ? 'Processing & Ingesting...' : 'Submit Profile'}
              </button>

              {candidateResult && (
                <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="text-lg font-bold text-green-600 mb-4">✓ Profile Successfully Ingested</h3>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto">
                    <pre>{JSON.stringify(candidateResult.data, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recruiter Tab */}
          {activeTab === 'recruiter' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Semantic Matching Section */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Semantic Job Matching</h2>
                <p className="text-gray-500">Paste a Job Description. Our RAG pipeline will find the best semantic matches from the talent pool.</p>
                
                <textarea 
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste Job Description here..."
                  className="w-full h-48 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
                
                <button 
                  onClick={handleFindMatches}
                  disabled={matchLoading || !jobDescription}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all"
                >
                  {matchLoading ? 'Scanning Talent Pool...' : 'Find Matches'}
                </button>

                {matchResult && (
                  <div className="mt-8 space-y-4">
                    <h3 className="text-xl font-bold text-gray-800">Top Candidates found:</h3>
                    {matchResult.matches?.length > 0 ? (
                      matchResult.matches.map((match: any, idx: number) => (
                        <div key={idx} className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                          <div className="flex-shrink-0 bg-blue-100 text-blue-800 font-bold px-4 py-2 rounded-lg text-2xl">
                            {match.fitScore}%
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{match.candidateId}</h4>
                            <p className="text-gray-600 mt-1">{match.reason}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 italic">No strong matches found in the current pool.</p>
                    )}
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              {/* Chatbot Section */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">AI Recruiter Assistant</h2>
                <p className="text-gray-500">Ask questions about the candidate pool. The AI will retrieve relevant resumes and synthesize answers.</p>
                
                <div className="flex flex-col h-[400px] border border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center text-gray-400 mt-10">Start chatting to query the knowledge base...</div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 text-gray-500 rounded-2xl px-5 py-3 shadow-sm animate-pulse">
                          Thinking...
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-white border-t border-gray-200 flex gap-2">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="e.g. Do we have any frontend developers who know React?"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
