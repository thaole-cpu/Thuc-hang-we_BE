import { Injectable } from '@nestjs/common';
@Injectable()
export class QrService {
  generateVietQR(orderCode: string, amount: number): string {
    const bankId = 'MB';
    const accountNo = '908112006';
    const template = 'compact2';
    const description = encodeURIComponent(`LURANA ${orderCode}`);
    
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.jpg?amount=${amount}&addInfo=${description}`;
  }
}