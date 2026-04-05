import { vi } from 'vitest'

// Mock next/navigation — redirect throws internally in Next.js;
// replicate that so tests can catch or assert on it.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT', url })
  }),
  notFound: vi.fn(() => {
    throw Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_NOT_FOUND' })
  }),
}))

// Mock next/cache — side-effect only, no return value needed in tests.
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
