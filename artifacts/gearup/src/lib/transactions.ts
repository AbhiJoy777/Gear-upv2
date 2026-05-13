import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

type TransactionStatus = 'pending' | 'completed' | 'failed';
type TransactionDirection = 'credit' | 'debit';
type TransactionType = 'rental_payment' | 'late_fee' | 'platform_fee' | 'refund' | 'payout' | 'payout_pending';

type TransactionInput = {
  userId: string;
  rentalId: string;
  listingId: string;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  status?: TransactionStatus;
  description: string;
};

export const createTransaction = async ({
  userId,
  rentalId,
  listingId,
  type,
  amount,
  direction,
  status = 'completed',
  description,
}: TransactionInput) => {
  await addDoc(collection(db, 'transactions'), {
    userId,
    rentalId,
    listingId,
    type,
    amount,
    direction,
    status,
    description,
    createdAt: serverTimestamp(),
  });
};

export const recordRentalPaymentTransactions = async (rental: any) => {
  const amount = Number(rental.totalPrice || 0);
  const platformFee = Number(rental.platformFee || 0);
  const lateFee = Number(rental.extraAmountDue || 0);
  const gearTitle = rental.gearTitle || 'Gear rental';

  const writes = [
    createTransaction({
      userId: rental.renterId,
      rentalId: rental.id,
      listingId: rental.gearId,
      type: 'rental_payment',
      amount,
      direction: 'debit',
      description: `Rental payment for ${gearTitle}`,
    }),
    createTransaction({
      userId: rental.ownerId,
      rentalId: rental.id,
      listingId: rental.gearId,
      type: 'rental_payment',
      amount,
      direction: 'credit',
      description: `Rental payout for ${gearTitle}`,
    }),
  ];

  if (platformFee > 0) {
    writes.push(
      createTransaction({
        userId: rental.renterId,
        rentalId: rental.id,
        listingId: rental.gearId,
        type: 'platform_fee',
        amount: platformFee,
        direction: 'debit',
        description: `Platform fee for ${gearTitle}`,
      })
    );
  }

  if (lateFee > 0) {
    writes.push(
      createTransaction({
        userId: rental.renterId,
        rentalId: rental.id,
        listingId: rental.gearId,
        type: 'late_fee',
        amount: lateFee,
        direction: 'debit',
        status: 'pending',
        description: `Late fee due for ${gearTitle}`,
      })
    );
  }

  await Promise.all(writes);
};

export const recordRazorpayPaymentTransactions = async (
  rental: any,
  payment: { amount: number; platformFee: number; ownerAmount: number; paymentId: string }
) => {
  const gearTitle = rental.gearTitle || 'Gear rental';

  await Promise.all([
    createTransaction({
      userId: rental.renterId,
      rentalId: rental.id,
      listingId: rental.gearId,
      type: 'rental_payment',
      amount: payment.amount,
      direction: 'debit',
      description: `Razorpay payment for ${gearTitle}`,
    }),
    createTransaction({
      userId: rental.ownerId,
      rentalId: rental.id,
      listingId: rental.gearId,
      type: 'payout_pending',
      amount: payment.ownerAmount,
      direction: 'credit',
      status: 'pending',
      description: `Owner payout pending for ${gearTitle}`,
    }),
    createTransaction({
      userId: rental.renterId,
      rentalId: rental.id,
      listingId: rental.gearId,
      type: 'platform_fee',
      amount: payment.platformFee,
      direction: 'debit',
      description: `Platform fee for ${gearTitle}`,
    }),
  ]);
};
