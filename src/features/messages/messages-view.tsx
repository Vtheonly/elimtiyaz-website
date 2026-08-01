"use client";

/**
 * MessagesView — staff↔parent communication.
 *
 * Per platform matrix: portal = "Staff Messages" (read + reply).
 * Channels are filtered to those whose parent_id matches the signed-in parent.
 *
 * Layout: two-pane on desktop (channel list + messages), single-pane on mobile
 * with a back button to switch channels.
 */

import { useAuth } from "@/app/providers/auth-provider";
import { useT } from "@/lib/i18n/use-t";
import {
  useChatChannels,
  useChatMessages,
} from "@/lib/hooks/portal-queries";
import { useChatMessagesRealtime } from "@/lib/hooks/use-realtime";
import {
  EmptyState,
  ListSkeleton,
  ErrorState,
} from "@/features/shared/state-views";
import { MessageSquare, Send, ArrowLeft, Megaphone } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { chatMessageSchema } from "@/lib/validation";
import type { ChatChannelRow, ChatMessageRow } from "@/lib/types/database";

export function MessagesView() {
  const { t } = useT();
  const { user } = useAuth();
  const channels = useChatChannels(user?.id ?? null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const activeChannel = channels.data?.find((c) => c.id === activeChannelId) ?? null;

  // Realtime: new messages arrive instantly while a channel is open.
  useChatMessagesRealtime(activeChannelId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <h1 className="mb-4 text-xl font-semibold">{t("messages.title")}</h1>

      <div className="grid h-[calc(100dvh-12rem)] grid-cols-1 overflow-hidden rounded-lg border border-border/60 bg-card lg:grid-cols-[300px_1fr]">
        {/* Channel list */}
        <div
          className={cn(
            "flex flex-col overflow-hidden border-b border-border/60 lg:border-b-0 lg:border-r",
            activeChannelId && "hidden lg:flex"
          )}
        >
          <div className="border-b border-border/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Conversations
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {channels.isLoading ? (
              <div className="p-3">
                <ListSkeleton count={4} />
              </div>
            ) : channels.isError ? (
              <ErrorState title={t("common.error.title")} onRetry={() => channels.refetch()} />
            ) : channels.data && channels.data.length > 0 ? (
              channels.data.map((ch) => (
                <ChannelListItem
                  key={ch.id}
                  channel={ch}
                  active={ch.id === activeChannelId}
                  onClick={() => setActiveChannelId(ch.id)}
                />
              ))
            ) : (
              <EmptyState title={t("messages.empty")} icon={<MessageSquare className="h-6 w-6" />} />
            )}
          </div>
        </div>

        {/* Active conversation */}
        <div className={cn("flex flex-col overflow-hidden", !activeChannelId && "hidden lg:flex")}>
          {activeChannel ? (
            <Conversation channel={activeChannel} onBack={() => setActiveChannelId(null)} />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Sélectionnez une conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelListItem({
  channel,
  active,
  onClick,
}: {
  channel: ChatChannelRow;
  active: boolean;
  onClick: () => void;
}) {
  const isAnnouncement = channel.channel_type === "announcement";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border/40 p-3 text-left transition-colors",
        active ? "bg-primary/10" : "hover:bg-muted/40"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          isAnnouncement ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
        )}
      >
        {isAnnouncement ? <Megaphone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{channel.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatRelative(channel.updated_at)}
        </p>
      </div>
    </button>
  );
}

function Conversation({
  channel,
  onBack,
}: {
  channel: ChatChannelRow;
  onBack: () => void;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const messages = useChatMessages(channel.id, { limit: 200 });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.data]);

  const send = async () => {
    if (!supabase || !user) return;
    const body = draft.trim();
    // Validate the message body with Zod (5000-char ceiling, non-empty).
    const parsed = chatMessageSchema.safeParse({ body, channelId: channel.id });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Message invalide.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      tenant_id: channel.tenant_id,
      channel_id: channel.id,
      author_id: user.id,
      body: parsed.data.body,
      attachments: [],
      read_by: [{ user_id: user.id, read_at: new Date().toISOString() }],
    });
    if (error) {
      toast.error(error.message);
    } else {
      setDraft("");
      messages.refetch();
    }
    setSending(false);
  };

  const isAnnouncement = channel.channel_type === "announcement";

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/60 p-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            isAnnouncement ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
          )}
        >
          {isAnnouncement ? <Megaphone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{channel.name}</p>
          <p className="truncate text-xs text-muted-foreground">{channel.channel_type}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.isLoading ? (
          <ListSkeleton count={4} />
        ) : messages.data && messages.data.length > 0 ? (
          messages.data.map((m) => <MessageBubble key={m.id} msg={m} ownId={user?.id} />)
        ) : (
          <EmptyState title={t("messages.empty")} icon={<MessageSquare className="h-6 w-6" />} />
        )}
      </div>

      {/* Composer */}
      {!isAnnouncement && (
        <div className="border-t border-border/60 p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("messages.placeholder")}
              rows={1}
              className="min-h-[44px] resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} disabled={sending || !draft.trim()} size="icon" className="touch-target shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg, ownId }: { msg: ChatMessageRow; ownId?: string }) {
  const isOwn = msg.author_id === ownId;
  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          isOwn
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        <p className={cn("mt-1 text-[10px]", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {formatRelative(msg.sent_at)}
        </p>
      </div>
    </div>
  );
}
