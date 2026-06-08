import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false, timestamps: false })
export class ProductVariant {
  @Prop({ required: true })
  variantName!: string;

  @Prop({ required: true, min: 0 })
  priceImport!: number;

  @Prop({ required: true, min: 0 })
  priceSell!: number;

  @Prop({ required: true, min: 0 })
  stockQty!: number;

  // Lượng hàng tạm giữ khi khách đang ở màn hình QR thanh toán
  @Prop({ default: 0, min: 0 })
  reservedQty!: number;

  @Prop({ default: 0 })
  stockAlert!: number;

  @Prop({ required: true })
  weight!: number;

  @Prop({ default: 0 })
  profit!: number;
}

export type ProductDocument = Product & Document;

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, index: true })
  name!: string;

  @Prop({ required: true, index: true })
  sku!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  category!: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'SkinType' }], default: [] })
  skinTypes!: Types.ObjectId[];

  @Prop({ required: true })
  mainImage!: string;

  @Prop({ type: [String], default: [] })
  galleryImages!: string[];

  @Prop({ default: '' })
  description!: string;

  @Prop({ default: '' })
  detailInfo!: string;

  @Prop({ type: [ProductVariant], default: [] })
  variants!: ProductVariant[];

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isDeleted!: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
ProductSchema.index({ name: 'text', description: 'text' });

ProductSchema.index(
  { sku: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
ProductSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);