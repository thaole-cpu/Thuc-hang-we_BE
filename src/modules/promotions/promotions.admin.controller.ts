import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Query, Body, UseGuards,
  UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { ListPromotionsDto } from './dto/list-promotions.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import 'multer';

@Controller('admin/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PromotionsAdminController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  create(@Body() dto: CreatePromotionDto) {
    return this.promotionsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListPromotionsDto) {
    return this.promotionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promotionsService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.promotionsService.update(id, dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.promotionsService.activate(id);
  }

  @Patch(':id/disable')
  disable(@Param('id') id: string) {
    return this.promotionsService.disable(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promotionsService.remove(id);
  }

  // ====== EXPORT ======
  @Post('export')
  async export(
    @Body('fields') fields: string[],
    @Body('filters') filters: any,
    @Res() res: Response,
  ) {
    const buffer = await this.promotionsService.exportExcel(
      fields || ['name', 'status', 'discountType', 'discountValue', 'applyScope', 'startDate', 'endDate'],
      filters,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Promotions.xlsx"',
    });
    res.send(buffer);
  }

  // ====== IMPORT ======
  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingStr: string,
  ) {
    const mapping = JSON.parse(mappingStr);
    return this.promotionsService.previewImportData(file.buffer, mapping);
  }

  @Post('import/commit')
  async commit(@Body('data') data: any[]) {
    return this.promotionsService.commitImportData(data);
  }
}