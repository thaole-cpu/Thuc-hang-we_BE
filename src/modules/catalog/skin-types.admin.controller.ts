import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseInterceptors,
  UploadedFile, Res, UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SkinTypesService } from './skin-types.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import 'multer';

@Controller('admin/skin-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SkinTypesAdminController {
  constructor(private readonly skinTypesService: SkinTypesService) {}

  @Get()
  async getList(@Query() query: any) {
    return this.skinTypesService.findAllWithFilter(query);
  }

  @Post()
  async create(@Body() body: { name: string; code: string; description?: string }) {
    return this.skinTypesService.create(body.name, body.code, body.description);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { name: string; code: string; description?: string },
  ) {
    return this.skinTypesService.update(id, body.name, body.code, body.description);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.skinTypesService.updateStatus(id, body.isActive);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.skinTypesService.delete(id);
  }

  @Post('export')
  async export(
    @Body('fields') fields: string[],
    @Body('filters') filters: any,
    @Res() res: Response,
  ) {
    const buffer = await this.skinTypesService.exportExcel(fields, filters);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="SkinTypes.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingStr: string,
  ) {
    const mapping = JSON.parse(mappingStr);
    return this.skinTypesService.previewImportData(file.buffer, mapping);
  }

  @Post('import/commit')
  async commit(@Body('data') data: any[]) {
    return this.skinTypesService.commitImportData(data);
  }
}