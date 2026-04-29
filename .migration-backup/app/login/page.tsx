import LoginForm from '@/src/components/auth/LoginForm';
import Logo from '@/src/components/common/Logo';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-cozy relative overflow-hidden">
      <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <Logo size={48} className="shadow-2xl" />
        <h1 className="text-2xl font-black tracking-tighter uppercase">GearUp</h1>
      </div>
      <LoginForm />
    </div>
  );
}
