import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SkinType, SkinTypeDocument } from './schemas/skin-type.schema';
import { Product, ProductDocument } from './schemas/product.schema';
import { ExcelBaseService } from '../../shared/csv/excel.service';
import { QueryBuilder } from '../../common/utils/pagination.util';

@Injectable()
export class SkinTypesService {
  constructor(
    @InjectModel(SkinType.name) private skinTypeModel: Model<SkinTypeDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly excelService: ExcelBaseService,
  ) {}

  private generateSlug(name: string): string {
    return name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/([^0-9a-z-\s])/g, '')
      .replace(/(\s+)/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async findAll() {
    return this.skinTypeModel.find({ isDeleted: false, isActive: true }).exec();
  }

  async findAllWithFilter(query: any) {
    const { filter, skip, limit, sort } = QueryBuilder.build(query, ['name', 'code']);
    filter.isDeleted = false;
    const [data, total] = await Promise.all([
      this.skinTypeModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.skinTypeModel.countDocuments(filter),
    ]);
    return { data, total, page: query.page || 1, limit };
  }

  async create(name: string, code: string, description?: string) {
    const slug = this.generateSlug(name);

    const existingName = await this.skinTypeModel.findOne({ name, isDeleted: false });
    if (existingName) throw new BadRequestException(`Tên loại da "${name}" đã tồn tại`);

    const existingCode = await this.skinTypeModel.findOne({ code: code.toUpperCase(), isDeleted: false });
    if (existingCode) throw new BadRequestException(`Mã loại da "${code.toUpperCase()}" đã tồn tại`);

    const existingSlug = await this.skinTypeModel.findOne({ slug, isDeleted: false });
    if (existingSlug) throw new BadRequestException(`Tên loại da "${name}" bị trùng slug với loại da khác`);

    const skinType = new this.skinTypeModel({
      name,
      code: code.toUpperCase(),
      slug,
      description: description || '',
      isActive: true,
      isDeleted: false,
    });
    return skinType.save();
  }

  async update(id: string, name: string, code: string, description?: string) {
    const slug = this.generateSlug(name);

    const existingName = await this.skinTypeModel.findOne({ name, isDeleted: false, _id: { $ne: id } });
    if (existingName) throw new BadRequestException(`Tên loại da "${name}" đã tồn tại`);

    const existingCode = await this.skinTypeModel.findOne({ code: code.toUpperCase(), isDeleted: false, _id: { $ne: id } });
    if (existingCode) throw new BadRequestException(`Mã loại da "${code.toUpperCase()}" đã tồn tại`);

    const updated = await this.skinTypeModel.findByIdAndUpdate(
      id,
      { name, code: code.toUpperCase(), slug, description: description || '' },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Không tìm thấy loại da');
    return updated;
  }

  async updateStatus(id: string, isActive: boolean) {
    const updated = await this.skinTypeModel.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { new: true, runValidators: false },
    );
    if (!updated) throw new NotFoundException('Không tìm thấy loại da');
    return updated;
  }

  async delete(id: string) {
    const skinType = await this.skinTypeModel.findOne({ _id: id, isDeleted: false });
    if (!skinType) throw new NotFoundException('Không tìm thấy loại da');

    const productCount = await this.productModel.countDocuments({
      skinTypes: id,
      isDeleted: false,
    });
    if (productCount > 0) {
      throw new BadRequestException(
        `Không thể xóa loại da "${skinType.name}" vì còn ${productCount} sản phẩm đang sử dụng.`,
      );
    }

    await this.skinTypeModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    return { message: 'Đã xóa loại da' };
  }

  async exportExcel(fieldsToExport: string[], queryFilters: any) {
    const { filter, sort } = QueryBuilder.build(queryFilters || {}, ['name', 'code']);
    filter.isDeleted = false;
    const data = await this.skinTypeModel
      .find(filter)
      .select(fieldsToExport.join(' '))
      .sort(sort)
      .lean()
      .exec();
    return this.excelService.exportData(data, fieldsToExport);
  }

  async previewImportData(buffer: Buffer, mapping: Record<string, string>) {
    return this.excelService.previewImport(
      buffer,
      mapping,
      ['name', 'code'],
      ['name', 'code'],
    );
  }

  async commitImportData(validDataList: any[]) {
    const results = {
      successCount: 0,
      failCount: 0,
      errors: [] as string[],
    };

    for (const item of validDataList) {
      try {
        await this.create(item.name, item.code, item.description);
        results.successCount++;
      } catch (error: any) {
        results.failCount++;
        results.errors.push(`"${item.name}" (${item.code}): ${error.message}`);
      }
    }

    return results;
  }
}
