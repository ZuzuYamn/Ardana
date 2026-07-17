import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  HelpCircle, Book, MessageCircle, FileText, Send, User, Bot,
  Loader2, AlertCircle, RefreshCw, X, Sparkles,
  UserPlus, Leaf, Bell, CloudSun, BrainCircuit, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupportMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
  error?: string;
}

function genId() { return Math.random().toString(36).slice(2, 11); }

const API_BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, '');

// ─── API call ─────────────────────────────────────────────────────────────────

async function sendSupportMessage(
  payload: {
    history: Array<{ role: 'user' | 'model'; text: string }>;
    message: string;
  },
  t: (key: string, vars?: Record<string, string>) => string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(`${API_BASE}/api/ai/support`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => ({ error: t('help.support_err_invalid_response') }));
    if (!res.ok) throw new Error(data.error ?? t('help.support_err_request_failed', { status: String(res.status) }));
    if (!data.reply) throw new Error(t('help.support_err_empty_response'));
    return data.reply as string;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(t('help.support_err_timeout'));
    }
    throw err;
  }
}

// ─── Inline markdown ──────────────────────────────────────────────────────────

function InlineText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={k++}>{m[1]}</strong>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function SupportMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-0.5" />;
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-current flex-shrink-0" />
              <span><InlineText text={trimmed.slice(2)} /></span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          return <p key={i}><InlineText text={trimmed} /></p>;
        }
        return <p key={i}><InlineText text={trimmed} /></p>;
      })}
    </div>
  );
}

// ─── Support Chat Component ───────────────────────────────────────────────────
// Always renders the full chat UI — collapse/expand is handled by the
// parent ContactSupportSection, consistent with the other sections.

function SupportChat() {
  const { t } = useLanguage();
  const SUPPORT_SUGGESTIONS = [
    t('help.support_sugg_1'),
    t('help.support_sugg_2'),
    t('help.support_sugg_3'),
    t('help.support_sugg_4'),
  ];
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildHistory = (msgs: SupportMessage[]) =>
    msgs
      .filter((m) => !m.isLoading && !m.error)
      .map((m) => ({ role: m.role, text: m.text }));

  const sendMessage = useCallback(async (text: string, currentMessages: SupportMessage[]) => {
    if (!text.trim()) return;

    const userMsg: SupportMessage = { id: genId(), role: 'user', text: text.trim() };
    const loadingMsg: SupportMessage = { id: genId(), role: 'model', text: '', isLoading: true };
    const withUser = [...currentMessages, userMsg, loadingMsg];
    setMessages(withUser);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await sendSupportMessage({
        history: buildHistory(currentMessages),
        message: text.trim(),
      }, t);
      setMessages((prev) =>
        prev.map((m) => m.id === loadingMsg.id ? { ...m, isLoading: false, text: reply } : m),
      );
    } catch (err) {
      const errText = err instanceof Error ? err.message : t('help.support_err_generic');
      setMessages((prev) =>
        prev.map((m) => m.id === loadingMsg.id ? { ...m, isLoading: false, text: '', error: errText } : m),
      );
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  const handleRetry = useCallback((errorMsg: SupportMessage) => {
    const idx = messages.findIndex((m) => m.id === errorMsg.id);
    const userMsg = idx > 0 ? messages[idx - 1] : null;
    if (!userMsg || userMsg.role !== 'user') return;
    const history = messages.slice(0, idx - 1);
    setMessages(history);
    sendMessage(userMsg.text, history);
  }, [messages, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input, messages); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Chat header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/30">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">{t('help.support_chat_title')}</p>
          <p className="text-xs text-muted-foreground">{t('help.support_chat_subtitle')}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="h-72 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <Bot className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('help.support_greeting')}</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">{t('help.support_greeting_sub')}</p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-xs">
              {SUPPORT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s, messages)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                    isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
                  )}>
                    {isUser ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : msg.error
                      ? 'bg-destructive/10 border border-destructive/20 text-destructive rounded-tl-sm'
                      : 'bg-muted border border-border text-foreground rounded-tl-sm',
                  )}>
                    {msg.isLoading ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground py-0.5">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    ) : msg.error ? (
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="text-xs">{msg.error}</span>
                        </div>
                        <button
                          onClick={() => handleRetry(msg)}
                          className="text-xs flex items-center gap-1 text-destructive/80 hover:text-destructive"
                        >
                          <RefreshCw className="w-3 h-3" /> {t('help.support_retry')}
                        </button>
                      </div>
                    ) : isUser ? (
                      <p className="leading-relaxed whitespace-pre-wrap text-sm">{msg.text}</p>
                    ) : (
                      <SupportMarkdown text={msg.text} />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t bg-muted/20">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={t('help.support_placeholder')}
            className={cn(
              'flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40',
              'min-h-[36px] max-h-[80px] leading-relaxed',
              isLoading && 'opacity-60 cursor-not-allowed',
            )}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 80) + 'px';
            }}
          />
          <Button
            size="icon"
            disabled={isLoading || !input.trim()}
            onClick={() => sendMessage(input, messages)}
            className="h-9 w-9 rounded-xl flex-shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Getting Started Guide ────────────────────────────────────────────────────

