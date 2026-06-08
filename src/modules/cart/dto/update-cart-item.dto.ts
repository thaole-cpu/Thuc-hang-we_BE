import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class UpdateCartItemDto {
  @IsNotEmpty()
  @IsString()
  productId!: string;

  @IsNotEmpty()
  @IsString()
  variantName!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0) // Nếu bằng 0 thì hệ thống tự hiểu là xóa khỏi giỏ
  quantity!: number;
}