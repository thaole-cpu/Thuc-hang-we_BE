import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { ReportsService } from './services/reports.service';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../catalog/schemas/product.schema';
import { Voucher, VoucherSchema } from '../vouchers/schemas/voucher.schema';
import { Category, CategorySchema } from '../catalog/schemas/category.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';

import { ExcelBaseService } from 'src/shared/csv/excel.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Voucher.name, schema: VoucherSchema },
      { name: Category.name, schema: CategorySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, ReportsService, ExcelBaseService],
})
export class DashboardModule {}