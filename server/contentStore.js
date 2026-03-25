import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const contentPath = path.join(__dirname, 'data', 'content.json')

const defaultLines = [
  {
    id: 'welcome-1',
    text: 'A calm little homepage that can be edited while visitors are still watching.',
    createdAt: '2026-03-25T08:00:00.000Z',
  },
  {
    id: 'welcome-2',
    text: 'Sign in on the right, add a line in the CMS, and every open tab updates automatically.',
    createdAt: '2026-03-25T08:01:00.000Z',
  },
  {
    id: 'welcome-3',
    text: 'This example stores its content on the server so your changes survive a restart.',
    createdAt: '2026-03-25T08:02:00.000Z',
  },
]

export async function ensureContentFile() {
  await mkdir(path.dirname(contentPath), { recursive: true })

  try {
    await readFile(contentPath, 'utf8')
  } catch {
    await writeFile(
      contentPath,
      JSON.stringify({ lines: defaultLines }, null, 2),
      'utf8',
    )
  }
}

export async function readContent() {
  const raw = await readFile(contentPath, 'utf8')
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed.lines)) {
    return { lines: [] }
  }

  return {
    lines: parsed.lines,
  }
}

export async function writeContent(lines) {
  await writeFile(contentPath, JSON.stringify({ lines }, null, 2), 'utf8')
  return { lines }
}
