import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  receiver_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+\d{8,20}$/)
  receiver_phone_e164?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  province_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  district_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  ward_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward_name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  address_line?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  delivery_note?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}