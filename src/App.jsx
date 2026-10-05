import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { AuthPage } from './components/AuthPage.jsx'
import { DonationCard } from './components/DonationCard.jsx'
import { DonationConnection } from './components/DonationConnection.jsx'
import { DonationRequestCard } from './components/DonationRequestCard.jsx'
import { StatusBadge } from './components/StatusBadge.jsx'
import { locationOptions } from './data/demoData.js'
import { DONATION_STATUS } from './data/donationStatus.js'
import {
  advanceDonationConnection,
  approveDonationRequest,
  createDonation as saveDonation,
  createDonationRequest,
  getCurrentUser,
  loadPlatformData,
  rejectDonationRequest,
  registerUser as registerPlatformUser,
  signInUser,
  signOutUser,
} from './data/platformApi.js'
import { languageOptions, translate } from './data/translations.js'
import { getRankedMatches } from './utils/matching.js'
import './App.css'

function applyPlatformData(data, setters) {
  setters.setUsers(data.users)
  setters.setDonations(data.donations)
  setters.setRequests(data.requests)
  setters.setConnections(data.connections)
}

function showFriendlyError(error, t, setToast, setToastIsError) {
  const message = String(error?.message || '').toLowerCase()
  console.error('FoodLink operation failed:', error)
  let friendlyMessage = t('genericError')
  if (message.includes('foodlink_signup_email_exists') || message.includes('already exists')) friendlyMessage = t('emailExists')
  else if (message.includes('foodlink_signup_rate_limited')) friendlyMessage = t('signupRateLimited')
  else if (message.includes('foodlink_signup_not_configured')) friendlyMessage = t('signupServiceNotConfigured')
  else if (message.includes('foodlink_signup_invalid_details')) friendlyMessage = t('signupDetailsInvalid')
  else if (message.includes('foodlink_signup_unavailable')) friendlyMessage = t('signupServiceUnavailable')
  else if (message.includes('invalid login') || message.includes('invalid credentials')) friendlyMessage = t('invalidLogin')
  else if (message.includes('request already exists') || message.includes('no longer available')) friendlyMessage = t('requestConflict')
  else if (message.includes('not configured')) friendlyMessage = t('backendNotConfigured')
  setToast(friendlyMessage)
  setToastIsError(true)
}

