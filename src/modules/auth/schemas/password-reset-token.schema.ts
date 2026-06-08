import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PasswordResetTokenDocument =
  HydratedDocument<PasswordResetToken>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class PasswordResetToken {
  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email!: string;

  @Prop({
    required: true,
    index: true,
  })
  code!: string;

  @Prop({
    required: true,
    index: true,
  })
  expiresAt!: Date;

  @Prop({
    default: false,
  })
  used!: boolean;
}

export const PasswordResetTokenSchema =
  SchemaFactory.createForClass(PasswordResetToken);