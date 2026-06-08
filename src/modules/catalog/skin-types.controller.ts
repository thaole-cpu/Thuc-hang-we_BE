import { Controller, Get } from '@nestjs/common';
import { SkinTypesService } from './skin-types.service';

@Controller('skin-types')
export class SkinTypesController {
  constructor(private readonly skinTypesService: SkinTypesService) {}
  @Get()
  findAll() {
    return this.skinTypesService.findAll();
  }
}