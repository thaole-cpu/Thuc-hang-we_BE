import { IsArray, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  VoucherApplyScope,
  VoucherCustomerScope,
  VoucherDiscountType,
  VoucherRepeatType,
  VOUCHER_CODE_REGEX,
} from 'src/common/constants/voucher.constant';

export class CreateVoucherDto {
  @IsNotEmpty()
  @IsString()
  @Matches(VOUCHER_CODE_REGEX, { message: 'Mã voucher chỉ được chứa chữ hoa, số và dấu gạch dưới.' })
  voucherCode!: string;

  @IsNotEmpty()
  @IsString()
  voucherName!: string;

  @IsEnum(VoucherCustomerScope)
  customerScope!: VoucherCustomerScope;

  @IsEnum(VoucherDiscountType)
  discountType!: VoucherDiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsEnum(VoucherApplyScope)
  applyScope!: VoucherApplyScope;

  @IsDateString()
  startDate!: Date;

  @IsDateString()
  endDate!: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Giờ bắt đầu phải ở định dạng HH:mm.' })
  goldenHourStart?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Giờ kết thúc phải ở định dạng HH:mm.' })
  goldenHourEnd?: string;

  @IsEnum(VoucherRepeatType)
  repeatType!: VoucherRepeatType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  repeatDays?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  applicableProductIds?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}