function App() {
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [donations, setDonations] = useState([])
  const [requests, setRequests] = useState([])
  const [connections, setConnections] = useState([])
  const [preferences, setPreferences] = useState({ language: 'en', location: 'Hyderabad' })
  const [authRole, setAuthRole] = useState('DONOR')
  const [authMode, setAuthMode] = useState('login')
  const [page, setPage] = useState('auth')
  const [activeConnectionId, setActiveConnectionId] = useState('')
  const [toast, setToast] = useState('')
  const [toastIsError, setToastIsError] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const { language, location } = preferences
  const t = (key) => translate(language, key)
  const reportEffectError = useEffectEvent((error) => showFriendlyError(error, t, setToast, setToastIsError))

  async function refreshPlatformData() {
    const data = await loadPlatformData()
    applyPlatformData(data, { setUsers, setDonations, setRequests, setConnections })
  }

  async function mutatePlatformData(operation) {
    setDataLoading(true)
    try {
      const result = await operation()
      await refreshPlatformData()
      return result
    } finally {
      setDataLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    async function restoreSession() {
      try {
        const user = await getCurrentUser()
        if (!active || !user) return
        setCurrentUser(user)
        setPreferences((current) => ({ ...current, location: user.location }))
        setPage(user.role === 'DONOR' ? 'donor' : 'receiver')
      } catch (error) {
        if (active) reportEffectError(error)
      } finally {
        if (active) setSessionLoading(false)
      }
    }
    restoreSession()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!currentUser) return undefined
    let active = true
    async function refresh() {
      setDataLoading(true)
      try {
        const data = await loadPlatformData()
        if (active) applyPlatformData(data, { setUsers, setDonations, setRequests, setConnections })
      } catch (error) {
        if (active) reportEffectError(error)
      } finally {
        if (active) setDataLoading(false)
      }
    }
    refresh()
    return () => { active = false }
  }, [currentUser, page])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  async function signIn(credentials) {
    setAuthLoading(true)
    try {
      const user = await signInUser(credentials)
      if (user.role !== credentials.role) {
        await signOutUser()
        setToast(t('roleMismatch'))
        setToastIsError(true)
        return
      }
      setCurrentUser(user)
      setPreferences((current) => ({ ...current, location: user.location }))
      setPage(user.role === 'DONOR' ? 'donor' : 'receiver')
      setToast(`${t('welcomeBack')}, ${user.organizationName}`)
      setToastIsError(false)
    } catch (error) {
      showFriendlyError(error, t, setToast, setToastIsError)
    } finally {
      setAuthLoading(false)
    }
  }

  async function registerUser(profile) {
    setAuthLoading(true)
    try {
      const result = await registerPlatformUser(profile)
      setCurrentUser(result.user)
      setPreferences((current) => ({ ...current, location: result.user.location }))
      setPage(result.user.role === 'DONOR' ? 'donor' : 'receiver')
      setToast(t('accountCreated'))
      setToastIsError(false)
    } catch (error) {
      showFriendlyError(error, t, setToast, setToastIsError)
    } finally {
      setAuthLoading(false)
    }
  }

  async function signOut() {
    try {
      await signOutUser()
      setCurrentUser(null)
      setUsers([])
      setDonations([])
      setRequests([])
      setConnections([])
      setAuthRole('DONOR')
      setAuthMode('login')
      setPage('auth')
      setActiveConnectionId('')
    } catch (error) {
      showFriendlyError(error, t, setToast, setToastIsError)
    }
  }

  async function createDonation(formData) {
    try {
      await mutatePlatformData(() => saveDonation(formData, currentUser))
      setToast(t('postSuccess'))
      setToastIsError(false)
      setPage('donor')
    } catch (error) {
      showFriendlyError(error, t, setToast, setToastIsError)
    }
  }

  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  async function requestDonation(donationId) {
    const donation = donations.find((item) => item.id === donationId)
    if (!donation || ![DONATION_STATUS.AVAILABLE, DONATION_STATUS.REQUESTED].includes(donation.status) || currentUser.role !== 'RECEIVER') return
    if (requests.some((request) => request.donationId === donationId && request.receiverId === currentUser.id && request.status === 'PENDING')) return
    const match = getRankedMatches(donation, [currentUser])[0]
    if (!match) return
    try {
      await mutatePlatformData(() => createDonationRequest({ donationId, donorId: donation.donorId, distanceKm: match.distanceKm || 0, matchScore: match.score }))
      setToast(t('requestSent'))
      setToastIsError(false)
    } catch (error) {
      showFriendlyError(error, t, setToast, setToastIsError)
    }
  }

  async function approveRequest(requestId) {
    try {
      const connectionId = await mutatePlatformData(() => approveDonationRequest(requestId))
      setActiveConnectionId(connectionId)
      setPage('connection')
      setToast(t('connectionCreatedToast'))
      setToastIsError(false)
    } catch (error) {
      showFriendlyError(error, t, setToast, setToastIsError)
    }
  }

  async function rejectRequest(requestId) {
    try {
      await mutatePlatformData(() => rejectDonationRequest(requestId))
      setToast(t('requestRejected'))
      setToastIsError(false)
    } catch (error) {
      showFriendlyError(error, t, setToast, setToastIsError)
    }
  }

  async function advanceConnection(connectionId, nextStep) {
    const connection = connections.find((item) => item.id === connectionId)
    const donation = donations.find((item) => item.id === connection?.donationId)
    const allowed = { ACCEPTED: ['PICKUP_SCHEDULED'], PICKUP_SCHEDULED: ['COLLECTED'], COLLECTED: ['COMPLETED'] }
    if (!connection || !donation || ![connection.donorId, connection.receiverId].includes(currentUser.id) || !allowed[connection.status]?.includes(nextStep)) return
    try {
      await mutatePlatformData(() => advanceDonationConnection(connectionId, nextStep, donation.pickupMinutes))
      setToast(t(nextStep === 'COMPLETED' ? 'completedMessage' : nextStep === 'COLLECTED' ? 'pickedUpMessage' : 'pickupScheduledMessage'))
      setToastIsError(false)
    } catch (error) {
      showFriendlyError(error, t, setToast, setToastIsError)
    }
  }

  if (sessionLoading) return <main className="session-loading" role="status">{t('loadingFoodLink')}</main>

  if (!currentUser) return <><AuthPage t={t} role={authRole} onRoleChange={setAuthRole} mode={authMode} onModeChange={setAuthMode} busy={authLoading} location={location} locations={locationOptions} language={language} languages={languageOptions} onLocationChange={(value) => updatePreference('location', value)} onLanguageChange={(value) => updatePreference('language', value)} onLogin={signIn} onRegister={registerUser} /><Toast toast={toast} isError={toastIsError} /></>

  const visibleDonations = currentUser.role === 'DONOR'
    ? donations.filter((donation) => donation.donorId === currentUser.id)
    : donations.filter((donation) => donation.city === location)
  const activeConnection = connections.find((connection) => connection.id === activeConnectionId)
  const openConnection = (connectionId) => { setActiveConnectionId(connectionId); setPage('connection') }
  const navigateHome = () => setPage(currentUser.role === 'DONOR' ? 'donor' : 'receiver')

  return (
    <div className="app-shell">
      <Sidebar page={page} role={currentUser.role} user={currentUser} onNavigate={setPage} onHome={navigateHome} onLogout={signOut} t={t} />
      <main className="main-content">
        <header className="topbar"><Brand /><PreferenceControls t={t} language={language} location={location} onLanguageChange={(value) => updatePreference('language', value)} onLocationChange={(value) => updatePreference('location', value)} /><div className="header-account"><span>{currentUser.organizationName}</span><button className="text-button" onClick={signOut}>{t('logout')}</button></div></header>
        {dataLoading && <p className="sync-indicator" role="status">{t('refreshingSharedData')}</p>}
        {currentUser.role === 'DONOR' && page === 'donor' && <DonorDashboard donations={visibleDonations} requests={requests.filter((request) => request.donorId === currentUser.id)} users={users} busy={dataLoading} t={t} onCreate={() => setPage('create')} onApprove={approveRequest} onReject={rejectRequest} onOpenConnection={openConnection} />}
        {currentUser.role === 'DONOR' && page === 'create' && <CreateDonation t={t} location={currentUser.location} donor={currentUser} busy={dataLoading} onCancel={() => setPage('donor')} onSubmit={createDonation} />}
        {currentUser.role === 'RECEIVER' && page === 'receiver' && <ReceiverDashboard donations={visibleDonations} requests={requests.filter((request) => request.receiverId === currentUser.id)} recipient={currentUser} busy={dataLoading} t={t} onRequest={requestDonation} onOpenConnection={openConnection} />}
        {currentUser.role === 'RECEIVER' && page === 'requests' && <RequestHistory requests={requests.filter((request) => request.receiverId === currentUser.id)} donations={donations} connections={connections} t={t} onOpenConnection={openConnection} />}
        {page === 'connection' && activeConnection && <DonationConnection connection={activeConnection} donation={donations.find((item) => item.id === activeConnection.donationId)} donor={users.find((item) => item.id === activeConnection.donorId)} receiver={users.find((item) => item.id === activeConnection.receiverId)} currentUser={currentUser} busy={dataLoading} t={t} onAdvance={(step) => advanceConnection(activeConnection.id, step)} onBack={() => setPage(currentUser.role === 'DONOR' ? 'donor' : 'requests')} />}
        <Toast toast={toast} isError={toastIsError} />
      </main>
    </div>
  )
}

