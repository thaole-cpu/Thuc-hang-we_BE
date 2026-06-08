import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  NotificationAudience,
  NotificationCategory,
} from 'src/common/constants/notification.constant';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: NotificationAudience,
    default: NotificationAudience.CUSTOMER,
    index: true,
  })
  audience!: NotificationAudience;

  @Prop({ type: String, enum: NotificationCategory, required: true })
  category!: NotificationCategory;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ default: false })
  isRead!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Order', default: null })
  orderId?: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  orderCode?: string | null;

  @Prop({ type: String, default: null })
  voucherCode?: string | null;

  @Prop({ type: String, default: null })
  discountAmount?: string | null;

  @Prop({ type: String, default: null })
  productName?: string | null;

  @Prop({ type: String, default: null })
  productImage?: string | null;

  @Prop({ type: String, default: null })
  actionText?: string | null;

  @Prop({ type: String, default: null })
  actionLink?: string | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, audience: 1, category: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, audience: 1, isRead: 1 });
