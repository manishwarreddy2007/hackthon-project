import { backendConfigured, supabase } from './supabaseClient.js'
import { normalizeDonationStatus } from './donationStatus.js'

function requireBackend() {
  if (!backendConfigured || !supabase) throw new Error('FoodLink backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
}

function normalizeProfile(row) {
  return {
    id: row.id,
    name: row.name || 'User',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role,
    organizationName: row.organization_name || 'FoodLink member',
    organizationType: row.organization_type || '',
    location: row.location || 'Hyderabad',
    verified: Boolean(row.verified),
  }
}

function normalizeDonation(row, profiles) {
  const donor = profiles.find((profile) => profile.id === row.donor_id)
  return {
    ...row,
    id: row.id,
    donorId: row.donor_id,
    donor: donor?.organizationName || 'FoodLink member',
    donorOrganization: donor?.organizationName || 'FoodLink member',
    donorContactPerson: donor?.name || 'User',
    donorPhone: donor?.phone || '',
    donorEmail: donor?.email || '',
    title: row.title,
    category: row.category,
    quantity: Number(row.quantity),
    pickupLocation: row.pickup_location,
    location: `${row.pickup_location}, ${row.city}`,
    city: row.city,
    imageUrl: row.image_url || '',
    pickupMinutes: row.pickup_minutes,
    pickupBy: row.pickup_by,
    pickupWindow: row.pickup_window,
    status: normalizeDonationStatus(row.status),
    connectedReceiverId: row.connected_receiver_id,
    connectionId: row.connection_id,
    pickupScheduledAt: row.pickup_scheduled_at,
    estimatedPickupAt: row.estimated_pickup_at,
    collectedAt: row.collected_at,
    createdAt: row.created_at,
  }
}

function normalizeRequest(row) {
  return {
    id: row.id,
    donationId: row.donation_id,
    donorId: row.donor_id,
    receiverId: row.receiver_id,
    status: row.status === 'PENDING_APPROVAL' ? 'PENDING' : row.status,
    distanceKm: Number(row.distance_km),
    matchScore: row.match_score,
    connectionId: row.connection_id,
    createdAt: row.created_at,
  }
}

function normalizeConnection(row) {
  return {
    id: row.id,
    donationId: row.donation_id,
    requestId: row.request_id,
    donorId: row.donor_id,
    receiverId: row.receiver_id,
    distanceKm: Number(row.distance_km),
    status: row.status,
    createdAt: row.created_at,
    pickupScheduledAt: row.pickup_scheduled_at,
    collectedAt: row.collected_at,
  }
}

async function unwrap(request) {
  const { data, error } = await request
  if (error) throw error
  return data
}

export async function getCurrentUser() {
  requireBackend()
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session?.user) return null
  const row = await unwrap(supabase.from('profiles').select('*').eq('id', sessionData.session.user.id).single())
  return normalizeProfile(row)
}

async function loadPlatformProfiles(donationRows, requestRows, connectionRows) {
  const { data, error } = await supabase.rpc('get_platform_profiles')
  if (!error) return data
  if (error.code !== 'PGRST202') throw error

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('Authentication required')

  const profileIds = [...new Set([
    authData.user.id,
    ...donationRows.filter((donation) => ['AVAILABLE', 'REQUESTED'].includes(donation.status)).map((donation) => donation.donor_id),
    ...requestRows.flatMap((request) => [request.donor_id, request.receiver_id]),
  ])]
  const profiles = await unwrap(supabase.from('profiles')
    .select('id,name,role,organization_name,organization_type,location,verified')
    .in('id', profileIds))
  const connectedProfileIds = [...new Set(connectionRows.flatMap((connection) => [connection.donor_id, connection.receiver_id]))]
  if (!connectedProfileIds.length) return profiles

  const contacts = await unwrap(supabase.from('profiles')
    .select('id,email,phone')
    .in('id', connectedProfileIds))
  const contactsById = new Map(contacts.map((profile) => [profile.id, profile]))
  return profiles.map((profile) => ({ ...profile, ...contactsById.get(profile.id) }))
}