function PreferenceControls({ t, language, location, onLanguageChange, onLocationChange }) {
  return (
    <div className="preference-controls">
      <label className="preference-select"><span>{t('location')}:</span><select value={location} onChange={(event) => onLocationChange(event.target.value)} aria-label={t('location')}>
        {locationOptions.map((city) => <option key={city} value={city}>{city}</option>)}
      </select></label>
      <label className="preference-select"><span>{t('language')}:</span><select value={language} onChange={(event) => onLanguageChange(event.target.value)} aria-label={t('language')}>
        {languageOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
      </select></label>
    </div>
  )
}

function Sidebar({ page, role, user, onNavigate, onHome, onLogout, t }) {
  return (
    <aside className="sidebar"><Brand /><nav className="side-nav" aria-label="Main navigation">
      <button className={page === 'donor' || page === 'receiver' ? 'nav-item selected' : 'nav-item'} onClick={onHome}><span className="nav-symbol">⌂</span>{t('home')}</button>
      {role === 'DONOR' && <button className={`nav-item nav-donate ${page === 'create' ? 'selected' : ''}`} onClick={() => onNavigate('create')}><span className="nav-symbol">＋</span>{t('donateFood')}</button>}
      {role === 'RECEIVER' && <><button className={page === 'receiver' ? 'nav-item selected' : 'nav-item'} onClick={() => onNavigate('receiver')}><span className="nav-symbol">⌕</span>{t('findDonations')}</button><button className={page === 'requests' ? 'nav-item selected' : 'nav-item'} onClick={() => onNavigate('requests')}><span className="nav-symbol">▤</span>{t('receiverRequests')}</button></>}
    </nav><div className="sidebar-spacer" /><div className="sidebar-user"><span className="profile-avatar">{user.organizationName.slice(0, 2).toUpperCase()}</span><span><strong>{user.organizationName}</strong><small>{role === 'RECEIVER' ? t('verifiedRecipient') : t('foodDonor')}</small></span><button className="sidebar-logout" onClick={onLogout}>{t('logout')}</button></div></aside>
  )
}

function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><span className="brand-bowl">◒</span><span className="brand-heart">♥</span></span><span className="brand-wording"><strong>FoodLink</strong><small>Share Food • Build Hope</small></span></div>
}

