import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddPhoneDto } from './dto/add-phone.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { AddAddressDto } from './dto/add-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { SaveVoucherDto } from './dto/save-voucher.dto';
import 'multer';

const resolveUserId = (user: Record<string, unknown>): string =>
  String(user.sub || user.id || user.userId || '');

const avatarStorage = diskStorage({
  destination: './uploads/avatars',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `avatar-${uniqueSuffix}${extname(file.originalname)}`);
  },
});

const avatarFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  if (!/\.(jpg|jpeg|png|webp)$/i.test(file.originalname)) {
    return cb(new BadRequestException('Chỉ chấp nhận jpg, png, webp'), false);
  }
  cb(null, true);
};

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return this.usersService.getMe(resolveUserId(user));
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(resolveUserId(user), dto);
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: avatarStorage,
      fileFilter: avatarFilter,
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Không có file được gửi lên');
    const url = `/uploads/avatars/${file.filename}`;
    await this.usersService.updateAvatarUrl(resolveUserId(user), url);
    return { url, avatar_url: url };
  }

  @Get('me/vouchers')
  async getSavedVouchers(@CurrentUser() user: any) {
    const me = await this.usersService.getMe(resolveUserId(user));
    return { savedVouchers: me.savedVouchers || [] };
  }

  @Post('me/vouchers')
  async saveVoucher(@CurrentUser() user: any, @Body() dto: SaveVoucherDto) {
    const list = await this.usersService.addSavedVoucher(resolveUserId(user), dto);
    return { savedVouchers: list };
  }

  @Delete('me/vouchers/:code')
  async removeSavedVoucher(@CurrentUser() user: any, @Param('code') code: string) {
    return this.usersService.removeSavedVoucher(resolveUserId(user), code);
  }

  @Get('me/preferences')
  async getPreferences(@CurrentUser() user: any) {
    return {
      success: true,
      data: await this.usersService.getPreferences(resolveUserId(user)),
    };
  }

  @Patch('me/preferences')
  async updatePreferences(@CurrentUser() user: any, @Body() dto: UpdatePreferencesDto) {
    return {
      success: true,
      data: await this.usersService.updatePreferences(resolveUserId(user), dto),
    };
  }

  @Post('phones')
  async addPhone(@CurrentUser() user: any, @Body() dto: AddPhoneDto) {
    return this.usersService.addPhone(resolveUserId(user), dto);
  }

  @Patch('phones/:phoneId')
  async updatePhone(@CurrentUser() user: any, @Param('phoneId') phoneId: string, @Body() dto: UpdatePhoneDto) {
    return this.usersService.updatePhone(resolveUserId(user), phoneId, dto);
  }

  @Patch('phones/:phoneId/default')
  async setDefaultPhone(@CurrentUser() user: any, @Param('phoneId') phoneId: string) {
    return this.usersService.setDefaultPhone(resolveUserId(user), phoneId);
  }

  @Delete('phones/:phoneId')
  async removePhone(@CurrentUser() user: any, @Param('phoneId') phoneId: string) {
    return this.usersService.removePhone(resolveUserId(user), phoneId);
  }

  @Post('addresses')
  async addAddress(@CurrentUser() user: any, @Body() dto: AddAddressDto) {
    return this.usersService.addAddress(resolveUserId(user), dto);
  }

  @Patch('addresses/:addressId')
  async updateAddress(@CurrentUser() user: any, @Param('addressId') addressId: string, @Body() dto: UpdateAddressDto) {
    return this.usersService.updateAddress(resolveUserId(user), addressId, dto);
  }

  @Patch('addresses/:addressId/default')
  async setDefaultAddress(@CurrentUser() user: any, @Param('addressId') addressId: string) {
    return this.usersService.setDefaultAddress(resolveUserId(user), addressId);
  }

  @Delete('addresses/:addressId')
  async removeAddress(@CurrentUser() user: any, @Param('addressId') addressId: string) {
    return this.usersService.removeAddress(resolveUserId(user), addressId);
  }
}
