import { Controller, Post, Body } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { ApplyVoucherDto } from './dto/apply-voucher.dto';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post('validate')
  async validate(@Body() dto: ApplyVoucherDto) {
    return this.vouchersService.validateVoucher(dto);
  }
}