import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Promotion, PromotionDocument } from './schemas/promotion.schema';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ListPromotionsDto } from './dto/list-promotions.dto';
import { PromotionStatus, PromotionApplyScope } from 'src/common/constants/promotion.constant';
import { ExcelBaseService } from 'src/shared/csv/excel.service';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
    private readonly excelService: ExcelBaseService,
  ) {}

  async calculateActivePrice(productId: string, originalPrice: number): Promise<number> {
    const now = new Date();
    const activePromos = await this.promotionModel.find({
      status: PromotionStatus.ACTIVE,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { applyScope: PromotionApplyScope.ALL_PRODUCTS },
        { applicableProductIds: new Types.ObjectId(productId) },
      ],
    }).exec();

    if (!activePromos || activePromos.length === 0) return originalPrice;

    let bestPrice = originalPrice;
    for (const promo of activePromos) {
      let currentPromoPrice = originalPrice;
      if (promo.discountType === 'PERCENTAGE') {
        currentPromoPrice = originalPrice - Math.floor((originalPrice * promo.discountValue) / 100);
      } else {
        currentPromoPrice = Math.max(0, originalPrice - promo.discountValue);
      }
      if (currentPromoPrice < bestPrice) bestPrice = currentPromoPrice;
    }
    return bestPrice;
  }

  async create(dto: CreatePromotionDto) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('Ngày kết thúc không được trước ngày bắt đầu');
    }
    if (
      dto.applyScope === PromotionApplyScope.SPECIFIC_PRODUCTS &&
      (!dto.applicableProductIds || dto.applicableProductIds.length === 0)
    ) {
      throw new BadRequestException('Vui lòng chọn sản phẩm áp dụng');
    }
    const promotion = new this.promotionModel({
      ...dto,
      status: PromotionStatus.DRAFT,
      applicableProductIds: dto.applicableProductIds ?? [],
    });
    return promotion.save();
  }

  async findAll(query: ListPromotionsDto) {
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (status) filter.status = status;
    if (search) filter.name = new RegExp(search, 'i');

    await this.promotionModel.updateMany(
      { status: PromotionStatus.ACTIVE, endDate: { $lt: new Date() } },
      { $set: { status: PromotionStatus.EXPIRED } },
    );

    const [data, total] = await Promise.all([
      this.promotionModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.promotionModel.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const promo = await this.promotionModel.findById(id).exec();
    if (!promo) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    return promo;
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const promo = await this.promotionModel.findById(id);
    if (!promo) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    if (promo.status === PromotionStatus.ACTIVE) {
      throw new BadRequestException('Không thể chỉnh sửa chương trình đang chạy. Hãy tắt trước.');
    }
    if (dto.endDate && dto.startDate && dto.endDate < dto.startDate) {
      throw new BadRequestException('Ngày kết thúc không được trước ngày bắt đầu');
    }
    return this.promotionModel.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
  }

  async activate(id: string) {
    const promo = await this.promotionModel.findById(id);
    if (!promo) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    if (new Date() > promo.endDate) {
      throw new BadRequestException('Chương trình đã hết hạn, không thể kích hoạt');
    }
    return this.promotionModel.findByIdAndUpdate(id, { status: PromotionStatus.ACTIVE }, { new: true }).exec();
  }

  async disable(id: string) {
    const promo = await this.promotionModel.findByIdAndUpdate(
      id, { status: PromotionStatus.DISABLED }, { new: true }
    ).exec();
    if (!promo) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    return promo;
  }

  async remove(id: string) {
    const promo = await this.promotionModel.findById(id);
    if (!promo) throw new NotFoundException('Không tìm thấy chương trình khuyến mãi');
    if (promo.status === PromotionStatus.ACTIVE) {
      throw new BadRequestException('Không thể xóa chương trình đang chạy. Hãy tắt trước.');
    }
    await this.promotionModel.findByIdAndDelete(id);
    return { message: 'Đã xóa chương trình khuyến mãi' };
  }

  async exportExcel(fields: string[], filters: any) {
    const filter: any = {};
    if (filters?.status) filter.status = filters.status;
    if (filters?.search) filter.name = new RegExp(filters.search, 'i');

    const data = await this.promotionModel
      .find(filter)
      .select(fields.join(' '))
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return this.excelService.exportData(data, fields);
  }

  async previewImportData(buffer: Buffer, mapping: Record<string, string>) {
    return this.excelService.previewImport(
      buffer, mapping,
      ['name', 'discountType', 'discountValue', 'applyScope', 'startDate', 'endDate'],
      ['name'],
    );
  }

  async commitImportData(validDataList: any[]) {
    const results = { successCount: 0, failCount: 0, errors: [] as string[] };
    for (const item of validDataList) {
      try {
        await this.create({
          name: item.name,
          description: item.description,
          discountType: item.discountType === 'FIXED_AMOUNT' ? 'FIXED' : item.discountType,
          discountValue: Number(item.discountValue),
          applyScope: item.applyScope,
          startDate: new Date(item.startDate),
          endDate: new Date(item.endDate),
        });
        results.successCount++;
      } catch (error: any) {
        results.failCount++;
        results.errors.push(`"${item.name}": ${error.message}`);
      }
    }
    return results;
  }
}