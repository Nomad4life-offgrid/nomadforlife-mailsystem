'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function createLoginClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    },
  )
}

export async function login(formData: FormData) {
  const email    = (formData.get('email')    as string).trim().toLowerCase()
  const password = (formData.get('password') as string)
  const next     = (formData.get('next')     as string) || '/dashboard'

  if (!email || !password) throw new Error('E-mail en wachtwoord zijn verplicht.')

  const supabase = await createLoginClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Redirect back with a generic error — nooit specifiek of het e-mail of wachtwoord fout is
    const url = new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    url.searchParams.set('error', 'invalid_credentials')
    url.searchParams.set('next', next)
    redirect(url.pathname + url.search)
  }

  redirect(next)
}

export async function logout() {
  const supabase = await createLoginClient()
  await supabase.auth.signOut()
  redirect('/login')
}
