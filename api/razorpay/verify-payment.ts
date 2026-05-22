import { createHmac } from 'node:crypto';

type VercelRequest = {
  method?: string;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: any) => void;
};

const jsonError = (res: VercelResponse, status: number, message: string) => {
  res.status(status).json({ error: message });
};

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    jsonError(res, 405, 'Method not allowed');
    return;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    jsonError(res, 500, 'Payment gateway not configured');
    return;
  }

  const orderId = String(req.body?.orderId || '');
  const paymentId = String(req.body?.paymentId || '');
  const signature = String(req.body?.signature || '');

  if (!orderId || !paymentId || !signature) {
    jsonError(res, 400, 'Missing payment verification fields');
    return;
  }

  const expectedSignature = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    jsonError(res, 400, 'Invalid payment signature');
    return;
  }

  res.status(200).json({ verified: true });
}
