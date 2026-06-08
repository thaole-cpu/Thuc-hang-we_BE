export const SHIPPING_FEE = 30000;
export const SHIPPING_FREE_THRESHOLD = 500000;

export const calcShippingFee = (cartTotal: number): number => {
  if (cartTotal <= 0) return 0;
  return cartTotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE;
};
