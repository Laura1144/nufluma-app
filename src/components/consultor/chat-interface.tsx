"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Send, Loader2, User, Sparkles, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

interface ChatSession {
  id: string;
  title: string | null;
  messages: { role: string; content: string }[];
  updatedAt: Date;
}

const EXAMPLE_PROMPTS = [
  "Mostre campanhas com melhor CPL no último mês",
  "Quais canais têm CTR abaixo da média?",
  "Crie um plano de ação para melhorar a conversão",
  "Como está a tendência de leads nas últimas 4 semanas?",
];

export function ChatInterface({
  sessions: initialSessions,
}: {
  sessions: ChatSession[];
  workspaceId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (content: string) => {
    if (!content.trim() || pending) return;
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);

    startTransition(async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            sessionId,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!res.ok) throw new Error();
        const data = await res.json();

        if (data.sessionId) setSessionId(data.sessionId);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const startNewChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setInput("");
  };

  return (
    <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
      {/* Sessions sidebar */}
      <div className="hidden w-56 flex-col gap-2 overflow-y-auto lg:flex">
        <Button
          variant="outline"
          size="sm"
          onClick={startNewChat}
          className="gap-2 justify-start"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova conversa
        </Button>

        {initialSessions.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSessionId(s.id);
              setMessages([]);
            }}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
              sessionId === s.id && "bg-accent text-foreground"
            )}
          >
            <p className="font-medium truncate">
              {s.title ?? s.messages[0]?.content?.slice(0, 30) ?? "Conversa"}...
            </p>
            <p className="text-muted-foreground/60 mt-0.5">
              {new Date(s.updatedAt).toLocaleDateString("pt-BR")}
            </p>
          </button>
        ))}
      </div>

      {/* Chat area */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Consultor Nufluma</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Faça perguntas sobre suas campanhas. Nunca invento dados — respondo apenas com o que está no seu workspace.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="rounded-lg border border-border p-3 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground hover:border-primary/30 transition-all"
                  >
                    <Sparkles className="h-3 w-3 text-primary mb-1" />
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" && "flex-row-reverse"
                )}
              >
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      msg.role === "assistant"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <Bot className="h-3.5 w-3.5" />
                    ) : (
                      <User className="h-3.5 w-3.5" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "assistant"
                      ? "bg-muted text-foreground rounded-tl-sm"
                      : "bg-primary text-primary-foreground rounded-tr-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={cn(
                      "text-[10px] mt-1.5",
                      msg.role === "assistant"
                        ? "text-muted-foreground"
                        : "text-primary-foreground/70"
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

          {pending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  <Bot className="h-3.5 w-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre suas campanhas..."
              disabled={pending}
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={!input.trim() || pending} size="icon">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            O Consultor usa apenas dados reais do seu workspace. Nunca inventa métricas.
          </p>
        </div>
      </Card>
    </div>
  );
}
