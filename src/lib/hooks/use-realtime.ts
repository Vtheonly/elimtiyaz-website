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
  const channelRef = useRef<{ unsubscribe: () => void } | null>(null);

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
 * Convenience: subscribe to notifications for the current user.
 */
export function useNotificationsRealtime() {
  const { user } = useAuth();
  useRealtimeInvalidation(
    "notifications",
    [["notifications"]],
    {
      // Filter by target_user_id so we only get events for THIS user.
      filter: user ? `target_user_id=eq.${user.id}` : undefined,
      enabled: Boolean(user),
    }
  );
}

/**
 * Convenience: subscribe to chat_messages for the active channel.
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
 * Convenience: subscribe to homework_assignments for the active student's class.
 */
export function useHomeworkRealtime(classId: string | null | undefined) {
  useRealtimeInvalidation(
    "homework_assignments",
    [["homework", classId]],
    {
      filter: classId ? `target_class_id=eq.${classId}` : undefined,
      enabled: Boolean(classId),
    }
  );
}
