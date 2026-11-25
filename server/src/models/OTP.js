import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pendingRegistrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PendingRegistration',
      default: null,
    },
    target: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['email', 'phone'],
      required: true,
    },
    purpose: {
      type: String,
      enum: ['REGISTER', 'RESET_PIN'],
      required: true,
    },
    hashedOTP: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    invalidatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index({ target: 1, purpose: 1, consumedAt: 1, invalidatedAt: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model('OTP', otpSchema);
