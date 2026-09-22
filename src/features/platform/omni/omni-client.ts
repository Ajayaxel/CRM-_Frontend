'use client';

import axios from 'axios';
import { useAuthStore } from '@/features/foundation/auth';

// Talks to the Omnichannel + AI microservice via the /omni proxy rewrite.
export const omniApi = axios.create({ baseURL: '/omni' });

omniApi.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type ChannelType =
  | 'WEB_CHAT' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TELEGRAM' | 'SMS' | 'RCS' | 'EMAIL' | 'VOICE';
export type ConversationStatus = 'OPEN' | 'PENDING' | 'SNOOZED' | 'CLOSED';
export type MessageAuthorType = 'CONTACT' | 'AGENT' | 'AI' | 'SYSTEM' | 'NOTE';

export interface OmniMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  authorType: MessageAuthorType;
  authorName?: string | null;
  body: string;
  aiProvider?: string | null;
  createdAt: string;
}

export interface ConversationRow {
  id: string;
  channelType: ChannelType;
  status: ConversationStatus;
  contactName?: string | null;
  contactHandle?: string | null;
  subject?: string | null;
  unread: boolean;
  aiEnabled: boolean;
  lastMessageAt?: string | null;
  assignedTo?: { firstName: string; lastName?: string | null } | null;
  lead?: { id: string; firstName: string; lastName?: string | null } | null;
  lastMessage?: OmniMessage | null;
}

export interface ConversationThread extends ConversationRow {
  aiSummary?: string | null;
  messages: OmniMessage[];
  lead?: {
    id: string; firstName: string; lastName?: string | null; email?: string | null;
    phone?: string | null; score?: number; stage?: { name: string } | null; course?: { name: string } | null;
  } | null;
}

export interface AiAgentConfig {
  enabled: boolean;
  provider: string;
  model?: string | null;
  persona: string;
  autoReply: boolean;
  providers: { provider: string; configured: boolean; model: string }[];
}

export const CHANNEL_META: Record<ChannelType, { label: string; color: string; icon: string }> = {
  WEB_CHAT: { label: 'Web Chat', color: '#132376', icon: '💬' },
  WHATSAPP: { label: 'WhatsApp', color: '#25D366', icon: '🟢' },
  INSTAGRAM: { label: 'Instagram', color: '#E1306C', icon: '📸' },
  FACEBOOK: { label: 'Messenger', color: '#0084FF', icon: '💠' },
  TELEGRAM: { label: 'Telegram', color: '#0088cc', icon: '✈️' },
  SMS: { label: 'SMS', color: '#6b6260', icon: '💌' },
  RCS: { label: 'RCS', color: '#00a0e9', icon: '📲' },
  EMAIL: { label: 'Email', color: '#e6a23c', icon: '✉️' },
  VOICE: { label: 'Voice', color: '#8E7CC3', icon: '📞' },
};

export function contactInitials(name?: string | null) {
  const parts = (name ?? 'Visitor').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? 'V') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const AV = ['#7C8CE0', '#E6A23C', '#4F8A6B', '#C86B7A', '#5B8CA6', '#B08968', '#8E7CC3', '#D08770'];
export function contactColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AV[h % AV.length];
}

export interface OmniContact {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  handle?: string | null;
  channels: ChannelType[];
  tags: string[];
  optIn: boolean;
  lastSeenAt?: string | null;
  _count?: { conversations: number };
}
export interface Segment {
  id: string;
  name: string;
  description?: string | null;
  filters: { tags?: string[]; channel?: string; optIn?: boolean; search?: string };
}
export interface SavedReply {
  id: string;
  title: string;
  shortcut?: string | null;
  body: string;
}

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type BroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED';

export interface MessageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  channelType: ChannelType;
  header?: string | null;
  body: string;
  footer?: string | null;
  buttons: any[];
  variables: string[];
  status: TemplateStatus;
  createdAt: string;
}

export interface Broadcast {
  id: string;
  name: string;
  channelType: ChannelType;
  templateId?: string | null;
  template?: { name: string } | null;
  segmentId?: string | null;
  body: string;
  status: BroadcastStatus;
  scheduledAt?: string | null;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
}

export type JourneyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface JourneyStep {
  id: string;
  order: number;
  delayMinutes: number;
  templateId?: string | null;
  body: string;
}

export interface Journey {
  id: string;
  name: string;
  description?: string | null;
  channelType: ChannelType;
  segmentId?: string | null;
  status: JourneyStatus;
  createdAt: string;
  steps?: JourneyStep[];
  _count?: { steps: number; enrollments: number };
  stats?: { ACTIVE: number; COMPLETED: number; CANCELLED: number };
  messagesSent?: number;
}

export interface KbArticle {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source?: string | null;
  updatedAt: string;
}