export async function loadPlatformData() {
  requireBackend()
  const [donationRows, requestRows, connectionRows] = await Promise.all([
    unwrap(supabase.from('donations').select('*').order('created_at', { ascending: false })),
    unwrap(supabase.from('donation_requests').select('*').order('created_at', { ascending: false })),
    unwrap(supabase.from('connections').select('*').order('created_at', { ascending: false })),
  ])
  const profileRows = await loadPlatformProfiles(donationRows, requestRows, connectionRows)
  const users = profileRows.map(normalizeProfile)
  return {
    users,
    donations: donationRows.map((row) => normalizeDonation(row, users)),
    requests: requestRows.map(normalizeRequest),
    connections: connectionRows.map(normalizeConnection),
  }
}

export async function signInUser({ email, password }) {
  requireBackend()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  const profile = await unwrap(supabase.from('profiles').select('*').eq('id', data.user.id).single())
  return normalizeProfile(profile)
}

export async function registerUser(profile) {
  requireBackend()
  const { data, error } = await supabase.functions.invoke('register-user', { body: profile })
  if (error) {
    const response = error.context instanceof Response ? error.context.clone() : null
    const payload = response ? await response.json().catch(() => null) : null
    const message = String(payload?.error || '').toLowerCase()
    if (message.includes('already exists')) throw new Error('FOODLINK_SIGNUP_EMAIL_EXISTS')
    if (message.includes('too many signup attempts')) throw new Error('FOODLINK_SIGNUP_RATE_LIMITED')
    if (message.includes('not configured')) throw new Error('FOODLINK_SIGNUP_NOT_CONFIGURED')
    if (response?.status === 400) throw new Error('FOODLINK_SIGNUP_INVALID_DETAILS')
    throw new Error('FOODLINK_SIGNUP_UNAVAILABLE')
  }
  if (!data?.userId) throw new Error('FOODLINK_SIGNUP_UNAVAILABLE')

  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: profile.password,
  })
  if (signInError) throw signInError
  const saved = await unwrap(supabase.from('profiles').select('*').eq('id', sessionData.user.id).single())
  return { user: normalizeProfile(saved), needsEmailConfirmation: false }
}

export async function signOutUser() {
  requireBackend()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

async function uploadDonationImage(imageUrl, userId) {
  if (!imageUrl || !imageUrl.startsWith('data:')) return imageUrl || null
  const blob = await (await fetch(imageUrl)).blob()
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('food-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('food-images').getPublicUrl(path)
  return data.publicUrl
}

export async function createDonation(formData, user) {
  requireBackend()
  const imageUrl = await uploadDonationImage(formData.imageUrl, user.id)
  const pickupMinutes = Number(formData.pickupMinutes)
  const pickupBy = new Date(Date.now() + pickupMinutes * 60 * 1000).toISOString()
  const selectedLocation = formData.coordinates
  const row = await unwrap(supabase.from('donations').insert({
    donor_id: user.id,
    title: formData.title,
    category: formData.category,
    quantity: formData.quantity,
    unit: formData.unit,
    pickup_location: formData.pickupLocation,
    city: user.location,
    description: formData.description,
    allergens: formData.allergens,
    urgency: formData.urgency,
    image_url: imageUrl,
    pickup_minutes: pickupMinutes,
    pickup_by: pickupBy,
    pickup_window: `${pickupMinutes} min`,
    coordinates: selectedLocation || null,
  }).select().single())
  return row
}

export async function createDonationRequest({ donationId, donorId, distanceKm, matchScore }) {
  requireBackend()
  return unwrap(supabase.rpc('request_donation', {
    p_donation_id: donationId,
    p_donor_id: donorId,
    p_distance_km: distanceKm,
    p_match_score: matchScore,
  }))
}

export async function approveDonationRequest(requestId) {
  requireBackend()
  return unwrap(supabase.rpc('approve_donation_request', { p_request_id: requestId }))
}

export async function rejectDonationRequest(requestId) {
  requireBackend()
  return unwrap(supabase.rpc('reject_donation_request', { p_request_id: requestId }))
}

export async function advanceDonationConnection(connectionId, nextStep, pickupMinutes) {
  requireBackend()
  return unwrap(supabase.rpc('advance_donation_connection', {
    p_connection_id: connectionId,
    p_next_step: nextStep,
    p_pickup_minutes: pickupMinutes,
  }))
}
