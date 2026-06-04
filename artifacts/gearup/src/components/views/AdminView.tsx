import React, { memo, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Flag, Mail, MapPin, Package, Phone, ShoppingBag, User, Users } from 'lucide-react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

type AdminTab = 'overview' | 'users' | 'rentListings' | 'saleListings' | 'reports';
type UserDetailTab = 'profile' | 'rentListings' | 'saleListings';

const tabLabels: Record<AdminTab, string> = {
  overview: 'Overview',
  users: 'Users',
  rentListings: 'Rent Listings',
  saleListings: 'Sale Listings',
  reports: 'Reports',
};

const PAGE_SIZE = 25;

function formatDate(value: any) {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function pageItems<T>(items: T[], page: number) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function userDisplayName(item: any) {
  return item.username || item.fullName || item.name || item.email || item.phone || 'Unnamed user';
}

function ownerDisplayName(item: any) {
  return item.username || item.fullName || item.name || item.email || 'Unknown user';
}

function hasGoogleConnected(item: any) {
  const providers = Array.isArray(item.authProviders) ? item.authProviders : [];
  return Boolean(item.emailVerified || providers.includes('google.com'));
}

const AdminView = memo(() => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [rentListings, setRentListings] = useState<any[]>([]);
  const [saleListings, setSaleListings] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetailTab, setUserDetailTab] = useState<UserDetailTab>('profile');
  const [usersPage, setUsersPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsersList(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubRentListings = onSnapshot(collection(db, 'listings'), (snapshot) => {
      setRentListings(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubSaleListings = onSnapshot(collection(db, 'saleListings'), (snapshot) => {
      setSaleListings(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      setReports(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    return () => {
      unsubUsers();
      unsubRentListings();
      unsubSaleListings();
      unsubReports();
    };
  }, []);

  const openReports = reports.filter((item) => ['open', 'reviewing'].includes(item.status || 'open'));
  const visibleUsers = useMemo(() => pageItems(usersList, usersPage), [usersList, usersPage]);
  const visibleReports = useMemo(() => pageItems(openReports, reportsPage), [openReports, reportsPage]);
  const selectedUserRentListings = useMemo(
    () => selectedUser ? rentListings.filter((item) => item.ownerId === selectedUser.id || item.userId === selectedUser.id) : [],
    [rentListings, selectedUser],
  );
  const selectedUserSaleListings = useMemo(
    () => selectedUser ? saleListings.filter((item) => item.sellerId === selectedUser.id) : [],
    [saleListings, selectedUser],
  );
  const usersById = useMemo(() => {
    const next = new Map<string, any>();
    usersList.forEach((item) => next.set(item.id, item));
    return next;
  }, [usersList]);

  useEffect(() => {
    setUsersPage((page) => Math.min(page, pageCount(usersList.length)));
  }, [usersList.length]);

  useEffect(() => {
    setReportsPage((page) => Math.min(page, pageCount(openReports.length)));
  }, [openReports.length]);

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
    { label: 'Total Users', value: usersList.length, Icon: Users, tab: 'users' as AdminTab },
    { label: 'Rent Listings', value: rentListings.length, Icon: Package, tab: 'rentListings' as AdminTab },
    { label: 'Sale Listings', value: saleListings.length, Icon: ShoppingBag, tab: 'saleListings' as AdminTab },
    { label: 'Open Reports', value: openReports.length, Icon: Flag, tab: 'reports' as AdminTab },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 space-y-6">
      <div>
        <h2 className="text-[22px] font-black tracking-tight text-white">Admin Dashboard</h2>
        <p className="text-[#707070] text-[13px] mt-1">Beta user, listing, and report oversight.</p>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide border-b border-white/5 pb-3">
        {(Object.keys(tabLabels) as AdminTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 px-4 py-2 rounded-full text-[12px] font-bold transition-all ${
              activeTab === tab
                ? 'bg-[#A855F7] text-white'
                : 'bg-white/5 text-white/45 hover:text-white hover:bg-white/10'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, Icon, tab }, idx) => (
            <motion.button
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => setActiveTab(tab)}
              className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[24px] p-5 text-left hover:border-[#A855F7]/30 transition-all"
            >
              <Icon size={18} className="text-[#A855F7] mb-4" />
              <p className="text-[11px] text-[#707070] font-bold uppercase tracking-wider">{label}</p>
              <p className="text-[28px] font-black text-white mt-1">{value}</p>
            </motion.button>
          ))}
        </div>
      )}

      {activeTab === 'users' && (
        <section className="space-y-4">
          <SectionTitle title="Users" subtitle="Click a user to inspect profile and owned listings." />
          <div className="grid gap-3">
            {usersList.length === 0 ? (
              <EmptyPanel text="No users yet." />
            ) : (
              visibleUsers.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setSelectedUser(item); setUserDetailTab('profile'); }}
                  className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-4 text-left flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-[#A855F7]/30 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-[14px] break-words">{userDisplayName(item)}</p>
                    <div className="mt-2 grid gap-1 text-[12px] text-[#707070]">
                      <span className="break-all">Email: {item.email || 'Not connected'}</span>
                      <span>Phone: {item.phone || 'Not added'}</span>
                      <span>City: {item.city || 'Not set'}</span>
                      <span>Joined: {formatDate(item.createdAt || item.betaJoinedAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge active={hasGoogleConnected(item)} label="Google connected" />
                    <StatusBadge active={Boolean(item.phoneVerified)} label="Phone verified" />
                    <ChevronRight size={16} className="text-white/25" />
                  </div>
                </button>
              ))
            )}
          </div>
          <PaginationControls page={usersPage} total={usersList.length} onPageChange={setUsersPage} />
        </section>
      )}

      {activeTab === 'rentListings' && (
        <ListingSection
          title="Rent Listings"
          emptyText="No rent listings yet."
          items={rentListings}
          kind="rent"
          usersById={usersById}
        />
      )}

      {activeTab === 'saleListings' && (
        <ListingSection
          title="Sale Listings"
          emptyText="No sale listings yet."
          items={saleListings}
          kind="sale"
          usersById={usersById}
        />
      )}

      {activeTab === 'reports' && (
        <section className="space-y-4">
          <SectionTitle title="Open Reports" subtitle="Beta support and dispute reports." />
          <div className="grid gap-3">
            {openReports.length === 0 ? (
              <EmptyPanel text="No open reports." />
            ) : (
              visibleReports.map((report) => (
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
                      Related: {report.rentalId || report.listingId || report.againstUserId || 'User behavior report'}
                    </p>
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
              ))
            )}
          </div>
          <PaginationControls page={reportsPage} total={openReports.length} onPageChange={setReportsPage} />
        </section>
      )}

      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal
            user={selectedUser}
            activeTab={userDetailTab}
            setActiveTab={setUserDetailTab}
            rentListings={selectedUserRentListings}
            saleListings={selectedUserSaleListings}
            usersById={usersById}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-[14px] font-black uppercase tracking-widest text-white/70">{title}</h3>
      {subtitle && <p className="text-[#707070] text-[12px] mt-1">{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
      active
        ? 'text-[#2DD4BF] border-[#2DD4BF]/20 bg-[#2DD4BF]/10'
        : 'text-white/35 border-white/10 bg-white/5'
    }`}>
      {label}
    </span>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-5 text-[#707070] text-[13px]">
      {text}
    </div>
  );
}

function PaginationControls({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const totalPages = pageCount(total);
  if (total <= PAGE_SIZE) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
      <p className="text-[#707070] text-[12px]">
        Page {page} of {totalPages} - {total} total
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-4 py-2 rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-[12px] font-bold transition-all disabled:opacity-35 disabled:hover:bg-white/5 disabled:hover:text-white/60"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-4 py-2 rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-[12px] font-bold transition-all disabled:opacity-35 disabled:hover:bg-white/5 disabled:hover:text-white/60"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ListingSection({ title, emptyText, items, kind, usersById }: { title: string; emptyText: string; items: any[]; kind: 'rent' | 'sale'; usersById: Map<string, any> }) {
  const [page, setPage] = useState(1);
  const visibleItems = useMemo(() => pageItems(items, page), [items, page]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount(items.length)));
  }, [items.length]);

  return (
    <section className="space-y-4">
      <SectionTitle title={title} />
      <div className="grid gap-3">
        {items.length === 0 ? (
          <EmptyPanel text={emptyText} />
        ) : (
          visibleItems.map((item) => (
            <ListingRow key={item.id} item={item} kind={kind} usersById={usersById} />
          ))
        )}
      </div>
      <PaginationControls page={page} total={items.length} onPageChange={setPage} />
    </section>
  );
}

function ListingRow({ item, kind, usersById }: { item: any; kind: 'rent' | 'sale'; usersById: Map<string, any> }) {
  const ownerId = kind === 'sale' ? item.sellerId : (item.ownerId || item.userId);
  const ownerProfile = ownerId ? usersById.get(ownerId) : null;
  const owner = ownerProfile
    ? ownerDisplayName(ownerProfile)
    : ownerId
      ? 'Unknown user'
      : kind === 'sale'
      ? (item.sellerEmail || item.sellerName || 'Unknown user')
      : (item.ownerEmail || item.ownerName || 'Unknown user');
  const price = kind === 'sale'
    ? `Rs ${item.price || 0}`
    : `Rs ${item.pricePerDay || 0} / day`;

  return (
    <div className="bg-[#121212] border-[0.5px] border-white/[0.04] rounded-[18px] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-white font-semibold text-[14px] line-clamp-1">{item.title || 'Untitled listing'}</p>
        <p className="text-[#707070] text-[12px] mt-1 break-words">
          {item.category || 'Gear'} - {item.city || item.location?.city || item.addressSnapshot?.city || 'City not set'} - {item.status || 'ACTIVE'}
        </p>
        <p className="text-white/35 text-[11px] mt-1 break-all">Owner: {owner}</p>
        {ownerProfile && ownerProfile.email && owner !== ownerProfile.email && (
          <p className="text-white/25 text-[10px] mt-0.5 break-all">{ownerProfile.email}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-[12px] font-bold text-[#A855F7]">{price}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/45">
          {item.status || (kind === 'sale' ? 'ACTIVE' : 'AVAILABLE')}
        </span>
      </div>
    </div>
  );
}

function UserDetailModal({
  user,
  activeTab,
  setActiveTab,
  rentListings,
  saleListings,
  usersById,
  onClose,
}: {
  user: any;
  activeTab: UserDetailTab;
  setActiveTab: (tab: UserDetailTab) => void;
  rentListings: any[];
  saleListings: any[];
  usersById: Map<string, any>;
  onClose: () => void;
}) {
  const detailTabs: Array<{ key: UserDetailTab; label: string }> = [
    { key: 'profile', label: 'Profile Info' },
    { key: 'rentListings', label: 'Rent Listings' },
    { key: 'saleListings', label: 'Sale Listings' },
  ];

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative z-10 w-full max-w-[760px] max-h-[92dvh] bg-[#121212] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
      >
        <div className="px-5 sm:px-6 py-5 border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[17px] font-black text-white tracking-tight truncate">{userDisplayName(user)}</h2>
            <p className="text-[#707070] text-[12px] mt-1 break-all">{user.email || user.phone || user.id}</p>
          </div>
          <button onClick={onClose} className="px-4 py-2 rounded-full bg-white/5 text-white/60 hover:text-white hover:bg-white/10 text-[12px] font-bold">
            Close
          </button>
        </div>

        <div className="px-5 sm:px-6 pt-4 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
          {detailTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 px-3 py-2 rounded-full text-[11px] font-bold ${
                activeTab === tab.key ? 'bg-[#A855F7] text-white' : 'bg-white/5 text-white/45'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {activeTab === 'profile' && (
            <div className="grid gap-3">
              <InfoRow icon={User} label="Name" value={userDisplayName(user)} />
              <InfoRow icon={Mail} label="Email" value={user.email || 'Not connected'} />
              <InfoRow icon={Phone} label="Phone" value={user.phone || 'Not added'} />
              <InfoRow icon={MapPin} label="City" value={user.city || 'Not set'} />
              <InfoRow icon={Users} label="Joined" value={formatDate(user.createdAt || user.betaJoinedAt)} />
              <div className="flex flex-wrap gap-2 pt-2">
                <StatusBadge active={hasGoogleConnected(user)} label="Google connected" />
                <StatusBadge active={Boolean(user.phoneVerified)} label="Phone verified" />
              </div>
            </div>
          )}

          {activeTab === 'rentListings' && (
            <div className="grid gap-3">
              {rentListings.length === 0 ? <EmptyPanel text="No rent listings for this user." /> : rentListings.map((item) => <ListingRow key={item.id} item={item} kind="rent" usersById={usersById} />)}
            </div>
          )}

          {activeTab === 'saleListings' && (
            <div className="grid gap-3">
              {saleListings.length === 0 ? <EmptyPanel text="No sale listings for this user." /> : saleListings.map((item) => <ListingRow key={item.id} item={item} kind="sale" usersById={usersById} />)}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-[18px] p-4 flex items-start gap-3">
      <Icon size={17} className="text-[#A855F7] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-white/35 text-[10px] font-bold uppercase tracking-wider">{label}</p>
        <p className="text-white/75 text-[13px] mt-1 break-words">{value}</p>
      </div>
    </div>
  );
}

AdminView.displayName = 'AdminView';

export default AdminView;
