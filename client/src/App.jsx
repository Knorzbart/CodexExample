import { startTransition, useEffect, useState } from 'react'
import './App.css'

const emptyCredentials = {
  username: '',
  password: '',
}

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const [lines, setLines] = useState([])
  const [credentials, setCredentials] = useState(emptyCredentials)
  const [draft, setDraft] = useState('')
  const [session, setSession] = useState({
    authenticated: false,
    username: '',
  })
  const [loginState, setLoginState] = useState({
    loading: false,
    error: '',
  })
  const [cmsState, setCmsState] = useState({
    loading: false,
    error: '',
    notice: '',
  })
  const [contentState, setContentState] = useState({
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
    let ignore = false

    const loadContent = async ({ showLoading = false } = {}) => {
      if (showLoading) {
        setContentState((current) => ({
          ...current,
          loading: true,
          error: '',
        }))
      }

      try {
        const response = await fetch('/api/content')
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error ?? 'The homepage content could not be loaded.')
        }

        if (!ignore) {
          startTransition(() => {
            setLines(payload.lines ?? [])
          })
          setContentState({
            loading: false,
            error: '',
          })
        }
      } catch (error) {
        if (!ignore) {
          setContentState({
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

    loadContent({ showLoading: true })
    loadSession()

    const stream = new EventSource('/api/stream')
    stream.addEventListener('content-updated', () => {
      loadContent()
    })

    return () => {
      ignore = true
      stream.close()
    }
  }, [])

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

      startTransition(() => {
        setLines(payload.lines ?? [])
      })
      setDraft('')
      setCmsState({
        loading: false,
        error: '',
        notice: 'The main page was updated live.',
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

      startTransition(() => {
        setLines(payload.lines ?? [])
      })
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

  const renderLines = () => {
    if (contentState.loading) {
      return <p className="status-copy">Loading the live text board…</p>
    }

    if (contentState.error) {
      return <p className="status-copy error-copy">{contentState.error}</p>
    }

    if (lines.length === 0) {
      return (
        <p className="status-copy">
          No text has been published yet. Add the first line in the CMS.
        </p>
      )
    }

    return (
      <div className="line-stack">
        {lines.map((line, index) => (
          <article className="line-card" key={line.id}>
            <span className="line-index">{String(index + 1).padStart(2, '0')}</span>
            <p>{line.text}</p>
          </article>
        ))}
      </div>
    )
  }

  return (
    <main className={`app-shell ${isAdminRoute ? 'admin-shell' : ''}`}>
      <section className="panel story-panel">
        <p className="eyebrow">Live website copy</p>
        <h1>Publish small text updates and watch every open tab keep up.</h1>
        <p className="lede">
          The left side is your public homepage. The right side is your access point
          into a lightweight admin area with live updates.
        </p>
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
                <p>
                  Add a line below and every connected homepage will refresh
                  automatically.
                </p>
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
                    {cmsState.loading ? 'Saving…' : 'Add line'}
                  </button>
                  <button className="ghost-button" type="button" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </form>

              {cmsState.error ? <p className="feedback error-copy">{cmsState.error}</p> : null}
              {cmsState.notice ? <p className="feedback success-copy">{cmsState.notice}</p> : null}

              <div className="cms-list">
                <div className="cms-list-heading">
                  <h3>Published lines</h3>
                  <span>{lines.length} total</span>
                </div>
                {lines.map((line) => (
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
                You are already authenticated. Open the CMS to publish a new line to the
                homepage.
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
                {loginState.loading ? 'Signing in…' : 'Login'}
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
