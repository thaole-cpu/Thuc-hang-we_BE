import { IsOptional, IsString } from 'class-validator';

export class ListOrdersDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}