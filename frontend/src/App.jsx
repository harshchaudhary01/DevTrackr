import {
  startTransition, useCallback, useDeferredValue,
  useEffect, useMemo, useState, useRef,
} from 'react'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const authDefaults = { name: '', email: '', password: '' }

/* ── count-up hook ── */
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const n = parseFloat(target)
    if (isNaN(n)) { setVal(target); return }
    let start = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      setVal(Math.floor(p * n))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return val
}

/* ── Particle system ── */
function Particles() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
    }))
    let raf
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139,92,246,${p.alpha})`
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.6 }} />
}

/* ── Main App ── */
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('dt_token') || '')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(authDefaults)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [appBusy, setAppBusy] = useState(false)
  const [appError, setAppError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [overviewData, setOverviewData] = useState(null)
  const [trackedRepos, setTrackedRepos] = useState([])
  const [availableRepos, setAvailableRepos] = useState([])
  const [availableBusy, setAvailableBusy] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [githubBusy, setGithubBusy] = useState(false)
  const [githubMsg, setGithubMsg] = useState('')
  const [repoSearch, setRepoSearch] = useState('')
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [bundle, setBundle] = useState({ loading: false, error: '', dashboard: null, insights: null })
  const [syncingId, setSyncingId] = useState('')
  const [trackingId, setTrackingId] = useState('')
  const [profileForm, setProfileForm] = useState({ name: '' })
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [insightBusy, setInsightBusy] = useState(false)
  const autoInsightRepoRef = useRef('')

  const dSearch = useDeferredValue(repoSearch)
  const trackedIds = useMemo(
    () => new Set(trackedRepos.filter(r => r.isActive !== false).map(r => String(r.githubId))),
    [trackedRepos]
  )
  const filteredRepos = useMemo(() => {
    const q = dSearch.trim().toLowerCase()
    return availableRepos.filter(r => !q || [r.name, r.fullName, r.language].filter(Boolean).some(v => v.toLowerCase().includes(q)))
  }, [availableRepos, dSearch])
  const selectedMeta = useMemo(() => {
    return [...(overviewData?.repos || []), ...trackedRepos].find(r => String(r.id || r._id) === String(selectedRepoId)) || null
  }, [overviewData, trackedRepos, selectedRepoId])

  const req = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
      ...opts,
    })
    const raw = await res.text()
    const data = raw ? JSON.parse(raw) : {}
    if (!res.ok) throw new Error(data.message || 'Request failed')
    return data
  }, [token])

  const refreshSession = useCallback(async () => {
    if (!token) return
    setAppBusy(true); setAppError('')
    try {
      const [me, ov, tr] = await Promise.allSettled([
        req('/auth/me'), req('/dashboard/overview'), req('/github/repos/tracked'),
      ])
      if (me.status === 'fulfilled') { setUser(me.value.user); setProfileForm({ name: me.value.user.name || '' }) }
      else throw me.reason
      setOverviewData(ov.status === 'fulfilled' ? ov.value : { overview: { totalRepos: 0, totalCommits: 0, totalPRs: 0, totalIssues: 0, avgProductivityScore: 0, avgHealthScore: 0 }, repos: [] })
      setTrackedRepos(tr.status === 'fulfilled' ? tr.value.repositories || [] : [])
    } catch (e) {
      setAppError(e.message)
      if (/token|login|expired/i.test(e.message)) { localStorage.removeItem('dt_token'); setToken(''); setUser(null) }
    } finally { setAppBusy(false) }
  }, [req, token])

  const loadRepo = useCallback(async (id) => {
    if (!id || !token) return
    setBundle(c => ({ ...c, loading: true, error: '' }))
    const [db, cm, pr, is, cn] = await Promise.allSettled([
      req(`/dashboard/repo/${id}`), req(`/analytics/${id}/commits`),
      req(`/analytics/${id}/prs`), req(`/analytics/${id}/issues`), req(`/analytics/${id}/contributors`),
    ])
    if (db.status === 'rejected') {
      setBundle({ loading: false, error: db.reason.message || 'Unavailable', dashboard: null, insights: null }); return
    }
    setBundle({ loading: false, error: '', dashboard: db.value, commits: cm.status === 'fulfilled' ? cm.value : null, prs: pr.status === 'fulfilled' ? pr.value : null, issues: is.status === 'fulfilled' ? is.value : null, contributors: cn.status === 'fulfilled' ? cn.value : null, insights: db.value.insights || null })
  }, [req, token])

  useEffect(() => {
    if (token) void refreshSession()
    else { setUser(null); setOverviewData(null); setTrackedRepos([]); setBundle({ loading: false, error: '', dashboard: null, insights: null }) }
  }, [token, refreshSession])

  useEffect(() => {
    if (!selectedRepoId && (overviewData?.repos?.length || trackedRepos.length)) {
      const first = overviewData?.repos?.[0]?.id || trackedRepos[0]?._id
      if (first) startTransition(() => setSelectedRepoId(String(first)))
    }
  }, [overviewData, trackedRepos, selectedRepoId])

  useEffect(() => { if (selectedRepoId && token) void loadRepo(selectedRepoId) }, [selectedRepoId, token, loadRepo])

  const refreshPortfolio = async () => {
    const [o, t] = await Promise.allSettled([req('/dashboard/overview'), req('/github/repos/tracked')])
    if (o.status === 'fulfilled') setOverviewData(o.value)
    if (t.status === 'fulfilled') setTrackedRepos(t.value.repositories || [])
  }

  const handleAuth = async (e) => {
    e.preventDefault(); setAuthBusy(true); setAuthError('')
    try {
      const ep = authMode === 'login' ? '/auth/login' : '/auth/register'
      const body = authMode === 'login' ? { email: authForm.email, password: authForm.password } : authForm
      const data = await req(ep, { method: 'POST', body: JSON.stringify(body) })
      localStorage.setItem('dt_token', data.token); setToken(data.token); setUser(data.user)
      setProfileForm({ name: data.user.name || '' }); setAuthForm(authDefaults); setActiveTab('overview')
    } catch (e) { setAuthError(e.message) } finally { setAuthBusy(false) }
  }

  const handleLogout = () => { localStorage.removeItem('dt_token'); setToken(''); setGithubToken(''); setGithubMsg(''); setProfileMsg('') }

  const handleConnectGithub = async (e) => {
    e.preventDefault(); setGithubBusy(true); setGithubMsg('')
    try {
      const d = await req('/github/connect', { method: 'POST', body: JSON.stringify({ token: githubToken }) })
      setGithubMsg(d.message); setGithubToken(''); await refreshSession(); setActiveTab('github')
    } catch (e) { setGithubMsg(e.message) } finally { setGithubBusy(false) }
  }

  const loadGithubRepos = useCallback(async () => {
    setAvailableBusy(true); setGithubMsg('')
    try { const d = await req('/github/repos'); setAvailableRepos(d.repositories || []) }
    catch (e) { setGithubMsg(e.message) } finally { setAvailableBusy(false) }
  }, [req])

  const handleTrack = async (repo) => {
    setTrackingId(String(repo.githubId))
    try { await req('/github/repos/track', { method: 'POST', body: JSON.stringify(repo) }); await refreshPortfolio(); setGithubMsg(`Tracking ${repo.fullName}`) }
    catch (e) { setGithubMsg(e.message) } finally { setTrackingId('') }
  }

  const handleUntrack = async (id) => {
    setTrackingId(String(id))
    try {
      await req(`/github/repos/${id}`, { method: 'DELETE' }); await refreshPortfolio()
      if (String(selectedRepoId) === String(id)) setSelectedRepoId('')
    } catch (e) { setGithubMsg(e.message) } finally { setTrackingId('') }
  }

  const handleSync = async (id) => {
    setSyncingId(String(id)); setGithubMsg('')
    try {
      const d = await req(`/github/sync/${id}`, { method: 'POST' }); setGithubMsg(d.message); await refreshPortfolio()
      autoInsightRepoRef.current = ''
      if (String(selectedRepoId) === String(id)) await loadRepo(id)
    } catch (e) { setGithubMsg(e.message) } finally { setSyncingId('') }
  }

  const handleInsights = useCallback(async (force = false) => {
    if (!selectedRepoId) return
    setInsightBusy(true); setBundle(c => ({ ...c, error: '' }))
    try {
      const d = await req(`/ai/generate/${selectedRepoId}${force ? '?force=true' : ''}`, { method: 'POST' })
      setBundle(c => ({ ...c, insights: d.insights }))
      autoInsightRepoRef.current = String(selectedRepoId)
    } catch (e) { setBundle(c => ({ ...c, error: e.message })) } finally { setInsightBusy(false) }
  }, [req, selectedRepoId])

  useEffect(() => {
    if (activeTab !== 'github' || availableBusy || availableRepos.length > 0 || !user?.githubUsername) return
    void loadGithubRepos()
  }, [activeTab, availableBusy, availableRepos.length, user?.githubUsername, loadGithubRepos])

  useEffect(() => {
    const hasInsights = Boolean(bundle.insights || bundle.dashboard?.insights)
    if (activeTab !== 'detail' || !selectedRepoId || !bundle.dashboard || bundle.loading || insightBusy || hasInsights) return
    if (autoInsightRepoRef.current === String(selectedRepoId)) return
    autoInsightRepoRef.current = String(selectedRepoId)
    void handleInsights(false)
  }, [activeTab, selectedRepoId, bundle.dashboard, bundle.insights, bundle.loading, insightBusy, handleInsights])

  const handleProfile = async (e) => {
    e.preventDefault(); setProfileBusy(true); setProfileMsg('')
    try {
      const d = await req('/auth/profile', { method: 'PUT', body: JSON.stringify(profileForm) })
      setUser(c => ({ ...c, ...d.user })); setProfileMsg('Profile updated!')
    } catch (e) { setProfileMsg(e.message) } finally { setProfileBusy(false) }
  }

  /* ── AUTH SCREEN ── */
  if (!token) return (
    <div className="dt-auth">
      <Particles />
      <div className="dt-auth__bg" />
      <div className="dt-auth__grid" />

      <div className="dt-auth__layout">
        <div className="dt-auth__left">
          <div className="dt-auth__logo">
            <span className="dt-logo__mark">⬡</span>
            <span className="dt-logo__text">DevTrackr</span>
          </div>
          <div className="dt-auth__tagline-wrap">
            <span className="dt-auth__eyebrow">MISSION CONTROL</span>
            <h1 className="dt-auth__headline">
              Your code,<br />
              <span className="dt-auth__hl-accent">decoded by AI.</span>
            </h1>
            <p className="dt-auth__sub">
              Connect GitHub repos, get real-time analytics, AI sprint summaries,
              and bottleneck detection — built for the developer arc.
            </p>
          </div>
          <div className="dt-auth__features">
            {[
              { icon: '◈', title: 'GitHub Sync', desc: 'Live repo tracking & commits' },
              { icon: '✦', title: 'AI Insights', desc: 'Sprint summaries & risk analysis' },
              { icon: '▲', title: 'Analytics', desc: 'Heatmaps, trends & contributors' },
            ].map(f => (
              <div key={f.title} className="dt-auth__feat">
                <span className="dt-auth__feat-icon">{f.icon}</span>
                <div>
                  <div className="dt-auth__feat-title">{f.title}</div>
                  <div className="dt-auth__feat-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dt-auth__right">
          <div className="dt-auth__card">
            <div className="dt-auth__card-shine" />
            <div className="dt-auth__tabs">
              <button className={`dt-auth__tab ${authMode === 'login' ? 'is-active' : ''}`} onClick={() => { setAuthError(''); setAuthMode('login') }}>Sign In</button>
              <button className={`dt-auth__tab ${authMode === 'register' ? 'is-active' : ''}`} onClick={() => { setAuthError(''); setAuthMode('register') }}>Register</button>
            </div>
            <form className="dt-auth__form" onSubmit={handleAuth}>
              {authMode === 'register' && (
                <div className="dt-field">
                  <label className="dt-label">Display Name</label>
                  <input className="dt-input" placeholder="Itadori Yuji" value={authForm.name} onChange={e => setAuthForm(c => ({ ...c, name: e.target.value }))} required autoComplete="name" />
                </div>
              )}
              <div className="dt-field">
                <label className="dt-label">Email Address</label>
                <input className="dt-input" type="email" placeholder="you@example.com" value={authForm.email} onChange={e => setAuthForm(c => ({ ...c, email: e.target.value }))} required autoComplete="email" />
              </div>
              <div className="dt-field">
                <label className="dt-label">Password</label>
                <input className="dt-input" type="password" placeholder="Min. 6 characters" value={authForm.password} onChange={e => setAuthForm(c => ({ ...c, password: e.target.value }))} required autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
              </div>
              {authError && <div className="dt-form-error">{authError}</div>}
              <button className="dt-btn-primary dt-btn--full" type="submit" disabled={authBusy}>
                {authBusy ? <span className="dt-spinner" /> : authMode === 'login' ? 'Enter Mission Control →' : 'Launch Your Arc →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )

  /* ── DASHBOARD ── */
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '⬡' },
    { id: 'repos', label: 'Repos', icon: '◈' },
    { id: 'github', label: 'GitHub', icon: '◉' },
    { id: 'detail', label: 'Analytics', icon: '▲' },
    { id: 'profile', label: 'Profile', icon: '◎' },
  ]

  return (
    <div className="dt-dash">
      <Particles />
      <div className="dt-dash__bg" />
      <div className="dt-dash__grid" />

      <header className="dt-nav">
        <div className="dt-nav__logo">
          <span className="dt-logo__mark">⬡</span>
          <span className="dt-logo__text">DevTrackr</span>
        </div>

        <div className="dt-nav__tabs">
          {tabs.map(t => (
            <button key={t.id} className={`dt-nav__tab ${activeTab === t.id ? 'is-active' : ''}`} onClick={() => setActiveTab(t.id)}>
              <span className="dt-nav__tab-icon">{t.icon}</span>
              <span className="dt-nav__tab-label">{t.label}</span>
              {activeTab === t.id && <span className="dt-nav__tab-bar" />}
            </button>
          ))}
        </div>

        <div className="dt-nav__right">
          <div className={`dt-nav__gh-status ${user?.githubUsername ? 'is-linked' : ''}`}>
            <span className="dt-pulse-dot" />
            {user?.githubUsername ? `@${user.githubUsername}` : 'Link GitHub'}
          </div>
          <div className="dt-nav__avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
          <button className="dt-btn-eject" onClick={handleLogout}>Eject</button>
        </div>
      </header>

      <main className="dt-main">
        {appError && <div className="dt-app-error">{appError}</div>}
        {appBusy ? <DtLoader /> : (
          <>
            {activeTab === 'overview' && <OverviewTab ov={overviewData} setTab={setActiveTab} />}
            {activeTab === 'repos' && (
              <ReposTab
                ov={overviewData} tracked={trackedRepos}
                selectedId={selectedRepoId}
                setSelectedId={(id) => { setSelectedRepoId(id); setActiveTab('detail') }}
                setTab={setActiveTab} handleSync={handleSync} syncingId={syncingId}
                handleUntrack={handleUntrack} trackingId={trackingId}
              />
            )}
            {activeTab === 'github' && (
              <GithubTab
                user={user} githubToken={githubToken} setGithubToken={setGithubToken}
                handleConnect={handleConnectGithub} githubBusy={githubBusy} githubMsg={githubMsg}
                availableBusy={availableBusy} loadRepos={loadGithubRepos}
                filteredRepos={filteredRepos} repoSearch={repoSearch} setRepoSearch={setRepoSearch}
                trackedIds={trackedIds} handleTrack={handleTrack} trackingId={trackingId}
              />
            )}
            {activeTab === 'detail' && (
              <DetailTab
                meta={selectedMeta} bundle={bundle}
                handleInsights={handleInsights} insightBusy={insightBusy}
                handleSync={handleSync} syncingId={syncingId}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileTab
                user={user} form={profileForm} setForm={setProfileForm}
                handleSave={handleProfile} busy={profileBusy} msg={profileMsg}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

/* ══════════════════════════════════════
   OVERVIEW TAB
══════════════════════════════════════ */
function OverviewTab({ ov, setTab }) {
  const o = ov?.overview || {}
  const stats = [
    { label: 'Repos', value: o.totalRepos || 0, color: 'pink', icon: '◈' },
    { label: 'Commits', value: o.totalCommits || 0, color: 'cyan', icon: '◉' },
    { label: 'Pull Requests', value: o.totalPRs || 0, color: 'violet', icon: '⬡' },
    { label: 'Issues', value: o.totalIssues || 0, color: 'amber', icon: '◎' },
    { label: 'Productivity', value: o.avgProductivityScore || 0, suffix: '/100', color: 'emerald', icon: '▲' },
    { label: 'Health Score', value: o.avgHealthScore || 0, suffix: '/100', color: 'sky', icon: '◆' },
  ]
  return (
    <div className="dt-tab-body">
      <div className="dt-hero">
        <div className="dt-hero__glow" />
        <span className="dt-eyebrow">MISSION CONTROL</span>
        <h2 className="dt-hero__title">What's happening<br /><span className="dt-hero__accent">in your codebase?</span></h2>
        <p className="dt-hero__desc">Real-time GitHub analytics, AI-powered sprint summaries, and contributor intelligence.</p>
        <div className="dt-hero__btns">
          <button className="dt-btn-primary" onClick={() => setTab('github')}>⬡ Connect GitHub</button>
          <button className="dt-btn-ghost" onClick={() => setTab('repos')}>View Repos →</button>
        </div>
      </div>

      <div className="dt-stat-grid">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {ov?.repos?.length > 0 && (
        <div className="dt-glass">
          <div className="dt-section-hd">
            <span className="dt-section-title">Tracked Fleet</span>
            <button className="dt-btn-link" onClick={() => setTab('repos')}>See all →</button>
          </div>
          <div className="dt-fleet-list">
            {ov.repos.slice(0, 4).map(r => (
              <div key={r.id || r._id} className="dt-fleet-row" onClick={() => setTab('repos')}>
                <div className="dt-fleet-row__lang">{r.language || '?'}</div>
                <div className="dt-fleet-row__name">{r.name}</div>
                <div className="dt-fleet-row__meta">{r.fullName}</div>
                <div className="dt-fleet-row__health">
                  <span className="dt-health-num">{r.metrics?.healthScore || 0}</span>
                  <span className="dt-health-label">health</span>
                </div>
                <HealthBar val={r.metrics?.healthScore || 0} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, suffix = '', color, icon }) {
  const n = useCountUp(value)
  return (
    <div className={`dt-stat dt-stat--${color}`}>
      <span className="dt-stat__icon">{icon}</span>
      <span className="dt-stat__num">{n}{suffix}</span>
      <span className="dt-stat__label">{label}</span>
      <div className="dt-stat__glow" />
    </div>
  )
}

function HealthBar({ val }) {
  const [w, setW] = useState(0)
  useEffect(() => { setTimeout(() => setW(val), 100) }, [val])
  const color = val > 70 ? '#22d3ee' : val > 40 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ flex: '0 0 80px', height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${w}%`, height: '100%', background: color, transition: 'width 0.8s ease', borderRadius: 2 }} />
    </div>
  )
}

