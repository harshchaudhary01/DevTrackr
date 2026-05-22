import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const authDefaults = {
  name: '',
  email: '',
  password: '',
}

const profileDefaults = {
  name: '',
}

const navItems = [
  { id: 'overview', label: 'Mission Control' },
  { id: 'repos', label: 'Repo Hangar' },
  { id: 'github', label: 'GitHub Link' },
  { id: 'profile', label: 'Pilot Profile' },
]

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('devtrackr_token') || '')
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(authDefaults)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [appBusy, setAppBusy] = useState(false)
  const [appError, setAppError] = useState('')
  const [activeView, setActiveView] = useState('overview')
  const [overviewData, setOverviewData] = useState(null)
  const [trackedRepos, setTrackedRepos] = useState([])
  const [availableRepos, setAvailableRepos] = useState([])
  const [availableBusy, setAvailableBusy] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [githubBusy, setGithubBusy] = useState(false)
  const [githubMessage, setGithubMessage] = useState('')
  const [repoSearch, setRepoSearch] = useState('')
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [repoBundle, setRepoBundle] = useState({
    loading: false,
    error: '',
    dashboard: null,
    commits: null,
    prs: null,
    issues: null,
    contributors: null,
    insights: null,
  })
  const [syncingRepoId, setSyncingRepoId] = useState('')
  const [trackingRepoId, setTrackingRepoId] = useState('')
  const [profileForm, setProfileForm] = useState(profileDefaults)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [insightBusy, setInsightBusy] = useState(false)

  const deferredSearch = useDeferredValue(repoSearch)

  const trackedRepoIds = useMemo(
    () => new Set(trackedRepos.filter((repo) => repo.isActive !== false).map((repo) => String(repo.githubId))),
    [trackedRepos],
  )

  const filteredAvailableRepos = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    return availableRepos.filter((repo) => {
      if (!query) {
        return true
      }

      return [repo.name, repo.fullName, repo.language]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    })
  }, [availableRepos, deferredSearch])

  const selectedRepoMeta = useMemo(() => {
    const merged = [
      ...(overviewData?.repos || []),
      ...trackedRepos,
    ]

    return merged.find((repo) => String(repo.id || repo._id) === String(selectedRepoId)) || null
  }, [overviewData, selectedRepoId, trackedRepos])

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    })

    const raw = await response.text()
    const data = raw ? JSON.parse(raw) : {}

    if (!response.ok) {
      throw new Error(data.message || 'Request failed.')
    }

    return data
  }, [token])

  const refreshSession = useCallback(async () => {
    if (!token) {
      return
    }

    setAppBusy(true)
    setAppError('')

    try {
      const [meResult, overviewResult, trackedResult] = await Promise.allSettled([
        request('/auth/me'),
        request('/dashboard/overview'),
        request('/github/repos/tracked'),
      ])

      if (meResult.status === 'fulfilled') {
        setUser(meResult.value.user)
        setProfileForm({ name: meResult.value.user.name || '' })
      } else {
        throw meResult.reason
      }

      if (overviewResult.status === 'fulfilled') {
        setOverviewData(overviewResult.value)
      } else {
        setOverviewData({
          overview: {
            totalRepos: 0,
            totalCommits: 0,
            totalPRs: 0,
            totalIssues: 0,
            avgProductivityScore: 0,
            avgHealthScore: 0,
          },
          repos: [],
        })
      }

      if (trackedResult.status === 'fulfilled') {
        setTrackedRepos(trackedResult.value.repositories || [])
      } else {
        setTrackedRepos([])
      }
    } catch (error) {
      const message = error.message || 'Session refresh failed.'
      setAppError(message)

      if (/token|login|expired|denied/i.test(message)) {
        localStorage.removeItem('devtrackr_token')
        setToken('')
        setUser(null)
      }
    } finally {
      setAppBusy(false)
    }
  }, [request, token])

  const loadRepoDetails = useCallback(async (repoId) => {
    if (!repoId || !token) {
      return
    }

    setRepoBundle((current) => ({
      ...current,
      loading: true,
      error: '',
    }))

    const results = await Promise.allSettled([
      request(`/dashboard/repo/${repoId}`),
      request(`/analytics/${repoId}/commits`),
      request(`/analytics/${repoId}/prs`),
      request(`/analytics/${repoId}/issues`),
      request(`/analytics/${repoId}/contributors`),
    ])

    const dashboardResult = results[0]

    if (dashboardResult.status === 'rejected') {
      setRepoBundle({
        loading: false,
        error: dashboardResult.reason.message || 'Repository details are unavailable right now.',
        dashboard: null,
        commits: null,
        prs: null,
        issues: null,
        contributors: null,
        insights: null,
      })
      return
    }

    setRepoBundle({
      loading: false,
      error: '',
      dashboard: dashboardResult.value,
      commits: results[1].status === 'fulfilled' ? results[1].value : null,
      prs: results[2].status === 'fulfilled' ? results[2].value : null,
      issues: results[3].status === 'fulfilled' ? results[3].value : null,
      contributors: results[4].status === 'fulfilled' ? results[4].value : null,
      insights: dashboardResult.value.insights || null,
    })
  }, [request, token])

  useEffect(() => {
    if (token) {
      void refreshSession()
    } else {
      setUser(null)
      setOverviewData(null)
      setTrackedRepos([])
      setAvailableRepos([])
      setSelectedRepoId('')
      setRepoBundle({
        loading: false,
        error: '',
        dashboard: null,
        commits: null,
        prs: null,
        issues: null,
        contributors: null,
        insights: null,
      })
    }
  }, [token, refreshSession])

  useEffect(() => {
    if (!selectedRepoId && (overviewData?.repos?.length || trackedRepos.length)) {
      const firstRepo = overviewData?.repos?.[0]?.id || trackedRepos[0]?._id
      if (firstRepo) {
        startTransition(() => {
          setSelectedRepoId(String(firstRepo))
        })
      }
    }
  }, [overviewData, trackedRepos, selectedRepoId])

  useEffect(() => {
    if (selectedRepoId && token) {
      void loadRepoDetails(selectedRepoId)
    }
  }, [selectedRepoId, token, loadRepoDetails])

  const refreshPortfolio = async () => {
    const [overviewResult, trackedResult] = await Promise.allSettled([
      request('/dashboard/overview'),
      request('/github/repos/tracked'),
    ])

    if (overviewResult.status === 'fulfilled') {
      setOverviewData(overviewResult.value)
    }

    if (trackedResult.status === 'fulfilled') {
      setTrackedRepos(trackedResult.value.repositories || [])
    }
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password }
        : authForm

      const data = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      localStorage.setItem('devtrackr_token', data.token)
      setToken(data.token)
      setUser(data.user)
      setProfileForm({ name: data.user.name || '' })
      setAuthForm(authDefaults)
      setAuthMode('login')
      setActiveView('overview')
    } catch (error) {
      setAuthError(error.message || 'Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('devtrackr_token')
    setToken('')
    setGithubToken('')
    setGithubMessage('')
    setProfileMessage('')
    setAppError('')
  }

  const handleConnectGithub = async (event) => {
    event.preventDefault()
    setGithubBusy(true)
    setGithubMessage('')

    try {
      const data = await request('/github/connect', {
        method: 'POST',
        body: JSON.stringify({ token: githubToken }),
      })

      setGithubMessage(data.message)
      setGithubToken('')
      await refreshSession()
      setActiveView('github')
    } catch (error) {
      setGithubMessage(error.message || 'GitHub connection failed.')
    } finally {
      setGithubBusy(false)
    }
  }

  const loadGithubRepos = async () => {
    setAvailableBusy(true)
    setGithubMessage('')

    try {
      const data = await request('/github/repos')
      setAvailableRepos(data.repositories || [])
    } catch (error) {
      setGithubMessage(error.message || 'Unable to load repositories.')
    } finally {
      setAvailableBusy(false)
    }
  }

  const handleTrackRepo = async (repo) => {
    setTrackingRepoId(String(repo.githubId))

    try {
      await request('/github/repos/track', {
        method: 'POST',
        body: JSON.stringify(repo),
      })

      await refreshPortfolio()
      setGithubMessage(`Tracking ${repo.fullName}.`)
    } catch (error) {
      setGithubMessage(error.message || 'Unable to track repository.')
    } finally {
      setTrackingRepoId('')
    }
  }

  const handleUntrackRepo = async (repoId) => {
    setTrackingRepoId(String(repoId))

    try {
      await request(`/github/repos/${repoId}`, { method: 'DELETE' })
      await refreshPortfolio()

      if (String(selectedRepoId) === String(repoId)) {
        setSelectedRepoId('')
      }
    } catch (error) {
      setGithubMessage(error.message || 'Unable to stop tracking repository.')
    } finally {
      setTrackingRepoId('')
    }
  }

  const handleSyncRepo = async (repoId) => {
    setSyncingRepoId(String(repoId))
    setGithubMessage('')

    try {
      const data = await request(`/github/sync/${repoId}`, { method: 'POST' })
      setGithubMessage(data.message)
      await refreshPortfolio()

      if (String(selectedRepoId) === String(repoId)) {
        await loadRepoDetails(repoId)
      }
    } catch (error) {
      setGithubMessage(error.message || 'Unable to sync repository.')
    } finally {
      setSyncingRepoId('')
    }
  }

  const handleGenerateInsights = async (force = false) => {
    if (!selectedRepoId) {
      return
    }

    setInsightBusy(true)
    setRepoBundle((current) => ({
      ...current,
      error: '',
    }))

    try {
      const data = await request(`/ai/generate/${selectedRepoId}${force ? '?force=true' : ''}`, {
        method: 'POST',
      })

      setRepoBundle((current) => ({
        ...current,
        insights: data.insights,
      }))
    } catch (error) {
      setRepoBundle((current) => ({
        ...current,
        error: error.message || 'AI generation failed.',
      }))
    } finally {
      setInsightBusy(false)
    }
  }

  const handleProfileUpdate = async (event) => {
    event.preventDefault()
    setProfileBusy(true)
    setProfileMessage('')

    try {
      const data = await request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      })

      setUser((current) => ({
        ...current,
        ...data.user,
      }))
      setProfileMessage('Profile updated successfully.')
    } catch (error) {
      setProfileMessage(error.message || 'Unable to update profile.')
    } finally {
      setProfileBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(129,230,217,0.16),_transparent_30%),linear-gradient(160deg,_#09090f_0%,_#111322_45%,_#1d1028_100%)] text-slate-100">
        <div className="anime-grid fixed inset-0 opacity-50" />
        <div className="scanline fixed inset-0 pointer-events-none opacity-30" />
        <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-10 px-4 py-10 lg:flex-row lg:items-center lg:px-8">
          <section className="max-w-2xl flex-1">
            <span className="pill mb-6 inline-flex">DevTrackr // anime operations deck</span>
            <h1 className="max-w-3xl text-5xl font-black uppercase leading-[0.95] tracking-[0.08em] text-white md:text-7xl">
              Ship your repo analytics like a season finale.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Your backend already supports authentication, GitHub repository tracking,
              analytics sync, AI insights, and dashboard summaries. This frontend turns that
              into a bold mission-control experience built for real usage instead of a starter template.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <FeatureCard
                title="Track Repos"
                value="GitHub sync"
                description="Connect a personal token, fetch repositories, and choose which ones to monitor."
              />
              <FeatureCard
                title="Read Signals"
                value="Health + velocity"
                description="Surface commits, PRs, issues, contributor activity, and heatmap trends."
              />
              <FeatureCard
                title="Ask AI"
                value="Tactical insights"
                description="Generate sprint summaries, recommendations, bottlenecks, and risk analysis."
              />
            </div>
          </section>

          <section className="relative w-full max-w-xl flex-1">
            <div className="panel shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-cyan-200/70">Pilot Access</p>
                  <h2 className="text-3xl font-black uppercase tracking-[0.08em] text-white">
                    {authMode === 'login' ? 'Log In' : 'Create Account'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    setAuthError('')
                    setAuthForm(authDefaults)
                    setAuthMode((current) => (current === 'login' ? 'register' : 'login'))
                  }}
                >
                  {authMode === 'login' ? 'Need an account?' : 'Already registered?'}
                </button>
              </div>

              <form className="space-y-4" onSubmit={handleAuthSubmit}>
                {authMode === 'register' ? (
                  <label className="field">
                    <span>Name</span>
                    <input
                      autoComplete="name"
                      value={authForm.name}
                      onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Captain coder"
                      required
                    />
                  </label>
                ) : null}

                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete={authMode === 'login' ? 'email' : 'username'}
                    value={authForm.email}
                    onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    type="password"
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    value={authForm.password}
                    onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Minimum 6 characters"
                    required
                  />
                </label>

                {authError ? <p className="status-error">{authError}</p> : null}

                <button className="primary-button w-full" type="submit" disabled={authBusy}>
                  {authBusy ? 'Processing...' : authMode === 'login' ? 'Enter Mission Control' : 'Launch Account'}
                </button>
              </form>

              <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 text-sm text-slate-300 sm:grid-cols-2">
                <StatusLine label="Backend coverage" value="Auth, GitHub, analytics, AI" />
                <StatusLine label="Frontend stack" value="React 19 + Tailwind v4 + Vite" />
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_25%),radial-gradient(circle_at_top_right,_rgba(125,211,252,0.14),_transparent_30%),linear-gradient(180deg,_#0b1020_0%,_#111827_55%,_#0a0a12_100%)] text-slate-100">
      <div className="anime-grid fixed inset-0 opacity-40" />
      <div className="scanline fixed inset-0 pointer-events-none opacity-25" />

      <header className="relative border-b border-white/10 bg-slate-950/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="badge-chip bg-cyan-300/15 text-cyan-100">DevTrackr</span>
              <span className="badge-chip bg-amber-300/15 text-amber-100">
                {user?.githubUsername ? `GitHub linked: ${user.githubUsername}` : 'GitHub not linked'}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-black uppercase tracking-[0.1em] text-white md:text-4xl">
              Mission Control
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Manage repositories, sync analytics, and turn engineering signals into a cinematic frontend experience.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="panel-tight min-w-[220px]">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Pilot</p>
              <p className="mt-1 text-lg font-semibold text-white">{user?.name}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <aside className="panel h-fit">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/80">Navigation</p>
          <div className="mt-5 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`nav-button ${activeView === item.id ? 'nav-button-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">System Pulse</p>
            <div className="mt-4 grid gap-3">
              <StatusLine label="Tracked repos" value={String(overviewData?.overview?.totalRepos || 0)} />
              <StatusLine label="Average health" value={`${overviewData?.overview?.avgHealthScore || 0}/100`} />
              <StatusLine label="Average output" value={`${overviewData?.overview?.avgProductivityScore || 0}/100`} />
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          {appError ? <p className="status-error">{appError}</p> : null}
          {appBusy ? (
            <div className="panel">
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/70">Syncing session</p>
              <h2 className="mt-2 text-2xl font-bold text-white">Loading your backend state...</h2>
            </div>
          ) : null}

          {activeView === 'overview' ? (
            <OverviewSection overviewData={overviewData} setActiveView={setActiveView} />
          ) : null}

          {activeView === 'repos' ? (
            <RepositoriesSection
              overviewData={overviewData}
              trackedRepos={trackedRepos}
              selectedRepoId={selectedRepoId}
              setSelectedRepoId={setSelectedRepoId}
              setActiveView={setActiveView}
              handleSyncRepo={handleSyncRepo}
              syncingRepoId={syncingRepoId}
              handleUntrackRepo={handleUntrackRepo}
              trackingRepoId={trackingRepoId}
            />
          ) : null}

          {activeView === 'github' ? (
            <GithubSection
              user={user}
              githubToken={githubToken}
              setGithubToken={setGithubToken}
              handleConnectGithub={handleConnectGithub}
              githubBusy={githubBusy}
              githubMessage={githubMessage}
              availableBusy={availableBusy}
              loadGithubRepos={loadGithubRepos}
              filteredAvailableRepos={filteredAvailableRepos}
              repoSearch={repoSearch}
              setRepoSearch={setRepoSearch}
              trackedRepoIds={trackedRepoIds}
              handleTrackRepo={handleTrackRepo}
              trackingRepoId={trackingRepoId}
            />
          ) : null}

          {activeView === 'profile' ? (
            <ProfileSection
              user={user}
              profileForm={profileForm}
              setProfileForm={setProfileForm}
              handleProfileUpdate={handleProfileUpdate}
              profileBusy={profileBusy}
              profileMessage={profileMessage}
            />
          ) : null}

          <RepoDetailSection
            selectedRepoMeta={selectedRepoMeta}
            repoBundle={repoBundle}
            handleGenerateInsights={handleGenerateInsights}
            insightBusy={insightBusy}
            handleSyncRepo={handleSyncRepo}
            syncingRepoId={syncingRepoId}
          />
        </section>
      </main>
    </div>
  )
}

