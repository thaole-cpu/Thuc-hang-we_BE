import { 
  Controller, 
  Get, 
  Query,
  Param, 
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { ListProductsDto } from './dto/list-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query() query: ListProductsDto) {
    return this.productsService.findAll(query);
  }

  @Get('best-sellers')
  async findBestSellers(@Query('limit') limit?: string) {
    return this.productsService.findBestSellers(Number(limit) || 8);
  }

  @Get(':id')
  async findOnePublic(@Param('id') id: string) {
    return this.productsService.findOnePublic(id);
  }
}