/* ══════════════════════════════════════
   REPOS TAB
══════════════════════════════════════ */
function ReposTab({ ov, tracked, selectedId, setSelectedId, setTab, handleSync, syncingId, handleUntrack, trackingId }) {
  const overviewMap = new Map((ov?.repos || []).map(repo => [String(repo.id || repo._id), repo]))
  const repos = tracked.length
    ? tracked.map(repo => {
      const summary = overviewMap.get(String(repo._id)) || {}
      return {
        ...summary,
        ...repo,
        metrics: summary.metrics || repo.metrics,
      }
    })
    : (ov?.repos || [])
  return (
    <div className="dt-tab-body">
      <div className="dt-tab-hd">
        <div>
          <span className="dt-eyebrow">YOUR FLEET</span>
          <h2 className="dt-tab-title">Repo Hangar</h2>
        </div>
        <button className="dt-btn-primary" onClick={() => setTab('github')}>+ Add Repos</button>
      </div>

      {repos.length === 0 ? (
        <DtEmpty icon="◈" title="No repos tracked yet" sub="Head to GitHub tab → connect token → fetch & track repos." />
      ) : (
        <div className="dt-repo-grid">
          {repos.map(repo => {
            const id = String(repo.id || repo._id)
            const m = repo.metrics || {}
            const isActive = id === String(selectedId)
            return (
              <div key={id} className={`dt-repo-card ${isActive ? 'is-active' : ''}`}>
                <div className="dt-repo-card__shine" />
                <div className="dt-repo-card__top">
                  <span className="dt-repo-card__lang">{repo.language || '?'}</span>
                  <div className="dt-repo-card__actions">
                    <button className="dt-btn-sm dt-btn-sm--primary" onClick={() => setSelectedId(id)}>Analyze</button>
                    <button className="dt-btn-sm" onClick={() => handleSync(id)} disabled={syncingId === id} title="Sync">
                      <span className={syncingId === id ? 'dt-spin' : ''}>↻</span>
                    </button>
                    {'_id' in repo && (
                      <button className="dt-btn-sm dt-btn-sm--danger" onClick={() => handleUntrack(repo._id)} disabled={trackingId === String(repo._id)} title="Untrack">✕</button>
                    )}
                  </div>
                </div>
                <h3 className="dt-repo-card__name">{repo.name}</h3>
                <p className="dt-repo-card__full">{repo.fullName}</p>
                <div className="dt-repo-card__metrics">
                  {[
                    { label: 'Commits', val: m.totalCommits || 0 },
                    { label: 'PRs', val: m.totalPRs || 0 },
                    { label: 'Issues', val: m.openIssues || 0 },
                    { label: 'Health', val: m.healthScore || 0, accent: true },
                  ].map(({ label, val, accent }) => (
                    <div key={label} className={`dt-metric ${accent ? 'dt-metric--accent' : ''}`}>
                      <span className="dt-metric__val">{val}</span>
                      <span className="dt-metric__label">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="dt-repo-card__sync">Synced {relDate(repo.lastSynced)}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════
   GITHUB TAB
══════════════════════════════════════ */
function GithubTab({ user, githubToken, setGithubToken, handleConnect, githubBusy, githubMsg, availableBusy, loadRepos, filteredRepos, repoSearch, setRepoSearch, trackedIds, handleTrack, trackingId }) {
  return (
    <div className="dt-tab-body">
      <div className="dt-tab-hd">
        <div>
          <span className="dt-eyebrow">INTEGRATION</span>
          <h2 className="dt-tab-title">GitHub Link</h2>
        </div>
        <div className={`dt-gh-badge ${user?.githubUsername ? 'is-linked' : ''}`}>
          <span className="dt-pulse-dot" />
          {user?.githubUsername ? `Linked as @${user.githubUsername}` : 'Not linked'}
        </div>
      </div>

      <div className="dt-glass">
        <h3 className="dt-glass__title">Connect Personal Access Token</h3>
        <p className="dt-glass__desc">Provide a GitHub PAT (repo scope) to start tracking repositories and syncing analytics.</p>
        <form className="dt-token-form" onSubmit={handleConnect}>
          <input className="dt-input dt-input--mono" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" required />
          <button className="dt-btn-primary" type="submit" disabled={githubBusy}>{githubBusy ? <><span className="dt-spinner" /> Connecting…</> : 'Connect →'}</button>
        </form>
        {githubMsg && <div className={`dt-flash ${/fail|error|unable/i.test(githubMsg) ? 'dt-flash--err' : 'dt-flash--ok'}`}>{githubMsg}</div>}
      </div>

      <div className="dt-glass">
        <div className="dt-section-hd">
          <span className="dt-section-title">Available Repositories</span>
          <div className="dt-section-hd__actions">
            <input className="dt-input dt-input--sm" placeholder="Search repos…" value={repoSearch} onChange={e => setRepoSearch(e.target.value)} />
            <button className="dt-btn-ghost" onClick={loadRepos} disabled={availableBusy}>{availableBusy ? <><span className="dt-spinner" /> Loading…</> : '↓ Fetch Repos'}</button>
          </div>
        </div>

        {filteredRepos.length === 0 ? (
          <DtEmpty icon="◉" title="No repositories fetched" sub="Connect your GitHub token above then click 'Fetch Repos'." />
        ) : (
          <div className="dt-gh-list">
            {filteredRepos.map(repo => {
              const tracked = trackedIds.has(String(repo.githubId))
              const busy = trackingId === String(repo.githubId)
              return (
                <div key={repo.githubId} className="dt-gh-item">
                  <div className="dt-gh-item__info">
                    <div className="dt-gh-item__name">{repo.fullName}</div>
                    <div className="dt-gh-item__tags">
                      <span className="dt-tag">{repo.language || 'Unknown'}</span>
                      <span className={`dt-tag ${repo.isPrivate ? 'dt-tag--amber' : 'dt-tag--emerald'}`}>{repo.isPrivate ? 'Private' : 'Public'}</span>
                    </div>
                    <p className="dt-gh-item__desc">{repo.description || 'No description provided.'}</p>
                  </div>
                  <div className="dt-gh-item__right">
                    <div className="dt-gh-item__stats">
                      <span>★ {repo.stars}</span>
                      <span>⑂ {repo.forks}</span>
                    </div>
                    <button
                      className={tracked ? 'dt-btn-tracked' : 'dt-btn-primary dt-btn-sm--primary'}
                      disabled={tracked || busy}
                      onClick={() => handleTrack(repo)}
                    >{busy ? <span className="dt-spinner" /> : tracked ? '✓ Tracked' : '+ Track'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   DETAIL / ANALYTICS TAB
══════════════════════════════════════ */
function DetailTab({ meta, bundle, handleInsights, insightBusy, handleSync, syncingId }) {
  const repo = bundle.dashboard?.repository || meta
  return (
    <div className="dt-tab-body">
      <div className="dt-tab-hd dt-tab-hd--wrap">
        <div>
          <span className="dt-eyebrow">ANALYTICS</span>
          <h2 className="dt-tab-title">{repo ? repo.name : 'Analytics'}</h2>
          {repo && <p className="dt-tab-sub">{repo.fullName} · {repo.language || 'Unknown'}</p>}
        </div>
        {repo && (
          <div className="dt-detail-actions">
            <button className="dt-btn-ghost dt-btn-sm--ghost" onClick={() => handleSync(repo.id || repo._id)} disabled={syncingId === String(repo.id || repo._id)}>
              <span className={syncingId === String(repo.id || repo._id) ? 'dt-spin' : ''}>↻</span>
              {syncingId === String(repo.id || repo._id) ? ' Syncing…' : ' Sync'}
            </button>
            <button className="dt-btn-primary dt-btn-sm--primary" onClick={() => handleInsights(false)} disabled={insightBusy}>
              {insightBusy ? <><span className="dt-spinner" /> Generating…</> : '✦ AI Insights'}
            </button>
            <button className="dt-btn-ghost dt-btn-sm--ghost" onClick={() => handleInsights(true)} disabled={insightBusy}>↺ Refresh</button>
          </div>
        )}
      </div>

      {!repo && !bundle.loading && <DtEmpty icon="▲" title="No repo selected" sub="Go to Repos tab → click Analyze on any repository." />}
      {bundle.loading && <DtLoader />}
      {bundle.error && <DtError msg={bundle.error} />}

      {bundle.dashboard && (
        <>
          {/* Score row */}
          <div className="dt-score-row">
            {[
              { label: 'Productivity', value: bundle.dashboard.metrics?.productivityScore || 0, max: 100, color: 'cyan' },
              { label: 'Health Score', value: bundle.dashboard.metrics?.healthScore || 0, max: 100, color: 'emerald' },
              { label: 'Open PRs', value: bundle.dashboard.metrics?.openPRCount || 0, color: 'pink' },
              { label: 'Open Issues', value: bundle.dashboard.metrics?.openIssueCount || 0, color: 'amber' },
            ].map(s => <ScoreCard key={s.label} {...s} />)}
          </div>

          {/* Charts row */}
          <div className="dt-two-col">
            <div className="dt-glass">
              <h3 className="dt-glass__title">Commit Trend</h3>
              <BarChart data={bundle.dashboard.commitTrend || []} />
              <h3 className="dt-glass__title" style={{ marginTop: '1.5rem' }}>Contribution Heatmap</h3>
              <Heatmap data={bundle.dashboard.heatmapData || []} />
            </div>
            <div className="dt-glass">
              <h3 className="dt-glass__title">Top Contributors</h3>
              {(bundle.dashboard.topContributors || []).length === 0
                ? <p className="dt-muted">No contributor data yet. Sync the repository first.</p>
                : (bundle.dashboard.topContributors).map((c, i) => (
                  <div key={c.login} className="dt-contrib-row">
                    <span className="dt-contrib-row__rank">#{i + 1}</span>
                    <div className="dt-contrib-row__info">
                      <span className="dt-contrib-row__login">{c.login}</span>
                      <span className={`dt-contrib-row__status ${c.isInactive ? 'is-inactive' : 'is-active'}`}>
                        {c.isInactive ? '● Inactive' : '● Active'}
                      </span>
                    </div>
                    <span className="dt-contrib-row__commits">{c.totalCommits}</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Activity feed */}
          <div className="dt-glass">
            <h3 className="dt-glass__title">Activity Feed</h3>
            {(bundle.dashboard.activityFeed || []).length === 0
              ? <p className="dt-muted">No recent activity found.</p>
              : (bundle.dashboard.activityFeed).map((item, i) => (
                <div key={i} className="dt-feed-item">
                  <span className={`dt-feed-type dt-feed-type--${(item.type || 'event').toLowerCase()}`}>{item.type?.toUpperCase() || 'EVENT'}</span>
                  <div className="dt-feed-item__body">
                    <p className="dt-feed-item__msg">{item.message || item.title || `#${item.number || item.sha}`}</p>
                    <p className="dt-feed-item__meta">by {item.author || 'Unknown'} · {relDate(item.date)}</p>
                  </div>
                </div>
              ))
            }
          </div>

          {/* AI Insights */}
          <div className="dt-two-col">
            <AIPanel title="Sprint Summary" content={bundle.insights?.sprintSummary || bundle.dashboard.insights?.sprintSummary} onGenerate={() => handleInsights(false)} busy={insightBusy} />
            <AIPanel title="Productivity Insights" content={bundle.insights?.productivityInsights || bundle.dashboard.insights?.productivityInsights} onGenerate={() => handleInsights(false)} busy={insightBusy} />
          </div>

          {/* Recommendations / Bottlenecks / Risks */}
          <div className="dt-three-col">
            <InsightList
              title="Recommendations" icon="◈"
              items={bundle.insights?.recommendations || bundle.dashboard.insights?.recommendations || []}
              render={item => (
                <>
                  <div className="dt-il-tags">
                    <span className={`dt-tag dt-tag--priority-${(item.priority || 'medium').toLowerCase()}`}>{item.priority || 'medium'}</span>
                    <span className="dt-tag">{item.category || 'process'}</span>
                  </div>
                  <p className="dt-il-title">{item.title}</p>
                  <p className="dt-il-desc">{item.description}</p>
                </>
              )}
            />
            <InsightList
              title="Bottlenecks" icon="⚠"
              items={bundle.insights?.bottlenecks || bundle.dashboard.insights?.bottlenecks || []}
              render={item => (
                <>
                  <div className="dt-il-tags">
                    <span className={`dt-tag dt-tag--sev-${(item.severity || 'low').toLowerCase()}`}>{item.severity || 'low'}</span>
                    <span className="dt-tag">{item.affectedArea || 'workflow'}</span>
                  </div>
                  <p className="dt-il-title">{item.type || 'Bottleneck'}</p>
                  <p className="dt-il-desc">{item.description}</p>
                  {item.suggestion && <p className="dt-il-hint">→ {item.suggestion}</p>}
                </>
              )}
            />
            <InsightList
              title="Risk Analysis" icon="◆"
              emptyTxt="Click '✦ AI Insights' to generate risk analysis."
              items={bundle.insights?.riskAnalysis?.risks || bundle.dashboard.insights?.riskAnalysis?.risks || []}
              render={item => (
                <>
                  <div className="dt-il-tags">
                    <span className={`dt-tag dt-tag--risk-${(item.level || 'low').toLowerCase()}`}>{item.level || 'low'}</span>
                    <span className="dt-tag">{item.area || 'general'}</span>
                  </div>
                  <p className="dt-il-desc">{item.description}</p>
                </>
              )}
            />
          </div>
        </>
      )}
    </div>
  )
}

function ScoreCard({ label, value, max, color }) {
  const n = useCountUp(value)
  const [barW, setBarW] = useState(0)
  const pct = max ? Math.min(100, (value / max) * 100) : null
  useEffect(() => { if (pct !== null) setTimeout(() => setBarW(pct), 200) }, [pct])
  return (
    <div className={`dt-score-card dt-score-card--${color}`}>
      <span className="dt-score-card__label">{label}</span>
      <span className="dt-score-card__val">{n}{max ? <span className="dt-score-card__max">/{max}</span> : null}</span>
      {pct !== null && (
        <div className="dt-score-card__track">
          <div className="dt-score-card__fill" style={{ width: `${barW}%` }} />
        </div>
      )}
    </div>
  )
}

function BarChart({ data }) {
  const safe = data.slice(-12)
  const max = Math.max(...safe.map(d => d.count || 0), 1)
  if (!safe.length) return <p className="dt-muted">No chart data available yet. Sync the repo.</p>
  return (
    <div className="dt-bar-chart">
      {safe.map((d, i) => {
        const h = Math.max(6, ((d.count || 0) / max) * 100)
        return (
          <div key={i} className="dt-bar-col">
            <span className="dt-bar-col__val">{d.count || 0}</span>
            <div className="dt-bar-col__track">
              <div className="dt-bar-col__fill" style={{ height: `${h}%` }} title={`${d.date}: ${d.count}`} />
            </div>
            <span className="dt-bar-col__label">{String(d.date || '').slice(0, 5)}</span>
          </div>
        )
      })}
    </div>
  )
}

function Heatmap({ data }) {
  if (!data.length) return <p className="dt-muted">No heatmap data yet.</p>
  return (
    <div className="dt-heatmap">
      {data.slice(-140).map((d, i) => {
        const lvl = d.count > 8 ? 4 : d.count > 4 ? 3 : d.count > 1 ? 2 : d.count > 0 ? 1 : 0
        return <div key={i} className={`dt-hm-cell dt-hm-cell--${lvl}`} title={`${d.date}: ${d.count} commits`} />
      })}
    </div>
  )
}

function AIPanel({ title, content, onGenerate, busy }) {
  return (
    <div className="dt-ai-panel">
      <div className="dt-ai-panel__header">
        <span className="dt-ai-panel__spark">✦</span>
        <span className="dt-ai-panel__title">{title}</span>
      </div>
      {content ? (
        <p className="dt-ai-panel__body">{content}</p>
      ) : (
        <div className="dt-ai-panel__empty">
          <p className="dt-muted">No insights generated yet.</p>
          <button className="dt-btn-primary dt-btn-sm--primary" onClick={onGenerate} disabled={busy}>
            {busy ? <><span className="dt-spinner" /> Generating…</> : '✦ Generate Insights'}
          </button>
        </div>
      )}
    </div>
  )
}

function InsightList({ title, icon, items, render, emptyTxt = 'No data available yet.' }) {
  return (
    <div className="dt-glass">
      <div className="dt-il-header">
        <span className="dt-il-icon">{icon}</span>
        <h3 className="dt-glass__title" style={{ margin: 0 }}>{title}</h3>
      </div>
      {items.length === 0
        ? <p className="dt-muted">{emptyTxt}</p>
        : items.map((item, i) => <div key={i} className="dt-il-item">{render(item)}</div>)
      }
    </div>
  )
}

/* ══════════════════════════════════════
   PROFILE TAB
══════════════════════════════════════ */
function ProfileTab({ user, form, setForm, handleSave, busy, msg }) {
  return (
    <div className="dt-tab-body">
      <div className="dt-tab-hd">
        <div>
          <span className="dt-eyebrow">SETTINGS</span>
          <h2 className="dt-tab-title">Pilot Profile</h2>
        </div>
      </div>
      <div className="dt-two-col">
        <div className="dt-glass">
          <h3 className="dt-glass__title">Edit Profile</h3>
          <form className="dt-profile-form" onSubmit={handleSave}>
            <div className="dt-field">
              <label className="dt-label">Display Name</label>
              <input className="dt-input" value={form.name} onChange={e => setForm({ name: e.target.value })} required />
            </div>
            <div className="dt-field">
              <label className="dt-label">Email (read-only)</label>
              <input className="dt-input" value={user?.email || ''} disabled style={{ opacity: 0.4 }} />
            </div>
            <button className="dt-btn-primary" type="submit" disabled={busy}>{busy ? <><span className="dt-spinner" /> Saving…</> : 'Save Changes'}</button>
            {msg && <div className="dt-flash dt-flash--ok">{msg}</div>}
          </form>
        </div>

        <div className="dt-glass">
          <h3 className="dt-glass__title">Account Info</h3>
          <div className="dt-profile-card">
            <div className="dt-profile-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
            <div>
              <p className="dt-profile-name">{user?.name}</p>
              <p className="dt-profile-email">{user?.email}</p>
            </div>
          </div>
          <div className="dt-info-rows">
            {[
              { label: 'Plan', val: user?.plan || 'Free' },
              { label: 'GitHub', val: user?.githubUsername ? `@${user.githubUsername}` : 'Not linked' },
              { label: 'Last active', val: relDate(user?.lastActive) },
              { label: 'User ID', val: user?._id ? `#${String(user._id).slice(-6).toUpperCase()}` : '—' },
            ].map(r => (
              <div key={r.label} className="dt-info-row">
                <span className="dt-info-row__label">{r.label}</span>
                <span className="dt-info-row__val">{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   UTILITY COMPONENTS
══════════════════════════════════════ */
function DtLoader() {
  return (
    <div className="dt-loader">
      <div className="dt-loader__ring" />
      <p className="dt-loader__txt">Syncing mission data…</p>
    </div>
  )
}

function DtEmpty({ icon, title, sub }) {
  return (
    <div className="dt-empty">
      <div className="dt-empty__icon">{icon}</div>
      <h3 className="dt-empty__title">{title}</h3>
      <p className="dt-empty__sub">{sub}</p>
    </div>
  )
}

function DtError({ msg }) {
  return (
    <div className="dt-error-banner">
      <span className="dt-error-banner__icon">⚠</span>
      <div>
        <p className="dt-error-banner__msg">{msg}</p>
        <p className="dt-error-banner__hint">If newly tracked, try syncing the repo first.</p>
      </div>
    </div>
  )
}

function relDate(v) {
  if (!v) return 'never'
  const d = Math.round((Date.now() - new Date(v).getTime()) / 86400000)
  if (d <= 0) return 'today'
  if (d === 1) return '1d ago'
  if (d < 30) return `${d}d ago`
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(v))
}
