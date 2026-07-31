/**
 * Re-export entry point for all database row types and the typed Database schema.
 *
 * The canonical definitions live in `./database` (mirrors the desktop app's
 * `src/infrastructure/supabase/types.ts` — source of truth). Importing from
 * this file lets feature modules do:
 *
 *   import type { ParentRow, StudentRow, Database } from "@/lib/types";
 *
 * instead of reaching into the internal file.
 */

export * from "./database";
