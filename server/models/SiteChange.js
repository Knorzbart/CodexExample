import mongoose from 'mongoose'

const siteChangeSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      required: true,
      trim: true,
    },
    actor: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

export const SiteChange =
  mongoose.models.SiteChange ?? mongoose.model('SiteChange', siteChangeSchema)
