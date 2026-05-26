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

  console.log('KEY EXISTS', !!keySecret);
  console.log('KEY ID EXISTS', !!keyId);

  if (!keyId || !keySecret) {
    jsonError(res, 500, 'Payment gateway not configured');
    return;
  }

  const amount = Number(req.body?.amount || 0);
  const receipt = `gu_${Date.now().toString().slice(-10)}`;

  if (!Number.isFinite(amount) || amount <= 0) {
    jsonError(res, 400, 'Invalid payment amount');
    return;
  }

  try {
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
      console.error('RAZORPAY ORDER ERROR', details);
      res.status(502).json({
        error: 'Could not create payment order',
        details,
      });
      return;
    }

    const order = await orderResponse.json();
    res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (err) {
    console.error('RAZORPAY ORDER ERROR', err);
    res.status(500).json({
      error: String(err),
    });
  }
}
