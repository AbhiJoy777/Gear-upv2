import LoginForm from '@/components/auth/LoginForm';
import Logo from '@/components/common/Logo';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0A0A0A] relative overflow-hidden">
      <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <Logo size={48} className="shadow-2xl" />
        <h1 className="text-2xl font-black tracking-tighter uppercase">GearUp</h1>
      </div>
      <LoginForm />
    </div>
  );
}
