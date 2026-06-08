import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendVerifyEmailDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;
}
