import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { disconnectFromDatabase } from '../db.js'
import { ensureSeedData } from '../contentStore.js'
import { ContentEntry } from '../models/ContentEntry.js'
import { SiteChange } from '../models/SiteChange.js'
import { SiteConfig } from '../models/SiteConfig.js'

let mongoServer
let app
let createApp

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongoServer.getUri('codexexample-test')
  process.env.ADMIN_USER = 'admin'
  process.env.ADMIN_PASSWORD = 'admin'
  process.env.SESSION_SECRET = 'test-session-secret'

  ;({ createApp } = await import('../createApp.js'))
  app = await createApp()
})

beforeEach(async () => {
  await Promise.all([
    ContentEntry.deleteMany({}),
    SiteConfig.deleteMany({}),
    SiteChange.deleteMany({}),
  ])
  await ensureSeedData()
})

afterAll(async () => {
  await disconnectFromDatabase()
  await mongoServer.stop()
})

describe('site application', () => {
  it('returns the seeded site state', async () => {
    const response = await request(app).get('/api/site-state')

    expect(response.status).toBe(200)
    expect(response.body.lines).toHaveLength(3)
    expect(response.body.siteConfig.heroTitle).toContain('Publish small text updates')
    expect(response.body.changes.length).toBeGreaterThan(0)
  })

  it('allows an admin session to create and remove content lines', async () => {
    const agent = request.agent(app)

    await agent.post('/api/login').send({
      username: 'admin',
      password: 'admin',
    })

    const createResponse = await agent.post('/api/content').send({
      text: 'Mongo-backed line from the test suite',
    })

    expect(createResponse.status).toBe(201)
    expect(createResponse.body.lines[0].text).toBe('Mongo-backed line from the test suite')

    const lineId = createResponse.body.lines[0].id
    const deleteResponse = await agent.delete(`/api/content/${lineId}`)

    expect(deleteResponse.status).toBe(200)
    expect(deleteResponse.body.lines.map((line) => line.text)).not.toContain(
      'Mongo-backed line from the test suite',
    )
  })

  it('stores editable look-and-feel changes in MongoDB', async () => {
    const agent = request.agent(app)

    await agent.post('/api/login').send({
      username: 'admin',
      password: 'admin',
    })

    const response = await agent.put('/api/site-config').send({
      heroEyebrow: 'Configured in tests',
      heroTitle: 'The database stores the visual layout too',
      heroDescription: 'This title and palette are now persisted in MongoDB.',
      theme: {
        pageBackgroundStart: '#101828',
        pageBackgroundEnd: '#1d2939',
        accent: '#f97316',
        storyGlow: 'rgba(249, 115, 22, 0.28)',
        panelBackground: '#0f172a',
        panelForeground: '#f8fafc',
        cardBackground: 'rgba(255,255,255,0.72)',
      },
    })

    expect(response.status).toBe(200)
    expect(response.body.siteConfig.heroEyebrow).toBe('Configured in tests')
    expect(response.body.siteConfig.theme.accent).toBe('#f97316')
  })

  it('streams a live update event after content changes', async () => {
    const server = app.listen(0)
    const address = server.address()
    const streamUrl = `http://127.0.0.1:${address.port}/api/stream`

    const response = await fetch(streamUrl)
    const reader = response.body.getReader()

    const readUntil = async (fragment) => {
      const timeoutAt = Date.now() + 10000
      let output = ''

      while (Date.now() < timeoutAt) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        output += Buffer.from(value).toString('utf8')
        if (output.includes(fragment)) {
          return output
        }
      }

      throw new Error(`Timed out waiting for ${fragment}`)
    }

    await readUntil('event: connected')

    const agent = request.agent(app)
    await agent.post('/api/login').send({
      username: 'admin',
      password: 'admin',
    })
    await agent.post('/api/content').send({
      text: 'This line should trigger the stream event',
    })

    const eventPayload = await readUntil('event: site-updated')
    expect(eventPayload).toContain('event: site-updated')

    reader.cancel()
    await new Promise((resolve) => {
      server.close(resolve)
    })
  })
})
