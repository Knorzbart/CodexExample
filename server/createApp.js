import 'dotenv/config'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import mongoose from 'mongoose'
import { connectToDatabase, getMongoUrl } from './db.js'
import {
  createContentLine,
  deleteContentLine,
  ensureSeedData,
  getSiteState,
  updateSiteConfig,
} from './contentStore.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist')

const isAuthenticated = (req) => req.session?.authenticated === true

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export async function createApp() {
  const adminUser = process.env.ADMIN_USER ?? 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin'
  const sessionSecret = process.env.SESSION_SECRET ?? crypto.randomUUID()
  const sessionStore = MongoStore.create({
    mongoUrl: getMongoUrl(),
    ttl: 60 * 60 * 8,
    autoRemove: 'interval',
    autoRemoveInterval: 10,
  })

  await connectToDatabase()
  await ensureSeedData()

  const app = express()
  const clients = new Set()

  app.set('trust proxy', 1)
  app.use(express.json())
  app.use(
    session({
      store: sessionStore,
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

  const broadcastSiteUpdate = (siteState) => {
    for (const client of clients) {
      writeSseEvent(client, 'site-updated', {
        updatedAt: new Date().toISOString(),
        lineCount: siteState.lines.length,
      })
    }
  }

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mongoReadyState: mongoose.connection.readyState,
    })
  })

  app.get('/healthz', (_req, res) => {
    res.status(200).send('ok')
  })

  app.get('/api/site-state', async (_req, res) => {
    const siteState = await getSiteState()
    res.json(siteState)
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

    try {
      const siteState = await createContentLine(req.body?.text, req.session.username)
      broadcastSiteUpdate(siteState)
      return res.status(201).json(siteState)
    } catch (error) {
      return res.status(error.message.includes('does not exist') ? 404 : 400).json({
        error: error.message,
      })
    }
  })

  app.delete('/api/content/:lineId', async (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({
        error: 'Please log in as admin before editing content.',
      })
    }

    try {
      const siteState = await deleteContentLine(req.params.lineId, req.session.username)
      broadcastSiteUpdate(siteState)
      return res.json(siteState)
    } catch (error) {
      return res.status(error.message.includes('does not exist') ? 404 : 400).json({
        error: error.message,
      })
    }
  })

  app.put('/api/site-config', async (req, res) => {
    if (!isAuthenticated(req)) {
      return res.status(401).json({
        error: 'Please log in as admin before editing content.',
      })
    }

    try {
      const siteState = await updateSiteConfig(req.body, req.session.username)
      broadcastSiteUpdate(siteState)
      return res.json(siteState)
    } catch (error) {
      return res.status(400).json({
        error: error.message,
      })
    }
  })

  app.get('/api/stream', (_req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    res.write('retry: 2000\n\n')
    writeSseEvent(res, 'connected', { ok: true })
    clients.add(res)

    const heartbeat = setInterval(() => {
      res.write(': keepalive\n\n')
    }, 15000)

    res.on('close', () => {
      clearInterval(heartbeat)
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

  return app
}
