import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="These beta terms describe the responsibilities of GearUp and the people who use the marketplace."
    >
      <p>By accessing or using GearUp, you agree to these Terms of Service. GearUp is currently operating as a beta product, and features may change, remain limited, or become temporarily unavailable.</p>

      <LegalSection title="Marketplace role">
        <p>GearUp is a marketplace that helps users discover, list, rent, sell, and communicate about technology gear. GearUp does not own the items listed by users and is not a party to agreements made directly between users except where explicitly stated.</p>
        <p>GearUp does not inspect, certify, guarantee, insure, or verify the quality, safety, legality, authenticity, availability, or condition of listed items.</p>
      </LegalSection>

      <LegalSection title="User responsibilities and risk">
        <p>Owners list, rent, or sell items at their own risk. Borrowers, buyers, and other users inspect, collect, use, transport, and return items at their own risk.</p>
        <p>Users are responsible for checking item condition, specifications, serial numbers, accessories, ownership, pickup arrangements, and any agreed terms before proceeding.</p>
        <p>GearUp is not responsible for damage, theft, loss, fraud, disputes, personal injury, user conduct, missed arrangements, or inaccurate listings.</p>
      </LegalSection>

      <LegalSection title="Safety and records">
        <p>For safety, support, and fraud prevention, GearUp may store listing photos, serial numbers, condition records, chat logs, contact information, account information, and transaction records.</p>
        <p>Users should preserve relevant evidence and contact local authorities when they believe a crime, urgent safety issue, or serious dispute has occurred.</p>
      </LegalSection>

      <LegalSection title="Beta services and payments">
        <p>Rentals, payments, payouts, bookings, verification, and other transaction features may be limited or unavailable during beta. GearUp may change, pause, or discontinue beta functionality without prior notice.</p>
      </LegalSection>

      <LegalSection title="Account and listing moderation">
        <p>GearUp may suspend or remove accounts, listings, messages, or access when needed to protect users, enforce these terms, investigate misuse, or comply with legal obligations.</p>
      </LegalSection>

      <LegalSection title="Applicable law">
        <p>These terms are intended to be governed by applicable Indian law. Subject to final legal review and applicable law, disputes involving GearUp will be subject to the jurisdiction of courts in Hyderabad, Telangana.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
