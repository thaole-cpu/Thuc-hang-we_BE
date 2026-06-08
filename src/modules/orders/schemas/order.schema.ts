import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderStatus } from 'src/common/constants/order-status.constant';
import { PaymentMethod } from 'src/common/constants/payment-method.constant';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true })
  orderCode!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Array, required: true })
  items!: any[];

  @Prop({ default: 0 })
  originalTotal!: number;

  @Prop({ default: 0 })
  shippingFee!: number;

  @Prop({ default: 0 })
  discountAmount!: number;

  @Prop({ type: String, default: null })
  appliedVoucher!: string;

  @Prop({ required: true })
  totalAmount!: number;

  @Prop({ type: Object, required: true })
  shippingAddress!: {
    fullName: string;
    phone: string;
    addressLine: string;
    province: string;
    district: string;
    ward: string;
  };

  @Prop({ type: String, enum: PaymentMethod, required: true })
  paymentMethod!: PaymentMethod;

  @Prop({ type: String })
  note!: string;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Prop({ type: String, default: 'UNPAID' })
  paymentStatus!: string;

  @Prop({ type: String })
  qrUrl!: string;

  @Prop({ type: Date })
  paymentTimeout!: Date;

  @Prop({ type: String })
  cancelReason!: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);