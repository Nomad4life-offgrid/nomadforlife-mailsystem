import { vi } from 'vitest'

export type MockResult<T = unknown> = { data: T; error: null } | { data: null; error: { message: string } }

/**
 * Builds a chainable Supabase query-builder mock.
 *
 * Usage:
 *   const chain = makeChain({ data: { id: '1' }, error: null })
 *   // chain.select().eq().single() will resolve to { data: { id: '1' }, error: null }
 */
export function makeChain<T = unknown>(result: MockResult<T>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}

  const chainable = [
    'select', 'update', 'delete', 'eq', 'neq', 'in',
    'order', 'limit', 'not', 'is',
  ]

  for (const m of chainable) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }

  // Terminal operations that resolve the promise
  chain['single']  = vi.fn().mockResolvedValue(result)
  chain['insert']  = vi.fn().mockResolvedValue(result)
  chain['upsert']  = vi.fn().mockReturnValue(chain)  // upsert().select().single()

  return chain
}

/**
 * Creates a full Supabase client mock where each table maps to a chain.
 *
 * Usage:
 *   const supabase = makeMockClient({
 *     contacts: makeChain({ data: { id: 'abc', email: 'test@example.com', global_opt_out: false }, error: null }),
 *     campaign_steps: makeChain({ data: [], error: null }),
 *   })
 */
export function makeMockClient(
  tableChains: Record<string, ReturnType<typeof makeChain>>
) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (tableChains[table]) return tableChains[table]
      // Default: return empty success
      return makeChain({ data: null, error: null })
    }),
  }
}

/**
 * Helper: capture all insert() call arguments for a given chain.
 * Useful for asserting what data was written.
 */
export function captureInserts(chain: ReturnType<typeof makeChain>) {
  return (chain['insert'] as ReturnType<typeof vi.fn>).mock.calls.map(
    ([payload]: [unknown]) => payload
  )
}

/**
 * Helper: capture all update() call arguments for a given chain.
 */
export function captureUpdates(chain: ReturnType<typeof makeChain>) {
  return (chain['update'] as ReturnType<typeof vi.fn>).mock.calls.map(
    ([payload]: [unknown]) => payload
  )
}

/**
 * Creates a FormData object from a plain object — convenience for tests.
 */
export function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.append(key, value)
  return fd
}