export type BotStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED';
export type BotFallback = 'AI' | 'MESSAGE' | 'HANDOFF';

export interface BotIntent {
  id?: string;
  name: string;
  keywords: string[];
  reply: string;
  action?: 'reply' | 'handoff' | 'collect';
}

export interface Bot {
  id: string;
  name: string;
  channelType: ChannelType;
  status: BotStatus;
  welcomeMessage?: string | null;
  flow: { intents: BotIntent[] };
  kbEnabled: boolean;
  fallbackMode: BotFallback;
  fallbackMessage?: string | null;
  createdAt: string;
  _count?: { sessions: number };
}

export interface BotReply {
  reply: string;
  source: 'welcome' | 'intent' | 'ai' | 'message' | 'handoff';
  matchedIntent?: string;
  handoff: boolean;
  kbUsed: string[];
  provider?: string;
}

export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM';
export type CommentAction = 'REPLY' | 'DM' | 'REPLY_AND_DM';

export interface CommentRule {
  id: string;
  platform: SocialPlatform;
  name: string;
  keywords: string[];
  action: CommentAction;
  replyText?: string | null;
  dmText?: string | null;
  active: boolean;
  matchCount: number;
  createdAt: string;
}

export interface SocialEvent {
  id: string;
  platform: SocialPlatform;
  type: 'COMMENT' | 'LEAD_AD' | 'MENTION';
  authorName?: string | null;
  authorHandle?: string | null;
  text?: string | null;
  actionTaken?: string | null;
  ruleId?: string | null;
  leadId?: string | null;
  createdAt: string;
}

export interface SocialStats { comments: number; leads: number; activeRules: number }

export interface WhatsAppAd {
  id: string;
  name: string;
  refCode: string;
  phone: string;
  prefillText?: string | null;
  /** Meta's own ad id. Set it and real click-to-WhatsApp referrals attribute to this ad. */
  metaAdId?: string | null;
  headline?: string | null;
  platform: string;
  clicks: number;
  conversations: number;
  createdAt: string;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  priceInr: number;
  currency: string;
  imageUrl?: string | null;
  category?: string | null;
  active: boolean;
  stock?: number | null;
}

export interface OrderItem {
  id: string;
  productId?: string | null;
  name: string;
  priceInr: number;
  quantity: number;
}

export interface Order {
  id: string;
  number: string;
  contactName?: string | null;
  contactHandle?: string | null;
  channelType: ChannelType;
  status: OrderStatus;
  subtotalInr: number;
  currency: string;
  payLinkRef?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  items: OrderItem[];
  createdAt: string;
}

export interface CommerceStats { orders: number; paid: number; revenue: number; products: number }

export interface OmniApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  active: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface OmniWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  deliveries: number;
  lastStatus?: number | null;
  lastFiredAt?: string | null;
  createdAt: string;
}

export interface IntegrationDirItem {
  key: string;
  name: string;
  desc: string;
  category: string;
  via: 'webhook' | 'api';
}

export interface IntegrationDirectory {
  integrations: IntegrationDirItem[];
  events: string[];
}

export interface AnalyticsOverview {
  conversations: { total: number; open: number; closed: number };
  aiHandledMessages: number;
  contacts: number;
  firstResponseMins: number;
  resolutionMins: number;
  broadcasts: { sent: number; delivered: number; read: number };
  commerce: { orders: number; revenue: number };
  leadAds: number;
}
export interface ChannelStat { channel: ChannelType; count: number }
export interface VolumePoint { date: string; in: number; out: number }
export interface SentimentStat { positive: number; neutral: number; negative: number; total: number; score: number }

export interface WabaAccount {
  id: string;
  name: string;
  connected: boolean;
  phoneNumberId?: string | null;
  displayNumber?: string | null;
  qualityRating: string;
  verifiedName: string;
}
export interface OmniBilling {
  planName: string;
  balanceCredits: number;
  includedCredits: number;
  usedCredits: number;
}
export interface CreditTransaction {
  id: string;
  type: 'TOPUP' | 'USAGE' | 'BONUS';
  credits: number;
  balanceAfter: number;
  note?: string | null;
  createdAt: string;
}
export interface ComplianceStats { total: number; optedIn: number; optedOut: number }

/** `permission`/`allowed`: the key the tool needs and whether the caller holds it — display only; omni enforces it. */
export interface AgentTool { name: string; desc: string; params: string[]; permission?: string; allowed?: boolean }
export interface AgentAction { tool: string; args: Record<string, any>; ok: boolean; summary: string; data?: any }
export interface AgentRunResult { reply: string; actions: AgentAction[]; plan: { tool: string; args: any }[] }
export interface AffiliateAccount {
  code: string;
  visits: number;
  signups: number;
  earningsInr: number;
  payoutPending: number;
}
