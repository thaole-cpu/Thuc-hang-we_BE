import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../../orders/schemas/order.schema';
import { Product, ProductDocument } from '../../catalog/schemas/product.schema';
import { Voucher, VoucherDocument } from '../../vouchers/schemas/voucher.schema';
import { Category, CategoryDocument } from '../../catalog/schemas/category.schema';
import { ExcelBaseService } from 'src/shared/csv/excel.service';

const PROFIT_MARGIN = 0.35;

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Voucher.name) private voucherModel: Model<VoucherDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private excelService: ExcelBaseService,
  ) {}

  /** Biên tháng theo múi giờ VN (UTC+7) */
  private getMonthRange(monthStr?: string) {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    if (monthStr) {
      const parts = monthStr.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    }

    const mm = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const startOfMonth = new Date(`${year}-${mm}-01T00:00:00+07:00`);
    const endOfMonth = new Date(`${year}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59.999+07:00`);

    return { startOfMonth, endOfMonth, year, month, daysInMonth: lastDay };
  }

  private shiftMonth(monthStr: string, delta: number) {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private buildBaseMatchStage(startOfMonth: Date, endOfMonth: Date) {
    return {
      $match: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      },
    };
  }

  private productLookupStages() {
    return [
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          safeProductId: {
            $convert: { input: '$items.productId', to: 'objectId', onError: null, onNull: null },
          },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'safeProductId',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          safeCategoryId: {
            $convert: { input: '$productInfo.category', to: 'objectId', onError: null, onNull: null },
          },
        },
      },
    ];
  }

  private categoryMatchStage(categoryId?: string) {
    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      return [{ $match: { safeCategoryId: new Types.ObjectId(categoryId) } }];
    }
    return [];
  }

  private calcTrendPercent(current: number, previous: number): number | null {
    if (previous <= 0) {
      return current > 0 ? 100 : null;
    }
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private fillTrendWeeks(
    rows: Array<{ _id: number; revenue: number; profit?: number }>,
    daysInMonth: number,
  ) {
    const maxWeek = Math.ceil(daysInMonth / 7);
    const map = new Map(rows.map((r) => [r._id, r]));
    return Array.from({ length: maxWeek }, (_, i) => {
      const week = i + 1;
      const item = map.get(week);
      const revenue = item?.revenue ?? 0;
      const profit = item?.profit ?? revenue * PROFIT_MARGIN;
      return { label: `Tuần ${week}`, revenue, profit };
    });
  }

  async getRevenueData(monthStr?: string, categoryId?: string) {
    const { startOfMonth, endOfMonth, daysInMonth } = this.getMonthRange(monthStr);
    const matchStage = this.buildBaseMatchStage(startOfMonth, endOfMonth);

    const current = await this.calculateKPIs(matchStage, categoryId);

    let netProfitTrend: number | null = null;
    if (monthStr) {
      const prevRange = this.getMonthRange(this.shiftMonth(monthStr, -1));
      const prevMatch = this.buildBaseMatchStage(prevRange.startOfMonth, prevRange.endOfMonth);
      const prev = await this.calculateKPIs(prevMatch, categoryId);
      netProfitTrend = this.calcTrendPercent(current.netProfit, prev.netProfit);
    }

    const trendData = await this.buildTrendData(matchStage, categoryId, daysInMonth);
    const categoryData = await this.buildCategoryData(matchStage, categoryId);
    const topProducts = await this.buildTopProducts(matchStage, categoryId);
    const topVouchers = await this.buildTopVouchers(matchStage, categoryId);

    const rawCategories = await this.categoryModel.find().select('_id name').exec();
    const availableCategories = rawCategories
      .filter((cat) => cat.name && cat.name.trim() !== '')
      .map((cat) => ({
        value: cat._id.toString(),
        label: cat.name,
      }));

    return {
      kpis: {
        totalRevenue: { value: current.totalRevenue },
        netProfit: {
          value: current.netProfit,
          ...(netProfitTrend !== null ? { trend: netProfitTrend } : {}),
        },
        discounts: { value: current.discounts },
        aov: {
          value: current.totalOrders > 0 ? Math.round(current.totalRevenue / current.totalOrders) : 0,
        },
      },
      trendData,
      categoryData,
      topProducts,
      topVouchers,
      availableCategories,
    };
  }

  private async calculateKPIs(matchStage: any, categoryId?: string) {
    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      const pipeline: any[] = [
        matchStage,
        ...this.productLookupStages(),
        ...this.categoryMatchStage(categoryId),
        {
          $group: {
            _id: '$_id',
            categoryRevenue: {
              $sum: {
                $multiply: [{ $ifNull: ['$items.priceSell', 0] }, { $ifNull: ['$items.quantity', 0] }],
              },
            },
            discountAmount: { $first: '$discountAmount' },
            originalTotal: { $first: '$originalTotal' },
          },
        },
        {
          $addFields: {
            allocatedDiscount: {
              $cond: [
                { $gt: [{ $ifNull: ['$originalTotal', 0] }, 0] },
                {
                  $multiply: [
                    { $ifNull: ['$discountAmount', 0] },
                    { $divide: ['$categoryRevenue', '$originalTotal'] },
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$categoryRevenue' },
            discounts: { $sum: '$allocatedDiscount' },
            totalOrders: { $sum: 1 },
            netProfit: { $sum: { $multiply: ['$categoryRevenue', PROFIT_MARGIN] } },
          },
        },
      ];

      const res = await this.orderModel.aggregate(pipeline);
      return res[0] || { totalRevenue: 0, discounts: 0, totalOrders: 0, netProfit: 0 };
    }

    const pipeline: any[] = [
      matchStage,
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          discounts: { $sum: '$discountAmount' },
          totalOrders: { $sum: 1 },
          netProfit: { $sum: { $multiply: ['$totalAmount', PROFIT_MARGIN] } },
        },
      },
    ];

    const res = await this.orderModel.aggregate(pipeline);
    return res[0] || { totalRevenue: 0, discounts: 0, totalOrders: 0, netProfit: 0 };
  }

  private async buildTrendData(matchStage: any, categoryId?: string, daysInMonth = 30) {
    const weekField = {
      weekInMonth: {
        $ceil: { $divide: [{ $dayOfMonth: '$createdAt' }, 7] },
      },
    };

    let pipeline: any[];

    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      pipeline = [
        matchStage,
        ...this.productLookupStages(),
        ...this.categoryMatchStage(categoryId),
        { $addFields: weekField },
        {
          $group: {
            _id: '$weekInMonth',
            revenue: {
              $sum: {
                $multiply: [{ $ifNull: ['$items.priceSell', 0] }, { $ifNull: ['$items.quantity', 0] }],
              },
            },
          },
        },
        { $addFields: { profit: { $multiply: ['$revenue', PROFIT_MARGIN] } } },
      ];
    } else {
      pipeline = [
        matchStage,
        { $addFields: weekField },
        {
          $group: {
            _id: '$weekInMonth',
            revenue: { $sum: '$totalAmount' },
            profit: { $sum: { $multiply: ['$totalAmount', PROFIT_MARGIN] } },
          },
        },
      ];
    }

    pipeline.push({ $sort: { _id: 1 } });
    const weeklyData = await this.orderModel.aggregate(pipeline);

    const normalized = weeklyData.map((item) => ({
      _id: typeof item._id === 'object' ? item._id.weekInMonth : item._id,
      revenue: item.revenue ?? 0,
      profit: item.profit ?? (item.revenue ?? 0) * PROFIT_MARGIN,
    }));

    return this.fillTrendWeeks(normalized, daysInMonth);
  }

  private async buildCategoryData(matchStage: any, categoryId?: string) {
    const pipeline: any[] = [
      matchStage,
      ...this.productLookupStages(),
      ...this.categoryMatchStage(categoryId),
      {
        $lookup: {
          from: 'categories',
          localField: 'safeCategoryId',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$categoryInfo.name',
          value: {
            $sum: {
              $multiply: [{ $ifNull: ['$items.priceSell', 0] }, { $ifNull: ['$items.quantity', 0] }],
            },
          },
        },
      },
    ];

    const data = await this.orderModel.aggregate(pipeline);
    const colors = ['#FFA78A', '#A7C7E7', '#E6E6FA', '#FFD1DC', '#D8BFD8', '#B0E0E6', '#FFB6C1', '#87CEFA'];

    return data.map((d, i) => ({
      name: d._id || 'Chưa phân loại',
      value: d.value,
      color: colors[i % colors.length],
    }));
  }

  private async buildTopProducts(matchStage: any, categoryId?: string) {
    const pipeline: any[] = [
      matchStage,
      ...this.productLookupStages(),
      ...this.categoryMatchStage(categoryId),
      {
        $group: {
          _id: '$items.productId',
          sales: { $sum: { $ifNull: ['$items.quantity', 0] } },
          revenue: {
            $sum: {
              $multiply: [{ $ifNull: ['$items.priceSell', 0] }, { $ifNull: ['$items.quantity', 0] }],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $addFields: {
          safeProductId: { $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null } },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'safeProductId',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          safeCategoryId: {
            $convert: { input: '$productInfo.category', to: 'objectId', onError: null, onNull: null },
          },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'safeCategoryId',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: '$_id',
          name: { $ifNull: ['$productInfo.name', 'Sản phẩm đã xóa'] },
          sku: { $ifNull: ['$productInfo.sku', 'N/A'] },
          categoryName: { $ifNull: ['$categoryInfo.name', 'Chưa phân loại'] },
          sales: 1,
          revenue: 1,
          profit: { $multiply: ['$revenue', PROFIT_MARGIN] },
          image: '$productInfo.mainImage',
        },
      },
    ];

    return this.orderModel.aggregate(pipeline);
  }

  private async buildTopVouchers(matchStage: any, categoryId?: string) {
    const pipeline: any[] = [matchStage, { $match: { appliedVoucher: { $nin: [null, ''] } } }];

    if (categoryId && Types.ObjectId.isValid(categoryId)) {
      pipeline.push(
        ...this.productLookupStages(),
        ...this.categoryMatchStage(categoryId),
        {
          $group: {
            _id: '$_id',
            appliedVoucher: { $first: '$appliedVoucher' },
            discountAmount: { $first: '$discountAmount' },
            totalAmount: { $first: '$totalAmount' },
          },
        },
      );
    }

    pipeline.push(
      {
        $group: {
          _id: '$appliedVoucher',
          usageCount: { $sum: 1 },
          totalDiscount: { $sum: '$discountAmount' },
          generatedRevenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { generatedRevenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'vouchers',
          localField: '_id',
          foreignField: 'voucherCode',
          as: 'voucherInfo',
        },
      },
      { $unwind: { path: '$voucherInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          code: '$_id',
          name: { $ifNull: ['$voucherInfo.voucherName', 'Voucher đã xóa'] },
          usageCount: 1,
          totalDiscount: 1,
          generatedRevenue: 1,
        },
      },
    );

    return this.orderModel.aggregate(pipeline);
  }

  async exportRevenueData(monthStr?: string, fields?: string | string[], categoryId?: string) {
    const { startOfMonth, endOfMonth } = this.getMonthRange(monthStr);
    const matchStage = this.buildBaseMatchStage(startOfMonth, endOfMonth);

    const pipeline: any[] = [
      matchStage,
      ...this.productLookupStages(),
      ...this.categoryMatchStage(categoryId),
      {
        $group: {
          _id: '$items.productId',
          sales: { $sum: { $ifNull: ['$items.quantity', 0] } },
          revenue: {
            $sum: {
              $multiply: [{ $ifNull: ['$items.priceSell', 0] }, { $ifNull: ['$items.quantity', 0] }],
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $addFields: {
          safeProductId: { $convert: { input: '$_id', to: 'objectId', onError: null, onNull: null } },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'safeProductId',
          foreignField: '_id',
          as: 'productInfo',
        },
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          safeCategoryId: {
            $convert: { input: '$productInfo.category', to: 'objectId', onError: null, onNull: null },
          },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'safeCategoryId',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
    ];

    const productsSold = await this.orderModel.aggregate(pipeline);

    const allFieldsMap: Record<string, (item: any) => any> = {
      Ten_San_Pham: (item) => item.productInfo?.name || 'Không xác định',
      SKU: (item) => item.productInfo?.sku || 'N/A',
      Loai_San_Pham: (item) => item.categoryInfo?.name || 'Chưa phân loại',
      So_Luong_Ban: (item) => item.sales,
      Doanh_Thu_VND: (item) => item.revenue,
      Loi_Nhuan_VND: (item) => item.revenue * PROFIT_MARGIN,
    };

    let fieldsToExport = Object.keys(allFieldsMap);
    if (fields) {
      fieldsToExport = Array.isArray(fields) ? fields : fields.split(',');
    }

    const validFieldsToExport = fieldsToExport.filter((field) => allFieldsMap[field]);

    const excelData = productsSold.map((item) => {
      const row: any = {};
      validFieldsToExport.forEach((field) => {
        row[field] = allFieldsMap[field](item);
      });
      return row;
    });

    return this.excelService.exportData(excelData, validFieldsToExport);
  }
}
