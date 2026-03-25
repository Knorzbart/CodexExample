import { defaultLines, defaultSiteConfig } from './config/defaultSite.js'
import { ContentEntry } from './models/ContentEntry.js'
import { SiteChange } from './models/SiteChange.js'
import { SiteConfig } from './models/SiteConfig.js'

function toLine(line) {
  return {
    id: line._id.toString(),
    text: line.text,
    createdAt: line.createdAt.toISOString(),
  }
}

function toChange(change) {
  return {
    id: change._id.toString(),
    actionType: change.actionType,
    actor: change.actor,
    summary: change.summary,
    createdAt: change.createdAt.toISOString(),
  }
}

function sanitizeSiteConfigInput(input) {
  return {
    heroEyebrow: String(input.heroEyebrow ?? '').trim(),
    heroTitle: String(input.heroTitle ?? '').trim(),
    heroDescription: String(input.heroDescription ?? '').trim(),
    theme: {
      pageBackgroundStart: String(input.theme?.pageBackgroundStart ?? '').trim(),
      pageBackgroundEnd: String(input.theme?.pageBackgroundEnd ?? '').trim(),
      accent: String(input.theme?.accent ?? '').trim(),
      storyGlow: String(input.theme?.storyGlow ?? '').trim(),
      panelBackground: String(input.theme?.panelBackground ?? '').trim(),
      panelForeground: String(input.theme?.panelForeground ?? '').trim(),
      cardBackground: String(input.theme?.cardBackground ?? '').trim(),
    },
  }
}

async function recordChange(actionType, summary, payload, actor = 'system') {
  await SiteChange.create({
    actionType,
    actor,
    summary,
    payload,
  })
}

export async function ensureSeedData() {
  const configCount = await SiteConfig.countDocuments()
  if (configCount === 0) {
    await SiteConfig.create({
      key: 'primary',
      ...defaultSiteConfig,
    })
    await recordChange('seeded-site-config', 'Created the initial site configuration.', {})
  }

  const lineCount = await ContentEntry.countDocuments()
  if (lineCount === 0) {
    await ContentEntry.insertMany(defaultLines)
    await recordChange('seeded-content', 'Created the initial homepage text lines.', {})
  }
}

export async function getSiteState() {
  const [siteConfig, lines, changes] = await Promise.all([
    SiteConfig.findOne({ key: 'primary' }).lean(),
    ContentEntry.find().sort({ createdAt: -1 }).lean(),
    SiteChange.find().sort({ createdAt: -1 }).limit(12).lean(),
  ])

  return {
    siteConfig: siteConfig
      ? {
          heroEyebrow: siteConfig.heroEyebrow,
          heroTitle: siteConfig.heroTitle,
          heroDescription: siteConfig.heroDescription,
          theme: siteConfig.theme,
        }
      : defaultSiteConfig,
    lines: lines.map(toLine),
    changes: changes.map(toChange),
  }
}

export async function createContentLine(text, actor = 'admin') {
  const normalizedText = String(text ?? '').trim()

  if (!normalizedText) {
    throw new Error('A text line is required.')
  }

  if (normalizedText.length > 220) {
    throw new Error('Please keep each text line under 220 characters.')
  }

  await ContentEntry.create({
    text: normalizedText,
  })
  await recordChange('created-line', `Added a homepage line: "${normalizedText}"`, { text: normalizedText }, actor)

  return getSiteState()
}

export async function deleteContentLine(lineId, actor = 'admin') {
  const deleted = await ContentEntry.findByIdAndDelete(lineId)

  if (!deleted) {
    throw new Error('The requested text line does not exist.')
  }

  await recordChange('deleted-line', `Removed a homepage line: "${deleted.text}"`, { id: lineId }, actor)
  return getSiteState()
}

export async function updateSiteConfig(input, actor = 'admin') {
  const sanitized = sanitizeSiteConfigInput(input)

  if (!sanitized.heroEyebrow || !sanitized.heroTitle || !sanitized.heroDescription) {
    throw new Error('Hero copy fields cannot be empty.')
  }

  for (const value of Object.values(sanitized.theme)) {
    if (!value) {
      throw new Error('All theme values are required.')
    }
  }

  await SiteConfig.findOneAndUpdate(
    { key: 'primary' },
    {
      $set: sanitized,
    },
    {
      upsert: true,
      new: true,
    },
  )

  await recordChange(
    'updated-site-config',
    'Updated the homepage copy and visual theme.',
    sanitized,
    actor,
  )

  return getSiteState()
}
