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

  const keyId = process.env.VITE_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    json(res, 500, { error: 'Payment gateway not configured' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const amount = Number(body.amount || 0);
    const rentalId = String(body.rentalId || '');

    if (!Number.isFinite(amount) || amount <= 0 || !rentalId) {
      json(res, 400, { error: 'Invalid payment request' });
      return;
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `rental_${rentalId}`.slice(0, 40),
        notes: { rentalId },
      }),
    });

    const order = await orderResponse.json();
    if (!orderResponse.ok) {
      json(res, orderResponse.status, { error: order?.error?.description || 'Could not create payment order' });
      return;
    }

    json(res, 200, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (err) {
    console.error('Create Razorpay order failed:', err);
    json(res, 500, { error: 'Could not create payment order' });
  }
}
