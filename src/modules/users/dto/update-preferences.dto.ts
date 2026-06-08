import { IsIn, IsOptional, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationPrefsDto {
  @IsOptional() @IsBoolean() emailAlerts?: boolean;
  @IsOptional() @IsBoolean() pushAlerts?: boolean;
  @IsOptional() @IsBoolean() newOrderAlerts?: boolean;
  @IsOptional() @IsBoolean() cancelOrderAlerts?: boolean;
}

export class RegionalPrefsDto {
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() dateFormat?: string;
  @IsOptional() @IsString() currency?: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['vi-VN', 'en-US'])
  locale?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notification_prefs?: NotificationPrefsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RegionalPrefsDto)
  regional_prefs?: RegionalPrefsDto;
}
