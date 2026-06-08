import { Controller, Get, Param, Patch, Body, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getCustomers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('search') search: string = '',
    @Query('status') status?: 'active' | 'blocked',
    @Query('verified') verified?: 'true' | 'false',
    @Query('vip') vip?: 'true',
  ) {
    return {
      success: true,
      data: await this.usersService.findAllForAdmin(
        parseInt(page, 10),
        parseInt(limit, 10),
        search,
        { status, verified, vip },
      ),
    };
  }

  @Get('stats')
  async getCustomerStats() {
    return {
      success: true,
      data: await this.usersService.getStatsForAdmin(),
    };
  }

  @Get('export')
  async exportCustomers(
    @Query('search') search: string = '',
    @Query('exportOptions') exportOptions: string | string[] = '',
    @Query('status') status: string = '',
    @Query('verified') verified: string = '',
    @Query('vip') vip: string = '',
    @Res() res: Response,
  ) {
    const buffer = await this.usersService.exportForAdmin(
      search,
      exportOptions as string,
      {
        status: (status as 'active' | 'blocked') || undefined,
        verified: (verified as 'true' | 'false') || undefined,
        vip: vip === 'true' ? 'true' : undefined,
      },
    );
    const filename = `khach-hang-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }

  @Patch(':userId/status')
  async updateCustomerStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return {
      success: true,
      data: await this.usersService.updateUserStatus(userId, dto.status),
    };
  }

  @Get(':userId')
  async getCustomerDetail(@Param('userId') userId: string) {
    return {
      success: true,
      data: await this.usersService.getDetailForAdmin(userId),
    };
  }
}
