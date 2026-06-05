import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import Logo from '@/components/common/Logo';

export default function LegalPageLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full bg-[#0A0A0A] text-white">
      <header className="border-b border-white/[0.06] bg-[#0A0A0A]/95 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-white hover:text-[#2DD4BF] transition-colors">
            <Logo size={38} />
            <span className="font-black tracking-tight">GearUp</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 text-[12px] font-bold text-white/55 hover:text-white transition-colors">
            <ArrowLeft size={15} />
            Back to GearUp
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-10 sm:py-16">
        <div className="mb-10 sm:mb-12">
          <p className="text-[#2DD4BF] text-[10px] font-black uppercase tracking-[0.24em] mb-3">GearUp Beta</p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{title}</h1>
          <p className="text-white/50 text-[13px] sm:text-[14px] leading-relaxed mt-4 max-w-2xl">{subtitle}</p>
        </div>

        <article className="space-y-8 text-white/65 text-[13px] sm:text-[14px] leading-7">
          {children}
        </article>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] text-white/45">
          <span>GearUp Beta</span>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/[0.06] pt-7">
      <h2 className="text-white text-[17px] sm:text-[19px] font-bold mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
