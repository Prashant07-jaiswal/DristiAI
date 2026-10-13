import React, { useState, useEffect } from 'react';
import { Network, Database, Activity, Shield, RefreshCw, UploadCloud, LogOut, Sun, Moon, Search, Send, X } from 'lucide-react';
import * as api from './services/api';
import GraphCanvas from './components/GraphCanvas';
import UploadModal from './components/UploadModal';
import Login from './components/Login';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // State for analytics and graph
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [keyPlayers, setKeyPlayers] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [graphStats, setGraphStats] = useState({ nodes: 0, edges: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [openHighRiskFolder, setOpenHighRiskFolder] = useState(true);
  const [openSyndicateFolder, setOpenSyndicateFolder] = useState(true);
  const [openNlqFolder, setOpenNlqFolder] = useState(true);
  const [showRootTree, setShowRootTree] = useState(true);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState([]);

  // NLQ state
  const [nlqQuery, setNlqQuery] = useState('');
  const [nlqLoading, setNlqLoading] = useState(false);
  const [nlqResult, setNlqResult] = useState(null);
  const [nlqError, setNlqError] = useState(null);

  // Theme state - 'dark' by default, persisted in localStorage
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Apply theme to document root whenever it changes
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Fetch data on mount or when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setIsAuthenticated(false);
    setGraphData({ nodes: [], edges: [] });
    setKeyPlayers([]);
    setCommunities([]);
    setDataLoaded(false);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch current graph
      try {
        const graphRes = await api.getGraphData();
        if (graphRes.data && graphRes.data.nodes && graphRes.data.nodes.length > 0) {
          setGraphData(graphRes.data);
          setGraphStats({
            nodes: graphRes.data.node_count || graphRes.data.nodes.length,
            edges: graphRes.data.edge_count || graphRes.data.edges.length,
          });
          setDataLoaded(true);
        } else {
          setDataLoaded(false);
          setLoading(false);
          return;
        }
      } catch (e) {
        if (e.response?.status === 401) handleLogout();
        setDataLoaded(false);
        setLoading(false);
        return;
      }

      // 2. Fetch Key Players
      try {
        const playersRes = await api.getKeyPlayers();
        if (playersRes.data && playersRes.data.key_players) {
          setKeyPlayers(playersRes.data.key_players.slice(0, 5));
        }
      } catch (err) {
        console.warn("Key players not ready yet", err);
      }

      // 3. Fetch Communities
      try {
        const commRes = await api.getCommunities();
        if (commRes.data && commRes.data.communities) {
          setCommunities(commRes.data.communities.slice(0, 4));
        }
      } catch (err) {
        console.warn("Communities not ready yet", err);
      }

    } catch (error) {
      console.error("Error fetching dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunIngestion = async () => {
    try {
      setLoading(true);
      await api.runIngestion();
      await fetchDashboardData();
    } catch (error) {
      console.error("Error running ingestion", error);
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        alert("Error processing data: " + (error.response?.data?.detail || error.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKeyPlayer = (player) => {
    // Find node in graph data and highlight/select it
    const foundNode = graphData.nodes?.find(n => n.id === player.entity_id || n.label === player.entity_name);
    if (foundNode) {
      setSelectedNode({
        id: foundNode.id,
        name: foundNode.label,
        type: foundNode.type,
        metadata: {
          ...foundNode.metadata,
          aliases: player.aliases,
          risk_score: player.risk_score,
          connections: player.connections
        }
      });
      setHighlightedNodeIds([foundNode.id]);
    }
  };

  const handleNlqQuery = async () => {
    if (!nlqQuery.trim()) return;
    try {
      setNlqLoading(true);
      setNlqError(null);
      setNlqResult(null);

      const response = await api.queryNetwork(nlqQuery);
      if (response.data) {
        setNlqResult({
          message: response.data.message,
          timestamp: new Date().toLocaleTimeString()
        });
        let highlightedIds = [];
        if (response.data.matches && Array.isArray(response.data.matches)) {
          highlightedIds = response.data.matches.map(m => m.id);
        }
        setHighlightedNodeIds(highlightedIds);
      }
    } catch (err) {
      setNlqError(err.response?.data?.detail || err.message || 'Error processing query');
    } finally {
      setNlqLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="navbar">
        <div className="brand">
          <Shield color={theme === 'dark' ? '#00f0ff' : '#0891b2'} size={28} />
          <span className="brand-title">DristiAI</span>
        </div>

        <div className="action-bar">
          {/* Theme Toggle */}
          <div className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} color="#d97706" />}
            <div className={`toggle-track${theme === 'light' ? ' active' : ''}`}>
              <div className="toggle-thumb" />
            </div>
            <span className="toggle-label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </div>

          <button
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', backgroundColor: theme === 'dark' ? '#1e293b' : '#e2e8f0', border: `1px solid ${theme === 'dark' ? '#334155' : '#cbd5e1'}`, color: theme === 'dark' ? '#fff' : '#1e293b' }}
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Graph
          </button>

          <button
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', backgroundColor: '#6d28d9' }}
            onClick={() => setShowUpload(true)}
            disabled={loading}
          >
            <UploadCloud size={16} /> Upload Evidence
          </button>

          <button
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', backgroundColor: '#3b82f6' }}
            onClick={handleRunIngestion}
            disabled={loading}
          >
            <Database size={16} /> Re-Ingest Data
          </button>

          <button
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem', backgroundColor: '#ef4444', border: '1px solid #dc2626' }}
            onClick={handleLogout}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">

        {/* Left Analytics Side Panel — VS Code style accordion */}
        <aside className="sidebar">

          {/* Section 1: High-Risk-Subjects */}
          <div className="tree-section">
            <div
              className="tree-section-header"
              onClick={() => setOpenHighRiskFolder(!openHighRiskFolder)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="tree-chevron">{openHighRiskFolder ? '▼' : '▶'}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: 0.3 }}>High-Risk-Subjects</span>
              </div>
              <span className="tree-count">{keyPlayers.length}</span>
            </div>

            {openHighRiskFolder && (
              <div className="tree-children">
                {keyPlayers.length > 0 ? (
                  keyPlayers.map((player, idx) => (
                    <div
                      key={idx}
                      className="tree-item"
                      onClick={() => handleSelectKeyPlayer(player)}
                    >
                      <span className="tree-item-name">{player.entity_name}</span>
                      <span className="tree-badge tree-badge-red">
                        {(player.risk_score * 10).toFixed(1)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="tree-empty">No suspects loaded</div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Detected-Syndicates */}
          <div className="tree-section">
            <div
              className="tree-section-header"
              onClick={() => setOpenSyndicateFolder(!openSyndicateFolder)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="tree-chevron">{openSyndicateFolder ? '▼' : '▶'}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: 0.3 }}>Detected-Syndicates</span>
              </div>
              <span className="tree-count">{communities.length}</span>
            </div>

            {openSyndicateFolder && (
              <div className="tree-children">
                {communities.length > 0 ? (
                  communities.map((comm, idx) => (
                    <div
                      key={idx}
                      className="tree-item"
                    >
                      <span className="tree-item-name">Syndicate #{comm.id}</span>
                      <span className="tree-badge tree-badge-amber">
                        {comm.member_count} mem
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="tree-empty">No syndicates detected</div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Natural Language Query */}
          <div className="tree-section">
            <div
              className="tree-section-header"
              onClick={() => setOpenNlqFolder(!openNlqFolder)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="tree-chevron">{openNlqFolder ? '▼' : '▶'}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Search size={14} color="#3b82f6" /> Natural Language Query
                </span>
              </div>
              <span className="tree-count">NLQ</span>
            </div>

            {openNlqFolder && (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-primary)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Ask about connections... (e.g., 'Who connects Vikram...')"
                    value={nlqQuery}
                    onChange={(e) => setNlqQuery(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') handleNlqQuery(); }}
                    disabled={nlqLoading}
                    style={{
                      flex: 1,
                      background: theme === 'light' ? '#f1f5f9' : '#0a0f18',
                      border: `1px solid var(--border-color)`,
                      color: 'var(--text-primary)',
                      padding: '8px 10px',
                      borderRadius: 4,
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleNlqQuery}
                    disabled={nlqLoading || !nlqQuery.trim()}
                    style={{
                      background: '#3b82f6',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: 4,
                      cursor: nlqLoading || !nlqQuery.trim() ? 'not-allowed' : 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      opacity: nlqLoading || !nlqQuery.trim() ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    {nlqLoading ? <Activity size={14} className="animate-spin" /> : <Send size={14} />}
                    Ask
                  </button>
                </div>

                {nlqResult && (
                  <div style={{
                    background: theme === 'light' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid #22c55e',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: '0.8rem',
                    color: 'var(--text-primary)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, color: '#22c55e', marginBottom: 4 }}>
                      <span>Query Result</span>
                      <button onClick={() => setNlqResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={12} /></button>
                    </div>
                    <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 150, overflowY: 'auto' }}>
                      {nlqResult.message}
                    </div>
                  </div>
                )}

                {nlqError && (
                  <div style={{
                    background: theme === 'light' ? 'rgba(220, 38, 38, 0.08)' : 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    borderRadius: 6,
                    padding: 8,
                    fontSize: '0.8rem',
                    color: '#ef4444'
                  }}>
                    <div style={{ fontWeight: 500, marginBottom: 2 }}>Error</div>
                    <div>{nlqError}</div>
                  </div>
                )}

                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Examples:</div>
                  <div style={{ lineHeight: 1.5 }}>
                    • "Who connects Vikram to money laundering?"<br/>
                    • "Show path between Mumbai and Delhi syndicates"<br/>
                    • "What accounts are linked to Ramesh?"
                  </div>
                </div>
              </div>
            )}
          </div>

        </aside>

        {/* Center Canvas Area */}
        <section className="graph-container">
          {!dataLoaded ? (
            <div className="empty-state">
              <Network size={64} color={theme === 'dark' ? '#3b82f6' : '#2563eb'} style={{ opacity: 0.5, marginBottom: '20px' }} />
              <h2 style={{ marginBottom: '10px' }}>No Network Data Loaded</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Run the multi-source pipeline to extract FIRs, match CDR calls, and detect bank anomalies.
              </p>
              <button
                className="btn-primary"
                onClick={handleRunIngestion}
                disabled={loading}
                style={{ margin: '0 auto', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <Activity size={20} className="animate-spin" /> : <Database size={20} />}
                {loading ? 'Analyzing Intelligence Data...' : 'Run Pipeline & Ingest'}
              </button>
            </div>
          ) : (
            <GraphCanvas
              graphData={graphData}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              theme={theme}
              highlightedNodeIds={highlightedNodeIds}
            />
          )}
        </section>

      </main>

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onRefresh={fetchDashboardData}
        />
      )}
    </div>
  );
}

export default App;
