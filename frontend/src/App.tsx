import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ShieldCheck, 
  Plus, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Cpu, 
  ArrowUp, 
  Paperclip, 
  PanelLeftClose, 
  PanelLeft, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  UploadCloud, 
  RefreshCw, 
  Play, 
  X, 
  Sparkles, 
  Server, 
  Database, 
  Layers, 
  Clock
} from 'lucide-react';

import type { 
  ChatMessage, 
  SystemInfo, 
  DocumentItem, 
  BenchmarkSummary, 
  SourceItem 
} from './types';
import { 
  fetchHealth, 
  fetchSystemInfo, 
  queryRAG, 
  fetchDocuments, 
  uploadDocuments, 
  reindexDocuments, 
  fetchDatasets, 
  runBenchmark 
} from './api';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeModal, setActiveModal] = useState<'docs' | 'eval' | 'arch' | null>(null);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Docs State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  // Eval State
  const [datasets, setDatasets] = useState<{ filename: string; count: number }[]>([]);
  const [selectedDataset, setSelectedDataset] = useState('golden_dataset.json');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkSummary | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});

  useEffect(() => {
    checkBackend();
    loadDocs();
    loadDatasets();
    const interval = setInterval(checkBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isQuerying]);

  async function checkBackend() {
    try {
      await fetchHealth();
      setBackendHealthy(true);
      const info = await fetchSystemInfo();
      setSystemInfo(info);
    } catch {
      setBackendHealthy(false);
    }
  }

  async function loadDocs() {
    try {
      const res = await fetchDocuments();
      setDocuments(res.documents);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadDatasets() {
    try {
      const res = await fetchDatasets();
      setDatasets(res.datasets);
      if (res.datasets.length > 0) {
        setSelectedDataset(res.datasets[0].filename);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const promptCards = [
    {
      title: '🚨 SEV-1 Incident SLA',
      desc: 'What is the response SLA for SEV-1 outages and kubernetes rollback procedure?',
      query: 'What is the response SLA for SEV-1 incidents and how do we roll back a kubernetes deployment?'
    },
    {
      title: '🧠 Gemini 2 Embeddings',
      desc: 'What is the vector dimension for our Gemini model and Qdrant index?',
      query: 'What is the vector dimension for our Gemini Embedding 2 model and how does it work with Qdrant?'
    },
    {
      title: '💰 L&D Stipend Policy',
      desc: 'How much is the annual learning budget and can I use it for AI API credits?',
      query: 'How much is the annual learning and development stipend and can it be used for AI API credits?'
    },
    {
      title: '🛡️ Security & MFA Rules',
      desc: 'What are the mandatory requirements for employee password management?',
      query: 'What are the corporate security requirements for password rotation and multi-factor authentication?'
    }
  ];

  async function handleSend(queryText?: string) {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isQuerying) return;

    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsQuerying(true);

    try {
      const resp = await queryRAG(textToSend.trim());
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: resp.answer,
        sources: resp.sources,
        telemetry: resp.telemetry,
        isError: resp.is_error,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ **Connection Error**: Unable to reach backend (${err.message || 'Network error'}). Please verify the Render service status.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsQuerying(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function startNewChat() {
    setMessages([]);
    setInputQuery('');
    setActiveModal(null);
  }

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) return;
    setIsUploading(true);
    setUploadMsg(null);
    try {
      const res = await uploadDocuments(selectedFiles);
      setUploadMsg(`✅ ${res.message}`);
      loadDocs();
      setSelectedFiles(null);
    } catch (err: any) {
      setUploadMsg(`❌ Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleReindex() {
    setIsUploading(true);
    setUploadMsg(null);
    try {
      const res = await reindexDocuments();
      setUploadMsg(`✅ ${res.message}`);
      loadDocs();
    } catch (err: any) {
      setUploadMsg(`❌ Reindex failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRunBenchmark() {
    setIsEvaluating(true);
    try {
      const res = await runBenchmark(selectedDataset);
      setBenchmarkResult(res);
    } catch (err: any) {
      alert(`Benchmark error: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  }

  return (
    <div className="chatgpt-app">
      {/* LEFT SIDEBAR */}
      <aside className={`chatgpt-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={startNewChat}>
            <Plus size={18} /> New chat
          </button>
        </div>

        <div className="sidebar-nav">
          <div className="nav-section-title">Conversations</div>
          {messages.length > 0 ? (
            <button className="nav-item active" onClick={() => setActiveModal(null)}>
              <MessageSquare size={16} /> Current Enterprise Session
            </button>
          ) : (
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              No previous chats
            </div>
          )}

          <div className="nav-section-title" style={{ marginTop: '1rem' }}>Knowledge & Tools</div>
          <button 
            className={`nav-item ${activeModal === 'docs' ? 'active' : ''}`}
            onClick={() => setActiveModal('docs')}
          >
            <FileText size={16} /> Knowledge Base ({documents.length})
          </button>

          <button 
            className={`nav-item ${activeModal === 'eval' ? 'active' : ''}`}
            onClick={() => setActiveModal('eval')}
          >
            <BarChart3 size={16} /> CI/CD Benchmark
          </button>

          <button 
            className={`nav-item ${activeModal === 'arch' ? 'active' : ''}`}
            onClick={() => setActiveModal('arch')}
          >
            <Cpu size={16} /> Pipeline Topology
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="system-pill">
            <span>
              <span className={`status-dot ${backendHealthy ? '' : 'error'}`}></span>
              {backendHealthy ? 'Render Connected' : 'Disconnected'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#93c5fd' }}>
              {systemInfo ? systemInfo.llm_model_id : 'Mistral + Cohere'}
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <div className="chatgpt-main">
        {/* TOP NAVBAR */}
        <div className="top-navbar">
          <div className="nav-left">
            <button 
              className="icon-btn" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            </button>

            <div className="model-selector">
              <span>Enterprise Applied RAG</span>
              <span className="model-tag">Mistral-Medium + Cohere v3.5</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {messages.length > 0 && (
              <button className="icon-btn" onClick={startNewChat} title="Clear & New Chat">
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>

        {/* CONTENT VIEWPORT */}
        <div className="content-viewport">
          {messages.length === 0 ? (
            /* EMPTY / WELCOME STATE */
            <div className="welcome-screen">
              <div className="welcome-logo">
                <Sparkles size={28} color="#ffffff" />
              </div>
              <h1 className="welcome-title">What would you like to know?</h1>
              <p className="welcome-subtitle">
                Ask questions grounded strictly in internal technical documentation, DevOps runbooks, and Slack archives with <strong>Cohere Reranking</strong> & <strong>Mistral AI</strong>.
              </p>

              <div className="prompts-grid">
                {promptCards.map((card, idx) => (
                  <div key={idx} className="prompt-card" onClick={() => handleSend(card.query)}>
                    <div className="prompt-card-title">{card.title}</div>
                    <div className="prompt-card-desc">{card.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT THREAD */
            <div className="thread-container">
              {messages.map(msg => (
                <div key={msg.id} className={`message-row ${msg.role}`}>
                  {msg.role === 'user' ? (
                    <div className="user-bubble">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="assistant-message">
                      <div className="assistant-avatar">
                        <Sparkles size={16} color="#ffffff" />
                      </div>
                      <div className="assistant-content">
                        <div className="markdown-body">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeContent = String(children).replace(/\n$/, '');
                                if (match) {
                                  return (
                                    <div className="code-block-wrapper">
                                      <div className="code-header">
                                        <span>{match[1]}</span>
                                        <button 
                                          className="code-copy-btn"
                                          onClick={() => copyToClipboard(codeContent, codeContent)}
                                        >
                                          {copiedId === codeContent ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                          {copiedId === codeContent ? 'Copied' : 'Copy'}
                                        </button>
                                      </div>
                                      <pre><code className={className} {...props}>{children}</code></pre>
                                    </div>
                                  );
                                }
                                return <code className={className} {...props}>{children}</code>;
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Grounded Sources Toggle */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div>
                            <button 
                              className="sources-toggle"
                              onClick={() => setExpandedSources(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                            >
                              <span>📚 {msg.sources.length} Grounded Sources</span>
                              {expandedSources[msg.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {expandedSources[msg.id] && (
                              <div className="sources-container">
                                {msg.sources.map((s: SourceItem, sIdx: number) => (
                                  <div key={sIdx} className="source-item-card">
                                    <div className="source-badges">
                                      <span className="badge">📄 {s.source}</span>
                                      {s.page && <span className="badge">Page {s.page}</span>}
                                      {s.section_id && <span className="badge">Sec: {s.section_id}</span>}
                                      {s.channel && <span className="badge">#{s.channel}</span>}
                                      {s.rerank_score !== undefined && (
                                        <span className="badge cohere">Cohere Score: {s.rerank_score}</span>
                                      )}
                                    </div>
                                    <div style={{ color: '#d1d5db', fontSize: '0.825rem' }}>{s.full_text}</div>
                                    {s.image_base64 && (
                                      <div style={{ marginTop: '8px' }}>
                                        <img 
                                          src={`data:image/png;base64,${s.image_base64}`} 
                                          alt={s.image_name || 'Visual Diagram'} 
                                          style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Telemetry & Copy Answer Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                          {msg.telemetry && (
                            <div className="msg-telemetry">
                              <span>⚡ {msg.telemetry.total_latency}s</span>
                              <span>• Retrieval: {msg.telemetry.retrieval_latency}s</span>
                              <span>• Cohere: {msg.telemetry.rerank_latency}s</span>
                              <span>• LLM: {msg.telemetry.llm_latency}s</span>
                              <span>• 🪙 {msg.telemetry.tokens} tokens</span>
                            </div>
                          )}

                          <button 
                            className="code-copy-btn"
                            style={{ padding: '0.2rem 0.5rem' }}
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            title="Copy response"
                          >
                            {copiedId === msg.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isQuerying && (
                <div className="message-row assistant">
                  <div className="assistant-message">
                    <div className="assistant-avatar">
                      <Sparkles size={16} color="#ffffff" />
                    </div>
                    <div className="assistant-content" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                      <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span className="shimmer-text">Searching hybrid index & reranking with Cohere...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* FLOATING BOTTOM INPUT BAR */}
        <div className="bottom-bar">
          <div className="input-container">
            <button 
              className="icon-btn" 
              onClick={() => setActiveModal('docs')} 
              title="Attach / Ingest Document"
            >
              <Paperclip size={18} />
            </button>

            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Message Enterprise Assistant (e.g. SLA rules, kubernetes rollbacks)..."
              rows={1}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isQuerying}
            />

            <button 
              className="btn-send-circle" 
              onClick={() => handleSend()} 
              disabled={isQuerying || !inputQuery.trim()}
              title="Send query"
            >
              <ArrowUp size={18} />
            </button>
          </div>

          <div className="disclaimer">
            Enterprise Applied RAG Assistant can make mistakes. Verify cited references in original internal documents.
          </div>
        </div>
      </div>

      {/* MODAL 1: KNOWLEDGE BASE INGESTION */}
      {activeModal === 'docs' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title"><FileText size={20} color="#3b82f6" /> Knowledge Base Documents</div>
              <button className="icon-btn" onClick={() => setActiveModal(null)}><X size={20} /></button>
            </div>

            <form onSubmit={handleFileUpload}>
              <div 
                style={{ 
                  border: '2px dashed var(--border-color)', 
                  borderRadius: '12px', 
                  padding: '1.75rem', 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)'
                }}
                onClick={() => document.getElementById('modalFileInput')?.click()}
              >
                <UploadCloud size={32} color="#3b82f6" style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
                <p style={{ fontWeight: 600 }}>
                  {selectedFiles && selectedFiles.length > 0
                    ? `${selectedFiles.length} file(s) selected: ${Array.from(selectedFiles).map(f => f.name).join(', ')}`
                    : 'Click or drop PDF, Markdown, Slack JSON, or TXT files here'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Auto-embedded with Gemini Embedding 2 into Qdrant</p>
                <input
                  id="modalFileInput"
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => setSelectedFiles(e.target.files)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="submit" className="new-chat-btn" style={{ background: '#3b82f6', color: '#fff', border: 'none', width: 'auto' }} disabled={isUploading || !selectedFiles}>
                  {isUploading ? 'Ingesting...' : 'Upload & Ingest'}
                </button>
                <button type="button" className="new-chat-btn" style={{ width: 'auto' }} onClick={handleReindex} disabled={isUploading}>
                  <RefreshCw size={14} /> Force Re-Index All
                </button>
              </div>
            </form>

            {uploadMsg && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.25)', fontSize: '0.85rem' }}>
                {uploadMsg}
              </div>
            )}

            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>Active Indexed Files ({documents.length})</div>
              <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Size</th>
                      <th>Format</th>
                      <th>Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#93c5fd' }}>{d.name}</td>
                        <td>{d.size_kb} KB</td>
                        <td><span className="badge">{d.extension.toUpperCase()}</span></td>
                        <td style={{ color: 'var(--text-muted)' }}>{d.last_modified}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GOLDEN BENCHMARK */}
      {activeModal === 'eval' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title"><BarChart3 size={20} color="#8b5cf6" /> Golden CI/CD Benchmark</div>
              <button className="icon-btn" onClick={() => setActiveModal(null)}><X size={20} /></button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Evaluate Faithfulness (Hallucination Detection), Context Precision, and Recall using Mistral as an LLM judge against benchmark test cases.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select 
                style={{ background: 'var(--bg-input)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 0.75rem', outline: 'none' }}
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
              >
                {datasets.map((ds, idx) => (
                  <option key={idx} value={ds.filename}>{ds.filename} ({ds.count} Q&A pairs)</option>
                ))}
              </select>

              <button 
                className="new-chat-btn" 
                style={{ background: '#8b5cf6', color: '#fff', border: 'none', width: 'auto' }}
                onClick={handleRunBenchmark}
                disabled={isEvaluating}
              >
                {isEvaluating ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
                {isEvaluating ? 'Running Benchmark...' : 'Run Benchmark'}
              </button>
            </div>

            {benchmarkResult && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>🛡️ Faithfulness</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981' }}>{benchmarkResult.avg_faithfulness.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>🎯 Precision</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8' }}>{benchmarkResult.avg_context_precision.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>📖 Recall</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#a78bfa' }}>{benchmarkResult.avg_context_recall.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>⚡ Latency</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>{benchmarkResult.avg_latency_seconds.toFixed(2)}s</div>
                  </div>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Question</th>
                        <th>Faithfulness</th>
                        <th>Precision</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarkResult.detailed_results.map((r, idx) => (
                        <React.Fragment key={idx}>
                          <tr>
                            <td>{idx + 1}</td>
                            <td style={{ maxWidth: '280px', fontWeight: 500 }}>{r.question}</td>
                            <td style={{ color: '#10b981', fontWeight: 700 }}>{r.faithfulness.toFixed(2)}</td>
                            <td style={{ color: '#38bdf8', fontWeight: 700 }}>{r.context_precision.toFixed(2)}</td>
                            <td><span className="badge cohere">{r.eval_status}</span></td>
                            <td>
                              <button 
                                className="icon-btn" 
                                onClick={() => setExpandedReasoning(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              >
                                {expandedReasoning[idx] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            </td>
                          </tr>
                          {expandedReasoning[idx] && (
                            <tr>
                              <td colSpan={6} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', fontSize: '0.8rem' }}>
                                <div><strong>Reasoning:</strong> {r.reasoning}</div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: TOPOLOGY & ARCHITECTURE */}
      {activeModal === 'arch' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title"><Cpu size={20} color="#3b82f6" /> Hybrid System Topology</div>
              <button className="icon-btn" onClick={() => setActiveModal(null)}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={16} /> ▲ Frontend (Vercel)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  React 19 + TypeScript SPA on Vercel Edge Network
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={16} /> 🚀 Backend (Render)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  FastAPI ASGI async server on Render Cloud
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={16} /> 🗄️ Qdrant + Gemini 2
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Multimodal 3072-dim embeddings + BM25 keyword index
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={16} /> 🎯 Cohere Rerank v3.5
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  High-precision cross-encoder Top-15 to Top-5 reranking
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} /> 🤖 Mistral AI
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  `mistral-medium-2508` grounded with strict citations
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} /> 🔭 Arize Phoenix
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Zero-docker OpenInference telemetry and span tracing
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
