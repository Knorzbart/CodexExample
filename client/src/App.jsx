import { startTransition, useEffect, useState } from 'react'
import './App.css'
import {
  buildThemeStyle,
  defaultSiteConfig,
  defaultSiteState,
  normalizeSiteState,
} from './siteState.js'

const emptyCredentials = {
  username: '',
  password: '',
}

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [siteState, setSiteState] = useState(defaultSiteState)
  const [credentials, setCredentials] = useState(emptyCredentials)
  const [draft, setDraft] = useState('')
  const [siteConfigDraft, setSiteConfigDraft] = useState(defaultSiteConfig)
  const [session, setSession] = useState({
    authenticated: false,
    username: '',
  })
  const [liveState, setLiveState] = useState('Connecting live sync...')
  const [loginState, setLoginState] = useState({
    loading: false,
    error: '',
  })
  const [cmsState, setCmsState] = useState({
    loading: false,
    error: '',
    notice: '',
  })
  const [siteStateMeta, setSiteStateMeta] = useState({
    loading: true,
    error: '',
  })

  const isAdminRoute = pathname === '/admin'

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname)

    window.addEventListener('popstate', syncPath)
    return () => {
      window.removeEventListener('popstate', syncPath)
    }
  }, [])

  useEffect(() => {
    setSiteConfigDraft(siteState.siteConfig)
  }, [siteState.siteConfig])

  useEffect(() => {
    let ignore = false

    const loadSiteState = async ({ showLoading = false } = {}) => {
      if (showLoading) {
        setSiteStateMeta({
          loading: true,
          error: '',
        })
      }

      try {
        const response = await fetch('/api/site-state')
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error ?? 'The homepage state could not be loaded.')
        }

        if (!ignore) {
          startTransition(() => {
            setSiteState(normalizeSiteState(payload))
          })
          setSiteStateMeta({
            loading: false,
            error: '',
          })
        }
      } catch (error) {
        if (!ignore) {
          setSiteStateMeta({
            loading: false,
            error: error.message,
          })
        }
      }
    }

    const loadSession = async () => {
      try {
        const response = await fetch('/api/session')
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error ?? 'The session state could not be loaded.')
        }

        if (!ignore) {
          setSession(payload.session)
        }
      } catch (error) {
        if (!ignore) {
          setLoginState((current) => ({
            ...current,
            error: error.message,
          }))
        }
      }
    }

    const interval = window.setInterval(() => {
      loadSiteState()
    }, 15000)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadSiteState()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    loadSiteState({ showLoading: true })
    loadSession()

    const stream = new EventSource('/api/stream')

    stream.onopen = () => {
      setLiveState('Live sync connected')
    }

    stream.addEventListener('site-updated', () => {
      setLiveState('Live sync connected')
      loadSiteState()
    })

    stream.onerror = () => {
      setLiveState('Live sync reconnecting...')
      loadSiteState()
    }

    return () => {
      ignore = true
      stream.close()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const applySiteState = (payload) => {
    startTransition(() => {
      setSiteState(normalizeSiteState(payload))
    })
  }

  const navigate = (nextPath) => {
    if (window.location.pathname === nextPath) {
      return
    }

    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  const handleCredentialChange = (event) => {
    const { name, value } = event.target
    setCredentials((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSiteConfigChange = (event) => {
    const { name, value } = event.target

    if (name.startsWith('theme.')) {
      const themeKey = name.replace('theme.', '')
      setSiteConfigDraft((current) => ({
        ...current,
        theme: {
          ...current.theme,
          [themeKey]: value,
        },
      }))
      return
    }

    setSiteConfigDraft((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoginState({
      loading: true,
      error: '',
    })

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? 'Login failed.')
      }

      setSession(payload.session)
      setCredentials(emptyCredentials)
      setLoginState({
        loading: false,
        error: '',
      })
      navigate('/admin')
    } catch (error) {
      setLoginState({
        loading: false,
        error: error.message,
      })
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? 'Logout failed.')
      }

      setSession(payload.session)
      setCmsState({
        loading: false,
        error: '',
        notice: '',
      })
      navigate('/')
    } catch (error) {
      setLoginState((current) => ({
        ...current,
        error: error.message,
      }))
    }
  }

  const handleAddLine = async (event) => {
    event.preventDefault()
    setCmsState({
      loading: true,
      error: '',
      notice: '',
    })

    try {
      const response = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: draft,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? 'The text line could not be saved.')
      }

      applySiteState(payload)
      setDraft('')
      setCmsState({
        loading: false,
        error: '',
        notice: 'The site content was updated and broadcast to all tabs.',
      })
    } catch (error) {
      setCmsState({
        loading: false,
        error: error.message,
        notice: '',
      })
    }
  }

  const handleDeleteLine = async (lineId) => {
    setCmsState({
      loading: true,
      error: '',
      notice: '',
    })

    try {
      const response = await fetch(`/api/content/${lineId}`, {
        method: 'DELETE',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? 'The text line could not be removed.')
      }

      applySiteState(payload)
      setCmsState({
        loading: false,
        error: '',
        notice: 'The selected line was removed everywhere.',
      })
    } catch (error) {
      setCmsState({
        loading: false,
        error: error.message,
        notice: '',
      })
    }
  }

  const handleSaveLook = async (event) => {
    event.preventDefault()
    setCmsState({
      loading: true,
      error: '',
      notice: '',
    })

    try {
      const response = await fetch('/api/site-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(siteConfigDraft),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error ?? 'The site look could not be updated.')
      }

      applySiteState(payload)
      setCmsState({
        loading: false,
        error: '',
        notice: 'The homepage copy and visual style were updated.',
      })
    } catch (error) {
      setCmsState({
        loading: false,
        error: error.message,
        notice: '',
      })
    }
  }

  const renderLines = () => {
    if (siteStateMeta.loading) {
      return <p className="status-copy">Loading the live text board...</p>
    }

    if (siteStateMeta.error) {
      return <p className="status-copy error-copy">{siteStateMeta.error}</p>
    }

    if (siteState.lines.length === 0) {
      return (
        <p className="status-copy">
          No text has been published yet. Add the first line in the CMS.
        </p>
      )
    }

    return (
      <div className="line-stack">
        {siteState.lines.map((line, index) => (
          <article className="line-card" key={line.id}>
            <span className="line-index">{String(index + 1).padStart(2, '0')}</span>
            <p>{line.text}</p>
          </article>
        ))}
      </div>
    )
  }

  const renderChangeLog = () => {
    if (siteState.changes.length === 0) {
      return <p className="support-copy">No site changes have been recorded yet.</p>
    }

    return (
      <div className="change-log">
        {siteState.changes.map((change) => (
          <article className="change-item" key={change.id}>
            <strong>{change.summary}</strong>
            <span>{new Date(change.createdAt).toLocaleString()}</span>
          </article>
        ))}
      </div>
    )
  }

  const themeStyle = buildThemeStyle(siteState.siteConfig)

  return (
    <main className={`app-shell ${isAdminRoute ? 'admin-shell' : ''}`} style={themeStyle}>
      <section className="panel story-panel">
        <div className="story-header">
          <p className="eyebrow">{siteState.siteConfig.heroEyebrow}</p>
          <span className="live-pill">{liveState}</span>
        </div>
        <h1>{siteState.siteConfig.heroTitle}</h1>
        <p className="lede">{siteState.siteConfig.heroDescription}</p>
        {renderLines()}
      </section>

      {isAdminRoute ? (
        <section className="panel side-panel">
          <div className="panel-heading">
            <p className="eyebrow">Admin CMS</p>
            <button className="ghost-button" type="button" onClick={() => navigate('/')}>
              Back to homepage
            </button>
          </div>

          {session.authenticated ? (
            <>
              <div className="welcome-block">
                <h2>Signed in as {session.username}</h2>
                <p>MongoDB stores the published text, the look of the page, and the recent change history.</p>
              </div>

              <form className="editor-form" onSubmit={handleAddLine}>
                <label htmlFor="draft">New text line</label>
                <textarea
                  id="draft"
                  name="draft"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength="220"
                  rows="4"
                  placeholder="Write the next message for the homepage."
                  required
                />
                <div className="form-actions">
                  <button className="primary-button" type="submit" disabled={cmsState.loading}>
                    {cmsState.loading ? 'Saving...' : 'Add line'}
                  </button>
                  <button className="ghost-button" type="button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </form>

              <form className="editor-form" onSubmit={handleSaveLook}>
                <div className="cms-list-heading">
                  <h3>Homepage look and copy</h3>
                  <span>Stored in MongoDB</span>
                </div>
                <label htmlFor="heroEyebrow">Eyebrow</label>
                <input
                  id="heroEyebrow"
                  name="heroEyebrow"
                  type="text"
                  value={siteConfigDraft.heroEyebrow}
                  onChange={handleSiteConfigChange}
                  required
                />
                <label htmlFor="heroTitle">Headline</label>
                <textarea
                  id="heroTitle"
                  name="heroTitle"
                  rows="3"
                  value={siteConfigDraft.heroTitle}
                  onChange={handleSiteConfigChange}
                  required
                />
                <label htmlFor="heroDescription">Description</label>
                <textarea
                  id="heroDescription"
                  name="heroDescription"
                  rows="4"
                  value={siteConfigDraft.heroDescription}
                  onChange={handleSiteConfigChange}
                  required
                />
                <div className="theme-grid">
                  <label>
                    Accent
                    <input
                      name="theme.accent"
                      type="text"
                      value={siteConfigDraft.theme.accent}
                      onChange={handleSiteConfigChange}
                    />
                  </label>
                  <label>
                    Page start
                    <input
                      name="theme.pageBackgroundStart"
                      type="text"
                      value={siteConfigDraft.theme.pageBackgroundStart}
                      onChange={handleSiteConfigChange}
                    />
                  </label>
                  <label>
                    Page end
                    <input
                      name="theme.pageBackgroundEnd"
                      type="text"
                      value={siteConfigDraft.theme.pageBackgroundEnd}
                      onChange={handleSiteConfigChange}
                    />
                  </label>
                  <label>
                    Story glow
                    <input
                      name="theme.storyGlow"
                      type="text"
                      value={siteConfigDraft.theme.storyGlow}
                      onChange={handleSiteConfigChange}
                    />
                  </label>
                  <label>
                    Panel background
                    <input
                      name="theme.panelBackground"
                      type="text"
                      value={siteConfigDraft.theme.panelBackground}
                      onChange={handleSiteConfigChange}
                    />
                  </label>
                  <label>
                    Panel foreground
                    <input
                      name="theme.panelForeground"
                      type="text"
                      value={siteConfigDraft.theme.panelForeground}
                      onChange={handleSiteConfigChange}
                    />
                  </label>
                  <label>
                    Card background
                    <input
                      name="theme.cardBackground"
                      type="text"
                      value={siteConfigDraft.theme.cardBackground}
                      onChange={handleSiteConfigChange}
                    />
                  </label>
                </div>
                <button className="primary-button" type="submit" disabled={cmsState.loading}>
                  {cmsState.loading ? 'Updating...' : 'Save look'}
                </button>
              </form>

              {cmsState.error ? <p className="feedback error-copy">{cmsState.error}</p> : null}
              {cmsState.notice ? <p className="feedback success-copy">{cmsState.notice}</p> : null}

              <div className="cms-list">
                <div className="cms-list-heading">
                  <h3>Published lines</h3>
                  <span>{siteState.lines.length} total</span>
                </div>
                {siteState.lines.map((line) => (
                  <article className="cms-item" key={line.id}>
                    <p>{line.text}</p>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => handleDeleteLine(line.id)}
                      disabled={cmsState.loading}
                    >
                      Delete
                    </button>
                  </article>
                ))}
              </div>

              <div className="cms-list">
                <div className="cms-list-heading">
                  <h3>Recent site changes</h3>
                  <span>{siteState.changes.length} tracked</span>
                </div>
                {renderChangeLog()}
              </div>
            </>
          ) : (
            <div className="locked-card">
              <h2>Please log in first</h2>
              <p>
                Use the homepage login box with <code>admin / admin</code> to open the CMS.
              </p>
              <button className="primary-button" type="button" onClick={() => navigate('/')}>
                Go to login
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="panel side-panel">
          <div className="panel-heading">
            <p className="eyebrow">Login tool</p>
            {session.authenticated ? (
              <button className="ghost-button" type="button" onClick={handleLogout}>
                Logout
              </button>
            ) : null}
          </div>

          {session.authenticated ? (
            <div className="welcome-block">
              <h2>Welcome back, {session.username}</h2>
              <p>
                You are already authenticated. Open the CMS to publish content and adjust
                the live visual theme.
              </p>
              <button className="primary-button" type="button" onClick={() => navigate('/admin')}>
                Open CMS
              </button>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleLogin}>
              <h2>Admin access</h2>
              <p className="support-copy">
                Sign in with the demo credentials to edit the homepage in real time.
              </p>

              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                value={credentials.username}
                onChange={handleCredentialChange}
                autoComplete="username"
                required
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={credentials.password}
                onChange={handleCredentialChange}
                autoComplete="current-password"
                required
              />

              <button className="primary-button" type="submit" disabled={loginState.loading}>
                {loginState.loading ? 'Signing in...' : 'Login'}
              </button>

              <p className="hint-copy">
                Demo account: <code>admin</code> / <code>admin</code>
              </p>
              {loginState.error ? <p className="feedback error-copy">{loginState.error}</p> : null}
            </form>
          )}
        </section>
      )}
    </main>
  )
}

export default App
