import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from 'src/common/constants/roles.constant';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({
    required: false,
    select: false,
  })
  password?: string;

  @Prop({
    default: false,
  })
  isEmailVerified!: boolean;

  @Prop({
    type: [String],
    enum: Object.values(Role),
    default: [Role.USER],
  })
  roles!: Role[];

  @Prop({ default: null })
  googleId?: string;

  @Prop({ default: '' })
  fullName?: string;

  @Prop({ enum: ['active', 'blocked'], default: 'active' })
  status?: 'active' | 'blocked';
}

export const UserSchema = SchemaFactory.createForClass(User);

