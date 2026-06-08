import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserAddressDocument = UserAddress & Document;

@Schema({
  timestamps: true,
  collection: 'user_addresses',
})
export class UserAddress {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  user_id!: Types.ObjectId;

  @Prop({ type: String, default: null })
  label!: string;

  @Prop({ type: String, required: true })
  receiver_name!: string;

  @Prop({ type: String, required: true })
  receiver_phone_e164!: string;

  @Prop({ type: String, required: true })
  country_id!: string;

  @Prop({ type: String, required: true })
  country_name!: string;

  @Prop({ type: String, required: true })
  province_id!: string;

  @Prop({ type: String, required: true })
  province_name!: string;

  @Prop({ type: String, required: true })
  district_id!: string;

  @Prop({ type: String, required: true })
  district_name!: string;

  @Prop({ type: String, required: true })
  ward_id!: string;

  @Prop({ type: String, required: true })
  ward_name!: string;

  @Prop({ type: String, required: true })
  address_line!: string;

  @Prop({ type: String, default: null })
  postal_code!: string;

  @Prop({ type: String, default: null })
  delivery_note!: string;

  @Prop({ type: Boolean, default: false })
  is_default!: boolean;

  @Prop({ type: String, default: 'active' })
  status!: string;

  @Prop({ type: Date, default: null })
  deleted_at!: Date;
}

export const UserAddressSchema = SchemaFactory.createForClass(UserAddress);