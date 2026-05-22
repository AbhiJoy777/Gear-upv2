const jsonError = (res, status, message) => {
  res.status(status).json({ error: message });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    jsonError(res, 405, 'Method not allowed');
    return;
  }

  const keyId = process.env.VITE_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    jsonError(res, 500, 'Payment gateway not configured');
    return;
  }

  const amount = Number(req.body?.amount || 0);
  const receipt = String(req.body?.receipt || `gearup-${Date.now()}`);

  if (!Number.isFinite(amount) || amount <= 0) {
    jsonError(res, 400, 'Invalid payment amount');
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
      receipt,
    }),
  });

  if (!orderResponse.ok) {
    const details = await orderResponse.text();
    console.error('Razorpay order creation failed:', details);
    jsonError(res, 502, 'Could not create payment order');
    return;
  }

  const order = await orderResponse.json();
  res.status(200).json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
  });
}
