import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    surname: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      trim: true,
    },
    normalizedEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    normalizedPhoneNumber: {
      type: String,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    pinHash: {
      type: String,
      select: false,
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    activeSessionId: {
      type: String,
      default: null,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.pinHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret.pinHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index(
  { normalizedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: { normalizedEmail: { $type: 'string' } },
  }
);

userSchema.index(
  { normalizedPhoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { normalizedPhoneNumber: { $type: 'string' } },
  }
);

userSchema.methods.toSafeProfile = function toSafeProfile() {
  return {
    id: String(this._id),
    surname: this.surname,
    email: this.normalizedEmail || null,
    phoneNumber: this.normalizedPhoneNumber || null,
    dateOfBirth: this.dateOfBirth ? this.dateOfBirth.toISOString().slice(0, 10) : null,
    emailVerified: Boolean(this.emailVerified),
    phoneVerified: Boolean(this.phoneVerified),
    hasPin: Boolean(this.pinHash),
    isActive: Boolean(this.isActive),
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
