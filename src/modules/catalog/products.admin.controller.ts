import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Patch, 
  Body, 
  Param, 
  Query,
  UseGuards, 
  UseInterceptors, 
  UploadedFiles,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const imageStorage = diskStorage({
  destination: './uploads/products',
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `product-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const imageFilter = (req: any, file: Express.Multer.File, cb: any) => {
  if (!/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) {
    return cb(new BadRequestException('Chỉ chấp nhận jpg, png, webp'), false);
  }
  cb(null, true);
};

const getImageUrl = (filename: string): string => `/uploads/products/${filename}`;

@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProductsAdminController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
    uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có file được gửi lên');
    return {
      url: `/uploads/products/${file.filename}`, 
      filename: file.filename,
  };
  }

  @Get()
  async findAllAdmin(@Query() query: ListProductsDto) {
    return this.productsService.findAllAdmin(query);
  }

  @Get(':id')
  async findOneAdmin(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'mainImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ], {
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files: { 
      mainImage?: Express.Multer.File[], 
      galleryImages?: Express.Multer.File[],
    }
  ) {
    if (files?.mainImage?.[0]) {
      createProductDto.mainImage = getImageUrl(files.mainImage[0].filename);
    }
    if (files?.galleryImages?.length) {
      createProductDto.galleryImages = files.galleryImages.map(f => getImageUrl(f.filename));
    }
    return this.productsService.create(createProductDto);
  }

  @Put(':id')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'mainImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 },
  ], {
    storage: imageStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async update(
    @Param('id') id: string, 
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles() files: { 
      mainImage?: Express.Multer.File[], 
      galleryImages?: Express.Multer.File[],
    }
  ) {
    if (files?.mainImage?.[0]) {
      updateProductDto.mainImage = getImageUrl(files.mainImage[0].filename);
    }
    if (files?.galleryImages?.length) {
      updateProductDto.galleryImages = files.galleryImages.map(f => getImageUrl(f.filename));
    }
    return this.productsService.update(id, updateProductDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.productsService.updateStatus(id, body.isActive);
  }

  @Patch(':id/toggle')
  toggleStatus(@Param('id') id: string) {
    return this.productsService.toggleStatus(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}