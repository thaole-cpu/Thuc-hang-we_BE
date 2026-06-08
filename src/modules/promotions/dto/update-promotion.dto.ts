import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionDto } from './create-promotion.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { PromotionStatus } from 'src/common/constants/promotion.constant';

export class UpdatePromotionDto extends PartialType(CreatePromotionDto) {
  @IsOptional()
  @IsEnum(PromotionStatus)
  status?: PromotionStatus;
}