import React, { memo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Check, X, Users, Package, ShieldCheck, ClipboardList, Flag } from 'lucide-react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const statusLabels: Record<string, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

const statusStyles: Record<string, string> = {
  not_started: 'text-white/40 border-white/10 bg-white/5',
  pending: 'text-[#F97316] border-[#F97316]/20 bg-[#F97316]/10',
  verified: 'text-[#2DD4BF] border-[#2DD4BF]/20 bg-[#2DD4BF]/10',
  rejected: 'text-red-400 border-red-500/20 bg-red-500/10',
};

const AdminView = memo(() => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsersList(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubListings = onSnapshot(collection(db, 'listings'), (snapshot) => {
      setListings(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubVerificationRequests = onSnapshot(collection(db, 'verificationRequests'), (snapshot) => {
      setVerificationRequests(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubRentals = onSnapshot(collection(db, 'rentals'), (snapshot) => {
      setRentals(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      setReports(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    return () => {
      unsubUsers();
      unsubListings();
      unsubVerificationRequests();
      unsubRentals();
      unsubReports();
    };
  }, []);

  const updateVerification = async (targetUser: any, status: 'verified' | 'rejected', request?: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', targetUser.id), {
        verificationStatus: status,
        verificationNotes: status === 'verified' ? 'Approved by admin.' : 'Rejected by admin.',
        verifiedAt: serverTimestamp(),
        verifiedBy: user.uid,
      });
      if (request?.id) {
        await updateDoc(doc(db, 'verificationRequests', request.id), {
          status,
          reviewedAt: serverTimestamp(),
          reviewedBy: user.uid,
        });
      }
      showToast(`Verification marked ${status}.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update verification.', 'error');
    }
  };

  const pendingRequests = verificationRequests.filter((item) => item.status === 'pending');
  const activeRentals = rentals.filter((item) => item.status === 'ACTIVE_RENTAL');
  const activeReports = reports.filter((item) => ['open', 'reviewing'].includes(item.status || 'open'));

  const updateReportStatus = async (reportId: string, status: 'reviewing' | 'resolved' | 'rejected') => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status,
        updatedAt: serverTimestamp(),
      });
      showToast(`Report marked ${status}.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update report.', 'error');
    }
  };

  const statCards = [
    { label: 'Total Users', value: usersList.length, Icon: Users },
    { label: 'Pending Verification', value: pendingRequests.length, Icon: ShieldCheck },
    { label: 'Total Listings', value: listings.length, Icon: Package },
    { label: 'Active Rentals', value: activeRentals.length, Icon: ClipboardList },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 space-y-8">
      <div>
        <h2 className="text-[22px] font-black tracking-tight text-white">Admin Dashboard</h2>
        <p className="text-[#707070] text-[13px] mt-1">Verification and marketplace oversight.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, Icon }, idx) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[24px] p-5"
          >
            <Icon size={18} className="text-[#A855F7] mb-4" />
            <p className="text-[11px] text-[#707070] font-bold uppercase tracking-wider">{label}</p>
            <p className="text-[28px] font-black text-white mt-1">{value}</p>
          </motion.div>
        ))}
      </div>

      <section className="space-y-4">
        <h3 className="text-[14px] font-black uppercase tracking-widest text-white/70">Open Reports</h3>
        <div className="grid gap-3">
          {activeReports.length === 0 ? (
            <div className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-5 text-[#707070] text-[13px]">
              No open reports.
            </div>
          ) : (
            activeReports.map((report) => {
              const relatedListing = listings.find((item) => item.id === report.listingId);
              const relatedRental = rentals.find((item) => item.id === report.rentalId);
              return (
                <div key={report.id} className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Flag size={14} className="text-red-400" />
                      <p className="text-white font-semibold text-[14px]">{report.reason || 'Report'}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-400">
                        {report.status || 'open'}
                      </span>
                    </div>
                    <p className="text-[#707070] text-[12px] break-all">Reporter: {report.reporterEmail || report.reporterId || 'Unknown user'}</p>
                    <p className="text-white/45 text-[12px] leading-relaxed max-w-3xl break-words">{report.description || 'No description provided.'}</p>
                    <p className="text-white/30 text-[11px] break-words">
                      {relatedRental?.gearTitle || relatedListing?.title || report.rentalId || report.listingId || 'User behavior report'}
                    </p>
                    {Array.isArray(relatedRental?.proofMedia) && relatedRental.proofMedia.length > 0 && (
                      <div className="flex gap-2 pt-2 overflow-x-auto">
                        {relatedRental.proofMedia.slice(0, 5).map((media: any, idx: number) => (
                          <a
                            key={`${media.url}-${idx}`}
                            href={media.url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-12 h-12 rounded-[10px] bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center text-[9px] text-white/40"
                          >
                            {media.type === 'image' ? <img src={media.url} alt="Proof" className="w-full h-full object-cover" /> : 'Video'}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    <button
                      onClick={() => updateReportStatus(report.id, 'reviewing')}
                      className="w-full sm:w-auto px-3 py-2 bg-[#F97316]/10 text-[#F97316] font-bold rounded-[12px] text-[12px] border border-[#F97316]/20 hover:bg-[#F97316]/20 transition-all"
                    >
                      Reviewing
                    </button>
                    <button
                      onClick={() => updateReportStatus(report.id, 'resolved')}
                      className="w-full sm:w-auto px-3 py-2 bg-[#2DD4BF] text-black font-bold rounded-[12px] text-[12px] hover:bg-[#14b8a6] transition-all"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => updateReportStatus(report.id, 'rejected')}
                      className="w-full sm:w-auto px-3 py-2 bg-red-500/10 text-red-400 font-bold rounded-[12px] text-[12px] border border-red-500/20 hover:bg-red-500/20 transition-all"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[14px] font-black uppercase tracking-widest text-white/70">Pending Verification Requests</h3>
        <div className="grid gap-3">
          {pendingRequests.length === 0 ? (
            <div className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-5 text-[#707070] text-[13px]">
              No pending verification requests.
            </div>
          ) : (
            pendingRequests.map((request) => {
              const targetUser = usersList.find((item) => item.id === request.uid) || { id: request.uid };
              return (
                <div key={request.id} className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="text-white font-semibold text-[14px]">{request.fullName || 'Unnamed applicant'}</p>
                    <p className="text-[#707070] text-[12px] break-all">{request.userEmail || request.uid}</p>
                    <p className="text-white/50 text-[12px] break-words">{request.idType}: {request.idNumber}</p>
                    {request.note && <p className="text-white/35 text-[12px] italic">{request.note}</p>}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => updateVerification(targetUser, 'verified', request)}
                      className="w-full sm:w-auto px-3 py-2 bg-[#2DD4BF] text-black font-bold rounded-[12px] text-[12px] flex items-center justify-center gap-1.5 hover:bg-[#14b8a6] transition-all"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => updateVerification(targetUser, 'rejected', request)}
                      className="w-full sm:w-auto px-3 py-2 bg-red-500/10 text-red-400 font-bold rounded-[12px] text-[12px] flex items-center justify-center gap-1.5 border border-red-500/20 hover:bg-red-500/20 transition-all"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[14px] font-black uppercase tracking-widest text-white/70">Users</h3>
        <div className="grid gap-3">
          {usersList.map((item) => {
            const status = item.verificationStatus || 'not_started';
            return (
              <div key={item.id} className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white font-semibold text-[14px]">{item.username || item.fullName || item.name || item.email || 'Unnamed user'}</p>
                  <p className="text-[#707070] text-[12px] mt-1 break-all">{item.email || item.id}</p>
                  <div className={`mt-2 inline-flex px-2.5 py-1 rounded-[24px] border text-[10px] font-bold uppercase tracking-wider ${statusStyles[status] || statusStyles.not_started}`}>
                    {statusLabels[status] || 'Not started'}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => updateVerification(item, 'verified')}
                    className="w-full sm:w-auto px-3 py-2 bg-[#2DD4BF] text-black font-bold rounded-[12px] text-[12px] flex items-center justify-center gap-1.5 hover:bg-[#14b8a6] transition-all"
                  >
                    <Check size={14} /> Verify
                  </button>
                  <button
                    onClick={() => updateVerification(item, 'rejected')}
                    className="w-full sm:w-auto px-3 py-2 bg-red-500/10 text-red-400 font-bold rounded-[12px] text-[12px] flex items-center justify-center gap-1.5 border border-red-500/20 hover:bg-red-500/20 transition-all"
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-[14px] font-black uppercase tracking-widest text-white/70">Listings</h3>
          <div className="grid gap-3">
            {listings.map((item) => (
              <div key={item.id} className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-4">
                <p className="text-white font-semibold text-[14px] line-clamp-1">{item.title || 'Untitled listing'}</p>
                <p className="text-[#707070] text-[12px] mt-1">{item.category || 'Gear'} - {item.city || item.location || 'Hyderabad'} - {item.status || 'AVAILABLE'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[14px] font-black uppercase tracking-widest text-white/70">Rentals</h3>
          <div className="grid gap-3">
            {rentals.map((item) => (
              <div key={item.id} className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-4">
                <p className="text-white font-semibold text-[14px] line-clamp-1">{item.gearTitle || 'Rental'}</p>
                <p className="text-[#707070] text-[12px] mt-1">{item.status || 'REQUESTED'} - Rs {item.totalPrice || 0}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
});

AdminView.displayName = 'AdminView';

export default AdminView;
