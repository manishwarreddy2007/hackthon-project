import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('FOODLINK_ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const attemptsByAddress = new Map<string, { count: number; windowStartedAt: number }>()
const RATE_LIMIT_COUNT = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function text(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`${field} is required and must be no longer than ${maxLength} characters.`)
  }
  return value.trim()
}

function validateProfile(payload: Record<string, unknown>) {
  const name = text(payload.name, 'Name', 100)
  const organizationName = text(payload.organizationName, 'Organization name', 160)
  const email = text(payload.email, 'Email', 254).toLowerCase()
  const password = typeof payload.password === 'string' ? payload.password : ''
  const phone = text(payload.phone, 'Phone', 40)
  const location = text(payload.location, 'Location', 80)
  const role = payload.role
  const organizationType = role === 'RECEIVER' ? text(payload.organizationType, 'Organization type', 100) : 'Food Donor'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
  if (password.length < 6 || password.length > 128) throw new Error('Password must be between 6 and 128 characters.')
  if (role !== 'DONOR' && role !== 'RECEIVER') throw new Error('Role must be DONOR or RECEIVER.')

  return { name, organizationName, email, password, phone, location, role, organizationType }
}

function getClientAddress(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('cf-connecting-ip') || 'unknown'
}

function checkRateLimit(address: string) {
  const now = Date.now()
  const current = attemptsByAddress.get(address)
  if (!current || now - current.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    attemptsByAddress.set(address, { count: 1, windowStartedAt: now })
    return true
  }
  if (current.count >= RATE_LIMIT_COUNT) return false
  current.count += 1
  return true
}

function getServerSecretKey() {
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<string, string>
      if (secretKeys.default) return secretKeys.default
    } catch {
      throw new Error('Supabase secret keys are not available in the expected format.')
    }
  }
  return Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Only POST is supported.' }, 405)

  const address = getClientAddress(request)
  if (!checkRateLimit(address)) return response({ error: 'Too many signup attempts. Try again later.' }, 429)

  try {
    const payload = await request.json()
    const profile = validateProfile(payload)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serverSecretKey = getServerSecretKey()
    if (!supabaseUrl || !serverSecretKey) return response({ error: 'Signup service is not configured.' }, 500)

    const admin = createClient(supabaseUrl, serverSecretKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data, error } = await admin.auth.admin.createUser({
      email: profile.email,
      password: profile.password,
      email_confirm: true,
      user_metadata: {
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        organizationName: profile.organizationName,
        organizationType: profile.organizationType,
        location: profile.location,
      },
    })

    if (error) {
      console.error('Supabase admin user creation failed:', error)
      const duplicate = error.message.toLowerCase().includes('already')
      return response({ error: duplicate ? 'An account with this email already exists.' : 'The signup service could not create this account.' }, duplicate ? 409 : 500)
    }

    return response({ userId: data.user.id }, 201)
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Invalid signup request.' }, 400)
  }
})
