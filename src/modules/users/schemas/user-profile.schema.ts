import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserProfileDocument = UserProfile & Document;

@Schema({ timestamps: true, collection: 'user_profiles' })
export class UserProfile {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  user_id!: Types.ObjectId;

  @Prop({ type: String, default: null })
  full_name!: string;

  @Prop({ type: String, default: null })
  gender!: string;

  @Prop({ type: Date, default: null })
  date_of_birth!: Date;

  @Prop({ type: String, default: null })
  avatar_url!: string;

  @Prop({ type: String, default: null })
  banner_url?: string;

  // Extended profile fields (bio, phone, saved vouchers, preferences)
  @Prop({ type: String, default: '' })
  bio?: string;

  @Prop({ type: String, default: '' })
  phone?: string;

  @Prop({
    type: [
      {
        code: { type: String, required: true },
        name: { type: String, default: null },
        discount_amount: { type: Number, default: 0 },
        expires_at: { type: Date, default: null },
        min_order: { type: Number, default: 0 },
        saved_at: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  saved_vouchers?: Array<{
    code: string;
    name?: string;
    discount_amount?: number;
    expires_at?: Date;
    min_order?: number;
    saved_at?: Date;
  }>;

  @Prop({ type: Types.ObjectId, default: null })
  default_phone_id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  default_address_id!: Types.ObjectId;

  @Prop({ type: String, enum: ['vi-VN', 'en-US'], default: 'vi-VN' })
  locale?: string;

  @Prop({
    type: {
      emailAlerts: { type: Boolean, default: true },
      pushAlerts: { type: Boolean, default: true },
      newOrderAlerts: { type: Boolean, default: true },
      cancelOrderAlerts: { type: Boolean, default: true },
    },
    _id: false,
    default: () => ({
      emailAlerts: true,
      pushAlerts: true,
      newOrderAlerts: true,
      cancelOrderAlerts: true,
    }),
  })
  notification_prefs?: {
    emailAlerts: boolean;
    pushAlerts: boolean;
    newOrderAlerts: boolean;
    cancelOrderAlerts: boolean;
  };

  @Prop({
    type: {
      timezone: { type: String, default: 'gmt7' },
      dateFormat: { type: String, default: 'dmy' },
      currency: { type: String, default: 'vnd' },
    },
    _id: false,
    default: () => ({
      timezone: 'gmt7',
      dateFormat: 'dmy',
      currency: 'vnd',
    }),
  })
  regional_prefs?: {
    timezone: string;
    dateFormat: string;
    currency: string;
  };
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);