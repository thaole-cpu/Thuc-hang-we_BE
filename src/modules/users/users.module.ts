import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersAdminController } from './users.admin.controller';
import { UsersService } from './users.service';
import { UserProfile, UserProfileSchema } from './schemas/user-profile.schema';
import { UserPhone, UserPhoneSchema } from './schemas/user-phone.schema';
import { UserAddress, UserAddressSchema } from './schemas/user-address.schema';
import { User, UserSchema } from './schemas/user.schema'; 
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { ExcelBaseService } from '../../shared/csv/excel.service';
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: UserPhone.name, schema: UserPhoneSchema },
      { name: UserAddress.name, schema: UserAddressSchema },
      { name: User.name, schema: UserSchema }, 
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [UsersController, UsersAdminController],
  providers: [UsersService, ExcelBaseService],
  exports: [UsersService],
})
export class UsersModule {}