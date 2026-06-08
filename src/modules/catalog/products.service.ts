import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Category, CategoryDocument } from './schemas/category.schema';
import { SkinType, SkinTypeDocument } from './schemas/skin-type.schema';
import { ListProductsDto } from './dto/list-products.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PromotionsService } from '../promotions/promotions.service';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { OrderStatus } from '../../common/constants/order-status.constant';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(SkinType.name) private skinTypeModel: Model<SkinTypeDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly promotionsService: PromotionsService, 
  ) {}

  private generateSlug(name: string): string {
    return name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/([^0-9a-z-\s])/g, '')
      .replace(/(\s+)/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') + '-' + Date.now();
  }

  private generateAutoSKU(categoryCode: string, name: string): string {
    const acronym = name.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join('')
      .toUpperCase();
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${categoryCode.toUpperCase()}-${acronym}${year}-${random}`;
  }

  private applySearchFilter(filters: Record<string, unknown>, search?: string) {
    if (!search?.trim()) return;
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filters.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { sku: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }

  private applyIsActiveFilter(filters: Record<string, unknown>, isActive?: string) {
    if (isActive === 'true') filters.isActive = true;
    else if (isActive === 'false') filters.isActive = false;
  }

  private validateVariants(variants?: CreateProductDto['variants']) {
    if (!variants?.length) {
      throw new BadRequestException('Sản phẩm phải có ít nhất một phân loại');
    }
    for (const variant of variants) {
      if (!variant.variantName?.trim()) {
        throw new BadRequestException('Tên phân loại không được để trống');
      }
    }
  }

  async create(dto: CreateProductDto): Promise<ProductDocument> {
    this.validateVariants(dto.variants);

    const category = await this.categoryModel.findById(dto.category).exec();
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');

    const sku = this.generateAutoSKU(category.code || 'GEN', dto.name);
    const existingProduct = await this.productModel.findOne({ sku }).exec();
    if (existingProduct) throw new BadRequestException('Mã SKU đã tồn tại, vui lòng thử lại');

    const slug = this.generateSlug(dto.name);
    
    // Tính toán lợi nhuận và set mặc định reservedQty cho các variants
    const variants = dto.variants?.map((v) => ({
      ...v,
      reservedQty: 0,
      profit: (v.priceSell || 0) - (v.priceImport || 0),
    })) || [];

    // Map chuẩn Category ID và SkinType IDs
    const skinTypeIds = dto.skinTypes?.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id)) || [];

    return new this.productModel({ 
      ...dto, 
      category: new Types.ObjectId(dto.category), 
      skinTypes: skinTypeIds,
      // Đảm bảo lấy đúng ảnh
      mainImage: dto.mainImage,
      galleryImages: dto.galleryImages || [],
      sku, 
      slug, 
      variants,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      isDeleted: false 
    }).save();
  }

  async findOne(id: string): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid Product ID');
    
    const product = await this.productModel.findOne({ _id: id, isDeleted: false }).exec();
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');

    try {
      if (product.category && Types.ObjectId.isValid(product.category.toString())) {
        await product.populate({ path: 'category', select: 'name code slug' });
      }
      await product.populate({ path: 'skinTypes', select: 'name code' });
    } catch (err) {}

    return product;
  }

  async findOnePublic(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid Product ID');
    
    const product = await this.productModel.findOne({ _id: id, isDeleted: false, isActive: true })
      .select('-variants.priceImport -variants.profit')
      .exec();
    if (!product) throw new NotFoundException('Product not found or hidden');

    try {
      if (product.category && Types.ObjectId.isValid(product.category.toString())) {
        await product.populate({ path: 'category', select: 'name code slug' });
      }
      await product.populate({ path: 'skinTypes', select: 'name code' });
    } catch (err) {}

    const productObj = product.toObject();
    productObj.variants = await Promise.all(
      productObj.variants.map(async (variant: any) => {
        const activePrice = await this.promotionsService.calculateActivePrice(productObj._id.toString(), variant.priceSell);
        return {
          ...variant,
          originalPrice: variant.priceSell, 
          priceSell: activePrice            
        };
      })
    );

    return productObj;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid Product ID');
    const existing = await this.productModel.findById(id).exec();
    if (!existing || existing.isDeleted) throw new NotFoundException('Không tìm thấy sản phẩm');

    if (dto.variants) {
      this.validateVariants(dto.variants as CreateProductDto['variants']);
    }

    const updateData: any = { ...dto };

    // Sinh slug mới nếu đổi tên
    if (dto.name && dto.name !== existing.name) {
      updateData.slug = this.generateSlug(dto.name);
    }
    
    // Convert Category ID
    if (dto.category) {
      updateData.category = new Types.ObjectId(dto.category);
    }

    // Convert SkinType IDs
    if (dto.skinTypes) {
      updateData.skinTypes = dto.skinTypes.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
    }

    // Xử lý giữ nguyên reservedQty của Variant cũ
    if (dto.variants) {
      updateData.variants = dto.variants.map((v: any) => {
        const oldVariant = existing.variants.find(ov => ov.variantName === v.variantName);
        return { 
          ...v, 
          reservedQty: oldVariant ? oldVariant.reservedQty : 0,
          profit: (v.priceSell || 0) - (v.priceImport || 0) 
        };
      });
    }

    const updated = await this.productModel.findByIdAndUpdate(
      id, 
      { $set: updateData }, 
      { new: true }
    ).exec();
    
    if (!updated) throw new NotFoundException('Update failed');
    return updated;
  }

  async findAll(query: ListProductsDto) {
    const { search, category, skinTypes, minPrice, maxPrice, page = 1, limit = 10 } = query;
    const filters: any = { isDeleted: false, isActive: true };

    this.applySearchFilter(filters, search);
    
    if (category && Types.ObjectId.isValid(category)) {
      filters.category = new Types.ObjectId(category);
    }
    
    if (skinTypes && skinTypes.length > 0) {
      const ids = Array.isArray(skinTypes) ? skinTypes : [skinTypes];
      const validIds = ids.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
      if (validIds.length > 0) {
        filters.skinTypes = { $in: validIds };
      }
    }

    if (minPrice || maxPrice) {
      filters['variants.priceSell'] = {
        ...(minPrice !== undefined && { $gte: minPrice }),
        ...(maxPrice !== undefined && { $lte: maxPrice }),
      };
    }

    const skip = (page - 1) * limit;

    const [rawProducts, total] = await Promise.all([
      this.productModel.find(filters)
        .select('-variants.priceImport -variants.profit')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filters),
    ]);

    const data = await Promise.all(
      rawProducts.map(async (product) => {
        let popProduct: any = product;
        try {
          if (product.category && Types.ObjectId.isValid(product.category.toString())) {
            popProduct = await product.populate([
              { path: 'category', select: 'name code slug' },
              { path: 'skinTypes', select: 'name code' }
            ]);
          }
        } catch (err) {}
        
        const productObj = popProduct.toObject ? popProduct.toObject() : popProduct;
        
        // Tính giá đã áp dụng khuyến mãi
        productObj.variants = await Promise.all(
          productObj.variants.map(async (variant: any) => {
            const activePrice = await this.promotionsService.calculateActivePrice(productObj._id.toString(), variant.priceSell);
            return {
              ...variant,
              originalPrice: variant.priceSell,
              priceSell: activePrice
            };
          })
        );
        return productObj;
      })
    );
    
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async findAllAdmin(query: ListProductsDto) {
    const { search, category, skinTypes, minPrice, maxPrice, isActive, page = 1, limit = 10 } = query;
    const filters: any = { isDeleted: false };

    this.applySearchFilter(filters, search);
    this.applyIsActiveFilter(filters, isActive);

    if (category && Types.ObjectId.isValid(category)) {
      filters.category = new Types.ObjectId(category);
    }

    if (skinTypes && skinTypes.length > 0) {
      const ids = Array.isArray(skinTypes) ? skinTypes : [skinTypes];
      const validIds = ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
      if (validIds.length > 0) {
        filters.skinTypes = { $in: validIds };
      }
    }

    if (minPrice || maxPrice) {
      filters['variants.priceSell'] = {
        ...(minPrice !== undefined && { $gte: minPrice }),
        ...(maxPrice !== undefined && { $lte: maxPrice }),
      };
    }

    const skip = (page - 1) * limit;

    const [rawProducts, total] = await Promise.all([
      this.productModel
        .find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filters),
    ]);

    const data = await Promise.all(
      rawProducts.map(async (product) => {
        let popProduct: any = product;
        try {
          if (product.category && Types.ObjectId.isValid(product.category.toString())) {
            popProduct = await product.populate([
              { path: 'category', select: 'name code slug' },
              { path: 'skinTypes', select: 'name code' },
            ]);
          }
        } catch (err) {}

        return popProduct.toObject ? popProduct.toObject() : popProduct;
      }),
    );

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  private async enrichPublicProduct(product: ProductDocument | any) {
    let popProduct: any = product;
    try {
      if (product.category && Types.ObjectId.isValid(product.category.toString())) {
        popProduct = await product.populate([
          { path: 'category', select: 'name code slug' },
          { path: 'skinTypes', select: 'name code' },
        ]);
      }
    } catch (err) {}

    const productObj = popProduct.toObject ? popProduct.toObject() : { ...popProduct };
    productObj.variants = await Promise.all(
      (productObj.variants || []).map(async (variant: any) => {
        const activePrice = await this.promotionsService.calculateActivePrice(
          productObj._id.toString(),
          variant.priceSell,
        );
        return {
          ...variant,
          originalPrice: variant.priceSell,
          priceSell: activePrice,
        };
      }),
    );
    return productObj;
  }

  /** Top sản phẩm bán chạy theo số lượng đã bán (đơn đã thanh toán) */
  async findBestSellers(limit = 8) {
    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);

    const salesRank = await this.orderModel.aggregate([
      {
        $match: {
          paymentStatus: 'PAID',
          status: { $ne: OrderStatus.CANCELLED },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: { $ifNull: ['$items.quantity', 0] } },
        },
      },
      { $match: { _id: { $ne: null }, totalSold: { $gt: 0 } } },
      { $sort: { totalSold: -1 } },
      { $limit: safeLimit },
    ]);

    const rankedIds = salesRank
      .map((row) => row._id?.toString())
      .filter((id) => id && Types.ObjectId.isValid(id));

    const soldMap = new Map(
      salesRank.map((row) => [row._id?.toString(), row.totalSold as number]),
    );

    const rankedProducts: any[] = [];
    if (rankedIds.length > 0) {
      const objectIds = rankedIds.map((id) => new Types.ObjectId(id));
      const found = await this.productModel
        .find({ _id: { $in: objectIds }, isDeleted: false, isActive: true })
        .select('-variants.priceImport -variants.profit')
        .exec();

      const foundMap = new Map(found.map((p) => [p._id.toString(), p]));
      for (const id of rankedIds) {
        const doc = foundMap.get(id);
        if (!doc) continue;
        const enriched = await this.enrichPublicProduct(doc);
        rankedProducts.push({
          ...enriched,
          totalSold: soldMap.get(id) ?? 0,
        });
      }
    }

    if (rankedProducts.length < safeLimit) {
      const excludeIds = rankedProducts.map((p) => p._id);
      const fillers = await this.productModel
        .find({
          _id: { $nin: excludeIds },
          isDeleted: false,
          isActive: true,
        })
        .select('-variants.priceImport -variants.profit')
        .sort({ createdAt: -1 })
        .limit(safeLimit - rankedProducts.length)
        .exec();

      for (const doc of fillers) {
        const enriched = await this.enrichPublicProduct(doc);
        rankedProducts.push({ ...enriched, totalSold: 0 });
      }
    }

    return {
      data: rankedProducts.slice(0, safeLimit),
      total: rankedProducts.length,
    };
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID sản phẩm không hợp lệ');

    const product = await this.productModel.findOne({ _id: id, isDeleted: false });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');

    const activeOrderCount = await this.orderModel.countDocuments({
      status: { $nin: [OrderStatus.CANCELLED, OrderStatus.COMPLETED] },
      'items.productId': new Types.ObjectId(id),
    });
    if (activeOrderCount > 0) {
      throw new BadRequestException(
        `Không thể xóa sản phẩm "${product.name}" vì còn ${activeOrderCount} đơn hàng đang xử lý.`,
      );
    }

    await this.productModel.findByIdAndUpdate(id, { isDeleted: true });
    return { message: 'Đã đưa sản phẩm vào thùng rác' };
  }

  async updateStatus(id: string, isActive: boolean): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID sản phẩm không hợp lệ');

    const updated = await this.productModel.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { new: true, runValidators: false },
    );
    if (!updated || updated.isDeleted) throw new NotFoundException('Không tìm thấy sản phẩm');
    return updated;
  }

  async toggleStatus(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findOne({ _id: id, isDeleted: false });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    return this.updateStatus(id, !product.isActive);
  }

  // ==== KHO HÀNG ====

  async holdStock(productId: string, variantName: string, quantity: number, session?: any): Promise<void> {
    const product = await this.productModel.findOne({ _id: productId, isDeleted: false, isActive: true }).session(session).exec();
    if (!product) {
      throw new BadRequestException('Sản phẩm không tồn tại hoặc đã bị ẩn.');
    }

    const variant = product.variants.find(v => v.variantName === variantName);
    if (!variant) {
      throw new BadRequestException(`Không tìm thấy biến thể ${variantName} của sản phẩm.`);
    }

    const availableQty = variant.stockQty - variant.reservedQty;
    if (availableQty < quantity) {
      throw new BadRequestException(`Biến thể ${variantName} không đủ số lượng tồn khả dụng. Hiện có: ${availableQty > 0 ? availableQty : 0}, yêu cầu: ${quantity}`);
    }

    await this.productModel.updateOne(
      {
        _id: productId,
        'variants.variantName': variantName
      },
      {
        $inc: { 'variants.$.reservedQty': quantity }
      },
      { session }
    ).exec();
  }

  async releaseStock(productId: string, variantName: string, quantity: number, session?: any): Promise<void> {
    await this.productModel.updateOne(
      { _id: productId, 'variants.variantName': variantName },
      { $inc: { 'variants.$.reservedQty': -quantity } },
      { session },
    ).exec();
  }

  async confirmDecreaseStock(productId: string, variantName: string, quantity: number, session?: any): Promise<void> {
    await this.productModel.updateOne(
      { _id: productId, 'variants.variantName': variantName },
      { 
        $inc: { 
          'variants.$.stockQty': -quantity,
          'variants.$.reservedQty': -quantity 
        } 
      },
      { session },
    ).exec();
  }

  async restockPhysical(productId: string, variantName: string, quantity: number, session?: any): Promise<void> {
    await this.productModel.updateOne(
      { _id: productId, 'variants.variantName': variantName },
      { $inc: { 'variants.$.stockQty': quantity } },
      { session },
    ).exec();
  }
}