import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdatePhoneDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  region_code?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  country_calling_code?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  @MinLength(6)
  @MaxLength(15)
  national_number?: string;

  @IsOptional()
  @IsIn(['personal', 'shipping', 'work'])
  phone_type?: 'personal' | 'shipping' | 'work';

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}