import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from './schemas/user.schema';
import {
  EmailVerifyToken,
  EmailVerifyTokenDocument,
} from './schemas/email-verify-token.schema';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';
import {
  RefreshToken,
  RefreshTokenDocument,
} from './schemas/refresh-token.schema';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendVerifyEmailDto } from './dto/resend-verify-email.dto';
import { MailService } from '../../shared/mail/mail.service';
import { Role } from '../../common/constants/roles.constant';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(EmailVerifyToken.name)
    private readonly verifyModel: Model<EmailVerifyTokenDocument>,

    @InjectModel(PasswordResetToken.name)
    private readonly resetModel: Model<PasswordResetTokenDocument>,

    @InjectModel(RefreshToken.name)
    private readonly refreshModel: Model<RefreshTokenDocument>,

    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'production') return;
    await this.seedAdminAccount();
  }

  private async seedAdminAccount() {
    const adminEmail = 'boss@luranashop.com';
    const adminPassword = 'Password123@';

    let admin = await this.userModel.findOne({ email: adminEmail }).select('+password');

    if (!admin) {
      admin = new this.userModel({
        email: adminEmail,
        password: await this.hashPassword(adminPassword),
        name: 'Super Admin',
        fullName: 'Super Admin',
        roles: ['ADMIN'],
        isEmailVerified: true,
      });
      await admin.save();
      this.logger.log(`[SEED] Created default admin account: ${adminEmail}`);
    } else {
      const valid = await this.verifyPassword(adminPassword, admin.password);
      if (!valid) {
        admin.password = await this.hashPassword(adminPassword);
        await admin.save();
        this.logger.log('[SEED] Reset default admin password.');
      }
    }
  }

  private generateNumericCode(length = 4): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return crypto.randomInt(min, max).toString();
  }

  private generateRandomToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private async verifyPassword(plain: string, stored?: string | null): Promise<boolean> {
    if (!stored) return false;
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
      return bcrypt.compare(plain, stored);
    }
    return plain === stored;
  }

  private async createAndSendVerifyCode(userId: Types.ObjectId, email: string) {
    await this.verifyModel.updateMany(
      { userId, used: false },
      { used: true },
    );

    const code = this.generateNumericCode(6);

    await this.verifyModel.create({
      userId,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });

    await this.mailService.sendVerifyEmail(email, code);
    return code;
  }

  private async sendVerifyEmailOrCleanup(userId: Types.ObjectId, email: string) {
    try {
      await this.createAndSendVerifyCode(userId, email);
    } catch (error) {
      this.logger.error('[Auth] Gửi email xác thực thất bại:', error);
      await this.verifyModel.deleteMany({ userId });
      await this.userModel.deleteOne({ _id: userId });
      throw new BadRequestException(
        'Không gửi được email xác thực. Vui lòng thử đăng ký lại sau vài phút.',
      );
    }
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const existing = await this.userModel.findOne({ email }).select('+password');

    if (existing?.isEmailVerified) {
      throw new BadRequestException('Email đã tồn tại');
    }

    // Email chưa xác thực (lần trước gửi mail lỗi / user bỏ dở): cập nhật và gửi lại OTP
    if (existing && !existing.isEmailVerified) {
      existing.password = await this.hashPassword(dto.password);
      existing.fullName = dto.name?.trim() || existing.fullName || 'New User';
      await existing.save();

      await this.sendVerifyEmailOrCleanup(existing._id as Types.ObjectId, email);

      return {
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để lấy mã xác thực 6 số.',
        email,
      };
    }

    const user = new this.userModel({
      email,
      password: await this.hashPassword(dto.password),
      fullName: dto.name || 'New User',
      isEmailVerified: false,
      roles: [Role.USER],
    });
    await user.save();

    await this.sendVerifyEmailOrCleanup(user._id as Types.ObjectId, email);

    return {
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để lấy mã xác thực 6 số.',
      email,
    };
  }

  async resendVerifyEmail(dto: ResendVerifyEmailDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel.findOne({ email });

    if (!user) {
      return { message: 'Nếu email tồn tại, mã xác thực đã được gửi lại' };
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email này đã được xác thực');
    }

    try {
      await this.createAndSendVerifyCode(user._id as Types.ObjectId, email);
    } catch (error) {
      this.logger.error('[Auth] Gửi lại email xác thực thất bại:', error);
      throw new BadRequestException('Không gửi được email. Vui lòng thử lại sau.');
    }

    return { message: 'Đã gửi lại mã xác thực tới email của bạn' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new BadRequestException('Email không tồn tại');
    }

    const token = await this.verifyModel.findOne({
      userId: user._id,
      code: dto.code,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!token) {
      throw new BadRequestException('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }

    user.isEmailVerified = true;
    await user.save();

    token.used = true;
    await token.save();

    return {
      message: 'Xác thực email thành công',
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.userModel.findOne({ email }).select('+password').exec();

    if (!user) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    const passwordOk = await this.verifyPassword(dto.password, user.password);
    if (!passwordOk) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    if (user.status === 'blocked') {
      throw new UnauthorizedException('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.');
    }

    if (!user.isEmailVerified && !(user.roles || []).includes(Role.ADMIN)) {
      throw new UnauthorizedException(
        'EMAIL_NOT_VERIFIED: Vui lòng xác thực email trước khi đăng nhập',
      );
    }

    const accessToken = this.jwtService.sign(
      { sub: user._id, email: user.email, roles: user.roles },
      { expiresIn: '1d' },
    );

    const refreshToken = this.generateRandomToken();

    await this.refreshModel.create({
      userId: user._id as Types.ObjectId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revoked: false,
    });

    return {
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        roles: user.roles,
        name: user.fullName,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const stored = await this.refreshModel.findOne({
      token: dto.refreshToken,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const user = await this.userModel.findById(stored.userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    stored.revoked = true;
    await stored.save();

    const newAccessToken = this.jwtService.sign(
      { sub: user._id, email: user.email, roles: user.roles },
      { expiresIn: '1d' },
    );

    const newRefreshToken = this.generateRandomToken();

    await this.refreshModel.create({
      userId: user._id as Types.ObjectId,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revoked: false,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.userModel.findOne({ email }).lean();
    const genericMessage = 'Nếu email tồn tại, hệ thống đã gửi mã đặt lại mật khẩu';

    if (!user) return { message: genericMessage };

    const code = this.generateNumericCode(4);
    await this.resetModel.create({
      email,
      code,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
    });

    try {
      await this.mailService.sendResetCode(email, code);
    } catch (error) {
      this.logger.error('[Auth] Gửi email reset thất bại:', error);
      throw new BadRequestException('Không gửi được email. Vui lòng thử lại sau.');
    }

    return { message: genericMessage };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmNewPassword) throw new BadRequestException('Mật khẩu xác nhận không khớp');
    const email = dto.email.toLowerCase().trim();
    const token = await this.resetModel.findOne({ email, code: dto.code, used: false, expiresAt: { $gt: new Date() } });
    if (!token) throw new BadRequestException('Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user) throw new BadRequestException('Email không tồn tại');
    
    user.password = await this.hashPassword(dto.newPassword);
    await user.save();
    token.used = true;
    await token.save();
    await this.refreshModel.updateMany({ userId: user._id }, { revoked: true });
    return { message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const user = await this.userModel.findById(userId).select('+password').exec();
    if (!user) throw new BadRequestException('Không tìm thấy tài khoản');

    if (!(await this.verifyPassword(dto.currentPassword, user.password))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    user.password = await this.hashPassword(dto.newPassword);
    await user.save();
    await this.refreshModel.updateMany({ userId: user._id }, { revoked: true });

    return { message: 'Đổi mật khẩu thành công' };
  }
}