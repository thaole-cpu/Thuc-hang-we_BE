import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { VoucherStatus, VoucherCustomerScope, VoucherDiscountType, VoucherApplyScope, VoucherRepeatType } from 'src/common/constants/voucher.constant';

export type VoucherDocument = Voucher & Document;

@Schema({ timestamps: true, collection: 'vouchers' })
export class Voucher {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  voucherCode!: string;

  @Prop({ required: true })
  voucherName!: string;

  @Prop({ required: true, enum: VoucherStatus, default: VoucherStatus.DRAFT })
  status!: VoucherStatus;

  @Prop({ required: true, enum: VoucherCustomerScope, default: VoucherCustomerScope.ALL_CUSTOMERS })
  customerScope!: VoucherCustomerScope;

  @Prop({ required: true, enum: VoucherDiscountType })
  discountType!: VoucherDiscountType;

  @Prop({ required: true, type: Number, min: 0 })
  discountValue!: number;

  @Prop({ required: true, enum: VoucherApplyScope })
  applyScope!: VoucherApplyScope;

  @Prop({ required: true })
  startDate!: Date;

  @Prop({ required: true })
  endDate!: Date;

  @Prop({ required: false })
  goldenHourStart?: string;

  @Prop({ required: false })
  goldenHourEnd?: string;

  @Prop({ required: true, enum: VoucherRepeatType, default: VoucherRepeatType.NONE })
  repeatType!: VoucherRepeatType;

  @Prop({ type: [String], default: [] })
  repeatDays?: string[];

  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] })
  applicableProductIds?: Types.ObjectId[];

  @Prop({ type: Number, min: 0, default: 0 })
  minOrderValue?: number;

  @Prop({ type: Number, min: 0 })
  usageLimit?: number;

  @Prop({ default: '' })
  description?: string;
}

export const VoucherSchema = SchemaFactory.createForClass(Voucher);