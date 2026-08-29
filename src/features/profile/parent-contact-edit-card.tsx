"use client";

/**
 * ParentContactEditCard — lets a parent update their own contact fields.
 *
 * Per the migration 0027 RLS policies: a parent can UPDATE their own row
 * but ONLY the contact fields (primary_phone, secondary_phone, email,
 * address, city, postal_code, occupation). The BEFORE UPDATE trigger
 * `enforce_parent_self_update_columns` rejects any attempt to touch other
 * columns (parent_code, first_name, last_name, national_id, relationship,
 * notes, is_active, is_financially_restricted, auth_user_id, deleted_at).
 *
 * Identity fields (name, national_id, relationship) can only be changed by
 * staff via the desktop app — that's the authoritative system for identity.
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Loader2, Save, X } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import { useAuth } from "@/app/providers/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ParentRow } from "@/lib/types/database";

interface EditState {
  primary_phone: string;
  secondary_phone: string;
  email: string;
  address: string;
  city: string;
  postal_code: string;
  occupation: string;
}

function toEditState(p: ParentRow): EditState {
  return {
    primary_phone: p.primary_phone ?? "",
    secondary_phone: p.secondary_phone ?? "",
    email: p.email ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    postal_code: p.postal_code ?? "",
    occupation: p.occupation ?? "",
  };
}

export function ParentContactEditCard() {
  const { t } = useT();
  const { parent, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<EditState | null>(null);

  // Initialize the edit form when the parent data loads or editing starts.
  // This is a deliberate reset-on-prop-change pattern — the lint rule
  // complains but the alternative (key-prop remounting) would lose internal
  // editing state.
  useEffect(() => {
    if (parent && editing && !state) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(toEditState(parent));
    }
    if (!editing) {
      setState(null);
    }
  }, [parent, editing, state]);

  const handleSave = async () => {
    if (!parent || !state || !supabase) return;

    // Basic validation — the phone number must not be empty (it's the
    // primary contact method the school uses).
    if (!state.primary_phone.trim()) {
      toast.error(t("profile.edit.phone") + " — requis");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("parents")
        .update({
          // T-049: primary_phone is NOT NULL in the canonical schema
          // (0005_crm.sql) and the form blocks empty submissions above —
          // sending null would hit a NOT NULL violation; send the trimmed
          // value.
          primary_phone: state.primary_phone.trim(),
          secondary_phone: state.secondary_phone.trim() || null,
          email: state.email.trim() || null,
          address: state.address.trim() || null,
          city: state.city.trim() || null,
          postal_code: state.postal_code.trim() || null,
          occupation: state.occupation.trim() || null,
        })
        .eq("id", parent.id);
      if (error) {
        // The trigger may reject the update if it touches a non-contact column.
        // Surface the underlying Postgres error to the user.
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success(t("profile.edit.saved"));
      setEditing(false);
      // Refresh the parent in the auth context so the new contact info
      // appears everywhere it's displayed.
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <span>{t("profile.edit.title")}</span>
          {!editing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              className="text-xs"
            >
              <Pencil className="mr-1 h-3 w-3" />
              {t("common.edit")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!parent ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : !editing ? (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t("profile.edit.phone")}</dt>
              <dd className="font-medium">{parent.primary_phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("profile.edit.secondaryPhone")}</dt>
              <dd className="font-medium">{parent.secondary_phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("profile.edit.email")}</dt>
              <dd className="truncate font-medium">{parent.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("profile.edit.occupation")}</dt>
              <dd className="font-medium">{parent.occupation || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{t("profile.edit.address")}</dt>
              <dd className="font-medium">
                {parent.address ? `${parent.address}${parent.city ? `, ${parent.city}` : ""}${parent.postal_code ? ` ${parent.postal_code}` : ""}` : "—"}
              </dd>
            </div>
          </dl>
        ) : state ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label={t("profile.edit.phone")}
                value={state.primary_phone}
                onChange={(v) => setState({ ...state, primary_phone: v })}
                required
              />
              <Field
                label={t("profile.edit.secondaryPhone")}
                value={state.secondary_phone}
                onChange={(v) => setState({ ...state, secondary_phone: v })}
              />
              <Field
                label={t("profile.edit.email")}
                value={state.email}
                onChange={(v) => setState({ ...state, email: v })}
                type="email"
              />
              <Field
                label={t("profile.edit.occupation")}
                value={state.occupation}
                onChange={(v) => setState({ ...state, occupation: v })}
              />
              <Field
                label={t("profile.edit.address")}
                value={state.address}
                onChange={(v) => setState({ ...state, address: v })}
              />
              <Field
                label={t("profile.edit.city")}
                value={state.city}
                onChange={(v) => setState({ ...state, city: v })}
              />
              <Field
                label={t("profile.edit.postalCode")}
                value={state.postal_code}
                onChange={(v) => setState({ ...state, postal_code: v })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                <X className="mr-1 h-3 w-3" />
                {t("profile.edit.cancel")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                {t("profile.edit.save")}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
