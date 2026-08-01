"use client";

/**
 * StudentSwitcher — horizontal pill list of the parent's children.
 *
 * Per design: "A parent with N enrolled children sees all of them from one
 * dashboard. No account switching." (Entire_Project_Plan.txt → Client Web Portal)
 *
 * The active student drives every per-child view (grades, attendance, etc.).
 * If only one child is enrolled, the switcher renders nothing.
 */

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import { useAuth } from "@/app/providers/auth-provider";
import { formatInitials, formatFullName } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  /** Compact renders smaller pills (used in headers); default is the full card */
  variant?: "compact" | "full";
  className?: string;
}

export function StudentSwitcher({ variant = "full", className }: Props) {
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);

  // Auto-select the first child if none is selected.
  useEffect(() => {
    if (!activeStudentId && kids.length > 0) {
      setActiveStudentId(kids[0].id);
    }
  }, [activeStudentId, kids, setActiveStudentId]);

  if (kids.length === 0) return null;
  if (kids.length === 1) {
    // Single child — just show a card with their info, no switching needed.
    const kid = kids[0];
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3",
          className
        )}
      >
        <Avatar kid={kid} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{formatFullName(kid)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {kid.student_code}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2 overflow-x-auto scrollbar-none pb-1",
        className
      )}
    >
      {kids.map((kid) => {
        const isActive = activeStudentId === kid.id;
        return (
          <button
            key={kid.id}
            type="button"
            onClick={() => setActiveStudentId(kid.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border p-1 pr-3 transition-colors",
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 bg-card text-muted-foreground hover:bg-muted/40"
            )}
          >
            <Avatar kid={kid} />
            <span className="text-sm font-medium">{formatFullName(kid)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Avatar({ kid }: { kid: { first_name: string; last_name: string; middle_name?: string | null } }) {
  const initials = formatInitials(kid.first_name, kid.last_name);
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{
        backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
        color: "var(--primary)",
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

import { useT } from "@/lib/i18n/use-t";
import { useState } from "react";

// Hook into the parent's auth children list for the dropdown in compact mode.
export function StudentSwitcherDropdown() {
  const { children: kids } = useAuth();
  const activeStudentId = useAppStore((s) => s.activeStudentId);
  const setActiveStudentId = useAppStore((s) => s.setActiveStudentId);
  const { t } = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!activeStudentId && kids.length > 0) setActiveStudentId(kids[0].id);
  }, [activeStudentId, kids, setActiveStudentId]);

  if (kids.length === 0) return null;
  const active = kids.find((k) => k.id === activeStudentId) ?? kids[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm font-medium hover:bg-muted/40"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
          style={{
            backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
            color: "var(--primary)",
          }}
        >
          {formatInitials(active.first_name, active.last_name)}
        </span>
        <span className="max-w-[120px] truncate">{formatFullName(active)}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            className="absolute z-50 mt-1 w-full min-w-[200px] overflow-hidden rounded-lg border border-border/60 bg-popover p-1 shadow-lg"
          >
            {kids.map((kid) => (
              <li key={kid.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={kid.id === activeStudentId}
                  onClick={() => {
                    setActiveStudentId(kid.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    kid.id === activeStudentId
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    {formatInitials(kid.first_name, kid.last_name)}
                  </span>
                  <span className="flex-1 truncate text-left">{formatFullName(kid)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
