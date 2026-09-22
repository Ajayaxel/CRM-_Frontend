'use client';

import React, { useState } from 'react';
import { Sun, Zap, Leaf, ShieldCheck, Ticket, CreditCard, MessageSquare, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export function SolarCustomerMobileAppView() {
  const [activeTab, setActiveTab] = useState<'home' | 'bills' | 'tickets' | 'chat'>('home');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: 'Hello! I am your SolarOS AI Customer Assistant. How can I help with your solar plant today?' },
  ]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');

    setTimeout(() => {
      let reply = 'Your solar plant is currently operating at optimal efficiency (99.4% uptime). Daily generation reached 48.5 kWh today.';
      if (userMsg.toLowerCase().includes('bill') || userMsg.toLowerCase().includes('pay')) {
        reply = 'Your July 2026 monitoring invoice (AED 472.50) is paid. Your next cycle bills on August 1st.';
      } else if (userMsg.toLowerCase().includes('ticket') || userMsg.toLowerCase().includes('fault')) {
        reply = 'You have no active high-priority faults. Regular PM inspection is scheduled for next month.';
      }
      setChatMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    }, 800);
  };

  return (
    <div className="max-w-md mx-auto bg-slate-950 text-slate-100 min-h-[640px] rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col font-sans">
      {/* Top Header */}
      <div className="bg-slate-900/90 p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">SolarOS Mobile</h2>
            <p className="text-[10px] text-slate-400">Green Energy Plant #1</p>
          </div>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ONLINE
        </span>
      </div>

      {/* Body Content */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {activeTab === 'home' && (
          <>
            {/* Live Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>Today Output</span>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-white font-mono">48.5 kWh</div>
                  <div className="text-[10px] text-emerald-400">102% of target</div>
                </div>
              </div>

              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>CO₂ Avoided</span>
                  <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="mt-2">
                  <div className="text-xl font-black text-emerald-400 font-mono">34.4 kg</div>
                  <div className="text-[10px] text-slate-400">Today's offset</div>
                </div>
              </div>
            </div>

            {/* Lifetime Savings Card */}
            <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 p-4 rounded-2xl border border-amber-500/20">
              <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Lifetime Utility Savings</div>
              <div className="text-2xl font-black text-white mt-1 font-mono">AED 14,850</div>
              <p className="text-[11px] text-slate-400 mt-1">2.4 years into 25-year system lifespan</p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab('bills')}
                  className="p-3 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 text-left transition-colors"
                >
                  <CreditCard className="w-4 h-4 text-emerald-400 mb-1" />
                  <div className="text-xs font-bold text-white">Pay Invoice</div>
                  <div className="text-[10px] text-slate-400">View bill status</div>
                </button>

                <button
                  onClick={() => setActiveTab('chat')}
                  className="p-3 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 text-left transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-cyan-400 mb-1" />
                  <div className="text-xs font-bold text-white">AI Assistant</div>
                  <div className="text-[10px] text-slate-400">Ask support questions</div>
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'bills' && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subscription & Invoices</h3>
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">July 2026 AMC & Monitoring</div>
                <div className="text-[10px] text-slate-400 mt-0.5">AED 450.00 + AED 22.50 VAT</div>
              </div>
              <span className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> PAID
              </span>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[480px]">
            <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-2xl max-w-[85%] text-xs ${
                    m.sender === 'user'
                      ? 'bg-amber-500/20 text-amber-100 ml-auto border border-amber-500/30'
                      : 'bg-slate-900 text-slate-200 border border-slate-800'
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask AI Copilot..."
                className="flex-1 bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500/50"
              />
              <button
                onClick={handleSendChat}
                className="px-3 bg-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav Bar */}
      <div className="bg-slate-900 border-t border-slate-800 grid grid-cols-4 p-2 text-center text-[10px]">
        <button
          onClick={() => setActiveTab('home')}
          className={`py-1 flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          <Sun className="w-4 h-4" /> Home
        </button>
        <button
          onClick={() => setActiveTab('bills')}
          className={`py-1 flex flex-col items-center gap-1 ${activeTab === 'bills' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          <CreditCard className="w-4 h-4" /> Bills
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`py-1 flex flex-col items-center gap-1 ${activeTab === 'tickets' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          <Ticket className="w-4 h-4" /> Support
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`py-1 flex flex-col items-center gap-1 ${activeTab === 'chat' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
        >
          <MessageSquare className="w-4 h-4" /> AI Chat
        </button>
      </div>
    </div>
  );
}
