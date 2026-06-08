import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SkinTypeDocument = SkinType & Document;

@Schema({ timestamps: true })
export class SkinType {
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

export const SkinTypeSchema = SchemaFactory.createForClass(SkinType);

SkinTypeSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
SkinTypeSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
SkinTypeSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
