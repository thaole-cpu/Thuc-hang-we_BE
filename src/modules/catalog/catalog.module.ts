import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './schemas/product.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { SkinType, SkinTypeSchema } from './schemas/skin-type.schema';
import { ProductsService } from './products.service';
import { CategoriesService } from './categories.service';
import { SkinTypesService } from './skin-types.service';
import { ProductsController } from './products.controller';
import { ProductsAdminController } from './products.admin.controller';
import { CategoriesController } from './categories.controller';
import { CategoriesAdminController } from './categories.admin.controller';
import { SkinTypesController } from './skin-types.controller';
import { SkinTypesAdminController } from './skin-types.admin.controller';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { PromotionsModule } from '../promotions/promotions.module'; 
import { ExcelBaseService } from '../../shared/csv/excel.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: SkinType.name, schema: SkinTypeSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    PromotionsModule,
  ],
  controllers: [
    ProductsController,
    ProductsAdminController,
    CategoriesController,
    CategoriesAdminController,
    SkinTypesController,
    SkinTypesAdminController,
  ],
  providers: [
    ProductsService, 
    CategoriesService, 
    SkinTypesService,
    ExcelBaseService 
  ],
  exports: [
    MongooseModule, 
    ProductsService, 
    CategoriesService, 
    SkinTypesService
  ],
})
export class CatalogModule {}