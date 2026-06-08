import { IsNotEmpty, IsObject, IsEnum, IsString, IsOptional } from 'class-validator';
import { PaymentMethod } from 'src/common/constants/payment-method.constant';

export class CheckoutDto {
  @IsNotEmpty()
  @IsObject()
  address!: { 
    fullName: string;
    phone: string;
    addressLine: string;
    province: string;
    district: string;
    ward: string;
  };

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod; 

  @IsOptional()
  @IsString()
  note?: string; 

  @IsOptional()
  @IsString()
  voucherCode?: string; 
}