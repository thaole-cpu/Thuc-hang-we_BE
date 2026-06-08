import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VoucherUsageDocument = VoucherUsage & Document;

@Schema({ timestamps: true })
export class VoucherUsage {
  @Prop({ type: Types.ObjectId, ref: 'Voucher', required: true })
  voucherId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  voucherCode!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true })
  discountAmount!: number;
}

export const VoucherUsageSchema = SchemaFactory.createForClass(VoucherUsage);