import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  PromotionStatus,
  PromotionApplyScope,
  PromotionDiscountType,
} from 'src/common/constants/promotion.constant';

export type PromotionDocument = Promotion & Document;

@Schema({ timestamps: true, collection: 'promotions' })
export class Promotion {
  @Prop({ required: true })
  name!: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ required: true, enum: PromotionStatus, default: PromotionStatus.DRAFT })
  status!: PromotionStatus;

  @Prop({ required: true, enum: PromotionDiscountType })
  discountType!: PromotionDiscountType;

  @Prop({ required: true, type: Number, min: 0 })
  discountValue!: number;

  @Prop({ required: true, enum: PromotionApplyScope })
  applyScope!: PromotionApplyScope;

  @Prop({ required: true })
  startDate!: Date;

  @Prop({ required: true })
  endDate!: Date;

  @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] })
  applicableProductIds!: Types.ObjectId[];
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);