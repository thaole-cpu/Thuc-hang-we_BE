import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class SaveVoucherDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discount_amount?: number;

  @IsOptional()
  @IsString()
  expires_at?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  min_order?: number;
}
