import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ShieldCheck, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Cpu, 
  Send, 
  UploadCloud, 
  RefreshCw, 
  Play, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Server, 
  Clock, 
  Layers, 
  FileSpreadsheet,
  Database
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
  const [activeTab, setActiveTab] = useState<'chat' | 'docs' | 'eval' | 'arch'>('chat');
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your Enterprise AI Assistant powered by **Mistral AI** and **Cohere Rerank**, grounded strictly in internal technical documentation (PDFs, Slack chats, DevOps runbooks). How can I assist you today?',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const chatBottomRef = useRef<HTMLDivElement>(null);

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

  const samplePrompts = [
    'What is the response SLA for SEV-1 incidents and how do we roll back a kubernetes deployment?',
    'What is the vector dimension for our Gemini Embedding 2 model and how does it work with Qdrant?',
    'How much is the annual learning and development stipend and can it be used for AI API credits?'
  ];

  async function handleSend(queryText?: string) {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isQuerying) return;

    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString()
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
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ [Connection Error] Failed to reach Render backend: ${err.message || 'Unknown error'}. Please check if the API server is active.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsQuerying(false);
    }
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
      alert(`Benchmark failed: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  }

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <div className="brand-icon">
              <ShieldCheck size={22} color="#ffffff" />
            </div>
            <div>
              <div className="brand-title">Enterprise Applied RAG</div>
              <div className="brand-subtitle">Cohere Rerank • Mistral AI • Qdrant Cloud • Vercel & Render Hybrid</div>
            </div>
          </div>
          <div className="header-status">
            <div className={`status-badge ${backendHealthy ? '' : 'error'}`}>
              <div className="status-dot"></div>
              {backendHealthy ? 'Render Backend Online' : 'Backend Disconnected'}
            </div>
            {systemInfo && (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Model: <strong>{systemInfo.llm_model_id}</strong>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* TABS NAVIGATION */}
      <div className="tabs-nav">
        <button 
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={16} /> Knowledge Assistant
        </button>
        <button 
          className={`tab-btn ${activeTab === 'docs' ? 'active' : ''}`}
          onClick={() => setActiveTab('docs')}
        >
          <FileText size={16} /> Ingestion & Documents
        </button>
        <button 
          className={`tab-btn ${activeTab === 'eval' ? 'active' : ''}`}
          onClick={() => setActiveTab('eval')}
        >
          <BarChart3 size={16} /> Golden CI/CD Benchmark
        </button>
        <button 
          className={`tab-btn ${activeTab === 'arch' ? 'active' : ''}`}
          onClick={() => setActiveTab('arch')}
        >
          <Cpu size={16} /> Hybrid Architecture
        </button>
      </div>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* TAB 1: CHAT */}
        {activeTab === 'chat' && (
          <div className="chat-layout">
            <div className="chat-panel">
              <div className="sample-prompts">
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={14} color="#38bdf8" /> Quick Queries:
                </span>
                {samplePrompts.map((p, idx) => (
                  <button key={idx} className="prompt-pill" onClick={() => handleSend(p)}>
                    {p.length > 55 ? p.substring(0, 55) + '...' : p}
                  </button>
                ))}
              </div>

              <div className="chat-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`message-bubble ${msg.role}`}>
                    <div className={`avatar ${msg.role}`}>
                      {msg.role === 'user' ? 'U' : <ShieldCheck size={18} />}
                    </div>
                    <div className="message-card">
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {/* Expandable Grounded Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="sources-accordion">
                          <div 
                            className="sources-header"
                            onClick={() => setExpandedSources(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                          >
                            <span>📚 View {msg.sources.length} Grounded Sources & Citations</span>
                            {expandedSources[msg.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                          {expandedSources[msg.id] && (
                            <div className="sources-list">
                              {msg.sources.map((s: SourceItem, idx: number) => (
                                <div key={idx} className="source-card-item">
                                  <div className="source-tags">
                                    <span className="tag">Doc: {s.source}</span>
                                    {s.page && <span className="tag">Page {s.page}</span>}
                                    {s.section_id && <span className="tag">Sec: {s.section_id}</span>}
                                    {s.channel && <span className="tag">#{s.channel}</span>}
                                    {s.rerank_score !== undefined && (
                                      <span className="tag rerank">Cohere Score: {s.rerank_score}</span>
                                    )}
                                  </div>
                                  <div style={{ color: '#cbd5e1', fontSize: '0.825rem' }}>{s.full_text}</div>
                                  {s.image_base64 && (
                                    <div style={{ marginTop: '8px' }}>
                                      <img 
                                        src={`data:image/png;base64,${s.image_base64}`} 
                                        alt={s.image_name || 'Visual Diagram'} 
                                        style={{ maxWidth: '100%', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Telemetry Footer */}
                      {msg.telemetry && (
                        <div className="telemetry-row">
                          <div className="telemetry-pill">⚡ Total: <strong>{msg.telemetry.total_latency}s</strong></div>
                          <div className="telemetry-pill">🔍 Retrieval: <strong>{msg.telemetry.retrieval_latency}s</strong></div>
                          <div className="telemetry-pill">🎯 Cohere: <strong>{msg.telemetry.rerank_latency}s</strong></div>
                          <div className="telemetry-pill">🤖 Mistral: <strong>{msg.telemetry.llm_latency}s</strong></div>
                          <div className="telemetry-pill">🪙 Tokens: <strong>{msg.telemetry.tokens}</strong></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isQuerying && (
                  <div className="message-bubble assistant">
                    <div className="avatar assistant"><ShieldCheck size={18} /></div>
                    <div className="message-card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      <span style={{ color: '#94a3b8' }}>Retrieving hybrid vectors & reranking with Cohere...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              <div className="chat-input-wrapper">
                <form className="chat-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
                  <input
                    type="text"
                    className="chat-input"
                    placeholder="Ask about DevOps runbooks, SLA rules, Kubernetes rollbacks, or security policies..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    disabled={isQuerying}
                  />
                  <button type="submit" className="send-btn" disabled={isQuerying || !inputQuery.trim()}>
                    <Send size={16} /> Send
                  </button>
                </form>
              </div>
            </div>

            {/* SIDEBAR SYSTEM INFO */}
            <div className="sidebar-panel">
              <div className="card">
                <div className="card-title"><Layers size={18} color="#3b82f6" /> Active Components</div>
                <div className="component-list">
                  <div className="component-item">
                    <span className="component-label">Embedding Model</span>
                    <span className="component-val">{systemInfo?.embedding_model || 'Gemini Embedding 2 (3072 dims)'}</span>
                  </div>
                  <div className="component-item">
                    <span className="component-label">LLM Generator</span>
                    <span className="component-val">{systemInfo?.llm_generator || 'Mistral AI (mistral-medium-2508)'}</span>
                  </div>
                  <div className="component-item">
                    <span className="component-label">Cross-Encoder Reranker</span>
                    <span className="component-val">{systemInfo?.reranker || 'Cohere Rerank (rerank-v3.5)'}</span>
                  </div>
                  <div className="component-item">
                    <span className="component-label">Vector Database</span>
                    <span className="component-val">{systemInfo?.vector_db || 'Qdrant Cloud (AWS)'}</span>
                  </div>
                  <div className="component-item">
                    <span className="component-label">Sparse Keyword Index</span>
                    <span className="component-val">BM25 Okapi Fusion</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-title"><Server size={18} color="#10b981" /> Deployment Topology</div>
                <div className="component-list">
                  <div className="component-item">
                    <span className="component-label">Frontend Hosting</span>
                    <span className="component-val" style={{ color: '#38bdf8' }}>Vercel Edge Network</span>
                  </div>
                  <div className="component-item">
                    <span className="component-label">Backend Hosting</span>
                    <span className="component-val" style={{ color: '#a78bfa' }}>Render Cloud Web Service</span>
                  </div>
                  <div className="component-item">
                    <span className="component-label">Observability</span>
                    <span className="component-val">Arize Phoenix (Tracing)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INGESTION & DOCUMENTS */}
        {activeTab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <div className="card-title"><UploadCloud size={20} color="#3b82f6" /> Upload Enterprise Documents</div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Upload PDF documentation, Markdown runbooks, Slack JSON logs, or plain text to automatically chunk and embed with <strong>Gemini Embedding 2</strong> into Qdrant.
              </p>

              <form onSubmit={handleFileUpload}>
                <div className="dropzone" onClick={() => document.getElementById('fileInput')?.click()}>
                  <UploadCloud size={36} color="#3b82f6" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                  <p style={{ fontWeight: 600, color: '#f1f5f9' }}>
                    {selectedFiles && selectedFiles.length > 0
                      ? `${selectedFiles.length} file(s) selected: ${Array.from(selectedFiles).map(f => f.name).join(', ')}`
                      : 'Click to select or drop PDF, MD, JSON, TXT files here'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Supports multimodal technical documents & visual assets</p>
                  <input
                    id="fileInput"
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => setSelectedFiles(e.target.files)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="send-btn" disabled={isUploading || !selectedFiles}>
                    {isUploading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <UploadCloud size={16} />}
                    {isUploading ? 'Ingesting vectors...' : 'Save & Ingest Selected Files'}
                  </button>
                  <button type="button" className="tab-btn" style={{ border: '1px solid var(--border-color)' }} onClick={handleReindex} disabled={isUploading}>
                    <RefreshCw size={16} /> Force Re-Index All Existing
                  </button>
                </div>
              </form>

              {uploadMsg && (
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)', fontSize: '0.875rem' }}>
                  {uploadMsg}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title"><Database size={20} color="#10b981" /> Active Documents in Knowledge Base ({documents.length})</div>
              {documents.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Document Name</th>
                      <th>Size (KB)</th>
                      <th>Format</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((d, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#93c5fd' }}>{d.name}</td>
                        <td>{d.size_kb} KB</td>
                        <td><span className="tag">{d.extension.toUpperCase()}</span></td>
                        <td style={{ color: '#94a3b8' }}>{d.last_modified}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#94a3b8' }}>No documents found in knowledge base directory.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: EVALUATION */}
        {activeTab === 'eval' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <div className="card-title"><BarChart3 size={20} color="#8b5cf6" /> Automated Golden CI/CD Benchmark</div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Run LLM-as-a-Judge evaluations on curated enterprise Q&A test cases to test Faithfulness (Hallucination Detection), Context Precision, and Context Recall with <strong>Mistral AI</strong>.
              </p>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select 
                  className="chat-input" 
                  style={{ maxWidth: '300px' }}
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                >
                  {datasets.map((ds, idx) => (
                    <option key={idx} value={ds.filename}>{ds.filename} ({ds.count} Q&A pairs)</option>
                  ))}
                </select>

                <button 
                  className="send-btn" 
                  onClick={handleRunBenchmark}
                  disabled={isEvaluating}
                >
                  {isEvaluating ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={16} />}
                  {isEvaluating ? 'Evaluating Benchmark...' : 'Run Full Benchmark'}
                </button>
              </div>
            </div>

            {benchmarkResult && (
              <>
                <div className="metrics-grid">
                  <div className="metric-kpi">
                    <span className="kpi-title">🛡️ Faithfulness</span>
                    <span className="kpi-value" style={{ color: '#10b981' }}>{benchmarkResult.avg_faithfulness.toFixed(2)}</span>
                    <span className="kpi-desc">1.0 = Zero Hallucinations</span>
                  </div>
                  <div className="metric-kpi">
                    <span className="kpi-title">🎯 Context Precision</span>
                    <span className="kpi-value" style={{ color: '#38bdf8' }}>{benchmarkResult.avg_context_precision.toFixed(2)}</span>
                    <span className="kpi-desc">Accuracy of retrieved chunks</span>
                  </div>
                  <div className="metric-kpi">
                    <span className="kpi-title">📖 Context Recall</span>
                    <span className="kpi-value" style={{ color: '#a78bfa' }}>{benchmarkResult.avg_context_recall.toFixed(2)}</span>
                    <span className="kpi-desc">Coverage of ground-truth facts</span>
                  </div>
                  <div className="metric-kpi">
                    <span className="kpi-title">💬 Answer Relevancy</span>
                    <span className="kpi-value" style={{ color: '#f59e0b' }}>{benchmarkResult.avg_answer_relevancy.toFixed(2)}</span>
                    <span className="kpi-desc">Directness to user query</span>
                  </div>
                  <div className="metric-kpi">
                    <span className="kpi-title">⚡ Avg Latency</span>
                    <span className="kpi-value">{benchmarkResult.avg_latency_seconds.toFixed(2)}s</span>
                    <span className="kpi-desc">End-to-end response time</span>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title"><FileSpreadsheet size={20} color="#38bdf8" /> Detailed Benchmark Breakdown ({benchmarkResult.total_questions} Test Cases)</div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Question</th>
                        <th>Faithfulness</th>
                        <th>Precision</th>
                        <th>Recall</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarkResult.detailed_results.map((r, idx) => (
                        <React.Fragment key={idx}>
                          <tr>
                            <td>{idx + 1}</td>
                            <td style={{ maxWidth: '350px', fontWeight: 500 }}>{r.question}</td>
                            <td style={{ color: '#10b981', fontWeight: 700 }}>{r.faithfulness.toFixed(2)}</td>
                            <td style={{ color: '#38bdf8', fontWeight: 700 }}>{r.context_precision.toFixed(2)}</td>
                            <td style={{ color: '#a78bfa', fontWeight: 700 }}>{r.context_recall.toFixed(2)}</td>
                            <td>
                              <span className={`tag ${r.eval_status === 'SUCCESS' ? 'rerank' : ''}`}>
                                {r.eval_status}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="tab-btn" 
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => setExpandedReasoning(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              >
                                {expandedReasoning[idx] ? 'Hide' : 'Inspect'}
                              </button>
                            </td>
                          </tr>
                          {expandedReasoning[idx] && (
                            <tr>
                              <td colSpan={7} style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.825rem' }}>
                                  <div><strong>Ground Truth:</strong> <span style={{ color: '#cbd5e1' }}>{r.ground_truth}</span></div>
                                  <div><strong>Generated Answer:</strong> <span style={{ color: '#93c5fd' }}>{r.generated_answer}</span></div>
                                  <div><strong>Judge Reasoning:</strong> <span style={{ color: '#f59e0b' }}>{r.reasoning}</span></div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: ARCHITECTURE */}
        {activeTab === 'arch' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <div className="card-title"><Cpu size={20} color="#3b82f6" /> Hybrid Applied RAG Architecture</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div className="component-item" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Server size={18} color="#38bdf8" />
                    <strong style={{ color: '#f1f5f9' }}>1. Frontend (Vercel)</strong>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                    React / TypeScript modern SPA deployed on Vercel Edge with zero server cold starts, connecting via REST API to Render.
                  </p>
                </div>

                <div className="component-item" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Cpu size={18} color="#a78bfa" />
                    <strong style={{ color: '#f1f5f9' }}>2. Backend (Render)</strong>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                    FastAPI high-performance ASGI service hosted on Render with CORS, asynchronous endpoints, and token telemetry.
                  </p>
                </div>

                <div className="component-item" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Database size={18} color="#10b981" />
                    <strong style={{ color: '#f1f5f9' }}>3. Vector DB & Embeddings</strong>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                    Qdrant Cloud vector database paired with Google Gemini Embedding 2 (3072 dims) for dense text and multimodal visual assets.
                  </p>
                </div>

                <div className="component-item" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Layers size={18} color="#f59e0b" />
                    <strong style={{ color: '#f1f5f9' }}>4. Cohere Cross-Encoder</strong>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                    Cohere Rerank API (v3.5) re-ranking Top-15 hybrid candidate chunks to Top-5 highest confidence passages with FlashRank fallback.
                  </p>
                </div>

                <div className="component-item" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <ShieldCheck size={18} color="#f43f5e" />
                    <strong style={{ color: '#f1f5f9' }}>5. Mistral AI Generation</strong>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                    Mistral AI (`mistral-medium-2508`) strictly grounded by system prompt rules to enforce citations and eliminate hallucinations.
                  </p>
                </div>

                <div className="component-item" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Clock size={18} color="#06b6d4" />
                    <strong style={{ color: '#f1f5f9' }}>6. Observability & CI/CD</strong>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                    Arize Phoenix OpenInference query tracing and automated golden dataset benchmarking for regression validation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
