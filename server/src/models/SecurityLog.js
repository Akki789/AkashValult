import mongoose from 'mongoose';

const securityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    identifier: {
      type: String,
      default: null,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'REGISTER_STARTED',
        'REGISTER_VERIFIED',
        'PIN_CREATED',
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'ACCOUNT_LOCKED',
        'LOCKOUT_BLOCKED_ATTEMPT',
        'SESSION_REPLACED',
        'SESSION_REVOKED',
        'REFRESH_TOKEN_REUSE',
        'OTP_SENT',
        'OTP_FAILED',
        'OTP_MAX_ATTEMPTS',
        'PIN_RESET_SUCCESS',
        'LOGOUT',
      ],
      index: true,
    },
    ipAddress: {
      type: String,
      default: 'Unknown',
    },
    userAgent: {
      type: String,
      default: 'Unknown',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

securityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const SecurityLog = mongoose.model('SecurityLog', securityLogSchema);
