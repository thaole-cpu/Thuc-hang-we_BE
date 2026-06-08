import { IsOptional, IsString } from 'class-validator';

export class GetRevenueDto {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}