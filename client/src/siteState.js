export const defaultSiteConfig = {
  heroEyebrow: 'Live website copy',
  heroTitle: 'Publish small text updates and watch every open tab keep up.',
  heroDescription:
    'The left side is your public homepage. The right side is your access point into a lightweight admin area with live updates.',
  theme: {
    pageBackgroundStart: '#f7efe5',
    pageBackgroundEnd: '#ecdec7',
    accent: '#b55d30',
    storyGlow: 'rgba(188, 119, 74, 0.28)',
    panelBackground: '#1b1d1c',
    panelForeground: '#f5efe5',
    cardBackground: 'rgba(255, 255, 255, 0.64)',
  },
}

export const defaultSiteState = {
  siteConfig: defaultSiteConfig,
  lines: [],
  changes: [],
}

export function normalizeSiteState(payload = {}) {
  return {
    siteConfig: payload.siteConfig ?? defaultSiteConfig,
    lines: payload.lines ?? [],
    changes: payload.changes ?? [],
  }
}

export function buildThemeStyle(siteConfig) {
  return {
    '--page-background-start': siteConfig.theme.pageBackgroundStart,
    '--page-background-end': siteConfig.theme.pageBackgroundEnd,
    '--theme-accent': siteConfig.theme.accent,
    '--story-glow': siteConfig.theme.storyGlow,
    '--panel-background': siteConfig.theme.panelBackground,
    '--panel-foreground': siteConfig.theme.panelForeground,
    '--card-background': siteConfig.theme.cardBackground,
  }
}
