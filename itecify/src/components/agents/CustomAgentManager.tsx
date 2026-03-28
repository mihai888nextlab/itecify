import React, { useState, useEffect } from 'react';
import { Bot, Plus, Trash2, Edit2, Play, X, Send, FileCode, Wand2 } from 'lucide-react';

const C = {
  bg: '#09090C',
  surface: '#0E0E13',
  card: '#13131A',
  border: '#2A2A3A',
  text: '#E8E8F0',
  muted: '#6B6B80',
  blue: '#4C8EFF',
  cyan: '#00E5CC',
  yellow: '#FFD700',
  green: '#39FF7A',
  red: '#FF4466',
  purple: '#A855F7',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface CustomAgent {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  color: string;
  icon: string;
}

interface FileInfo {
  name: string;
  content: string;
}

interface CustomAgentManagerProps {
  projectId: string;
  files: FileInfo[];
  onClose: () => void;
  onAgentsChange?: () => void;
  onRunAgent?: (agent: CustomAgent) => void;
  onAgentResult?: (result: { success: boolean; content: string; agentName: string }) => void;
  runningAgentId?: string | null;
  completedAgentId?: string | null;
}

const PRESET_AGENTS = [
  {
    name: 'Code Reviewer',
    description: 'Analyze code for bugs, security issues, and improvements',
    prompt: 'You are an expert code reviewer. Analyze the provided code files and provide feedback on:\n1. Bugs and potential issues\n2. Security vulnerabilities\n3. Performance improvements\n4. Code quality and best practices\n5. Give an overall score 1-10',
    color: '#A855F7',
  },
  {
    name: 'React Generator',
    description: 'Generate React components with TypeScript',
    prompt: 'You are a React expert. Generate complete, production-ready React components based on the user description. Include:\n1. Proper TypeScript types\n2. Error handling\n3. Loading states\n4. Accessible markup\n5. Clean, maintainable code',
    color: '#00E5CC',
  },
  {
    name: 'Bug Fixer',
    description: 'Find and fix bugs in code',
    prompt: 'You are an expert debugger. Analyze the provided code and:\n1. Identify bugs and errors\n2. Explain what is wrong\n3. Provide corrected code with explanations\n4. Suggest preventive measures',
    color: '#FF4466',
  },
  {
    name: 'Code Explainer',
    description: 'Explain what code does in simple terms',
    prompt: 'You are a coding teacher. Explain the provided code in simple, easy-to-understand terms:\n1. What does this code do overall?\n2. Explain each section/function\n3. Provide usage examples\n4. Note any tricky parts',
    color: '#FFD700',
  },
];

export function CustomAgentManager({ 
  projectId, 
  files, 
  onClose, 
  onAgentsChange,
  onRunAgent,
  onAgentResult,
  runningAgentId,
  completedAgentId
}: CustomAgentManagerProps) {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);
  const [runningAgent, setRunningAgent] = useState<CustomAgent | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<{ content: string; agentName: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    prompt: '',
    color: '#4C8EFF',
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/api/agents/agents`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.prompt.trim()) {
      setError('Name and instructions are required');
      return;
    }
    
    if (form.prompt.trim().length < 10) {
      setError('Instructions must be at least 10 characters');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const url = editingAgent 
        ? `${API_URL}/api/agents/agents/${editingAgent.id}`
        : `${API_URL}/api/agents/agents`;
      const method = editingAgent ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setShowForm(false);
        setEditingAgent(null);
        setForm({ name: '', description: '', prompt: '', color: '#4C8EFF' });
        fetchAgents();
        onAgentsChange?.();
      } else {
        setError(data.error || data.message || 'Failed to save agent');
      }
    } catch (err) {
      console.error('Failed to save agent:', err);
      setError('Failed to save agent - check if backend is running');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!confirm('Delete this agent?')) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/api/agents/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        fetchAgents();
        onAgentsChange?.();
      }
    } catch (err) {
      console.error('Failed to delete agent:', err);
    }
  };

  const handleRun = async (agent: CustomAgent) => {
    if (!customPrompt.trim()) {
      setError('Please enter what you want the agent to do');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    onRunAgent?.(agent);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/api/agents/agents/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          agentId: agent.id,
          projectId,
          customPrompt,
          files,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult(data.content);
        onClose();
        onAgentResult?.({ success: true, content: data.content, agentName: agent.name });
      } else {
        setError(data.error || 'Execution failed');
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Execution failed');
      setIsLoading(false);
    }
  };

  const startCreate = () => {
    setEditingAgent(null);
    setForm({ name: '', description: '', prompt: '', color: '#4C8EFF' });
    setShowForm(true);
  };

  const startEdit = (agent: CustomAgent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name,
      description: agent.description || '',
      prompt: agent.prompt,
      color: agent.color,
    });
    setShowForm(true);
  };

  const startRun = (agent: CustomAgent) => {
    setRunningAgent(agent);
    setCustomPrompt('');
    setResult(null);
    setError(null);
  };

  const usePreset = (preset: typeof PRESET_AGENTS[0]) => {
    setForm({
      name: preset.name,
      description: preset.description,
      prompt: preset.prompt,
      color: preset.color,
    });
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        width: 900,
        maxWidth: '95vw',
        maxHeight: '90vh',
        backgroundColor: '#1E1E1E',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
            <Wand2 size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            AI Agents
          </h2>
          <button onClick={onClose} style={{
            padding: 8,
            background: 'transparent',
            border: 'none',
            color: C.muted,
            cursor: 'pointer',
            borderRadius: 6,
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
          <div style={{ width: 300, borderRight: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column' }}>
            <button
              onClick={startCreate}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: C.blue,
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Plus size={16} /> Create Agent
            </button>

            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Agents ({agents.length})
              </div>
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => startRun(agent)}
                  style={{
                    padding: 12,
                    backgroundColor: runningAgent?.id === agent.id ? `${agent.color}20` : C.surface,
                    border: `1px solid ${runningAgent?.id === agent.id ? agent.color : C.border}`,
                    borderRadius: 8,
                    marginBottom: 8,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: agent.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Bot size={14} color="#000" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{agent.name}</div>
                      {agent.description && (
                        <div style={{ fontSize: 11, color: C.muted }}>{agent.description}</div>
                      )}
                      {runningAgentId === agent.id && (
                        <div style={{ fontSize: 10, color: C.yellow, marginTop: 2 }}>Running...</div>
                      )}
                      {completedAgentId === agent.id && (
                        <div style={{ fontSize: 10, color: C.green, marginTop: 2 }}>Completed ✓</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); startRun(agent); }}
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        backgroundColor: C.green,
                        border: 'none',
                        borderRadius: 4,
                        color: '#000',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Run
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(agent); }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: `1px solid ${C.border}`,
                        borderRadius: 4,
                        color: C.muted,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: `1px solid ${C.red}40`,
                        borderRadius: 4,
                        color: C.red,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {agents.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: C.muted }}>
                  <Bot size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div style={{ fontSize: 13 }}>No agents yet</div>
                  <div style={{ fontSize: 11 }}>Create one or use a preset</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column' }}>
            {showForm ? (
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20 }}>
                  {editingAgent ? 'Edit Agent' : 'Create New Agent'}
                </h3>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>
                    Agent Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Code Reviewer"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.text,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>
                    Short Description
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What this agent helps with"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.text,
                      fontSize: 14,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {!editingAgent && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>
                      Start from a preset
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {PRESET_AGENTS.map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => usePreset(preset)}
                          style={{
                            padding: '10px 12px',
                            backgroundColor: `${preset.color}15`,
                            border: `1px solid ${preset.color}40`,
                            borderRadius: 8,
                            color: C.text,
                            fontSize: 12,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: preset.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Bot size={10} color="#000" />
                            </div>
                            <span style={{ fontWeight: 600 }}>{preset.name}</span>
                          </div>
                          <div style={{ color: C.muted }}>{preset.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 16, flex: 1 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>
                    Instructions * (what the agent should do)
                  </label>
                  <textarea
                    value={form.prompt}
                    onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                    placeholder="You are an expert code reviewer. Analyze the code and provide feedback on bugs, security, and improvements..."
                    style={{
                      width: '100%',
                      minHeight: 150,
                      padding: '10px 12px',
                      backgroundColor: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.text,
                      fontSize: 13,
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>
                    Agent Color
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm({ ...form, color: e.target.value })}
                      style={{
                        width: 40,
                        height: 40,
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    />
                    <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                      {['#4C8EFF', '#00E5CC', '#FFD700', '#39FF7A', '#FF4466', '#A855F7'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setForm({ ...form, color })}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            backgroundColor: color,
                            border: form.color === color ? `2px solid #fff` : 'none',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{
                    padding: 12,
                    backgroundColor: `${C.red}20`,
                    border: `1px solid ${C.red}40`,
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    color: C.red,
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleSave}
                    disabled={!form.name.trim() || !form.prompt.trim() || isLoading}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: form.name.trim() && form.prompt.trim() ? C.green : C.muted,
                      border: 'none',
                      borderRadius: 8,
                      color: '#000',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: form.name.trim() && form.prompt.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {isLoading ? 'Saving...' : (editingAgent ? 'Update Agent' : 'Create Agent')}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setEditingAgent(null); }}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.muted,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : runningAgent ? (
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: runningAgent.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Bot size={24} color="#000" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>{runningAgent.name}</h3>
                    <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{runningAgent.description}</p>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>
                    What should {runningAgent.name} do?
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={`Ask ${runningAgent.name} to analyze your code, fix bugs, generate components, etc.`}
                    style={{
                      width: '100%',
                      minHeight: 100,
                      padding: '12px',
                      backgroundColor: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.text,
                      fontSize: 14,
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16, padding: 12, backgroundColor: C.surface, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                    Files in context ({files.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {files.slice(0, 10).map((f, i) => (
                      <span key={i} style={{
                        padding: '4px 8px',
                        backgroundColor: C.bg,
                        borderRadius: 4,
                        fontSize: 11,
                        color: C.muted,
                      }}>
                        {f.name}
                      </span>
                    ))}
                    {files.length > 10 && (
                      <span style={{ fontSize: 11, color: C.muted }}>+{files.length - 10} more</span>
                    )}
                  </div>
                </div>

                {error && (
                  <div style={{
                    padding: 12,
                    backgroundColor: `${C.red}20`,
                    border: `1px solid ${C.red}40`,
                    borderRadius: 8,
                    marginBottom: 16,
                    fontSize: 13,
                    color: C.red,
                  }}>
                    {error}
                  </div>
                )}

                {result && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>
                      Response
                    </label>
                    <div style={{
                      backgroundColor: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: 16,
                      maxHeight: 300,
                      overflow: 'auto',
                      fontSize: 13,
                      color: C.text,
                      whiteSpace: 'pre-wrap',
                      fontFamily: "'Fragment Mono', monospace",
                      lineHeight: 1.6,
                    }}>
                      {result}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => handleRun(runningAgent)}
                    disabled={isLoading || !customPrompt.trim()}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: isLoading || !customPrompt.trim() ? C.muted : C.green,
                      border: 'none',
                      borderRadius: 8,
                      color: '#000',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isLoading || !customPrompt.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Play size={16} /> {isLoading ? 'Running...' : 'Run Agent'}
                  </button>
                  <button
                    onClick={() => setRunningAgent(null)}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: 'transparent',
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.muted,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: C.muted }}>
                <Wand2 size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>Select an Agent</h3>
                <p style={{ fontSize: 14, maxWidth: 300 }}>
                  Click on an agent from the list to run it, or create a new one.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
