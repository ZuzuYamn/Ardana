import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  ImagePlus,
  Camera,
  Leaf,
  User,
  Trash2,
  AlertCircle,
  X,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/lib/contexts/LanguageContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  imagePreviewUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  isLoading?: boolean;
  error?: string;
}

interface PendingImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

const API_BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

async function compressImage(
  file: File,
  maxPx = 1024,
): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxPx / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve({
        base64: dataUrl.split(",")[1],
        mimeType: "image/jpeg",
        previewUrl: dataUrl,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}

async function sendChatMessage(
  payload: {
    history: Array<{
      role: "user" | "model";
      text: string;
      imageBase64?: string;
      mimeType?: string;
    }>;
    message: string;
    imageBase64?: string;
    mimeType?: string;
  },
  errorMessages: {
    invalidResponse: string;
    requestFailed: (status: number) => string;
    emptyResponse: string;
    timeout: string;
  },
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await res
      .json()
      .catch(() => ({ error: errorMessages.invalidResponse }));

    if (!res.ok) {
      throw new Error(data.error ?? errorMessages.requestFailed(res.status));
    }

    if (!data.reply) {
      throw new Error(errorMessages.emptyResponse);
    }

    return data.reply as string;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(errorMessages.timeout);
    }
    throw err;
  }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    if (m[2]) parts.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3])
      parts.push(
        <code
          key={key++}
          className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
        >
          {m[3]}
        </code>,
      );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul
          key={key++}
          className="list-disc list-inside space-y-0.5 my-1.5 pl-1"
        >
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  const flushOrdered = () => {
    if (orderedItems.length) {
      elements.push(
        <ol
          key={key++}
          className="list-decimal list-inside space-y-0.5 my-1.5 pl-1"
        >
          {orderedItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      orderedItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^#{1,3}\s/.test(trimmed)) {
      flushList();
      flushOrdered();
      const content = trimmed.replace(/^#{1,3}\s/, "");
      elements.push(
        <p key={key++} className="font-semibold text-sm mt-3 mb-0.5">
          {renderInline(content)}
        </p>,
      );
    } else if (/^[-*]\s/.test(trimmed)) {
      flushOrdered();
      listItems.push(trimmed.slice(2));
    } else if (/^\d+\.\s/.test(trimmed)) {
      flushList();
      orderedItems.push(trimmed.replace(/^\d+\.\s/, ""));
    } else if (trimmed === "") {
      flushList();
      flushOrdered();
      if (elements.length) elements.push(<div key={key++} className="h-1" />);
    } else {
      flushList();
      flushOrdered();
      elements.push(
        <p key={key++} className="text-sm leading-relaxed">
          {renderInline(trimmed)}
        </p>,
      );
    }
  }

  flushList();
  flushOrdered();
  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onRetry,
  t,
}: {
  msg: ChatMessage;
  onRetry: (msg: ChatMessage) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const isUser = msg.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex gap-3 max-w-full",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Leaf className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "flex flex-col gap-1.5 max-w-[80%]",
          isUser ? "items-end" : "items-start",
        )}
      >
        {msg.imagePreviewUrl && (
          <img
            src={msg.imagePreviewUrl}
            alt={t("ai_chat.uploaded_alt")}
            className="rounded-xl max-h-48 max-w-[280px] object-cover border border-border shadow-sm"
          />
        )}

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : msg.error
                ? "bg-destructive/10 border border-destructive/30 text-destructive rounded-tl-sm"
                : "bg-card border border-border text-foreground rounded-tl-sm",
          )}
        >
          {msg.isLoading ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
              <span className="text-xs">{t("ai_chat.thinking")}</span>
            </div>
          ) : msg.error ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-xs leading-relaxed">{msg.error}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetry(msg)}
                className="h-7 text-xs gap-1.5 self-start border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                <RefreshCw className="w-3 h-3" /> {t("ai_chat.retry")}
              </Button>
            </div>
          ) : isUser ? (
            <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
          ) : (
            <MarkdownText text={msg.text} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AiChat() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const SUGGESTIONS = [
    t("ai_chat.sugg_1"),
    t("ai_chat.sugg_2"),
    t("ai_chat.sugg_3"),
    t("ai_chat.sugg_4"),
  ];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast({
          title: t("ai_chat.invalid_file_title"),
          description: t("ai_chat.invalid_file_desc"),
          variant: "destructive",
        });
        return;
      }
      try {
        const compressed = await compressImage(file);
        setPendingImage(compressed);
      } catch {
        toast({
          title: t("ai_chat.image_error_title"),
          description: t("ai_chat.image_error_desc"),
          variant: "destructive",
        });
      }
    },
    [toast, t],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const imageItem = Array.from(e.clipboardData.items).find((i) =>
        i.type.startsWith("image/"),
      );
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          e.preventDefault();
          handleFile(file);
        }
      }
    },
    [handleFile],
  );

  const buildHistoryPayload = useCallback(
    (msgs: ChatMessage[]) =>
      msgs
        .filter((m) => !m.isLoading && !m.error)
        .map((m) => ({
          role: m.role,
          text: m.text,
          imageBase64: m.imageBase64,
          mimeType: m.mimeType,
        })),
    [],
  );

  const sendMessage = useCallback(
    async (
      text: string,
      image: PendingImage | null,
      currentMessages: ChatMessage[],
    ) => {
      if (!text.trim() && !image) return;

      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        text: text.trim(),
        imagePreviewUrl: image?.previewUrl,
        imageBase64: image?.base64,
        mimeType: image?.mimeType,
      };

      const loadingMsg: ChatMessage = {
        id: genId(),
        role: "model",
        text: "",
        isLoading: true,
      };

      const withUser = [...currentMessages, userMsg, loadingMsg];
      setMessages(withUser);
      setInput("");
      setPendingImage(null);
      setIsLoading(true);

      try {
        const reply = await sendChatMessage(
          {
            history: buildHistoryPayload(currentMessages),
            message:
              text.trim() || (image ? t("ai_chat.default_image_prompt") : ""),
            imageBase64: image?.base64,
            mimeType: image?.mimeType,
          },
          {
            invalidResponse: t("ai_chat.invalid_server_response"),
            requestFailed: (status) =>
              t("ai_chat.request_failed", { status: String(status) }),
            emptyResponse: t("ai_chat.empty_response"),
            timeout: t("ai_chat.timeout_error"),
          },
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? { ...m, isLoading: false, text: reply }
              : m,
          ),
        );
      } catch (err) {
        const errText =
          err instanceof Error ? err.message : t("ai_chat.generic_error");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === loadingMsg.id
              ? {
                  ...m,
                  isLoading: false,
                  text: "",
                  error: errText,
                  imageBase64: userMsg.imageBase64,
                  mimeType: userMsg.mimeType,
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    },
    [buildHistoryPayload, t],
  );

  const handleSend = useCallback(() => {
    if (isLoading || (!input.trim() && !pendingImage)) return;
    sendMessage(input, pendingImage, messages);
  }, [isLoading, input, pendingImage, messages, sendMessage]);

  const handleRetry = useCallback(
    (errorMsg: ChatMessage) => {
      // Find the preceding user message
      const errorIdx = messages.findIndex((m) => m.id === errorMsg.id);
      const userMsg = errorIdx > 0 ? messages[errorIdx - 1] : null;
      if (!userMsg || userMsg.role !== "user") return;

      // Remove the error message and retry
      const history = messages.slice(0, errorIdx - 1);
      setMessages(history);
      sendMessage(
        userMsg.text,
        userMsg.imageBase64
          ? {
              base64: userMsg.imageBase64,
              mimeType: userMsg.mimeType!,
              previewUrl: userMsg.imagePreviewUrl!,
            }
          : null,
        history,
      );
    },
    [messages, sendMessage],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setPendingImage(null);
    setInput("");
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] max-h-[900px] max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card/80 backdrop-blur-sm rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-base leading-tight">
              {t("ai_chat.title")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("ai_chat.subtitle")}
            </p>
          </div>
        </div>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="h-8 gap-1.5 text-muted-foreground hover:text-destructive text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" /> {t("ai_chat.clear")}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center gap-6 text-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Leaf className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-serif font-bold text-xl">
                {t("ai_chat.greeting_title")}
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                {t("ai_chat.greeting_desc")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}
                  className="text-left text-xs px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onRetry={handleRetry}
                t={t}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 pt-2 border-t bg-card/80 backdrop-blur-sm space-y-2 rounded-b-2xl">
        {/* Pending image preview */}
        <AnimatePresence>
          {pendingImage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2"
            >
              <img
                src={pendingImage.previewUrl}
                alt={t("ai_chat.pending_alt")}
                className="h-12 w-12 rounded-lg object-cover border border-border"
              />
              <span className="text-xs text-muted-foreground flex-1">
                {t("ai_chat.photo_attached")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPendingImage(null)}
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden file inputs */}
        <input
          type="file"
          ref={galleryInputRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFile(e.target.files[0]);
              e.target.value = "";
            }
          }}
        />
        <input
          type="file"
          ref={cameraInputRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFile(e.target.files[0]);
              e.target.value = "";
            }
          }}
        />

        {/* Toolbar + textarea + send */}
        <div className="flex items-end gap-2">
          {/* Gallery upload */}
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={isLoading}
            onClick={() => galleryInputRef.current?.click()}
            className={cn(
              "flex-shrink-0 h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors",
              pendingImage && "text-primary",
            )}
            title={t("ai_chat.upload_gallery")}
          >
            <ImagePlus className="w-5 h-5" />
          </Button>

          {/* Camera capture */}
          <Button
            variant="ghost"
            size="icon"
            type="button"
            disabled={isLoading}
            onClick={() => cameraInputRef.current?.click()}
            className="flex-shrink-0 h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title={t("ai_chat.take_photo")}
          >
            <Camera className="w-5 h-5" />
          </Button>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={isLoading}
              placeholder={
                isLoading ? t("ai_chat.thinking") : t("ai_chat.placeholder")
              }
              className={cn(
                "w-full resize-none rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm",
                "placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40",
                "transition-all leading-relaxed min-h-[40px] max-h-[120px] overflow-y-auto",
                isLoading && "opacity-60 cursor-not-allowed",
              )}
            />
          </div>

          {/* Send */}
          <Button
            size="icon"
            type="button"
            disabled={isLoading || (!input.trim() && !pendingImage)}
            onClick={handleSend}
            className="flex-shrink-0 h-10 w-10 rounded-xl"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground/50 text-center">
          {t("ai_chat.footer_hint")}
        </p>
      </div>
    </div>
  );
}
