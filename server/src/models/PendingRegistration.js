import mongoose from 'mongoose';

const pendingRegistrationSchema = new mongoose.Schema(
  {
    surname: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['email', 'phone'],
      required: true,
    },
    email: {
      type: String,
      trim: true,
    },
    normalizedEmail: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    normalizedPhoneNumber: {
      type: String,
      trim: true,
      index: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    lastOtpSentAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingRegistration = mongoose.model(
  'PendingRegistration',
  pendingRegistrationSchema
);
