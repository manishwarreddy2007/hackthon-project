export function AuthPage({ t, role, onRoleChange, mode, onModeChange, location, locations, language, languages, busy, onLocationChange, onLanguageChange, onLogin, onRegister }) {
  function submit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (mode === 'register') {
      onRegister({
        name: data.get('name').trim(),
        organizationName: data.get('organizationName').trim(),
        email: data.get('email').trim().toLowerCase(),
        phone: data.get('phone').trim(),
        password: data.get('password'),
        role,
        location: data.get('location'),
        organizationType: role === 'RECEIVER' ? data.get('organizationType') : 'Food Donor',
        verified: role === 'RECEIVER',
      })
      return
    }
    onLogin({ email: data.get('email').trim().toLowerCase(), password: data.get('password'), role })
  }

  return (
    <main className="auth-shell">
      <div className="auth-topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><span className="brand-bowl">◒</span><span className="brand-heart">♥</span></span><span className="brand-wording"><strong>FoodLink</strong><small>Share Food • Build Hope</small></span></div>
        <div className="preference-controls">
          <label className="preference-select"><span>{t('location')}:</span><select aria-label={t('location')} value={location} onChange={(event) => onLocationChange(event.target.value)}>{locations.map((city) => <option key={city}>{city}</option>)}</select></label>
          <label className="preference-select"><span>{t('language')}:</span><select aria-label={t('language')} value={language} onChange={(event) => onLanguageChange(event.target.value)}>{languages.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
        </div>
      </div>
      <section className="auth-layout">
        <div className="auth-intro"><p className="eyebrow">GOOD FOOD, SHARED WELL</p><h1>{t('authHeadline')}</h1><p>{t('authIntro')}</p><div className="auth-steps"><span>01 <strong>{t('donateFood')}</strong></span><i>→</i><span>02 <strong>{t('aiMatch')}</strong></span><i>→</i><span>03 <strong>{t('collectShort')}</strong></span></div><img src="/food-meals.jpg" alt={t('heroImageAlt')} /></div>
        <div className="auth-panel">
          <h2>{t('welcome')}</h2><p className="auth-subtitle">{mode === 'login' ? t('loginIntro') : t('registerIntro')}</p>
          <div className="role-selector" aria-label={t('selectRole')}><button type="button" className={role === 'DONOR' ? 'active' : ''} onClick={() => onRoleChange('DONOR')}>{t('foodDonor')}</button><button type="button" className={role === 'RECEIVER' ? 'active' : ''} onClick={() => onRoleChange('RECEIVER')}>{t('foodReceiver')}</button></div>
          <div className="auth-mode"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => onModeChange('login')}>{t('login')}</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => onModeChange('register')}>{t('register')}</button></div>
          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <><label className="field">{t('fullName')}<input name="name" autoComplete="name" required /></label><label className="field">{t('organizationName')}<input name="organizationName" autoComplete="organization" required /></label></>}
            <label className="field">{t('email')}<input name="email" type="email" autoComplete="email" required /></label>
            {mode === 'register' && <label className="field">{t('phone')}<input name="phone" type="tel" autoComplete="tel" required /></label>}
            <label className="field">{t('password')}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength="6" /></label>
            {mode === 'register' && <><label className="field">{t('location')}<select name="location" defaultValue={location}>{locations.map((city) => <option key={city}>{city}</option>)}</select></label>{role === 'RECEIVER' && <label className="field">{t('organizationType')}<select name="organizationType" defaultValue="Community Kitchen"><option>NGO</option><option>Food Shelter</option><option>Orphanage</option><option>Community Kitchen</option><option>Charitable Organization</option></select></label>}</>}
            <button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy ? t('working') : mode === 'login' ? t('login') : t('createAccount')} <span aria-hidden="true">→</span></button>
          </form>
        </div>
      </section>
      <p className="auth-footnote">{t('authSecurityNote')}</p>
    </main>
  )
}
