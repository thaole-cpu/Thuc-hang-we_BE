import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { Product, ProductDocument } from '../../catalog/schemas/product.schema';
import { User, UserDocument } from '../../auth/schemas/user.schema';
import { OrderStatus } from 'src/common/constants/order-status.constant';
import { Role } from 'src/common/constants/roles.constant';

type ChartBucket = { label: string; salesQuantity: number; revenue: number };

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Lấy mainImage từ bảng products — populate items.productId không hoạt động vì items là Array thường */
  private async getProductMainImageMap(productIds: string[]) {
    const uniqueIds = [
      ...new Set(productIds.filter((id) => Types.ObjectId.isValid(id))),
    ];
    if (!uniqueIds.length) return new Map<string, string>();

    const products = await this.productModel
      .find({ _id: { $in: uniqueIds.map((id) => new Types.ObjectId(id)) } })
      .select('mainImage')
      .lean()
      .exec();

    return new Map(products.map((p) => [p._id.toString(), p.mainImage || '']));
  }

  private resolveOrderItemProductId(productId: unknown): string {
    if (!productId) return '';
    if (typeof productId === 'string') return productId;
    if (typeof productId === 'object') {
      const ref = productId as { _id?: unknown; toString?: () => string };
      if (ref._id != null) return String(ref._id);
      if (typeof ref.toString === 'function') return ref.toString();
    }
    return String(productId);
  }

  private sumPaidRevenue(orders: Array<{ totalAmount?: number; paymentStatus?: string }>) {
    return orders
      .filter((o) => o.paymentStatus === 'PAID')
      .reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  }

  private async getStatByStatuses(statuses: OrderStatus[]) {
    const orders = await this.orderModel
      .find({ status: { $in: statuses } })
      .select('totalAmount paymentStatus')
      .lean()
      .exec();

    return {
      count: orders.length,
      potentialRevenue: this.sumPaidRevenue(orders),
    };
  }

  private formatDateTime(value?: Date | string) {
    if (!value) return '—';
    const date = new Date(value);
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private getWeekdayLabel(date: Date) {
    const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return labels[date.getDay()];
  }

  private getWeekOfMonthLabel(date: Date) {
    const week = Math.min(4, Math.ceil(date.getDate() / 7));
    return `Tuần ${week}`;
  }

  private getQuarterLabel(date: Date) {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `Q${quarter}`;
  }

  private buildChartFromOrders(
    orders: any[],
    labelResolver: (date: Date) => string,
    presetLabels: string[],
  ) {
    const chartMap = new Map<string, ChartBucket>();
    presetLabels.forEach((label) => chartMap.set(label, { label, salesQuantity: 0, revenue: 0 }));

    let total = 0;
    orders.forEach((order) => {
      total += order.totalAmount || 0;
      const label = labelResolver(new Date(order.createdAt));
      const current = chartMap.get(label) || { label, salesQuantity: 0, revenue: 0 };
      const qty = (order.items || []).reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0,
      );
      current.salesQuantity += qty;
      current.revenue += order.totalAmount || 0;
      chartMap.set(label, current);
    });

    return {
      total,
      chartData: presetLabels.map((label) => chartMap.get(label) || { label, salesQuantity: 0, revenue: 0 }),
    };
  }

  private withRingPercent(stats: {
    newOrders: { count: number; potentialRevenue: number };
    processedOrders: { count: number; potentialRevenue: number };
    deliveredOrders: { count: number; potentialRevenue: number };
    newCustomers: { count: number; potentialRevenue: number };
  }) {
    const maxCount = Math.max(
      stats.newOrders.count,
      stats.processedOrders.count,
      stats.deliveredOrders.count,
      stats.newCustomers.count,
      1,
    );

    const addPercent = (item: { count: number; potentialRevenue: number }) => ({
      ...item,
      ringPercent: Math.round((item.count / maxCount) * 100),
    });

    return {
      newOrders: addPercent(stats.newOrders),
      processedOrders: addPercent(stats.processedOrders),
      deliveredOrders: addPercent(stats.deliveredOrders),
      newCustomers: addPercent(stats.newCustomers),
    };
  }

  async getOverviewData() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOf30Days = new Date(now);
    startOf30Days.setDate(startOf30Days.getDate() - 30);
    startOf30Days.setHours(0, 0, 0, 0);

    const paidFilter = { paymentStatus: 'PAID' };

    const [
      newOrders,
      processedOrders,
      deliveredOrders,
      newCustomersList,
      recentOrdersRaw,
      weekOrders,
      monthOrders,
      yearOrders,
      bestSellerAgg,
    ] = await Promise.all([
      this.getStatByStatuses([OrderStatus.PENDING]),
      this.getStatByStatuses([OrderStatus.CONFIRMED, OrderStatus.PROCESSING]),
      this.getStatByStatuses([OrderStatus.COMPLETED]),
      this.userModel
        .find({ roles: Role.USER, createdAt: { $gte: startOfMonth } })
        .select('_id')
        .lean()
        .exec(),
      this.orderModel
        .find({ status: { $ne: OrderStatus.CANCELLED } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderCode status totalAmount createdAt items')
        .lean()
        .exec(),
      this.orderModel
        .find({ ...paidFilter, createdAt: { $gte: startOfWeek } })
        .select('createdAt totalAmount items')
        .lean()
        .exec(),
      this.orderModel
        .find({ ...paidFilter, createdAt: { $gte: startOfMonth } })
        .select('createdAt totalAmount items')
        .lean()
        .exec(),
      this.orderModel
        .find({ ...paidFilter, createdAt: { $gte: startOfYear } })
        .select('createdAt totalAmount items')
        .lean()
        .exec(),
      this.orderModel.aggregate([
        { $match: { ...paidFilter, createdAt: { $gte: startOf30Days } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.name' },
            sales: { $sum: '$items.quantity' },
          },
        },
        { $sort: { sales: -1 } },
        { $limit: 8 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    const recentProductIds = recentOrdersRaw.map((order) => {
      const firstItem = (order as any).items?.[0];
      return this.resolveOrderItemProductId(firstItem?.productId);
    });
    const mainImageMap = await this.getProductMainImageMap(recentProductIds);

    const recentOrders = recentOrdersRaw.map((order) => {
      const orderDoc = order as any;
      const firstItem = orderDoc.items?.[0] as any;
      const productId = this.resolveOrderItemProductId(firstItem?.productId);
      const imageUrl = mainImageMap.get(productId) || '';

      return {
        id: orderDoc._id.toString(),
        orderId: orderDoc._id.toString(),
        orderCode: orderDoc.orderCode || '',
        status: orderDoc.status || 'PENDING',
        productName: firstItem?.name || 'Sản phẩm LURANA',
        quantity: firstItem?.quantity || 1,
        price: orderDoc.totalAmount || 0,
        createdAt: this.formatDateTime(orderDoc.createdAt),
        imageUrl,
      };
    });

    const weekLabels = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + index);
      return this.getWeekdayLabel(day);
    });

    const revenueWeek = this.buildChartFromOrders(
      weekOrders,
      (date) => this.getWeekdayLabel(date),
      weekLabels,
    );

    const revenueMonth = this.buildChartFromOrders(
      monthOrders,
      (date) => this.getWeekOfMonthLabel(date),
      ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
    );

    const revenueYear = this.buildChartFromOrders(
      yearOrders,
      (date) => this.getQuarterLabel(date),
      ['Q1', 'Q2', 'Q3', 'Q4'],
    );

    const bestSellers = bestSellerAgg.map((item) => ({
      id: item._id?.toString() || item.name,
      name: item.name || item.product?.name || 'Sản phẩm',
      imageUrl: item.product?.mainImage || '',
      sales: item.sales || 0,
    }));

    const stats = this.withRingPercent({
      newOrders,
      processedOrders,
      deliveredOrders,
      newCustomers: {
        count: newCustomersList.length,
        potentialRevenue: 0,
      },
    });

    return {
      stats,
      recentOrders,
      revenue: revenueWeek,
      revenueWeek,
      revenueMonth,
      revenueYear,
      bestSellers,
    };
  }
}
