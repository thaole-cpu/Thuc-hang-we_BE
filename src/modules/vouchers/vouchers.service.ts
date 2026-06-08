import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, UpdateQuery } from 'mongoose';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { ListVouchersDto } from './dto/list-vouchers.dto';
import { ApplyVoucherDto } from './dto/apply-voucher.dto';
import { Voucher, VoucherDocument } from './schemas/voucher.schema';
import { VoucherUsage, VoucherUsageDocument } from './schemas/voucher-usage.schema';
import {
  VoucherStatus,
  VoucherCustomerScope,
  VoucherDiscountType,
  VoucherApplyScope,
  VoucherRepeatType,
  VOUCHER_CODE_REGEX,
  VoucherErrorMessage,
} from 'src/common/constants/voucher.constant';
import { ExcelBaseService } from '../../shared/csv/excel.service';

@Injectable()
export class VouchersService {
  constructor(
    @InjectModel(Voucher.name) private voucherModel: Model<VoucherDocument>,
    @InjectModel(VoucherUsage.name) private voucherUsageModel: Model<VoucherUsageDocument>,
    private readonly excelService: ExcelBaseService,
  ) {}

  private normalizeCode(code: string) {
    return code?.trim().toUpperCase() ?? '';
  }

  private buildFilter(query: ListVouchersDto) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { voucherCode: new RegExp(query.search, 'i') },
        { voucherName: new RegExp(query.search, 'i') },
      ];
    }
    return filter;
  }

  async create(createVoucherDto: CreateVoucherDto) {
    const voucherCode = this.normalizeCode(createVoucherDto.voucherCode);

    if (!VOUCHER_CODE_REGEX.test(voucherCode)) {
      throw new BadRequestException(VoucherErrorMessage.INVALID_FORMAT);
    }

    if (createVoucherDto.endDate < createVoucherDto.startDate) {
      throw new BadRequestException(VoucherErrorMessage.INVALID_DATE_RANGE);
    }

    const existing = await this.voucherModel.findOne({ voucherCode }).exec();
    if (existing) {
      throw new BadRequestException(VoucherErrorMessage.DUPLICATE_CODE);
    }

    if (
      createVoucherDto.applyScope === VoucherApplyScope.SPECIFIC_PRODUCTS &&
      (!createVoucherDto.applicableProductIds || createVoucherDto.applicableProductIds.length === 0)
    ) {
      throw new BadRequestException('Danh sách sản phẩm áp dụng không được để trống khi phạm vi là SPECIFIC_PRODUCTS.');
    }

    if (
      createVoucherDto.repeatType === VoucherRepeatType.WEEKLY &&
      (!createVoucherDto.repeatDays || createVoucherDto.repeatDays.length === 0)
    ) {
      throw new BadRequestException('Vui lòng cung cấp ngày lặp lại khi sử dụng định kỳ WEEKLY.');
    }

    const voucher = new this.voucherModel({
      ...createVoucherDto,
      voucherCode,
      status: VoucherStatus.DRAFT,
      applicableProductIds: createVoucherDto.applicableProductIds ?? [],
      repeatDays: createVoucherDto.repeatDays ?? [],
    });

    return voucher.save();
  }

  async findAll(query: ListVouchersDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    await this.voucherModel.updateMany(
      { status: VoucherStatus.ACTIVE, endDate: { $lt: new Date() } },
      { $set: { status: VoucherStatus.EXPIRED } },
    );

    const filter = this.buildFilter(query);

    const [data, total] = await Promise.all([
      this.voucherModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.voucherModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã voucher không hợp lệ.');
    const voucher = await this.voucherModel.findById(id).exec();
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher.');
    return voucher;
  }

  async update(id: string, updateVoucherDto: UpdateVoucherDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã voucher không hợp lệ.');

    const existing = await this.voucherModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Không tìm thấy voucher.');
    if (existing.status === VoucherStatus.ACTIVE) {
      throw new BadRequestException('Không thể chỉnh sửa voucher đang chạy. Hãy tắt trước.');
    }

    if (updateVoucherDto.voucherCode && !VOUCHER_CODE_REGEX.test(this.normalizeCode(updateVoucherDto.voucherCode))) {
      throw new BadRequestException(VoucherErrorMessage.INVALID_FORMAT);
    }

    if (
      updateVoucherDto.startDate &&
      updateVoucherDto.endDate &&
      updateVoucherDto.endDate < updateVoucherDto.startDate
    ) {
      throw new BadRequestException(VoucherErrorMessage.INVALID_DATE_RANGE);
    }

    if (
      updateVoucherDto.applyScope === VoucherApplyScope.SPECIFIC_PRODUCTS &&
      updateVoucherDto.applicableProductIds &&
      updateVoucherDto.applicableProductIds.length === 0
    ) {
      throw new BadRequestException('Danh sách sản phẩm áp dụng không được để trống khi phạm vi là SPECIFIC_PRODUCTS.');
    }

    if (
      updateVoucherDto.repeatType === VoucherRepeatType.WEEKLY &&
      updateVoucherDto.repeatDays &&
      updateVoucherDto.repeatDays.length === 0
    ) {
      throw new BadRequestException('Vui lòng cung cấp ngày lặp lại khi sử dụng định kỳ WEEKLY.');
    }

    const updatePayload: UpdateQuery<VoucherDocument> = { ...updateVoucherDto };
    if (updatePayload.voucherCode) {
      updatePayload.voucherCode = this.normalizeCode(updatePayload.voucherCode as string);
    }

    const voucher = await this.voucherModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .exec();
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher.');
    return voucher;
  }

  async activate(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã voucher không hợp lệ.');
    const voucher = await this.voucherModel
      .findByIdAndUpdate(id, { status: VoucherStatus.ACTIVE }, { new: true })
      .exec();
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher.');
    return voucher;
  }

  async disable(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã voucher không hợp lệ.');
    const voucher = await this.voucherModel
      .findByIdAndUpdate(id, { status: VoucherStatus.DISABLED }, { new: true })
      .exec();
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher.');
    return voucher;
  }

  private isWithinGoldenHour(voucher: Voucher) {
    if (!voucher.goldenHourStart || !voucher.goldenHourEnd) return true;
    const now = new Date();
    const [startHour, startMinute] = voucher.goldenHourStart.split(':').map(Number);
    const [endHour, endMinute] = voucher.goldenHourEnd.split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const fromMinutes = startHour * 60 + startMinute;
    const toMinutes = endHour * 60 + endMinute;
    return nowMinutes >= fromMinutes && nowMinutes <= toMinutes;
  }

  private isWithinWeeklyRepeat(voucher: Voucher) {
    if (voucher.repeatType !== VoucherRepeatType.WEEKLY || !voucher.repeatDays?.length) return true;
    const weekDays = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const today = weekDays[new Date().getDay()];
    return voucher.repeatDays.includes(today);
  }

  private computeDiscount(voucher: Voucher, cartTotal: number, eligibleTotal: number) {
    if (cartTotal <= 0 || eligibleTotal <= 0) return 0;
    if (voucher.discountType === VoucherDiscountType.PERCENTAGE) {
      return Math.floor((eligibleTotal * voucher.discountValue) / 100);
    }
    return Math.min(voucher.discountValue, eligibleTotal);
  }

  async validateVoucher(applyVoucherDto: ApplyVoucherDto) {
    const voucherCode = this.normalizeCode(applyVoucherDto.voucherCode);
    const voucher = (await this.voucherModel.findOne({ voucherCode }).exec()) as VoucherDocument | null;

    if (!voucher) throw new NotFoundException('Voucher không tồn tại.');
    if (voucher.status !== VoucherStatus.ACTIVE) throw new BadRequestException('Voucher hiện không khả dụng.');

    const now = new Date();
    if (now < voucher.startDate) throw new BadRequestException('Voucher chưa bắt đầu.');
    if (now > voucher.endDate) {
      await this.voucherModel.findByIdAndUpdate(voucher._id, { status: VoucherStatus.EXPIRED }).exec();
      throw new BadRequestException(VoucherErrorMessage.EXPIRED);
    }

    if (!this.isWithinGoldenHour(voucher)) throw new BadRequestException(VoucherErrorMessage.OUT_OF_GOLDEN_HOUR);
    if (!this.isWithinWeeklyRepeat(voucher)) throw new BadRequestException('Voucher chỉ áp dụng trong ngày lặp lại đã cấu hình.');

    if (voucher.customerScope !== VoucherCustomerScope.ALL_CUSTOMERS) {
      if (!applyVoucherDto.customerScope || applyVoucherDto.customerScope !== voucher.customerScope) {
        throw new BadRequestException('Khách hàng không thuộc phạm vi áp dụng voucher.');
      }
    }

    if (applyVoucherDto.hasDirectDiscount) {
      throw new BadRequestException('Voucher không thể áp dụng cho sản phẩm đã có giảm giá trực tiếp.');
    }

    const cartTotal = applyVoucherDto.cartTotal ?? 0;
    if (voucher.minOrderValue && cartTotal < voucher.minOrderValue) {
      throw new BadRequestException(
        `Đơn hàng tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}đ để dùng voucher này.`,
      );
    }

    if (voucher.usageLimit && voucher.usageLimit > 0) {
      const usedCount = await this.voucherUsageModel.countDocuments({ voucherId: voucher._id });
      if (usedCount >= voucher.usageLimit) {
        throw new BadRequestException('Voucher đã hết lượt sử dụng.');
      }
    }

    if (voucher.applyScope === VoucherApplyScope.SPECIFIC_PRODUCTS) {
      if (!applyVoucherDto.productIds?.length) {
        throw new BadRequestException('Cần cung cấp danh sách sản phẩm để xác thực voucher.');
      }
      const matched = applyVoucherDto.productIds.some(id =>
        voucher.applicableProductIds?.some(productId => productId.toString() === id) ?? false
      );
      if (!matched) throw new BadRequestException('Không có sản phẩm nào trong giỏ phù hợp với voucher.');
    }

    const eligibleTotal =
      voucher.applyScope === VoucherApplyScope.SPECIFIC_PRODUCTS
        ? (applyVoucherDto.eligibleCartTotal ?? applyVoucherDto.cartTotal ?? 0)
        : (applyVoucherDto.cartTotal ?? 0);

    const discountAmount = this.computeDiscount(voucher, applyVoucherDto.cartTotal ?? 0, eligibleTotal);

    return {
      valid: true,
      voucher: {
        voucherCode: voucher.voucherCode,
        voucherName: voucher.voucherName,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        applyScope: voucher.applyScope,
      },
      discountAmount,
    };
  }

  async exportExcel(fields: string[], filters: any) {
    const filter = this.buildFilter(filters || {});
    const data = await this.voucherModel
      .find(filter)
      .select(fields.join(' '))
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return this.excelService.exportData(data, fields);
  }

  async previewImportData(buffer: Buffer, mapping: Record<string, string>) {
    return this.excelService.previewImport(buffer, mapping, [
      'voucherCode', 'voucherName', 'discountType',
      'discountValue', 'startDate', 'endDate',
    ]);
  }
    async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã voucher không hợp lệ.');
    const voucher = await this.voucherModel.findByIdAndDelete(id).exec();
    if (!voucher) throw new NotFoundException('Không tìm thấy voucher.');
    return { message: 'Đã xóa voucher thành công.' };
  }
  async commitImportData(validDataList: any[]) {
    const results = { successCount: 0, failCount: 0, errors: [] as string[] };
    for (const item of validDataList) {
      try {
        await this.create({
          voucherCode: item.voucherCode,
          voucherName: item.voucherName,
          discountType: item.discountType,
          discountValue: Number(item.discountValue),
          applyScope: item.applyScope || 'ALL_PRODUCTS',
          customerScope: item.customerScope || 'ALL_CUSTOMERS',
          repeatType: item.repeatType || 'NONE',
          startDate: new Date(item.startDate),
          endDate: new Date(item.endDate),
          minOrderValue: item.minOrderValue ? Number(item.minOrderValue) : undefined,
          usageLimit: item.usageLimit ? Number(item.usageLimit) : undefined,
          description: item.description,
        });
        results.successCount++;
      } catch (error: any) {
        results.failCount++;
        results.errors.push(`"${item.voucherCode}": ${error.message}`);
      }
    }
    return results;
  }
}