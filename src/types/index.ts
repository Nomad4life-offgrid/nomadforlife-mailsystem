/**
 * Central entity types for the Nomad For Life mail system.
 *
 * Derived directly from the database schema — always keep in sync
 * with supabase/migrations/. These are plain TypeScript types, not
 * Zod schemas — validation lives in lib/validations/.
 */

// ── Shared ────────────────────────────────────────────────────────────────────

export type Uuid = string

export type Timestamps = {
  created_at: string
  updated_at: string
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export type ContactStatus = 'pending' | 'active' | 'opted_out'
export type ContactSource = 'manual' | 'import' | 'api' | 'website' | 'admin'
export type BounceType    = 'hard' | 'soft'
export type ContactType   = 'camping' | 'sponsor' | 'adverteerder' | 'lid' | 'partner' | 'prospect' | 'overig'

export type Contact = Timestamps & {
  id:              Uuid
  email:           string
  first_name:      string | null
  last_name:       string | null
  company:         string | null
  phone:           string | null
  source:          ContactSource
  status:          ContactStatus
  contact_type:    ContactType | null
  notes:           string | null
  tags:            string[]
  custom_fields:   Record<string, unknown>
  opted_in:        boolean
  opted_in_at:     string | null
  global_opt_out:  boolean
  unsubscribed_at: string | null
  bounced_at:      string | null
  bounce_type:     BounceType | null
  metadata:        Record<string, unknown>
  deleted_at:      string | null
}

export type ContactSummary = Pick<Contact,
  'id' | 'email' | 'first_name' | 'last_name' | 'company' | 'status' | 'opted_in' | 'opted_in_at' | 'created_at'
>

// ── Contact Groups (doelgroepen/labels) ───────────────────────────────────────

export type ContactGroupListType = 'group' | 'list'

export type ContactGroup = Timestamps & {
  id:          Uuid
  name:        string
  description: string | null
  color:       string
  list_type:   ContactGroupListType
  is_locked:   boolean
  created_by:  Uuid | null
}

export type ContactGroupMember = {
  contact_id: Uuid
  group_id:   Uuid
  added_at:   string
}

// ── Contact Lists (formele lijsten) ───────────────────────────────────────────

export type ContactListSource = 'manual' | 'import' | 'api' | 'website'

export type ContactList = Timestamps & {
  id:            Uuid
  name:          string
  description:   string | null
  source:        ContactListSource
  is_locked:     boolean
  import_job_id: Uuid | null
  created_by:    Uuid | null
}

export type ContactListItem = {
  list_id:    Uuid
  contact_id: Uuid
  added_at:   string
  added_by:   Uuid | null
}

// ── Segments (dynamische filters) ─────────────────────────────────────────────

export type SegmentConditionOp = 'eq' | 'neq' | 'contains' | 'not_contains' | 'gte' | 'lte' | 'is_null' | 'is_not_null'
export type SegmentOperator    = 'AND' | 'OR'

export type SegmentCondition = {
  field: string
  op:    SegmentConditionOp
  value: string | number | boolean | null
}

export type SegmentFilter = {
  operator:   SegmentOperator
  conditions: SegmentCondition[]
}

export type Segment = Timestamps & {
  id:            Uuid
  name:          string
  description:   string | null
  filter_json:   SegmentFilter
  preview_count: number | null
  refreshed_at:  string | null
  created_by:    Uuid | null
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'sending'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'active'      // legacy: funnel-campagnes
  | 'archived'    // legacy: funnel-campagnes

export type CampaignType  = 'one_off' | 'funnel'
export type AudienceType  = 'group' | 'segment'

export type Campaign = Timestamps & {
  id:                   Uuid
  name:                 string
  description:          string | null
  campaign_type:        CampaignType
  status:               CampaignStatus
  // E-mailinstellingen
  subject:              string | null
  preview_text:         string | null
  from_email:           string
  from_name:            string
  reply_to_email:       string | null
  track_opens:          boolean
  track_clicks:         boolean
  // Template (eenmalig)
  template_id:          Uuid | null
  // Doelgroep (eenmalig)
  audience_type:        AudienceType | null
  audience_group_id:    Uuid | null
  audience_segment_id:  Uuid | null
  // Verzending (eenmalig)
  planned_send_at:      string | null
  batch_size:           number
  sent_at:              string | null
  recipient_count:      number | null
  // Testmodus
  test_mode:            boolean
  test_delay_minutes:   number
  // Meta
  created_by:           Uuid | null
  deleted_at:           string | null
}

export type CampaignSummary = Pick<Campaign,
  | 'id' | 'name' | 'status' | 'campaign_type'
  | 'from_email' | 'from_name'
  | 'planned_send_at' | 'sent_at' | 'recipient_count'
  | 'created_at'
>

// ── Campaign Steps ────────────────────────────────────────────────────────────

export type CampaignStepStatus = 'active' | 'paused'

/**
 * Verzendconditie op stap-niveau.
 * Bepaalt of een contact de stap ontvangt op basis van gedrag in de vorige stap.
 * 'always' (of null) = altijd verzenden.
 * Genegeerd voor stap 1 (geen vorige stap).
 */
export type StepSendConditionType =
  | 'always'
  | 'opened_previous'      // alleen als vorige stap geopend
  | 'not_opened_previous'  // alleen als vorige stap NIET geopend
  | 'clicked_previous'     // alleen als er geklikt is in vorige stap

export type StepSendCondition = {
  type: StepSendConditionType
}

export type CampaignStep = {
  id:               Uuid
  campaign_id:      Uuid
  template_id:      Uuid
  step_order:       number
  delay_days:       number
  delay_hours:      number
  /** Per-stap onderwerpregel voor funnel-mails */
  subject:          string | null
  preview_text:     string | null
  /** Auto-ingevuld bij one_off; niet relevant voor funnel */
  subject_override: string | null
  send_condition:   StepSendCondition | null
  status:           CampaignStepStatus
  created_at:       string
  updated_at:       string
}

/** Totale cumulatieve vertraging in uren */
export function stepDelayHours(step: Pick<CampaignStep, 'delay_days' | 'delay_hours'>): number {
  return step.delay_days * 24 + step.delay_hours
}

// ── Campaign Runs ─────────────────────────────────────────────────────────────

export type CampaignRunStatus = 'active' | 'completed' | 'opted_out' | 'bounced'

export type CampaignRun = {
  id:            Uuid
  campaign_id:   Uuid
  contact_id:    Uuid
  status:        CampaignRunStatus
  subscribed_at: string
  opted_out_at:  string | null
  completed_at:  string | null
  created_at:    string
  updated_at:    string
}

// ── Templates ─────────────────────────────────────────────────────────────────

export type TemplateCategory = 'general' | 'onboarding' | 'followup' | 'newsletter' | 'transactional'

export type Template = Timestamps & {
  id:           Uuid
  name:         string
  subject:      string
  preview_text: string | null
  html_body:    string
  text_body:    string | null
  category:     TemplateCategory
  created_by:   Uuid | null
  deleted_at:   string | null
}

export type TemplateSummary = Pick<Template,
  'id' | 'name' | 'subject' | 'category' | 'created_at' | 'updated_at'
>

// ── Mail Logs ─────────────────────────────────────────────────────────────────

export type MailLogStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export type MailLog = {
  id:                  Uuid
  campaign_run_id:     Uuid
  campaign_step_id:    Uuid
  contact_id:          Uuid
  status:              MailLogStatus
  scheduled_at:        string
  sent_at:             string | null
  opened_at:           string | null
  clicked_at:          string | null
  external_message_id: string | null
  error_message:       string | null
  retry_count:         number
  created_at:          string
  updated_at:          string
}

// ── Unsubscribe Events ────────────────────────────────────────────────────────

export type UnsubscribeEvent = {
  id:          Uuid
  contact_id:  Uuid
  campaign_id: Uuid | null
  token:       string
  reason:      string | null
  used_at:     string | null
  ip_address:  string | null
  user_agent:  string | null
  created_at:  string
}

// ── Opt-in Tokens ─────────────────────────────────────────────────────────────

export type OptInToken = {
  id:          Uuid
  contact_id:  Uuid
  campaign_id: Uuid | null
  token:       string
  used_at:     string | null
  created_at:  string
}

// ── Consent Logs ──────────────────────────────────────────────────────────────

export type ConsentEventType =
  | 'opt_in'
  | 'opt_in_confirmed'
  | 'opt_out'
  | 'opt_out_global'
  | 'consent_withdrawn'
  | 'consent_renewed'
  | 'imported'
  | 'manually_added'

export type ConsentChannel = 'email' | 'web' | 'import' | 'admin' | 'api'

export type ConsentLog = {
  id:           Uuid
  contact_id:   Uuid
  event_type:   ConsentEventType
  channel:      ConsentChannel
  ip_address:   string | null
  user_agent:   string | null
  notes:        string | null
  performed_by: Uuid | null
  metadata:     Record<string, unknown>
  created_at:   string
}

// ── Import Jobs ───────────────────────────────────────────────────────────────

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type ImportJob = {
  id:              Uuid
  status:          ImportJobStatus
  file_name:       string | null
  file_size_bytes: number | null
  total_rows:      number | null
  processed_rows:  number
  imported_rows:   number
  skipped_rows:    number
  failed_rows:     number
  target_list_id:  Uuid | null
  target_group_id: Uuid | null
  column_mapping:  Record<string, string>
  error_details:   unknown[] | null
  created_by:      Uuid | null
  started_at:      string | null
  completed_at:    string | null
  created_at:      string
  updated_at:      string
}

// ── Activity Logs ─────────────────────────────────────────────────────────────

export type ActivityLog = {
  id:          Uuid
  user_id:     Uuid | null
  action:      string
  entity_type: string | null
  entity_id:   Uuid | null
  description: string | null
  before_data: Record<string, unknown> | null
  after_data:  Record<string, unknown> | null
  ip_address:  string | null
  metadata:    Record<string, unknown>
  created_at:  string
}