function OverviewSection({ overviewData, setActiveView }) {
  const overview = overviewData?.overview || {
    totalRepos: 0,
    totalCommits: 0,
    totalPRs: 0,
    totalIssues: 0,
    avgProductivityScore: 0,
    avgHealthScore: 0,
  }

  return (
    <section className="space-y-6">
      <div className="panel overflow-hidden">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle,_rgba(56,189,248,0.18),_transparent_60%)] lg:block" />
        <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <span className="pill mb-4 inline-flex">Backend analyzed, frontend remixed</span>
            <h2 className="text-3xl font-black uppercase tracking-[0.08em] text-white md:text-4xl">
              Full-stack telemetry for your developer workflow.
            </h2>
            <p className="mt-4 max-w-2xl text-slate-300">
              The backend exposes a polished repository analytics pipeline: GitHub ingestion,
              derived metrics, dashboard aggregation, and AI-generated insights. This dashboard is designed
              to surface those layers clearly, with smooth transitions and clear empty states.
            </p>
          </div>
          <div className="rounded-[28px] border border-cyan-300/20 bg-cyan-300/10 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/80">Ready next</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {overview.totalRepos === 0
                ? 'Connect GitHub, fetch repos, then start tracking.'
                : 'Pick a tracked repo below to drill into metrics and AI insights.'}
            </p>
            <button className="primary-button mt-5" type="button" onClick={() => setActiveView('github')}>
              Open GitHub Link
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Tracked Repositories" value={overview.totalRepos} tone="cyan" />
        <StatCard label="Total Commits" value={overview.totalCommits} tone="amber" />
        <StatCard label="Pull Requests" value={overview.totalPRs} tone="pink" />
        <StatCard label="Issues" value={overview.totalIssues} tone="violet" />
        <StatCard label="Avg Productivity" value={`${overview.avgProductivityScore}/100`} tone="emerald" />
        <StatCard label="Avg Health" value={`${overview.avgHealthScore}/100`} tone="sky" />
      </div>
    </section>
  )
}

