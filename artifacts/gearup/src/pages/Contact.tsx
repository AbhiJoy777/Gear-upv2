import { Mail, ShieldAlert } from 'lucide-react';
import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';

export default function ContactPage() {
  return (
    <LegalPageLayout
      title="Contact & Support"
      subtitle="Get help with your GearUp Beta account, listings, safety concerns, or general questions."
    >
      <LegalSection title="GearUp Beta Support">
        <a
          href="mailto:support@gearup.example"
          className="inline-flex items-center gap-3 px-4 py-3 rounded-[8px] bg-white/[0.04] border border-white/[0.07] text-white hover:border-[#2DD4BF]/40 transition-colors"
        >
          <Mail size={17} className="text-[#2DD4BF]" />
          support@gearup.example
        </a>
        <p>This is a beta support placeholder and should be replaced with the active GearUp support email before public release.</p>
      </LegalSection>

      <LegalSection title="Urgent safety and dispute issues">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="text-[#A855F7] mt-1 shrink-0" />
          <p>For emergencies, suspected crimes, immediate safety concerns, theft, or serious disputes, contact the appropriate local authorities. GearUp support is not an emergency service.</p>
        </div>
      </LegalSection>
    </LegalPageLayout>
  );
}
