import { useAuth } from '@/context/AuthContext';
import PublicBetaAuth from '@/components/auth/PublicBetaAuth';
import Logo from '@/components/common/Logo';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0A0A0A] relative overflow-hidden">
        <div className="mb-12 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-1000">
          <Logo size={56} className="shadow-2xl" />
          <h1 className="text-3xl font-black tracking-tighter uppercase text-white">GearUp</h1>
        </div>

        <div className="w-full max-w-[400px] space-y-8">
          <PublicBetaAuth />
        </div>
      </div>
    );
  }

  return null;
}
