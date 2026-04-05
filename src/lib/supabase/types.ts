/**
 * Low-level Supabase database type helpers.
 *
 * We keep the entity types in src/types/index.ts (plain TS, framework-agnostic).
 * This file provides utilities specifically for working with the Supabase client:
 * query result unwrapping, error typing, and table name constants.
 */

import type { PostgrestError } from '@supabase/supabase-js'

// ── Result helpers ────────────────────────────────────────────────────────────

export type DbResult<T> =
  | { data: T;    error: null }
  | { data: null; error: PostgrestError }

/** Unwrap a Supabase query result — throws on error. */
export function unwrap<T>(result: DbResult<T>): T {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

/** Unwrap a Supabase query result — returns null on error. */
export function unwrapOrNull<T>(result: DbResult<T>): T | null {
  if (result.error) return null
  return result.data
}

// ── Table name constants ──────────────────────────────────────────────────────
// Avoids raw string literals scattered across services.

export const Tables = {
  contacts:           'contacts',
  contactGroups:      'contact_groups',
  contactGroupMembers:'contact_group_members',
  contactLists:       'contact_lists',
  contactListItems:   'contact_list_items',
  segments:           'segments',
  campaigns:          'campaigns',
  campaignSteps:      'campaign_steps',
  campaignRuns:       'campaign_runs',
  templates:          'templates',
  mailLogs:           'mail_logs',
  unsubscribeEvents:  'unsubscribe_events',
  optInTokens:        'opt_in_tokens',
  consentLogs:        'consent_logs',
  importJobs:         'import_jobs',
  activityLogs:       'activity_logs',
} as const

export type TableName = typeof Tables[keyof typeof Tables]

// ── Postgres error codes ──────────────────────────────────────────────────────

export const PgError = {
  UNIQUE_VIOLATION:       '23505',
  FOREIGN_KEY_VIOLATION:  '23503',
  NOT_NULL_VIOLATION:     '23502',
  CHECK_VIOLATION:        '23514',
} as const
