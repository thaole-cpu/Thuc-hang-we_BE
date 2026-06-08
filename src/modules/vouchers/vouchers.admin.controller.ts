import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Query, Body, UseGuards,
  UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';
import { ListVouchersDto } from './dto/list-vouchers.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import 'multer';

@Controller('admin/vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class VouchersAdminController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.vouchersService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListVouchersDto) {
    return this.vouchersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vouchersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVoucherDto) {
    return this.vouchersService.update(id, dto);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.vouchersService.activate(id);
  }

  @Patch(':id/disable')
  disable(@Param('id') id: string) {
    return this.vouchersService.disable(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.vouchersService.remove(id);
  }

  // ====== EXPORT ======
  @Post('export')
  async export(
    @Body('fields') fields: string[],
    @Body('filters') filters: any,
    @Res() res: Response,
  ) {
    const buffer = await this.vouchersService.exportExcel(
      fields || ['voucherCode', 'voucherName', 'status', 'discountType', 'discountValue', 'startDate', 'endDate'],
      filters,
    );
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Vouchers.xlsx"',
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
    return this.vouchersService.previewImportData(file.buffer, mapping);
  }

  @Post('import/commit')
  async commit(@Body('data') data: any[]) {
    return this.vouchersService.commitImportData(data);
  }
}