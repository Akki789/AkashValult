import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    previousRefreshTokenHashes: {
      type: [String],
      default: [],
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      enum: [
        null,
        'REPLACED_BY_NEW_LOGIN',
        'LOGOUT',
        'TOKEN_REUSE_DETECTED',
        'PIN_RESET',
        'EXPIRED',
      ],
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    deviceInfo: {
      userAgent: { type: String, default: 'Unknown' },
      ipAddress: { type: String, default: 'Unknown' },
      deviceLabel: { type: String, default: 'Web Browser' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.refreshTokenHash;
        delete ret.previousRefreshTokenHashes;
        delete ret.__v;
        return ret;
      },
    },
  }
);

sessionSchema.index({ userId: 1, revokedAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema);
