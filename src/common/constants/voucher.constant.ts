export enum VoucherStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  EXPIRED = 'EXPIRED',
}

export enum VoucherCustomerScope {
  ALL_CUSTOMERS = 'ALL_CUSTOMERS',
  SPECIFIC_CUSTOMERS = 'SPECIFIC_CUSTOMERS',
}

export enum VoucherDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum VoucherApplyScope {
  ALL_PRODUCTS = 'ALL_PRODUCTS',
  SPECIFIC_PRODUCTS = 'SPECIFIC_PRODUCTS',
}

export enum VoucherRepeatType {
  NONE = 'NONE',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export const VOUCHER_CODE_REGEX = /^[A-Z0-9_]+$/;

export const VoucherErrorMessage = {
  INVALID_FORMAT: 'Mã voucher chỉ được chứa chữ hoa, số và dấu gạch dưới.',
  INVALID_DATE_RANGE: 'Ngày kết thúc không được trước ngày bắt đầu.',
  DUPLICATE_CODE: 'Mã voucher này đã tồn tại trên hệ thống.',
  EXPIRED: 'Mã voucher đã hết hạn.',
  OUT_OF_GOLDEN_HOUR: 'Chưa đến khung giờ vàng áp dụng voucher này.',
};