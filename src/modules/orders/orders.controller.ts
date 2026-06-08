import { Controller, Post, Get, Body, Query, UseGuards, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  @Post('checkout')
  async checkout(@CurrentUser() user: any, @Body() checkoutDto: CheckoutDto) {
    return this.ordersService.checkout(user.userId, checkoutDto);
  }
  @Get('my-orders')
  async getMyOrders(@CurrentUser() user: any, @Query() query: ListOrdersDto) {
    return this.ordersService.findAllByUser(user.userId, query);
  }
  @Get(':id')
  async getOrderDetail(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.findOneByUser(id, user.userId);
  }
}