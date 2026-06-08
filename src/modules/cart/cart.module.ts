import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { Cart, CartSchema } from './schemas/cart.schema';
import { CatalogModule } from '../catalog/catalog.module';

// ---> THÊM IMPORT NÀY
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
    ]),
    CatalogModule, 
    PromotionsModule, // ---> THÊM VÀO ĐÂY ĐỂ GIỎ HÀNG TÍNH TIỀN TẠM TÍNH ĐÚNG GIÁ SALE
  ],
  controllers: [CartController],
  providers: [CartService], 
  exports: [CartService],
})
export class CartModule {}