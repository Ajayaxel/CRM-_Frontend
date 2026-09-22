'use client';

import { useState } from 'react';
import { MessageSquare, Sparkles, User, ArrowRight, CheckCircle2, Clock, Plus, Phone } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onGenerateQuote?: (customerName: string) => void;
}

export function TravelInbox({ onGenerateQuote }: Props) {
  const [selectedChatId, setSelectedChatId] = useState<string>('c1');

  const chats = [
    {
      id: 'c1',
      name: 'Rahul Sharma',
      phone: '+971 50 1234567',
      time: '10:32 AM',
      unread: true,
      lastMessage: 'Hi, I need a 5-day Dubai family package for 4 people coming from Kochi next month.',
      aiDetected: {
        familyTrip: true,
        pax: 4,
        destination: 'Dubai, UAE',
        intent: 'HIGH_HOT_LEAD',
        recommendedPackage: 'Dubai 5-Day Family Extravaganza',
      },
    },
    {
      id: 'c2',
      name: 'Anjali Nair',
      phone: '+44 7700 900077',
      time: '09:15 AM',
      unread: false,
      lastMessage: 'Can you check if my UK student visa biometrics appointment has been confirmed?',
      aiDetected: {
        familyTrip: false,
        pax: 1,
        destination: 'United Kingdom',
        intent: 'VISA_STATUS_CHECK',
        recommendedPackage: 'UK Student Migration Assist',
      },
    },
    {
      id: 'c3',
      name: 'Mohammed Al-Saud',
      phone: '+966 50 9876543',
      time: 'Yesterday',
      unread: false,
      lastMessage: 'We would like to book the Bali Private Pool Villa Honeymoon escape for late December.',
      aiDetected: {
        familyTrip: false,
        pax: 2,
        destination: 'Ubud & Seminyak, Bali',
        intent: 'VIP_LUXURY_BOOKING',
        recommendedPackage: 'Bali Private Pool Villa Escape 6D',
      },
    },
  ];

  const activeChat = chats.find((c) => c.id === selectedChatId) || chats[0];

  return (
    <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', height: 600, display: 'flex' }}>
      {/* Left Chat List */}
      <div style={{ width: 320, borderRight: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} style={{ color: '#25D366' }} /> WhatsApp Inbox
          </div>
          <span style={{ fontSize: 11, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
            Live Direct
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChatId(chat.id)}
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #E2E8F0',
                cursor: 'pointer',
                background: selectedChatId === chat.id ? '#ffffff' : 'transparent',
                borderLeft: selectedChatId === chat.id ? '4px solid #25D366' : '4px solid transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{chat.name}</span>
                <span style={{ fontSize: 11, color: '#64748B' }}>{chat.time}</span>
              </div>
              <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {chat.lastMessage}
              </div>
              {chat.aiDetected && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#4338CA', fontWeight: 600 }}>
                  <Sparkles size={12} /> AI Detected: {chat.aiDetected.destination} ({chat.aiDetected.pax} PAX)
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center Messages Conversation View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{activeChat.name}</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>{activeChat.phone}</div>
          </div>
          <button
            onClick={() => toast.success(`Calling ${activeChat.phone}...`)}
            style={{ padding: '6px 12px', borderRadius: 6, background: '#F1F5F9', border: '1px solid #CBD5E1', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Phone size={14} /> Call Client
          </button>
        </div>

        <div style={{ flex: 1, padding: 20, overflowY: 'auto', background: '#F1F5F9', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ alignSelf: 'flex-start', background: '#ffffff', padding: '12px 16px', borderRadius: '12px 12px 12px 2px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', maxWidth: '75%' }}>
            <div style={{ fontSize: 13, color: '#0F172A' }}>{activeChat.lastMessage}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4, textAlign: 'right' }}>{activeChat.time}</div>
          </div>
        </div>

        {/* Input Box */}
        <div style={{ padding: 16, borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10 }}>
          <input
            placeholder="Type WhatsApp reply or AI prompt..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #CBD5E1', outline: 'none', fontSize: 13 }}
          />
          <button
            onClick={() => toast.success('WhatsApp message sent!')}
            style={{ padding: '10px 18px', borderRadius: 8, background: '#25D366', color: '#ffffff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >
            Send WA
          </button>
        </div>
      </div>

      {/* Right AI Lead Detection & Instant Action Panel */}
      <div style={{ width: 300, borderLeft: '1px solid #E2E8F0', background: '#F8FAFC', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#4338CA' }}>
          <Sparkles size={16} /> Attio AI Lead Insights
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, color: '#64748B' }}>Detected Intent</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{activeChat.aiDetected.intent.replace('_', ' ')}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>Target Destination</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4F46E5', marginTop: 2 }}>{activeChat.aiDetected.destination}</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>Party Size</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{activeChat.aiDetected.pax} Passengers</div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Instant CRM Actions</div>
        <button
          onClick={() => {
            if (onGenerateQuote) onGenerateQuote(activeChat.name);
            else toast.success(`Generated quote for ${activeChat.name}`);
          }}
          style={{ padding: '10px 14px', borderRadius: 8, background: '#4F46E5', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          ✨ Generate Quote Proposal
        </button>

        <button
          onClick={() => toast.success(`Lead assigned to Senior Agent`)}
          style={{ padding: '10px 14px', borderRadius: 8, background: '#ffffff', color: '#334155', border: '1px solid #CBD5E1', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
        >
          👤 Assign Deal to Agent
        </button>
      </div>
    </div>
  );
}
