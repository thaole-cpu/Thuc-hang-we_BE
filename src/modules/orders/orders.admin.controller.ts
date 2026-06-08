import { Controller, Get, Patch, Param, Query, UseGuards, Body, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ExcelBaseService } from 'src/shared/csv/excel.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class OrdersAdminController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly excelBaseService: ExcelBaseService,
  ) {}

  @Get('dashboard/revenue')
  async getDashboardRevenue() {
    return this.ordersService.getDashboardRevenue();
  }

  // API Xuất báo cáo doanh thu (đã có sẵn)
  @Get('export/revenue-report')
  async exportRevenueReport(@Query() query: any, @Res() res: Response) {
    const reportData = await this.ordersService.getDashboardRevenue();
    
    const dataToExport = reportData.data.topProducts.map((p: any) => ({
      'MÃ SKU': p.sku,
      'TÊN SẢN PHẨM': p.name,
      'LOẠI SẢN PHẨM': p.categoryName || 'Chưa phân loại',
      'SỐ LƯỢNG BÁN': p.sales,
      'DOANH THU GỘP': p.revenue,
      'LỢI NHUẬN': p.profit
    }));

    const fieldsToExport = ['MÃ SKU', 'TÊN SẢN PHẨM', 'LOẠI SẢN PHẨM', 'SỐ LƯỢNG BÁN', 'DOANH THU GỘP', 'LỢI NHUẬN'];
    const buffer = await this.excelBaseService.exportData(dataToExport, fieldsToExport);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=revenue-report.xlsx');
    res.send(buffer);
  }

  // API XUẤT DANH SÁCH ĐƠN HÀNG (BỔ SUNG MỚI)
  @Get('export')
  async exportOrders(@Query() query: any, @Res() res: Response) {
    const buffer = await this.ordersService.exportOrdersAdmin(query);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Danh_Sach_Don_Hang.xlsx"');
    res.send(buffer);
  }

  @Get()
  async getOrders(@Query() query: any) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get(':id')
  async getOrderDetail(@Param('id') id: string) {
    return this.ordersService.findOneAdmin(id);
  }

  @Patch(':id/confirm-payment')
  async confirmPayment(@Param('id') id: string) {
    return this.ordersService.confirmPaymentAdmin(id);
  }

  @Patch(':id/cancel')
  async cancelOrder(@Param('id') id: string, @Body('reason') reason: string) {
    return this.ordersService.cancelOrderAdmin(id, reason);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  @Post('trigger-timeout-cleanup')
  async triggerCleanup() {
    return this.ordersService.handleAutoTimeoutCleanup();
  }
}