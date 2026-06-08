import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VouchersService } from './vouchers.service';
import { VouchersController } from './vouchers.controller';
import { VouchersAdminController } from './vouchers.admin.controller';
import { Voucher, VoucherSchema } from './schemas/voucher.schema';
import { VoucherUsage, VoucherUsageSchema } from './schemas/voucher-usage.schema';
import { ExcelBaseService } from 'src/shared/csv/excel.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Voucher.name, schema: VoucherSchema },
      { name: VoucherUsage.name, schema: VoucherUsageSchema },
    ]),
  ],
  controllers: [VouchersController, VouchersAdminController],
  providers: [VouchersService, ExcelBaseService],
  exports: [VouchersService],
})
export class VouchersModule {}