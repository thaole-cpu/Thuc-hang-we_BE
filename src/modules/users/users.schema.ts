import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })
export class User {
  @Prop({ required: true, unique: true, index: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  password_hash!: string;

  @Prop() full_name?: string;
  @Prop() phone?: string;

  @Prop({
    type: [
      {
        label: { type: String },
        address_line: { type: String },
        province: { type: String },
        district: { type: String },
        ward: { type: String },
        is_default: { type: Boolean, default: false },
      },
    ],
    default: [],
  })
  addresses?: any[];

  @Prop({ enum: ['active', 'blocked'], default: 'active' })
  status!: 'active' | 'blocked';

  @Prop({ default: false })
  email_verified?: boolean;

  @Prop() email_verified_at?: Date;

  @Prop({
    type: [
      {
        provider: { type: String }, // 'google'
        provider_id: { type: String },
      },
    ],
    default: [],
  })
  auth_providers?: { provider: string; provider_id: string }[];
}

export const UserSchema = SchemaFactory.createForClass(User);
