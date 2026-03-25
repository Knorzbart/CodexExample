import 'dotenv/config'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import { ensureContentFile, readContent, writeContent } from './contentStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const clients = new Set()

const port = Number(process.env.PORT ?? 3001)
const adminUser = process.env.ADMIN_USER ?? 'admin'
const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'
const sessionSecret = process.env.SESSION_SECRET ?? crypto.randomUUID()
const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist')

app.use(express.json())
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
)

const isAuthenticated = (req) => req.session?.authenticated === true

const broadcastContentUpdate = (lines) => {
  const payload = `event: content-updated\ndata: ${JSON.stringify({
    count: lines.length,
    updatedAt: new Date().toISOString(),
  })}\n\n`

  for (const client of clients) {
    client.write(payload)
  }
}

app.get('/api/content', async (_req, res) => {
  const content = await readContent()
  res.json(content)
})

app.get('/api/session', (req, res) => {
  res.json({
    session: {
      authenticated: isAuthenticated(req),
      username: req.session?.username ?? '',
    },
  })
})

app.post('/api/login', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')

  if (username !== adminUser || password !== adminPassword) {
    return res.status(401).json({
      error: 'Invalid username or password.',
    })
  }

  req.session.authenticated = true
  req.session.username = username

  return res.json({
    session: {
      authenticated: true,
      username,
    },
  })
})

app.post('/api/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        error: 'The session could not be cleared.',
      })
    }

    return res.json({
      session: {
        authenticated: false,
        username: '',
      },
    })
  })
})

app.post('/api/content', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({
      error: 'Please log in as admin before editing content.',
    })
  }

  const text = String(req.body?.text ?? '').trim()

  if (!text) {
    return res.status(400).json({
      error: 'A text line is required.',
    })
  }

  if (text.length > 220) {
    return res.status(400).json({
      error: 'Please keep each text line under 220 characters.',
    })
  }

  const current = await readContent()
  const nextLines = [
    {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    },
    ...current.lines,
  ]

  const saved = await writeContent(nextLines)
  broadcastContentUpdate(saved.lines)

  return res.status(201).json(saved)
})

app.delete('/api/content/:lineId', async (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({
      error: 'Please log in as admin before editing content.',
    })
  }

  const current = await readContent()
  const nextLines = current.lines.filter((line) => line.id !== req.params.lineId)

  if (nextLines.length === current.lines.length) {
    return res.status(404).json({
      error: 'The requested text line does not exist.',
    })
  }

  const saved = await writeContent(nextLines)
  broadcastContentUpdate(saved.lines)

  return res.json(saved)
})

app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  res.write('event: connected\ndata: {"ok":true}\n\n')
  clients.add(res)

  req.on('close', () => {
    clients.delete(res)
  })
})

app.use(express.static(clientDistPath))

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    next()
    return
  }

  res.sendFile(path.join(clientDistPath, 'index.html'))
})

await ensureContentFile()

app.listen(port, () => {
  console.log(`Live CMS example running on http://localhost:${port}`)
})
