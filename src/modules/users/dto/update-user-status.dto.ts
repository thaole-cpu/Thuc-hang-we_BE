import { IsIn, IsString } from 'class-validator';

export class UpdateUserStatusDto {
  @IsString()
  @IsIn(['active', 'blocked'])
  status!: 'active' | 'blocked';
}
