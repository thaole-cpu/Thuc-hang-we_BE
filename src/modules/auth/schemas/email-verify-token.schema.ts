import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EmailVerifyTokenDocument =
  HydratedDocument<EmailVerifyToken>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class EmailVerifyToken {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

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

export const EmailVerifyTokenSchema =
  SchemaFactory.createForClass(EmailVerifyToken);