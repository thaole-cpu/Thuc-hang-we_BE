import { Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class NotificationsAdminController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser('userId') adminUserId: string, @Query() query: ListNotificationsDto) {
    return {
      success: true,
      data: await this.notificationsService.findAllForAdmin(adminUserId, query),
    };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('userId') adminUserId: string) {
    return {
      success: true,
      data: await this.notificationsService.getUnreadCountAdmin(adminUserId),
    };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser('userId') adminUserId: string, @Query() query: ListNotificationsDto) {
    return {
      success: true,
      data: await this.notificationsService.markAllAsReadAdmin(adminUserId, query.category),
    };
  }

  @Patch(':id/read')
  async markAsRead(@CurrentUser('userId') adminUserId: string, @Param('id') id: string) {
    return {
      success: true,
      data: await this.notificationsService.markAsReadAdmin(adminUserId, id),
    };
  }

  @Delete(':id')
  async remove(@CurrentUser('userId') adminUserId: string, @Param('id') id: string) {
    return {
      success: true,
      data: await this.notificationsService.removeAdmin(adminUserId, id),
    };
  }
}
