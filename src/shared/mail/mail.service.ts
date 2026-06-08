import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('mail.host') || 'smtp.gmail.com';
    const port = this.config.get<number>('mail.port') || 587;
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: { user, pass },
    });
  }

  private loadTemplate(fileName: string): string {
    const candidates = [
      path.join(__dirname, 'templates', fileName),
      path.join(process.cwd(), 'dist', 'shared', 'mail', 'templates', fileName),
      path.join(process.cwd(), 'src', 'shared', 'mail', 'templates', fileName),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    }

    throw new Error(`Không tìm thấy mail template: ${fileName}`);
  }

  private getFromAddress() {
    return this.config.get<string>('mail.from') || this.config.get<string>('mail.user');
  }

  async sendVerifyEmail(to: string, code: string) {
    const html = this.loadTemplate('verify-email.html').replace('{{CODE}}', code);

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: 'Mã xác thực email - LURANA',
        html,
      });
      this.logger.log(`Đã gửi email xác thực tới ${to}`);
    } catch (error) {
      this.logger.error(`Gửi email xác thực thất bại (${to})`, error);
      throw error;
    }
  }

  async sendResetCode(to: string, code: string) {
    const html = this.loadTemplate('reset-code.html').replace('{{CODE}}', code);

    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject: 'Mã khôi phục mật khẩu - LURANA',
        html,
      });
      this.logger.log(`Đã gửi email reset mật khẩu tới ${to}`);
    } catch (error) {
      this.logger.error(`Gửi email reset thất bại (${to})`, error);
      throw error;
    }
  }
}
