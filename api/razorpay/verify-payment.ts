import { createHmac } from 'node:crypto';

const json = (res: any, status: number, body: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' });
    return;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    json(res, 500, { error: 'Payment gateway not configured' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const orderId = String(body.orderId || '');
    const paymentId = String(body.paymentId || '');
    const signature = String(body.signature || '');

    if (!orderId || !paymentId || !signature) {
      json(res, 400, { error: 'Missing payment verification fields' });
      return;
    }

    const expectedSignature = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expectedSignature !== signature) {
      json(res, 400, { verified: false, error: 'Invalid payment signature' });
      return;
    }

    json(res, 200, { verified: true });
  } catch (err) {
    console.error('Verify Razorpay payment failed:', err);
    json(res, 500, { verified: false, error: 'Could not verify payment' });
  }
}
