import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { MongooseDatabaseModule } from './database/mongoose.module';
import { MailModule } from './shared/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartModule } from './modules/cart/cart.module'; 
import { OrdersModule } from './modules/orders/orders.module'; 
import { VouchersModule } from './modules/vouchers/vouchers.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    MongooseDatabaseModule,
    MailModule,
    AuthModule,
    UsersModule,
    CatalogModule, 
    CartModule,   
    OrdersModule,  
    DashboardModule,
    VouchersModule,
    PromotionsModule,
    NotificationsModule,
  ],
})
export class AppModule {}