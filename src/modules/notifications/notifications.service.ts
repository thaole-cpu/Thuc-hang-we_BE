import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationAudience,
  NotificationCategory,
} from 'src/common/constants/notification.constant';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async create(dto: CreateNotificationDto) {
    const notification = await this.notificationModel.create({
      userId: new Types.ObjectId(dto.userId),
      audience: dto.audience ?? NotificationAudience.CUSTOMER,
      category: dto.category,
      title: dto.title,
      message: dto.message,
      orderId: dto.orderId ? new Types.ObjectId(dto.orderId) : null,
      orderCode: dto.orderCode ?? null,
      voucherCode: dto.voucherCode ?? null,
      discountAmount: dto.discountAmount ?? null,
      productName: dto.productName ?? null,
      productImage: dto.productImage ?? null,
      actionText: dto.actionText ?? null,
      actionLink: dto.actionLink ?? null,
      isRead: false,
    });

    return notification;
  }

  async createOrderNotification(params: {
    userId: string;
    orderId: string;
    orderCode: string;
    title: string;
    message: string;
    actionLink?: string;
  }) {
    return this.create({
      userId: params.userId,
      audience: NotificationAudience.CUSTOMER,
      category: NotificationCategory.ORDER,
      title: params.title,
      message: params.message,
      orderId: params.orderId,
      orderCode: params.orderCode,
      actionText: 'Xem đơn hàng',
      actionLink: params.actionLink ?? '/account?tab=ORDERS',
    });
  }

  async createAdminOrderNotification(params: {
    adminUserId: string;
    orderId: string;
    orderCode: string;
    title: string;
    message: string;
    actionLink?: string;
  }) {
    return this.create({
      userId: params.adminUserId,
      audience: NotificationAudience.ADMIN,
      category: NotificationCategory.ORDER,
      title: params.title,
      message: params.message,
      orderId: params.orderId,
      orderCode: params.orderCode,
      actionText: 'Xem đơn hàng',
      actionLink: params.actionLink ?? `/admin/orders/${params.orderId}`,
    });
  }

  async notifyAdminsOrderEvent(params: {
    adminUserIds: string[];
    orderId: string;
    orderCode: string;
    title: string;
    message: string;
    actionLink?: string;
  }) {
    const results = await Promise.allSettled(
      params.adminUserIds.map((adminUserId) =>
        this.createAdminOrderNotification({
          adminUserId,
          orderId: params.orderId,
          orderCode: params.orderCode,
          title: params.title,
          message: params.message,
          actionLink: params.actionLink,
        }),
      ),
    );
    return results.filter((r) => r.status === 'fulfilled').length;
  }

  private buildFilters(userId: string, query: ListNotificationsDto) {
    const filters: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      audience: NotificationAudience.CUSTOMER,
    };

    if (query.category) {
      filters.category = query.category;
    }

    if (query.unreadOnly) {
      filters.isRead = false;
    }

    if (query.search?.trim()) {
      const keyword = query.search.trim();
      filters.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { message: { $regex: keyword, $options: 'i' } },
        { orderCode: { $regex: keyword, $options: 'i' } },
        { voucherCode: { $regex: keyword, $options: 'i' } },
      ];
    }

    return filters;
  }

  private buildAdminFilters(adminUserId: string, query: ListNotificationsDto) {
    const filters: Record<string, unknown> = {
      userId: new Types.ObjectId(adminUserId),
      audience: NotificationAudience.ADMIN,
    };

    if (query.category) {
      filters.category = query.category;
    }

    if (query.unreadOnly) {
      filters.isRead = false;
    }

    if (query.search?.trim()) {
      const keyword = query.search.trim();
      filters.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { message: { $regex: keyword, $options: 'i' } },
        { orderCode: { $regex: keyword, $options: 'i' } },
        { voucherCode: { $regex: keyword, $options: 'i' } },
      ];
    }

    return filters;
  }

  async findAllByUser(userId: string, query: ListNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const filters = this.buildFilters(userId, query);

    const [data, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filters),
      this.notificationModel.countDocuments({
        userId: new Types.ObjectId(userId),
        audience: NotificationAudience.CUSTOMER,
        isRead: false,
      }),
    ]);

    return { data, total, page, limit, unreadCount };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      audience: NotificationAudience.CUSTOMER,
      isRead: false,
    });

    return { unreadCount };
  }

  async findOneByUser(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã thông báo không hợp lệ');
    }

    const notification = await this.notificationModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        audience: NotificationAudience.CUSTOMER,
      })
      .lean()
      .exec();

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return notification;
  }

  async markAsRead(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã thông báo không hợp lệ');
    }

    const notification = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
          audience: NotificationAudience.CUSTOMER,
        },
        { isRead: true },
        { new: true },
      )
      .lean()
      .exec();

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return notification;
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        audience: NotificationAudience.CUSTOMER,
        isRead: false,
      },
      { isRead: true },
    );

    return {
      message: 'Đã đánh dấu tất cả là đã đọc',
      modifiedCount: result.modifiedCount,
    };
  }

  async remove(userId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã thông báo không hợp lệ');
    }

    const notification = await this.notificationModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
        audience: NotificationAudience.CUSTOMER,
      })
      .lean()
      .exec();

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return { message: 'Đã xóa thông báo' };
  }

  async findAllForAdmin(adminUserId: string, query: ListNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const filters = this.buildAdminFilters(adminUserId, query);

    const baseAdminFilter = {
      userId: new Types.ObjectId(adminUserId),
      audience: NotificationAudience.ADMIN,
    };

    const [data, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filters),
      this.notificationModel.countDocuments({ ...baseAdminFilter, isRead: false }),
    ]);

    return { data, total, page, limit, unreadCount };
  }

  async getUnreadCountAdmin(adminUserId: string) {
    const unreadCount = await this.notificationModel.countDocuments({
      userId: new Types.ObjectId(adminUserId),
      audience: NotificationAudience.ADMIN,
      isRead: false,
    });
    return { unreadCount };
  }

  async markAsReadAdmin(adminUserId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã thông báo không hợp lệ');
    }

    const notification = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(adminUserId),
          audience: NotificationAudience.ADMIN,
        },
        { isRead: true },
        { new: true },
      )
      .lean()
      .exec();

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return notification;
  }

  async markAllAsReadAdmin(adminUserId: string, category?: NotificationCategory) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(adminUserId),
      audience: NotificationAudience.ADMIN,
      isRead: false,
    };
    if (category) {
      filter.category = category;
    }

    const result = await this.notificationModel.updateMany(filter, { isRead: true });

    return {
      message: 'Đã đánh dấu tất cả là đã đọc',
      modifiedCount: result.modifiedCount,
    };
  }

  async removeAdmin(adminUserId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã thông báo không hợp lệ');
    }

    const notification = await this.notificationModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(adminUserId),
        audience: NotificationAudience.ADMIN,
      })
      .lean()
      .exec();

    if (!notification) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return { message: 'Đã xóa thông báo' };
  }
}
