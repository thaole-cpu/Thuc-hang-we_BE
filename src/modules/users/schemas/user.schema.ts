import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  password!: string;

  @Prop({ default: 'User' })
  name!: string;

  @Prop({ type: [String], default: ['USER'] })
  roles!: string[];

  @Prop({ default: false })
  isEmailVerified!: boolean;

  @Prop({ enum: ['active', 'blocked'], default: 'active' })
  status!: 'active' | 'blocked';
}

export const UserSchema = SchemaFactory.createForClass(User);