function DonorDashboard({ donations, requests, users, busy, t, onCreate, onApprove, onReject, onOpenConnection }) {
  const activePickups = donations.filter((donation) => [DONATION_STATUS.REQUESTED, DONATION_STATUS.ACCEPTED, DONATION_STATUS.PICKUP_SCHEDULED, DONATION_STATUS.COLLECTED].includes(donation.status)).length
  const completed = donations.filter((donation) => donation.status === DONATION_STATUS.COMPLETED)
  const activeDonations = donations.filter((donation) => donation.status !== DONATION_STATUS.COMPLETED)
  const pendingRequests = requests.filter((request) => request.status === 'PENDING')
  const acceptedRequests = requests.filter((request) => ['ACCEPTED', 'COMPLETED'].includes(request.status))
  return (
    <div className="page-wrap"><section className="page-heading"><div><p className="eyebrow">{t('donorHome')}</p><h1>{t('donorTitle')}</h1><p className="muted">{t('donorDescription')}</p></div><button className="button button-dark" onClick={onCreate}>{t('donateFood')} <span aria-hidden="true">→</span></button></section>
      <JourneyProgress current="donate" t={t} /><ActivitySummary t={t} role="donor" total={donations.length} active={activePickups} completed={completed.length} />
      {pendingRequests.length > 0 && <section className="content-section request-notifications"><div className="section-heading"><div><p className="eyebrow">{t('newDonationRequest')}</p><h2>{t('pendingRequests')}</h2></div><span className="request-count">{pendingRequests.length}</span></div><div className="request-list">{pendingRequests.map((request) => <DonationRequestCard key={request.id} request={request} donation={donations.find((item) => item.id === request.donationId)} receiver={users.find((user) => user.id === request.receiverId)} busy={busy} t={t} onApprove={onApprove} onReject={onReject} onOpenConnection={onOpenConnection} />)}</div></section>}
      {acceptedRequests.length > 0 && <section className="content-section"><div className="section-heading"><div><h2>{t('connectedDonations')}</h2></div></div><div className="request-list">{acceptedRequests.map((request) => <DonationRequestCard key={request.id} request={request} donation={donations.find((item) => item.id === request.donationId)} receiver={users.find((user) => user.id === request.receiverId)} t={t} onOpenConnection={onOpenConnection} />)}</div></section>}
      <section className="content-section"><div className="section-heading"><div><h2>{t('yourDonations')}</h2><p className="muted">{t('followPickup')}</p></div></div><div className="donation-list donor-list">{activeDonations.map((donation) => <DonationCard key={donation.id} donation={donation} mode="donor" t={t} />)}</div></section>
      {completed.length > 0 && <section className="content-section completed-donations-section"><div className="section-heading"><div><h2>{t('completedDonations')}</h2></div></div><div className="donation-list donor-list">{completed.map((donation) => <DonationCard key={donation.id} donation={donation} mode="donor" t={t} />)}</div></section>}
    </div>
  )
}

