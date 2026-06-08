import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { Product, ProductDocument } from './schemas/product.schema';
import { ExcelBaseService } from '../../shared/csv/excel.service';
import { QueryBuilder } from '../../common/utils/pagination.util';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
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
    return this.categoryModel.find({ isDeleted: false, isActive: true }).exec();
  }

  async findAllWithFilter(query: any) {
    const { filter, skip, limit, sort } = QueryBuilder.build(query, ['name', 'code']);
    filter.isDeleted = false;
    const [data, total] = await Promise.all([
      this.categoryModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.categoryModel.countDocuments(filter),
    ]);
    return { data, total, page: query.page || 1, limit };
  }

  async create(name: string, code: string, description?: string) {
    const slug = this.generateSlug(name);

    // Báo lỗi rõ từng trường bị trùng
    const existingName = await this.categoryModel.findOne({ name, isDeleted: false });
    if (existingName) throw new BadRequestException(`Tên danh mục "${name}" đã tồn tại`);

    const existingCode = await this.categoryModel.findOne({ code: code.toUpperCase(), isDeleted: false });
    if (existingCode) throw new BadRequestException(`Mã danh mục "${code.toUpperCase()}" đã tồn tại`);

    const existingSlug = await this.categoryModel.findOne({ slug, isDeleted: false });
    if (existingSlug) throw new BadRequestException(`Tên danh mục "${name}" bị trùng slug với danh mục khác`);

    const category = new this.categoryModel({
      name,
      code: code.toUpperCase(),
      slug,
      description: description || '',
      isActive: true,
      isDeleted: false,
    });
    return category.save();
  }

  async update(id: string, name: string, code: string, description?: string) {
    const slug = this.generateSlug(name);

    // Kiểm tra trùng tên/code với danh mục khác (không phải chính nó)
    const existingName = await this.categoryModel.findOne({ name, isDeleted: false, _id: { $ne: id } });
    if (existingName) throw new BadRequestException(`Tên danh mục "${name}" đã tồn tại`);

    const existingCode = await this.categoryModel.findOne({ code: code.toUpperCase(), isDeleted: false, _id: { $ne: id } });
    if (existingCode) throw new BadRequestException(`Mã danh mục "${code.toUpperCase()}" đã tồn tại`);

    const updated = await this.categoryModel.findByIdAndUpdate(
      id,
      { name, code: code.toUpperCase(), slug, description: description || '' },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Không tìm thấy danh mục');
    return updated;
  }

  async updateStatus(id: string, isActive: boolean) {
    const updated = await this.categoryModel.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { new: true, runValidators: false },
    );
    if (!updated) throw new NotFoundException('Không tìm thấy danh mục');
    return updated;
  }

  async delete(id: string) {
    const category = await this.categoryModel.findOne({ _id: id, isDeleted: false });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');

    const productCount = await this.productModel.countDocuments({
      category: id,
      isDeleted: false,
    });
    if (productCount > 0) {
      throw new BadRequestException(
        `Không thể xóa danh mục "${category.name}" vì còn ${productCount} sản phẩm đang sử dụng.`,
      );
    }

    await this.categoryModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    return { message: 'Đã xóa danh mục' };
  }

  async exportExcel(fieldsToExport: string[], queryFilters: any) {
    const { filter, sort } = QueryBuilder.build(queryFilters || {}, ['name', 'code']);
    filter.isDeleted = false;
    const data = await this.categoryModel
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
      ['name', 'code'],   // bắt buộc
      ['name', 'code'],   // không được trùng trong file
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