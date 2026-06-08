import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class AddAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  receiver_name!: string;

  @IsString()
  @Matches(/^\+\d{8,20}$/)
  receiver_phone_e164!: string;

  @IsString()
  @Matches(/^[A-Z]{2}$/)
  country_id!: string;

  @IsString()
  @MaxLength(100)
  country_name!: string;

  @IsString()
  @MaxLength(50)
  province_id!: string;

  @IsString()
  @MaxLength(100)
  province_name!: string;

  @IsString()
  @MaxLength(50)
  district_id!: string;

  @IsString()
  @MaxLength(100)
  district_name!: string;

  @IsString()
  @MaxLength(50)
  ward_id!: string;

  @IsString()
  @MaxLength(100)
  ward_name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  address_line!: string;

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
}