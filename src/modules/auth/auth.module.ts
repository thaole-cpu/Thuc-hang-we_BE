import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from '../../shared/mail/mail.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { User, UserSchema } from './schemas/user.schema';
import {
  EmailVerifyToken,
  EmailVerifyTokenSchema,
} from './schemas/email-verify-token.schema';
import { 
  PasswordResetToken,
  PasswordResetTokenSchema,
} from './schemas/password-reset-token.schema';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema';

import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    MailModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET');
        if (!secret) throw new Error('Missing JWT_ACCESS_SECRET in env');

        const expiresIn = config.get<string>('JWT_ACCESS_EXPIRES') || '15m';

        return {
          secret,
          signOptions: {
            // jsonwebtoken StringValue type compatibility
            expiresIn: expiresIn as any,
          },
        };
      },
    }),

    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: EmailVerifyToken.name, schema: EmailVerifyTokenSchema },
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
  ],

  controllers: [AuthController],

  providers: [AuthService, JwtStrategy],

  exports: [AuthService],
})
export class AuthModule {}