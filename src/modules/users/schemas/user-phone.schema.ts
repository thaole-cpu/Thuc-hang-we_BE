import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserPhoneDocument = HydratedDocument<UserPhone>;

@Schema({
  timestamps: true,
  versionKey: false,
  collection: 'user_phones',
})
export class UserPhone {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user_id!: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  region_code!: string; // VD: VN

  @Prop({ required: true, trim: true })
  country_calling_code!: string; // VD: +84

  @Prop({ required: true, trim: true })
  national_number!: string; // VD: 901234567

  @Prop({ required: true, trim: true, index: true })
  full_phone_e164!: string; // VD: +84901234567

  @Prop({ trim: true, enum: ['personal', 'shipping', 'work'], default: 'personal' })
  phone_type!: 'personal' | 'shipping' | 'work';

  @Prop({ default: false })
  is_default!: boolean;

  @Prop({ default: false })
  is_verified!: boolean;

  @Prop({ trim: true, enum: ['active', 'inactive'], default: 'active' })
  status!: 'active' | 'inactive';
}

export const UserPhoneSchema = SchemaFactory.createForClass(UserPhone);

UserPhoneSchema.index({ user_id: 1, full_phone_e164: 1 }, { unique: true });
UserPhoneSchema.index(
  { user_id: 1, is_default: 1 },
  {
    partialFilterExpression: { is_default: true, status: 'active' },
    unique: true,
  },
);