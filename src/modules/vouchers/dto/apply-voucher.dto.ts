import { IsArray, IsBoolean, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { VoucherCustomerScope } from 'src/common/constants/voucher.constant';

export class ApplyVoucherDto {
  @IsNotEmpty()
  @IsString()
  voucherCode!: string;

  @IsOptional()
  @IsEnum(VoucherCustomerScope)
  customerScope?: VoucherCustomerScope;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  productIds?: string[];

  @IsOptional()
  @IsBoolean()
  hasDirectDiscount?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cartTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  eligibleCartTotal?: number;
}