"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageCircle,
  X,
  Headphones,
  Send,
  Loader2,
  Bot,
  User,
  PhoneCall,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SupportMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [escalating, setEscalating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll quando novas mensagens chegam
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  // ── Envio de mensagem ───────────────────────────────────────────────────────
  const sendMessage = (content: string) => {
    if (!content.trim() || pending) return;
    setInput("");

    const userMsg: SupportMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    startTransition(async () => {
      try {
        const res = await fetch("/api/support/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, sessionId }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { content: string; sessionId: string; escalated: boolean } = await res.json();

        if (data.sessionId) setSessionId(data.sessionId);
        if (data.escalated && !escalated) setEscalated(true);

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.content,
            createdAt: new Date(),
          },
        ]);
      } catch {
        toast.error("Erro ao enviar mensagem. Verifique sua conexão.");
        setMessages((prev) => prev.slice(0, -1));
      }
    });
  };

  // ── Escalação manual ────────────────────────────────────────────────────────
  const handleEscalate = async () => {
    if (escalating || escalated) return;
    setEscalating(true);
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, escalate: true }),
      });
      if (!res.ok) throw new Error();
      const data: { sessionId: string; escalated: boolean } = await res.json();
      if (data.sessionId) setSessionId(data.sessionId);
      setEscalated(true);
    } catch {
      toast.error("Não foi possível acionar o atendente. Tente novamente.");
    } finally {
      setEscalating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Botão flutuante */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            aria-label="Abrir suporte"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Painel do chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            style={{ height: "520px" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
                <Headphones className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary-foreground">Suporte Nufluma</p>
                <p className="text-[10px] text-primary-foreground/70">
                  {escalated ? "Atendente acionado" : "IA disponível agora"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Banner de escalação */}
            <AnimatePresence>
              {escalated && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="flex items-start gap-2 bg-green-500/10 border-b border-green-500/20 px-4 py-2.5"
                >
                  <PhoneCall className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-green-600 dark:text-green-400 leading-snug">
                    Atendente notificado! Em breve você receberá contato pelo e-mail cadastrado.
                    Pode continuar enviando mensagens.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Área de mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Empty state */}
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Como posso ajudar?</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                      Tire dúvidas sobre o dashboard, métricas, campanhas ou qualquer funcionalidade da Nufluma.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {[
                      "Como adicionar uma campanha?",
                      "O que é CTR e ROAS?",
                      "Como conectar o Google Ads?",
                    ].map((p) => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        className="rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/30 transition-all"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensagens */}
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}
                  >
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                      <AvatarFallback
                        className={cn(
                          "text-[10px]",
                          msg.role === "assistant"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {msg.role === "assistant" ? (
                          <Bot className="h-3 w-3" />
                        ) : (
                          <User className="h-3 w-3" />
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div
                      className={cn(
                        "max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed",
                        msg.role === "assistant"
                          ? "bg-muted text-foreground rounded-tl-sm"
                          : "bg-primary text-primary-foreground rounded-tr-sm"
                      )}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p
                        className={cn(
                          "text-[9px] mt-1",
                          msg.role === "assistant"
                            ? "text-muted-foreground"
                            : "text-primary-foreground/60"
                        )}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Indicador de digitação */}
              {pending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                      <Bot className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3 space-y-2">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua dúvida..."
                  disabled={pending}
                  className="flex-1 h-9 text-xs"
                  autoFocus={open}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || pending}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </Button>
              </form>

              {/* Botão de escalação manual */}
              {!escalated && (
                <button
                  onClick={handleEscalate}
                  disabled={escalating || pending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {escalating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <PhoneCall className="h-3 w-3" />
                  )}
                  Falar com atendente
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
