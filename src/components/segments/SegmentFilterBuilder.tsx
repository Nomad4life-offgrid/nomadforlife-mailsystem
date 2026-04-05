'use client'

import { useState, useEffect, useId } from 'react'
import type { SegmentFilter, SegmentCondition, SegmentConditionOp, SegmentOperator } from '@/types'

// ── Field definitions ─────────────────────────────────────────────────────────

type FieldType = 'text' | 'enum' | 'boolean' | 'date_null'

type FieldDef = {
  value:       string
  label:       string
  type:        FieldType
  enumValues?: readonly string[]
  enumLabels?: Record<string, string>
}

const FIELDS: FieldDef[] = [
  {
    value:       'contact_type',
    label:       'Contacttype',
    type:        'enum',
    enumValues:  ['camping', 'sponsor', 'adverteerder', 'lid', 'partner', 'prospect', 'overig'],
    enumLabels:  {
      camping: 'Camping', sponsor: 'Sponsor', adverteerder: 'Adverteerder',
      lid: 'Lid', partner: 'Partner', prospect: 'Prospect', overig: 'Overig',
    },
  },
  {
    value:      'source',
    label:      'Bron',
    type:       'enum',
    enumValues: ['manual', 'import', 'api', 'website', 'admin'],
    enumLabels: { manual: 'Handmatig', import: 'Import', api: 'API', website: 'Website', admin: 'Admin' },
  },
  {
    value:      'status',
    label:      'Status',
    type:       'enum',
    enumValues: ['pending', 'active', 'opted_out'],
    enumLabels: { pending: 'In afwachting', active: 'Actief', opted_out: 'Afgemeld' },
  },
  { value: 'opted_in',       label: 'Opt-in bevestigd',   type: 'boolean' },
  { value: 'global_opt_out', label: 'Globaal afgemeld',   type: 'boolean' },
  { value: 'unsubscribed_at',label: 'Uitschrijfdatum',    type: 'date_null' },
  { value: 'bounced_at',     label: 'Bouncedatum',        type: 'date_null' },
  { value: 'email',          label: 'E-mailadres',        type: 'text' },
  { value: 'company',        label: 'Bedrijf',            type: 'text' },
  { value: 'first_name',     label: 'Voornaam',           type: 'text' },
  { value: 'last_name',      label: 'Achternaam',         type: 'text' },
]

const FIELD_MAP = Object.fromEntries(FIELDS.map((f) => [f.value, f]))

// ── Operator definitions per field type ───────────────────────────────────────

type OpDef = { value: SegmentConditionOp; label: string }

const OPS_TEXT: OpDef[] = [
  { value: 'contains',     label: 'bevat' },
  { value: 'not_contains', label: 'bevat niet' },
  { value: 'eq',           label: 'is gelijk aan' },
  { value: 'neq',          label: 'is niet gelijk aan' },
]

const OPS_ENUM: OpDef[] = [
  { value: 'eq',  label: 'is' },
  { value: 'neq', label: 'is niet' },
]

const OPS_BOOLEAN: OpDef[] = [
  { value: 'eq', label: 'is' },
]

const OPS_DATE_NULL: OpDef[] = [
  { value: 'is_null',     label: 'is niet ingesteld' },
  { value: 'is_not_null', label: 'is ingesteld' },
]

function getOps(type: FieldType): OpDef[] {
  switch (type) {
    case 'enum':      return OPS_ENUM
    case 'boolean':   return OPS_BOOLEAN
    case 'date_null': return OPS_DATE_NULL
    default:          return OPS_TEXT
  }
}

function defaultOp(type: FieldType): SegmentConditionOp {
  switch (type) {
    case 'enum':      return 'eq'
    case 'boolean':   return 'eq'
    case 'date_null': return 'is_null'
    default:          return 'contains'
  }
}

function defaultValue(type: FieldType, enumValues?: readonly string[]): string | boolean | null {
  switch (type) {
    case 'enum':      return enumValues?.[0] ?? ''
    case 'boolean':   return true
    case 'date_null': return null
    default:          return ''
  }
}

// ── Condition row ─────────────────────────────────────────────────────────────

type ConditionDraft = {
  id:    string
  field: string
  op:    SegmentConditionOp
  value: string | number | boolean | null
}

