import { describe, expect, it } from 'vitest'
import {
  buildThemeStyle,
  defaultSiteConfig,
  normalizeSiteState,
} from './siteState.js'

describe('siteState helpers', () => {
  it('normalizes partial payloads into a consistent site state object', () => {
    const normalized = normalizeSiteState({
      lines: [{ id: 'line-1', text: 'Stored in MongoDB' }],
    })

    expect(normalized.siteConfig.heroTitle).toBe(defaultSiteConfig.heroTitle)
    expect(normalized.lines).toHaveLength(1)
    expect(normalized.changes).toEqual([])
  })

  it('builds CSS custom properties from the stored theme', () => {
    const style = buildThemeStyle(defaultSiteConfig)

    expect(style['--theme-accent']).toBe('#b55d30')
    expect(style['--panel-background']).toBe('#1b1d1c')
  })
})
