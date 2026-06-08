import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RefreshTokenDocument =
  HydratedDocument<RefreshToken>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class RefreshToken {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
  })
  token: string;

  @Prop({
    required: true,
    index: true,
  })
  expiresAt: Date;

  @Prop({
    default: false,
  })
  revoked: boolean;
}

export const RefreshTokenSchema =
  SchemaFactory.createForClass(RefreshToken);