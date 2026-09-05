// Shared order status/timeline labels for customer and admin views.

export const ORDER_STATUS = {
  pending_payment: { label: "در انتظار پرداخت", tone: "warning" },
  paid: { label: "پرداخت‌شده", tone: "success" },
  processing: { label: "در حال پردازش", tone: "primary" },
  shipped: { label: "ارسال‌شده", tone: "primary" },
  delivered: { label: "تحویل‌شده", tone: "success" },
  cancelled: { label: "لغو‌شده", tone: "destructive" },
};

export const PAYMENT_STATUS = {
  unpaid: { label: "پرداخت‌نشده", tone: "warning" },
  paid: { label: "پرداخت‌شده", tone: "success" },
  refunded: { label: "بازگشت داده شده", tone: "muted" },
};

export const TIMELINE_ACTIONS = {
  created: "ثبت سفارش",
  payment_paid: "پرداخت تأیید شد",
  status_cancelled: "لغو سفارش",
  status_paid: "پرداخت تأیید شد",
  status_processing: "شروع پردازش",
  status_shipped: "ارسال شد",
  status_delivered: "تحویل داده شد",
};

export function orderStatus(status) {
  return ORDER_STATUS[status] || { label: status, tone: "muted" };
}

export function paymentStatus(status) {
  return PAYMENT_STATUS[status] || { label: status, tone: "muted" };
}

export function timelineAction(action) {
  return TIMELINE_ACTIONS[action] || action;
}
