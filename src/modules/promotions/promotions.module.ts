import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromotionsService } from './promotions.service';
import { PromotionsAdminController } from './promotions.admin.controller';
import { Promotion, PromotionSchema } from './schemas/promotion.schema';
import { ExcelBaseService } from 'src/shared/csv/excel.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Promotion.name, schema: PromotionSchema }]),
  ],
  controllers: [PromotionsAdminController],
  providers: [PromotionsService, ExcelBaseService],
  exports: [PromotionsService],
})
export class PromotionsModule {}