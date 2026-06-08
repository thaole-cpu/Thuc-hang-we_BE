import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, uppercase: true, default: 'GEN' })
  code!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop({ default: '' })
  description: string = '';

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ default: true })
  isActive!: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
CategorySchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
CategorySchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);