function JourneyProgress({ current, t }) {
  const steps = [t('donateFood'), t('aiMatch'), t('acceptShort'), t('collectShort')]
  const activeIndex = current === 'donate' ? 0 : current === 'match' ? 1 : current === 'accept' ? 2 : 3
  return <div className="journey-progress" aria-label={t('journeyLabel')}>{steps.map((step, index) => <div className={`journey-step ${index === activeIndex ? 'current' : ''}`} key={step}><span>{index + 1}</span><strong>{step}</strong>{index < steps.length - 1 && <i aria-hidden="true">→</i>}</div>)}</div>
}

function ActivitySummary({ t, role, total, active, completed }) {
  return <section className="activity-summary" aria-label={t(role === 'donor' ? 'donorStats' : 'recipientStats')}><div><strong>{total}</strong><span>{t('totalDonations')}</span></div><div><strong>{active}</strong><span>{t('activePickups')}</span></div><div><strong>{completed}</strong><span>{t('completedDonations')}</span></div></section>
}

function CreateDonation({ t, location, donor, busy, onCancel, onSubmit }) {
  const [foodImage, setFoodImage] = useState('')
  const [imageError, setImageError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleImageChange(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError(t('imageTypeError'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError(t('imageSizeError'))
      event.target.value = ''
      return
    }
    try {
      setImageError('')
      setFoodImage(await compressDonationImage(file))
    } catch {
      setImageError(t('imageReadError'))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setSubmitting(true)
    try {
      await onSubmit({ title: data.get('title').trim(), category: data.get('category'), quantity: Number(data.get('quantity')), unit: data.get('unit'), pickupLocation: data.get('pickupLocation').trim(), pickupMinutes: Number(data.get('pickupMinutes')), description: data.get('description').trim(), allergens: data.get('allergens').trim() || 'None declared', urgency: data.get('urgency'), imageUrl: foodImage })
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="page-wrap form-page"><section className="page-heading"><div><p className="eyebrow">{t('donateFood')}</p><h1>{t('donateHeading')}</h1><p className="muted">{t('donateIntro')}</p></div><button className="text-button" onClick={onCancel}>{t('backHome')}</button></section>
      <div className="form-layout"><form className="donation-form" onSubmit={handleSubmit}><div className="form-section-title"><span>1</span><div><h2>{t('foodDetails')}</h2><p>{t('foodDetailsHint')}</p></div></div>
        <label className="field full-field">{t('donationName')}<input name="title" placeholder="e.g. Vegetable Biryani" required maxLength="60" /></label>
        <label className="field full-field">{t('pickupAddress')}<input name="pickupLocation" placeholder={t('pickupAddressHint')} required maxLength="180" /></label>
        <div className="field-row"><label className="field">{t('foodType')}<select name="category" defaultValue="Prepared meals"><option value="Prepared meals">{t('preparedMeals')}</option><option value="Produce">{t('produce')}</option><option value="Fruit">{t('fruit')}</option><option value="Bakery">{t('bakery')}</option><option value="Other">{t('otherFood')}</option></select></label><label className="field">{t('quantity')}<input name="quantity" type="number" min="1" defaultValue="30" required /></label><label className="field unit-field">{t('unit')}<select name="unit"><option>servings</option><option>kg</option><option>boxes</option></select></label></div>
        <label className="field full-field">{t('description')}<textarea name="description" rows="3" placeholder={t('descriptionHint')} required maxLength="240" /></label><label className="field full-field">{t('dietaryNotes')}<input name="allergens" placeholder={t('dietaryHint')} /></label>
        <section className="food-image-upload"><div className="food-image-preview">{foodImage ? <img src={foodImage} alt={t('foodImagePreview')} /> : <div className="food-image-placeholder"><span>♡</span><strong>{t('foodImagePreview')}</strong></div>}</div><div className="food-image-copy"><p className="eyebrow">{t('foodImageSection')}</p><h3>{t('uploadFoodImage')}</h3><p>{t('uploadFoodImageHint')}</p><div className="food-image-actions"><label className="button button-outline upload-image-button">{t(foodImage ? 'changeFoodImage' : 'chooseFoodImage')}<input type="file" accept="image/*" onClick={(event) => { event.currentTarget.value = '' }} onChange={handleImageChange} /></label>{foodImage && <button type="button" className="text-button" onClick={() => { setFoodImage(''); setImageError('') }}>{t('removeFoodImage')}</button>}</div>{imageError && <p className="upload-image-error" role="alert">{imageError}</p>}</div></section>
        <div className="form-section-title form-section-spaced"><span>2</span><div><h2>{t('pickupTiming')}</h2><p>{t('pickupHint')}</p></div></div>
        <div className="field-row"><label className="field">{t('collectWithin')}<select name="pickupMinutes" defaultValue="30">{[10, 15, 20, 30, 45, 60, 75, 90, 105, 120].map((minutes) => <option key={minutes} value={minutes}>{formatDuration(minutes, t)}</option>)}</select></label><label className="field">{t('urgency')}<select name="urgency"><option value="High">{t('urgent')}</option><option value="Medium">{t('normal')}</option><option value="Flexible">{t('flexible')}</option></select></label></div>
        <div className="pickup-location"><span className="location-pin">⌖</span><span><strong>{donor.organizationName}</strong><small>{location} · {t('pickupLocation')}</small></span></div><div className="form-actions"><button className="button button-outline" type="button" onClick={onCancel} disabled={busy || submitting}>{t('cancel')}</button><button className="button button-dark" type="submit" disabled={busy || submitting}>{busy || submitting ? t('working') : t('postDonation')} <span aria-hidden="true">→</span></button></div>
      </form><aside className="form-aside"><div className="aside-icon">✳</div><p className="eyebrow">{t('afterPost')}</p><h2>{t('matchingExplainer')}</h2><p>{t('matchingNext')}</p><JourneyProgress current="donate" t={t} /></aside></div>
    </div>
  )
}

function ReceiverDashboard({ donations, requests, recipient, busy, t, onRequest, onOpenConnection }) {
  const [tab, setTab] = useState('find')
  const [foodType, setFoodType] = useState('All')
  const available = donations.filter((donation) => [DONATION_STATUS.AVAILABLE, DONATION_STATUS.REQUESTED].includes(donation.status) && (foodType === 'All' || donation.category === foodType))
  const matches = useMemo(() => available.map((donation) => ({ donation, match: getRankedMatches(donation, [recipient])[0] })), [available, recipient])
  const requestByDonation = new Map(requests.map((request) => [request.donationId, request]))
  return (
    <div className="page-wrap"><section className="page-heading recipient-heading"><div><p className="eyebrow">{t('receiverHome')}</p><h1>{t('findTitle')}</h1><p className="muted">{t('findDescription')}</p></div><span className="verified-mark">✓ {t('verifiedRecipient')}</span></section>
      <ActivitySummary t={t} role="recipient" total={requests.length} active={requests.filter((request) => request.status === 'PENDING').length} completed={requests.filter((request) => ['ACCEPTED', 'COMPLETED'].includes(request.status)).length} />
      <section className="content-section available-section"><div className="section-heading"><div><h2>{tab === 'find' ? t('availableFood') : t('myRequests')}</h2></div><div className="filter-tabs" role="tablist"><button role="tab" aria-selected={tab === 'find'} className={tab === 'find' ? 'filter-tab active' : 'filter-tab'} onClick={() => setTab('find')}>{t('findDonations')}</button><button role="tab" aria-selected={tab === 'requests'} className={tab === 'requests' ? 'filter-tab active' : 'filter-tab'} onClick={() => setTab('requests')}>{t('myRequests')}</button></div></div>
        {tab === 'find' && <label className="food-type-filter"><span>{t('filterFoodType')}</span><select value={foodType} onChange={(event) => setFoodType(event.target.value)}><option value="All">{t('allFoodTypes')}</option><option value="Prepared meals">{t('preparedMeals')}</option><option value="Produce">{t('produce')}</option><option value="Fruit">{t('fruit')}</option><option value="Bakery">{t('bakery')}</option></select></label>}
        {tab === 'find' ? matches.length ? <div className="recipient-grid">{matches.map(({ donation, match }) => <DonationCard key={donation.id} donation={donation} mode="receiver" match={match} request={requestByDonation.get(donation.id)} busy={busy} t={t} onRequest={() => onRequest(donation.id)} onOpenConnection={onOpenConnection} />)}</div> : <div className="empty-state"><h3>{t('emptyAvailable')}</h3><p>{t('emptyHint')}</p></div> : requests.length ? <div className="receiver-request-list">{requests.map((request) => <ReceiverRequest key={request.id} request={request} donation={donations.find((item) => item.id === request.donationId)} t={t} onOpenConnection={onOpenConnection} />)}</div> : <div className="empty-state"><h3>{t('requestHistoryEmpty')}</h3></div>}</section>
    </div>
  )
}

function ReceiverRequest({ request, donation, t, onOpenConnection }) {
  if (!donation) return null
  return <article className="receiver-request"><div><p className="eyebrow">{t('myRequests')}</p><h3>{donation.title}</h3><p>{donation.quantity} {donation.unit} · {donation.city}</p><time dateTime={request.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.createdAt))}</time></div><StatusBadge status={request.status} t={t} />{['ACCEPTED', 'COMPLETED'].includes(request.status) && <button className="button button-dark" onClick={() => onOpenConnection(request.connectionId)}>{t('openConnection')} <span aria-hidden="true">→</span></button>}</article>
}

function RequestHistory({ requests, donations, connections, t, onOpenConnection }) {
  return <div className="page-wrap"><section className="page-heading"><div><p className="eyebrow">{t('receiverRequests')}</p><h1>{t('myRequests')}</h1></div></section><div className="receiver-request-list">{requests.map((request) => <ReceiverRequest key={request.id} request={request} donation={donations.find((item) => item.id === request.donationId)} t={t} onOpenConnection={onOpenConnection} />)}</div>{connections.length === 0 && requests.length === 0 && <div className="empty-state"><h3>{t('requestHistoryEmpty')}</h3></div>}</div>
}

function Toast({ toast }) {
  return toast ? <div className="toast" role="status">{toast}</div> : null
}

function formatDuration(minutes, t) {
  if (minutes < 60) return `${minutes} ${t('minutes')}`
  if (minutes === 60) return `1 ${t('hour')}`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} ${t('hour')} ${remainder} ${t('minutes')}` : `${hours} ${t('hours')}`
}

export default App

function compressDonationImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.naturalWidth * scale)
      canvas.height = Math.round(image.naturalHeight * scale)
      const context = canvas.getContext('2d')
      if (!context) {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Image canvas unavailable'))
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      URL.revokeObjectURL(objectUrl)
      resolve(dataUrl)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Image could not be read'))
    }
    image.src = objectUrl
  })
}
