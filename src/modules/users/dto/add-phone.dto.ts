import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AddPhoneDto {
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  region_code!: string;

  @IsString()
  @Matches(/^\+\d{1,4}$/)
  country_calling_code!: string;

  @IsString()
  @Matches(/^\d+$/)
  @MinLength(6)
  @MaxLength(15)
  national_number!: string;

  @IsOptional()
  @IsIn(['personal', 'shipping', 'work'])
  phone_type?: 'personal' | 'shipping' | 'work';

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}