const GUIDE_STEPS = [
  { icon: UserPlus,    titleKey: 'help.guide_step1_title', descKey: 'help.guide_step1_desc' },
  { icon: Leaf,        titleKey: 'help.guide_step2_title', descKey: 'help.guide_step2_desc' },
  { icon: Bell,        titleKey: 'help.guide_step3_title', descKey: 'help.guide_step3_desc' },
  { icon: CloudSun,    titleKey: 'help.guide_step4_title', descKey: 'help.guide_step4_desc' },
  { icon: BrainCircuit,titleKey: 'help.guide_step5_title', descKey: 'help.guide_step5_desc' },
];

function GettingStartedGuide({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 group text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
          <Book className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-serif font-bold">{t('help.getting_started')}</h2>
          <p className="text-sm text-muted-foreground">{t('help.getting_started_desc')}</p>
        </div>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="guide-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
              {GUIDE_STEPS.map(({ icon: Icon, titleKey, descKey }, index) => (
                <motion.div
                  key={titleKey}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.06 }}
                  className="flex items-start gap-4 p-5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-sm">
                      {index + 1}
                    </div>
                    {index < GUIDE_STEPS.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-2 min-h-[20px]" />
                    )}
                  </div>
                  <div className="flex items-start gap-3 flex-1 min-w-0 pb-1">
                    <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5 border border-primary/15">
                      <Icon className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground mb-1">{t(titleKey)}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AI Tutorial Section ──────────────────────────────────────────────────────

const AI_TUTORIAL_STEPS = [
  {
    icon: Leaf,
    title: 'Plant Identification',
    desc: 'Upload a photo of any plant — the AI instantly identifies the species, common name, and care family.',
  },
  {
    icon: BrainCircuit,
    title: 'Disease Detection',
    desc: 'The same photo scan checks for visible diseases, pests, or deficiencies and explains what it found.',
  },
  {
    icon: MessageCircle,
    title: 'AI Chat Assistant',
    desc: 'Ask follow-up questions about watering, sunlight, soil, or anything plant-related in the Contact Support chat.',
  },
  {
    icon: Sparkles,
    title: 'Smart Reminders',
    desc: 'After saving a plant the AI suggests a watering and fertilising schedule tailored to that species.',
  },
];

function AITutorialSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="space-y-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 group text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center flex-shrink-0 group-hover:bg-secondary/40 transition-colors">
          <FileText className="w-5 h-5 text-secondary-foreground" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-serif font-bold">AI Tools Tutorial</h2>
          <p className="text-sm text-muted-foreground">Learn how the AI features work together</p>
        </div>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="tutorial-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
              {AI_TUTORIAL_STEPS.map(({ icon: Icon, title, desc }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.06 }}
                  className="flex items-start gap-4 p-5 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-secondary/15 flex items-center justify-center flex-shrink-0 mt-0.5 border border-secondary/20">
                    <Icon className="w-4.5 h-4.5 text-secondary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground mb-1">{title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Contact Support Section ──────────────────────────────────────────────────
// Consistent with the other sections: a collapsible header + body.
// When expanded, the full chat is shown immediately with no intermediate state.

function ContactSupportSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 group text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
          <MessageCircle className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-serif font-bold">{t('help.support_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('help.support_subtitle')}</p>
        </div>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="chat-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <SupportChat />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Help Page ───────────────────────────────────────────────────────────

export default function Help() {
  const { t } = useLanguage();

  // All sections start collapsed
  const [guideOpen, setGuideOpen]       = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [chatOpen, setChatOpen]         = useState(false);
  const [faqValue, setFaqValue]         = useState<string>('');

  // Section refs for smooth scrolling
  const guideRef    = useRef<HTMLDivElement>(null);
  const tutorialRef = useRef<HTMLDivElement>(null);
  const chatRef     = useRef<HTMLDivElement>(null);
  const faqRef      = useRef<HTMLDivElement>(null);

  // Wait for AnimatePresence to start expanding before scrolling so the
  // section header lands at the top of the viewport, not the content mid-way.
  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>, delay = 80) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, delay);
  };

  const handleGettingStarted = () => {
    setGuideOpen(true);
    scrollTo(guideRef);
  };

  const handleAITutorial = () => {
    setTutorialOpen(true);
    scrollTo(tutorialRef);
  };

  const handleContactSupport = () => {
    setChatOpen(true);
    scrollTo(chatRef);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Hero */}
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-foreground">{t('help.title')}</h1>
        <p className="text-muted-foreground mt-2 text-lg">{t('help.subtitle')}</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={handleGettingStarted}
          className="text-left rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 hover:shadow-md transition-all group"
        >
          <div className="p-6 text-center">
            <Book className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold mb-2">{t('help.getting_started')}</h3>
            <p className="text-sm text-muted-foreground">{t('help.getting_started_desc')}</p>
          </div>
        </button>

        <button
          onClick={handleAITutorial}
          className="text-left rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
        >
          <div className="p-6 text-center">
            <FileText className="w-8 h-8 text-secondary mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold mb-2">{t('help.ai_tutorial')}</h3>
            <p className="text-sm text-muted-foreground">{t('help.ai_tutorial_desc')}</p>
          </div>
        </button>

        <button
          onClick={handleContactSupport}
          className="text-left rounded-2xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
        >
          <div className="p-6 text-center">
            <MessageCircle className="w-8 h-8 text-accent-foreground mx-auto mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-bold mb-2">{t('help.contact_support')}</h3>
            <p className="text-sm text-muted-foreground">{t('help.contact_support_desc')}</p>
          </div>
        </button>
      </div>

      {/* Getting Started Guide */}
      <div ref={guideRef}>
        <GettingStartedGuide open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} />
      </div>

      {/* AI Tutorial */}
      <div ref={tutorialRef}>
        <AITutorialSection open={tutorialOpen} onToggle={() => setTutorialOpen((v) => !v)} />
      </div>

      {/* Contact Support */}
      <div ref={chatRef}>
        <ContactSupportSection open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
      </div>

      {/* FAQ */}
      <div ref={faqRef}>
        <h2 className="text-2xl font-serif font-bold mb-6">{t('help.faq_title')}</h2>
        <Accordion
          type="single"
          collapsible
          value={faqValue}
          onValueChange={setFaqValue}
          className="w-full bg-card border rounded-2xl px-6"
        >
          <AccordionItem value="item-1" className="border-b">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              {t('help.faq_1_q')}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {t('help.faq_1_a')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border-b">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              {t('help.faq_2_q')}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {t('help.faq_2_a')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border-b">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              {t('help.faq_3_q')}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {t('help.faq_3_a')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border-b">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              {t('help.faq_4_q')}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {t('help.faq_4_a')}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="border-none">
            <AccordionTrigger className="hover:no-underline font-semibold text-left">
              {t('help.faq_5_q')}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {t('help.faq_5_a')}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