function ConditionRow({
  cond,
  onChange,
  onRemove,
  canRemove,
}: {
  cond:     ConditionDraft
  onChange: (c: ConditionDraft) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const uid   = useId()
  const field = FIELD_MAP[cond.field] ?? FIELDS[0]
  const ops   = getOps(field.type)

  function handleFieldChange(newField: string) {
    const def    = FIELD_MAP[newField] ?? FIELDS[0]
    const newOp  = defaultOp(def.type)
    const newVal = defaultValue(def.type, def.enumValues)
    onChange({ ...cond, field: newField, op: newOp, value: newVal })
  }

  function handleOpChange(newOp: SegmentConditionOp) {
    onChange({ ...cond, op: newOp })
  }

  const selectCls = 'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none'
  const inputCls  = 'rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none min-w-0 flex-1'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Field selector */}
      <select
        id={`${uid}-field`}
        value={cond.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className={selectCls}
      >
        {FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        id={`${uid}-op`}
        value={cond.op}
        onChange={(e) => handleOpChange(e.target.value as SegmentConditionOp)}
        className={selectCls}
      >
        {ops.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Value input — varies by field type */}
      {field.type === 'enum' && (
        <select
          value={String(cond.value ?? '')}
          onChange={(e) => onChange({ ...cond, value: e.target.value })}
          className={selectCls}
        >
          {(field.enumValues ?? []).map((v) => (
            <option key={v} value={v}>{field.enumLabels?.[v] ?? v}</option>
          ))}
        </select>
      )}

      {field.type === 'boolean' && (
        <select
          value={cond.value === true ? 'true' : 'false'}
          onChange={(e) => onChange({ ...cond, value: e.target.value === 'true' })}
          className={selectCls}
        >
          <option value="true">Ja</option>
          <option value="false">Nee</option>
        </select>
      )}

      {field.type === 'text' && (
        <input
          type="text"
          value={String(cond.value ?? '')}
          onChange={(e) => onChange({ ...cond, value: e.target.value })}
          placeholder="Waarde…"
          className={inputCls}
        />
      )}

      {field.type === 'date_null' && (
        <span className="text-sm text-zinc-400 italic">
          {cond.op === 'is_null' ? '(geen waarde nodig)' : '(geen waarde nodig)'}
        </span>
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="rounded-md px-2 py-2 text-zinc-400 hover:text-red-500 disabled:opacity-30 transition-colors"
        title="Conditie verwijderen"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = {
  /** Pre-fill when editing an existing segment */
  defaultValue?: SegmentFilter
  /** Name of the hidden input — matches server action expectation */
  name?: string
}

let _idCounter = 0
function nextId() { return `c${++_idCounter}` }

function filterToConditionDraft(cond: SegmentCondition): ConditionDraft {
  return { id: nextId(), field: cond.field, op: cond.op, value: cond.value }
}

export function SegmentFilterBuilder({ defaultValue, name = 'filter_json' }: Props) {
  const [operator, setOperator] = useState<SegmentOperator>(
    defaultValue?.operator ?? 'AND'
  )
  const [conditions, setConditions] = useState<ConditionDraft[]>(
    defaultValue?.conditions?.length
      ? defaultValue.conditions.map(filterToConditionDraft)
      : [{ id: nextId(), field: FIELDS[0].value, op: defaultOp(FIELDS[0].type), value: '' }]
  )

  // Re-initialize if defaultValue changes (edit mode)
  useEffect(() => {
    if (!defaultValue) return
    setOperator(defaultValue.operator)
    setConditions(defaultValue.conditions.map(filterToConditionDraft))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const serialized: SegmentFilter = {
    operator,
    conditions: conditions.map(({ field, op, value }) => ({ field, op, value })),
  }

  function addCondition() {
    const def = FIELDS[0]
    setConditions((prev) => [
      ...prev,
      { id: nextId(), field: def.value, op: defaultOp(def.type), value: '' },
    ])
  }

  function updateCondition(id: string, next: ConditionDraft) {
    setConditions((prev) => prev.map((c) => c.id === id ? next : c))
  }

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="space-y-4">
      {/* Operator toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600">Contacten moeten voldoen aan</span>
        <div className="flex rounded-md border border-zinc-300 overflow-hidden">
          {(['AND', 'OR'] as SegmentOperator[]).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => setOperator(op)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                operator === op
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {op === 'AND' ? 'ALLE condities' : 'MINIMAAL ÉÉN conditie'}
            </button>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        {conditions.map((cond) => (
          <ConditionRow
            key={cond.id}
            cond={cond}
            onChange={(next) => updateCondition(cond.id, next)}
            onRemove={() => removeCondition(cond.id)}
            canRemove={conditions.length > 1}
          />
        ))}
      </div>

      {/* Add condition */}
      <button
        type="button"
        onClick={addCondition}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Conditie toevoegen
      </button>

      {/* Hidden serialized input */}
      <input type="hidden" name={name} value={JSON.stringify(serialized)} />
    </div>
  )
}
