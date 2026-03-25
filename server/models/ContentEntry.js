import mongoose from 'mongoose'

const contentEntrySchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

export const ContentEntry =
  mongoose.models.ContentEntry ??
  mongoose.model('ContentEntry', contentEntrySchema)
