import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ReportsService } from './services/reports.service';
import { DashboardService } from './services/dashboard.service';
import { GetRevenueDto } from './dto/get-revenue.dto';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DashboardController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly dashboardService: DashboardService
  ) {}

  @Get('overview')
  async getOverview() {
    return {
      success: true,
      data: await this.dashboardService.getOverviewData(),
    };
  }

  @Get('revenue')
  async getRevenueReport(@Query() query: GetRevenueDto) {
    return {
      success: true,
      data: await this.reportsService.getRevenueData(query.month, query.categoryId),
    };
  }

  @Get('revenue/export')
  async exportRevenue(@Query() query: GetRevenueDto & { fields?: string | string[] }, @Res() res: Response) {
    const buffer = await this.reportsService.exportRevenueData(
      query.month,
      query.fields,
      query.categoryId,
    );
    
    const fileName = `Bao_Cao_Doanh_Thu_${query.month || 'Hien_Tai'}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  }
}