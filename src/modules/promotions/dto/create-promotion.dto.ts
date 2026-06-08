import { IsArray, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PromotionApplyScope, PromotionDiscountType } from 'src/common/constants/promotion.constant';

export class CreatePromotionDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(PromotionDiscountType)
  discountType!: PromotionDiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountValue!: number;

  @IsEnum(PromotionApplyScope)
  applyScope!: PromotionApplyScope;

  @IsDateString()
  startDate!: Date;

  @IsDateString()
  endDate!: Date;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  applicableProductIds?: string[];
}