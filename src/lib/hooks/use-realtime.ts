"use client";

/**
 * Realtime subscriptions via Supabase Realtime.
 *
 * Instead of polling every 30s, we subscribe to `postgres_changes` events on
 * the tables that change frequently (notifications, chat_messages,
 * installments). When a change happens server-side, we invalidate the
 * corresponding TanStack Query so the UI refetches instantly.
 *
 * This keeps the portal in sync with desktop/mobile actions:
 *   - Staff marks a payment → parent's installment list updates
 *   - Teacher pushes homework → parent sees it immediately
 *   - Admin broadcasts announcement → notification appears
 *   - Staff sends a message → chat thread updates
 *
 * Defensive: if Supabase isn't configured, the hooks are no-ops.
 */

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/providers/auth-provider";

/**
 * Subscribe to INSERT/UPDATE/DELETE on a table and invalidate the matching
 * query keys. Pass an array of query key prefixes to invalidate.
 *
 * Example:
 *   useRealtimeInvalidation("notifications", [["notifications"]]);
 *   useRealtimeInvalidation("chat_messages", [["chat-messages"]]);
 */
export function useRealtimeInvalidation(
  table: string,
  queryKeyPrefixes: unknown[][],
  options: { filter?: string; enabled?: boolean } = {}
) {
  const qc = useQueryClient();
  const { enabled = true, filter } = options;
  // T-049: the ref holds a real Supabase RealtimeChannel — typing it as a
  // structural `{ unsubscribe }` subset broke supabase.removeChannel(ref)
  // (needs the full RealtimeChannel type).
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabase || !enabled) return;

    const channelName = `realtime-${table}-${Date.now()}`;
    let channel = supabase.channel(channelName);

    const filters: Record<string, unknown> = {
      event: "*",
      schema: "public",
      table,
    };
    if (filter) filters.filter = filter;

    channel = channel.on("postgres_changes", filters as never, () => {
      // Invalidate every matching query key prefix.
      for (const prefix of queryKeyPrefixes) {
        qc.invalidateQueries({ queryKey: prefix });
      }
    });

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") {
        console.warn(`[realtime] ${table} subscription status:`, status);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
    };
  }, [table, enabled, filter]);
}

/**
 * Convenience: subscribe to notifications visible to the current user.
 *
 * REALTIME-102 (T-032): the old filter pinned `target_user_id` to the
 * caller's id — direct-targeted rows only. Role broadcasts (`target_user_id`
 * IS NULL, `target_role` set — e.g. an announcement to all parents) and
 * tenant broadcasts never triggered a refetch, so they appeared only on
 * the next remount. Supabase Realtime applies the caller's RLS SELECT
 * policy (0019: direct target OR role broadcast matching current_user_roles
 * OR tenant broadcast) to postgres_changes events, so subscribing WITHOUT
 * the narrow filter delivers exactly the rows this user may see — direct,
 * role-broadcast, and (for staff) tenant-broadcast — and nothing else.
 */
export function useNotificationsRealtime() {
  const { user } = useAuth();
  useRealtimeInvalidation(
    "notifications",
    [["notifications"]],
    {
      // No column filter — RLS scopes the delivered events (see above).
      enabled: Boolean(user),
    }
  );
}

/**
 * Convenience: subscribe to chat_messages for the active channel.
 *
 * REALTIME-103 (T-032): this hook is intentionally scoped to the OPEN
 * channel (refresh the visible conversation). The unread badge needs its
 * own ALL-channel subscription — use `useChatUnreadRealtime` (below).
 */
export function useChatMessagesRealtime(channelId: string | null | undefined) {
  useRealtimeInvalidation(
    "chat_messages",
    [["chat-messages", channelId]],
    {
      filter: channelId ? `channel_id=eq.${channelId}` : undefined,
      enabled: Boolean(channelId),
    }
  );
}

/**
 * REALTIME-103 (T-032): the unread badge must react to new messages in ANY
 * of the user's channels — not just the open one. This subscribes to
 * `chat_messages` WITHOUT a channel filter and invalidates the unread-count
 * query only. RLS scopes the delivered events to channels the user can
 * read, exactly like the notifications subscription above.
 */
export function useChatUnreadRealtime() {
  useRealtimeInvalidation(
    "chat_messages",
    [["chat-unread-count"]],
    { enabled: true }
  );
}

/**
 * Convenience: subscribe to installments + payments for the current parent.
 * This makes the financial view update the moment staff records a payment
 * on the desktop.
 */
export function useFinancialRealtime(parentId: string | null | undefined) {
  useRealtimeInvalidation(
    "installments",
    [["installments", parentId], ["payments", parentId]],
    {
      filter: parentId ? `parent_id=eq.${parentId}` : undefined,
      enabled: Boolean(parentId),
    }
  );
  useRealtimeInvalidation(
    "payments",
    [["payments", parentId], ["installments", parentId]],
    {
      filter: parentId ? `parent_id=eq.${parentId}` : undefined,
      enabled: Boolean(parentId),
    }
  );
}

/**
 * Convenience: subscribe to the canonical `homework` table for the active
 * student's class.
 *
 * WEAK-016 (T-032): this used to subscribe to the legacy
 * `homework_assignments` table (0004) with a `target_class_id` filter —
 * a table NO platform writes since the 0029 academic module. The canonical
 * table is `homework` (0029) with a `class_id` column, which is also what
 * `useHomework` queries (portal-queries.ts). Realtime events now match the
 * data source, so a teacher's desktop homework push refreshes the portal
 * instantly.
 */
export function useHomeworkRealtime(classId: string | null | undefined) {
  useRealtimeInvalidation(
    "homework",
    [["homework", classId]],
    {
      filter: classId ? `class_id=eq.${classId}` : undefined,
      enabled: Boolean(classId),
    }
  );
}
