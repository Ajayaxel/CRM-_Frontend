'use client';

import React, { useState } from 'react';
import { Bot, Sparkles, Send, Activity, ShieldCheck, DollarSign, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export function SolarAiCopilotView() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ sender: 'user' | 'ai'; text: string; actionTaken?: string }[]>([
    {
      sender: 'ai',
      text: 'Welcome to SolarOS AI Copilot! Ask me anything about project sizing, inventory stock, recurring revenue, fault telemetry, or profit margins.',
    },
  ]);

  const handleQuery = async (inputPrompt?: string) => {
    const q = inputPrompt || prompt;
    if (!q.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: q }]);
    if (!inputPrompt) setPrompt('');
    setLoading(true);

    setTimeout(() => {
      let reply = 'SolarOS Copilot analyzed 12 active projects, 4 recurring monitoring subscriptions, and 1 open fault ticket.';
      let action: string | undefined = undefined;

      const lower = q.toLowerCase();
      if (lower.includes('margin') || lower.includes('profit')) {
        reply = 'System designs achieve an average gross profit margin of 18.4% on BOM materials + installation overheads. Highest margin project: SOL-0042 (22.1%).';
        action = 'FETCH_PROFIT_MARGINS';
      } else if (lower.includes('fault') || lower.includes('ticket')) {
        reply = '1 open ticket: UNDERPERFORMANCE on SOL-0042 (generating 64% of expected). Ingestion poller checked 15 mins ago.';
        action = 'FILTER_SERVICE_TICKETS';
      } else if (lower.includes('revenue') || lower.includes('mrr') || lower.includes('subscription')) {
        reply = 'Current MRR: AED 450.00 / month. Annual Recurring Revenue (ARR) projected at AED 5,400.00 across 25-year lifetime monitoring contracts.';
        action = 'FETCH_RECURRING_REVENUE';
      } else if (lower.includes('generation') || lower.includes('fleet')) {
        reply = 'Total lifetime fleet generation is 148,250 kWh. Fleet uptime is currently 99.4%.';
        action = 'FETCH_FLEET_GENERATION';
      }

      setMessages((prev) => [...prev, { sender: 'ai', text: reply, actionTaken: action }]);
      setLoading(false);
    }, 900);
  };

  const quickPrompts = [
    'What is our total MRR and ARR across monitoring subscriptions?',
    'Which solar plant has open service tickets?',
    'What is the average gross profit margin on system designs?',
    'Show total lifetime kWh generated across all fleet plants',
  ];

  return (
    <div
      className="space-y-6 p-6 rounded-2xl border shadow-2xl"
      style={{ background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1" style={{ background: 'var(--tone-info-bg)', color: 'var(--tone-info)', border: '1px solid var(--tone-info-line)' }}>
              <Sparkles className="w-3.5 h-3.5" /> PLATFORM ENGINE (#24)
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1" style={{ color: 'var(--ink)' }}>SolarOS AI Copilot & Natural Actions</h2>
        </div>
      </div>

      {/* Suggestion Chips */}
      <div className="flex flex-wrap gap-2">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleQuery(qp)}
            className="px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 text-left hover:bg-[var(--surface-3)]"
            style={{ background: 'var(--surface-2)', color: 'var(--ink-2)', borderColor: 'var(--hairline)' }}
          >
            <Sparkles className="w-3 h-3 shrink-0" style={{ color: 'var(--tone-renewal)' }} /> {qp}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div className="rounded-xl border p-4 min-h-[320px] max-h-[480px] overflow-y-auto space-y-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.sender === 'ai' && (
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-[var(--tone-info-line)] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" style={{ color: 'var(--tone-info)' }} />
              </div>
            )}

            <div
              className={`p-3.5 rounded-2xl max-w-[80%] text-sm border ${
                m.sender === 'user' ? 'bg-amber-500/20 border-[var(--tone-renewal-line)] font-medium' : ''
              }`}
              style={
                m.sender === 'user'
                  ? { color: 'var(--ink)' }
                  : { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--hairline)' }
              }
            >
              {m.text}
              {m.actionTaken && (
                <div className="mt-2 text-[10px] font-mono px-2 py-1 rounded border w-fit flex items-center gap-1" style={{ background: 'var(--tone-info-bg)', color: 'var(--tone-info)', borderColor: 'var(--tone-info-line)' }}>
                  <Activity className="w-3 h-3" /> ACTION EXECUTED: {m.actionTaken}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-center text-xs" style={{ color: 'var(--ink-2)' }}>
            <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--tone-info)' }} /> Thinking & querying platform data...
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
          placeholder="Ask Copilot (e.g. 'Show revenue trends', 'Draft proposal quote summary')..."
          className="flex-1 border text-sm rounded-xl px-4 py-2.5 outline-none focus:border-indigo-500"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)', color: 'var(--ink)' }}
        />
        <button
          onClick={() => handleQuery()}
          disabled={loading}
          className="px-5 font-bold rounded-xl text-sm transition-all flex items-center gap-2 disabled:opacity-50 hover:opacity-90"
          style={{ background: 'var(--tone-info)', color: 'var(--surface)' }}
        >
          Send <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