function RepositoriesSection({
  overviewData,
  trackedRepos,
  selectedRepoId,
  setSelectedRepoId,
  setActiveView,
  handleSyncRepo,
  syncingRepoId,
  handleUntrackRepo,
  trackingRepoId,
}) {
  const repos = overviewData?.repos || trackedRepos

  return (
    <section className="panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Tracked Fleet</p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white">
            Repo Hangar
          </h2>
        </div>
        <button className="ghost-button" type="button" onClick={() => setActiveView('github')}>
          Add More Repositories
        </button>
      </div>

      {repos.length === 0 ? (
        <EmptyState
          title="No repositories tracked yet"
          description="Your backend is ready for it. Link GitHub, fetch your repos, and choose a project to monitor."
        />
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {repos.map((repo) => {
            const repoId = String(repo.id || repo._id)
            const metrics = repo.metrics || {}
            const active = repoId === String(selectedRepoId)

            return (
              <article
                key={repoId}
                className={`rounded-[30px] border p-5 transition duration-300 ${active ? 'border-cyan-300/60 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.25)]' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge-chip bg-white/10 text-slate-200">{repo.language || 'Unknown'}</span>
                      <span className="badge-chip bg-white/10 text-slate-300">{repo.fullName || repo.name}</span>
                    </div>
                    <h3 className="mt-4 text-2xl font-bold text-white">{repo.name}</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Last synced {formatRelativeDate(repo.lastSynced)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setSelectedRepoId(repoId)
                        setActiveView('overview')
                      }}
                    >
                      Inspect
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => handleSyncRepo(repoId)}
                      disabled={syncingRepoId === repoId}
                    >
                      {syncingRepoId === repoId ? 'Syncing...' : 'Sync'}
                    </button>
                    {'_id' in repo ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => handleUntrackRepo(repo._id)}
                        disabled={trackingRepoId === String(repo._id)}
                      >
                        {trackingRepoId === String(repo._id) ? 'Working...' : 'Untrack'}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MiniStat label="Commits" value={metrics.totalCommits || 0} />
                  <MiniStat label="PRs" value={metrics.totalPRs || 0} />
                  <MiniStat label="Open Issues" value={metrics.openIssues || 0} />
                  <MiniStat label="Health" value={`${metrics.healthScore || 0}`} />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function GithubSection({
  user,
  githubToken,
  setGithubToken,
  handleConnectGithub,
  githubBusy,
  githubMessage,
  availableBusy,
  loadGithubRepos,
  filteredAvailableRepos,
  repoSearch,
  setRepoSearch,
  trackedRepoIds,
  handleTrackRepo,
  trackingRepoId,
}) {
  return (
    <section className="space-y-6">
      <div className="panel">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Integration Gateway</p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white">
              GitHub Link
            </h2>
            <p className="mt-4 text-slate-300">
              The backend expects a GitHub personal access token, validates it against the GitHub API,
              and stores your GitHub identity on the user record. Once linked, you can fetch repositories and track them individually.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Connection State</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {user?.githubUsername ? `Linked as ${user.githubUsername}` : 'Not linked yet'}
            </p>
          </div>
        </div>

        <form className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleConnectGithub}>
          <label className="field">
            <span>GitHub personal access token</span>
            <input
              value={githubToken}
              onChange={(event) => setGithubToken(event.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxx"
              required
            />
          </label>
          <button className="primary-button self-end" type="submit" disabled={githubBusy}>
            {githubBusy ? 'Linking...' : 'Connect GitHub'}
          </button>
        </form>

        {githubMessage ? <p className="mt-4 status-info">{githubMessage}</p> : null}
      </div>

      <div className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Repository Discovery</p>
            <h3 className="mt-2 text-2xl font-bold text-white">Fetch available repositories</h3>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="field min-w-[240px]">
              <span>Search repos</span>
              <input
                value={repoSearch}
                onChange={(event) => setRepoSearch(event.target.value)}
                placeholder="Search by name or language"
              />
            </label>
            <button className="secondary-button self-end" type="button" onClick={loadGithubRepos} disabled={availableBusy}>
              {availableBusy ? 'Loading...' : 'Fetch Repositories'}
            </button>
          </div>
        </div>

        {filteredAvailableRepos.length === 0 ? (
          <EmptyState
            title="No repositories loaded yet"
            description="Fetch your GitHub repos after linking your token. They will appear here with one-click tracking."
          />
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {filteredAvailableRepos.map((repo) => {
              const isTracked = trackedRepoIds.has(String(repo.githubId))
              const busy = trackingRepoId === String(repo.githubId)

              return (
                <article key={repo.githubId} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-chip bg-white/10 text-slate-200">{repo.language}</span>
                        <span className="badge-chip bg-white/10 text-slate-300">
                          {repo.isPrivate ? 'Private' : 'Public'}
                        </span>
                      </div>
                      <h4 className="mt-4 text-xl font-bold text-white">{repo.fullName}</h4>
                      <p className="mt-2 text-sm text-slate-400">{repo.description || 'No description provided.'}</p>
                    </div>
                    <button
                      className={isTracked ? 'ghost-button' : 'primary-button'}
                      type="button"
                      disabled={isTracked || busy}
                      onClick={() => handleTrackRepo(repo)}
                    >
                      {busy ? 'Tracking...' : isTracked ? 'Tracked' : 'Track Repo'}
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-4 gap-3">
                    <MiniStat label="Stars" value={repo.stars} />
                    <MiniStat label="Forks" value={repo.forks} />
                    <MiniStat label="Issues" value={repo.openIssues} />
                    <MiniStat label="Branch" value={repo.defaultBranch} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function ProfileSection({
  user,
  profileForm,
  setProfileForm,
  handleProfileUpdate,
  profileBusy,
  profileMessage,
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="panel">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Identity Module</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white">
          Pilot Profile
        </h2>
        <form className="mt-8 space-y-4" onSubmit={handleProfileUpdate}>
          <label className="field">
            <span>Name</span>
            <input
              value={profileForm.name}
              onChange={(event) => setProfileForm({ name: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={user?.email || ''} disabled />
          </label>
          <button className="primary-button" type="submit" disabled={profileBusy}>
            {profileBusy ? 'Updating...' : 'Save Profile'}
          </button>
          {profileMessage ? <p className="status-info">{profileMessage}</p> : null}
        </form>
      </div>

      <div className="panel">
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Account Stats</p>
        <div className="mt-6 space-y-4">
          <MiniStat label="Plan" value={user?.plan || 'free'} large />
          <MiniStat label="GitHub" value={user?.githubUsername || 'Not linked'} large />
          <MiniStat label="Last Active" value={formatRelativeDate(user?.lastActive)} large />
        </div>
      </div>
    </section>
  )
}

function RepoDetailSection({
  selectedRepoMeta,
  repoBundle,
  handleGenerateInsights,
  insightBusy,
  handleSyncRepo,
  syncingRepoId,
}) {
  const repo = repoBundle.dashboard?.repository || selectedRepoMeta

  return (
    <section className="space-y-6">
      <div className="panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Deep Dive</p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.08em] text-white">
              Repository Detail
            </h2>
            <p className="mt-3 text-slate-300">
              This section is powered by `/dashboard/repo/:repoId`, plus the detailed analytics and AI insight endpoints.
            </p>
          </div>

          {repo ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="secondary-button"
                type="button"
                onClick={() => handleSyncRepo(repo.id || repo._id)}
                disabled={syncingRepoId === String(repo.id || repo._id)}
              >
                {syncingRepoId === String(repo.id || repo._id) ? 'Syncing...' : 'Sync Repository'}
              </button>
              <button className="primary-button" type="button" onClick={() => handleGenerateInsights(false)} disabled={insightBusy}>
                {insightBusy ? 'Generating...' : 'Generate AI Insights'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {!repo ? (
        <EmptyState
          title="Choose a repository"
          description="Pick a tracked repo from the Repo Hangar and this area will fill with metrics, charts, contributors, and AI recommendations."
        />
      ) : null}

      {repoBundle.loading ? (
        <div className="panel">
          <p className="text-lg font-semibold text-white">Loading repository analytics...</p>
        </div>
      ) : null}

      {repoBundle.error ? (
        <div className="panel border border-amber-300/30 bg-amber-300/10">
          <p className="text-sm uppercase tracking-[0.22em] text-amber-100/80">Repository status</p>
          <p className="mt-3 text-lg font-semibold text-white">{repoBundle.error}</p>
          <p className="mt-2 text-sm text-slate-200">
            If this repo is newly tracked, run a sync first so the backend can populate analytics documents.
          </p>
        </div>
      ) : null}

      {repoBundle.dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Productivity Score" value={`${repoBundle.dashboard.metrics?.productivityScore || 0}/100`} tone="cyan" />
            <StatCard label="Health Score" value={`${repoBundle.dashboard.metrics?.healthScore || 0}/100`} tone="amber" />
            <StatCard label="Open PRs" value={repoBundle.dashboard.metrics?.openPRCount || 0} tone="pink" />
            <StatCard label="Open Issues" value={repoBundle.dashboard.metrics?.openIssueCount || 0} tone="violet" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="panel">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Activity Arc</p>
                  <h3 className="mt-2 text-2xl font-bold text-white">{repo.fullName || repo.name}</h3>
                  <p className="mt-2 text-sm text-slate-400">{repo.description || 'No description available.'}</p>
                </div>
                <div className="text-right text-sm text-slate-400">
                  <p>Updated {formatRelativeDate(repo.lastSynced)}</p>
                  <p className="mt-1">{repo.language || 'Unknown'} stack</p>
                </div>
              </div>

              <div className="mt-8">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Commit trend</h4>
                <BarTrend items={repoBundle.dashboard.commitTrend || []} itemKey="date" valueKey="count" />
              </div>

              <div className="mt-8">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Contribution heatmap</h4>
                <HeatmapGrid items={repoBundle.dashboard.heatmapData || []} />
              </div>
            </div>

            <div className="panel">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Top Contributors</p>
              <div className="mt-6 space-y-4">
                {(repoBundle.dashboard.topContributors || []).length === 0 ? (
                  <p className="text-sm text-slate-400">No contributor analytics yet.</p>
                ) : (
                  repoBundle.dashboard.topContributors.map((contributor) => (
                    <div key={contributor.login} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-white">{contributor.login}</p>
                          <p className="text-sm text-slate-400">
                            {contributor.isInactive ? 'Inactive for 14+ days' : 'Recently active'}
                          </p>
                        </div>
                        <span className="badge-chip bg-cyan-300/15 text-cyan-100">
                          {contributor.totalCommits} commits
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="panel xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Activity Feed</p>
              <div className="mt-6 space-y-4">
                {(repoBundle.dashboard.activityFeed || []).map((item, index) => (
                  <div key={`${item.type}-${index}`} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="badge-chip bg-white/10 text-slate-200">{item.type.toUpperCase()}</span>
                      <span className="text-sm text-slate-400">{formatRelativeDate(item.date)}</span>
                    </div>
                    <p className="mt-3 text-white">
                      {item.message || item.title || `#${item.number || item.sha}`}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">by {item.author || 'Unknown author'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Weekly Pulse</p>
              <BarTrend items={repoBundle.dashboard.weeklyActivity || []} itemKey="week" valueKey="commits" compact />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <InsightPanel
              title="Sprint Summary"
              content={repoBundle.insights?.sprintSummary || repoBundle.dashboard.insights?.sprintSummary}
            />
            <InsightPanel
              title="Productivity Insights"
              content={repoBundle.insights?.productivityInsights || repoBundle.dashboard.insights?.productivityInsights}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ListPanel
              title="Recommendations"
              items={repoBundle.insights?.recommendations || repoBundle.dashboard.insights?.recommendations || []}
              renderItem={(item) => (
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge-chip bg-emerald-300/15 text-emerald-100">{item.priority || 'medium'}</span>
                    <span className="badge-chip bg-white/10 text-slate-200">{item.category || 'process'}</span>
                  </div>
                  <p className="mt-3 font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                </div>
              )}
            />
            <ListPanel
              title="Bottlenecks"
              items={repoBundle.insights?.bottlenecks || repoBundle.dashboard.insights?.bottlenecks || []}
              renderItem={(item) => (
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge-chip bg-amber-300/15 text-amber-100">{item.severity || 'low'}</span>
                    <span className="badge-chip bg-white/10 text-slate-200">{item.affectedArea || 'Workflow'}</span>
                  </div>
                  <p className="mt-3 font-semibold text-white">{item.type || 'Process bottleneck'}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.description}</p>
                  <p className="mt-2 text-sm text-cyan-100">{item.suggestion}</p>
                </div>
              )}
            />
            <ListPanel
              title="Risk Analysis"
              items={repoBundle.insights?.riskAnalysis?.risks || repoBundle.dashboard.insights?.riskAnalysis?.risks || []}
              emptyText="Generate AI insights to see structured risk analysis."
              renderItem={(item) => (
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge-chip bg-rose-300/15 text-rose-100">{item.level || 'low'}</span>
                    <span className="badge-chip bg-white/10 text-slate-200">{item.area || 'General'}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{item.description}</p>
                </div>
              )}
            />
          </div>
        </>
      ) : null}
    </section>
  )
}

function FeatureCard({ title, value, description }) {
  return (
    <article className="rounded-[30px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">{title}</p>
      <h3 className="mt-3 text-2xl font-black uppercase tracking-[0.06em] text-white">{value}</h3>
      <p className="mt-3 text-sm text-slate-300">{description}</p>
    </article>
  )
}

function StatCard({ label, value, tone = 'cyan' }) {
  const toneMap = {
    cyan: 'from-cyan-300/20 to-sky-400/5 border-cyan-300/20',
    amber: 'from-amber-300/20 to-orange-400/5 border-amber-300/20',
    pink: 'from-pink-300/20 to-rose-400/5 border-pink-300/20',
    violet: 'from-violet-300/20 to-fuchsia-400/5 border-violet-300/20',
    emerald: 'from-emerald-300/20 to-lime-400/5 border-emerald-300/20',
    sky: 'from-sky-300/20 to-cyan-400/5 border-sky-300/20',
  }

  return (
    <article className={`rounded-[30px] border bg-gradient-to-br p-5 ${toneMap[tone] || toneMap.cyan}`}>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-300">{label}</p>
      <p className="mt-4 text-4xl font-black uppercase tracking-[0.05em] text-white">{value}</p>
    </article>
  )
}

function MiniStat({ label, value, large = false }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/35 p-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 font-semibold text-white ${large ? 'text-lg' : 'text-base'}`}>{value}</p>
    </div>
  )
}

function StatusLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  )
}

function BarTrend({ items, itemKey, valueKey, compact = false }) {
  const safeItems = items.slice(-12)
  const max = Math.max(...safeItems.map((item) => item[valueKey] || 0), 1)

  if (!safeItems.length) {
    return <p className="mt-4 text-sm text-slate-400">No chart data available yet.</p>
  }

  return (
    <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4 xl:grid-cols-6'}`}>
      {safeItems.map((item) => {
        const value = item[valueKey] || 0
        const height = `${Math.max(12, Math.round((value / max) * 100))}%`

        return (
          <div key={`${item[itemKey]}-${value}`} className="rounded-[22px] border border-white/10 bg-white/5 p-3">
            <div className={`flex h-${compact ? '[100px]' : '[140px]'} items-end`}>
              <div
                className="w-full rounded-t-[18px] bg-gradient-to-t from-cyan-400 via-sky-300 to-amber-200 shadow-[0_0_18px_rgba(125,211,252,0.35)]"
                style={{ height }}
              />
            </div>
            <p className="mt-3 truncate text-xs uppercase tracking-[0.16em] text-slate-400">{item[itemKey]}</p>
            <p className="mt-1 text-sm font-semibold text-white">{value}</p>
          </div>
        )
      })}
    </div>
  )
}

function HeatmapGrid({ items }) {
  if (!items.length) {
    return <p className="mt-4 text-sm text-slate-400">No heatmap data available yet.</p>
  }

  return (
    <div className="mt-4 grid grid-cols-10 gap-2 md:grid-cols-15 xl:grid-cols-20">
      {items.slice(-120).map((item) => {
        const tone =
          item.count > 8 ? 'bg-cyan-200' : item.count > 4 ? 'bg-cyan-300/80' : item.count > 1 ? 'bg-cyan-500/55' : 'bg-slate-700'

        return (
          <div
            key={item.date}
            className={`aspect-square rounded-md border border-white/5 ${tone}`}
            title={`${item.date}: ${item.count} commits`}
          />
        )
      })}
    </div>
  )
}

function InsightPanel({ title, content }) {
  return (
    <article className="panel">
      <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">{title}</p>
      <div className="prose-invert mt-5 max-w-none text-slate-200">
        {content ? <p className="whitespace-pre-line leading-7">{content}</p> : <p className="text-slate-400">Generate AI insights to populate this section.</p>}
      </div>
    </article>
  )
}

function ListPanel({ title, items, renderItem, emptyText = 'No structured data available yet.' }) {
  return (
    <article className="panel">
      <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">{title}</p>
      <div className="mt-5 space-y-4">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              {renderItem(item)}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">{emptyText}</p>
        )}
      </div>
    </article>
  )
}

function EmptyState({ title, description }) {
  return (
    <div className="mt-6 rounded-[30px] border border-dashed border-white/15 bg-white/5 p-8 text-center">
      <h3 className="text-2xl font-bold text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-slate-400">{description}</p>
    </div>
  )
}

function formatRelativeDate(value) {
  if (!value) {
    return 'not yet'
  }

  const date = new Date(value)
  const diffDays = Math.round((Date.now() - date.getTime()) / 86400000)

  if (diffDays <= 0) {
    return 'today'
  }

  if (diffDays === 1) {
    return '1 day ago'
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export default App
