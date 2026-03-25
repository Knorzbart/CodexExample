import mongoose from 'mongoose'

const siteConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'primary',
    },
    heroEyebrow: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    heroTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    heroDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    theme: {
      pageBackgroundStart: { type: String, required: true, trim: true },
      pageBackgroundEnd: { type: String, required: true, trim: true },
      accent: { type: String, required: true, trim: true },
      storyGlow: { type: String, required: true, trim: true },
      panelBackground: { type: String, required: true, trim: true },
      panelForeground: { type: String, required: true, trim: true },
      cardBackground: { type: String, required: true, trim: true },
    },
  },
  {
    timestamps: true,
  },
)

export const SiteConfig =
  mongoose.models.SiteConfig ?? mongoose.model('SiteConfig', siteConfigSchema)
