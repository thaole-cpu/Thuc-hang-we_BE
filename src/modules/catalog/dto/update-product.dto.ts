import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto, ProductVariantDto } from './create-product.dto';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVariantDto extends PartialType(ProductVariantDto) {}

// Tách riêng không extends để tránh conflict type
export class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsArray() skinTypes?: string[];
  @IsOptional() @IsString() mainImage?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) galleryImages?: string[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() detailInfo?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UpdateVariantDto) variants?: UpdateVariantDto[];
  @IsOptional() isActive?: boolean;
}