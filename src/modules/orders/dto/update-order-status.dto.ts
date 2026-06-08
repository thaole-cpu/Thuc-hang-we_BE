import { IsEnum } from 'class-validator';
import { OrderStatus } from 'src/common/constants/order-status.constant';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
