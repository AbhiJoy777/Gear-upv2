import LegalPageLayout, { LegalSection } from '@/components/legal/LegalPageLayout';

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="This policy explains the information GearUp may collect and use while the platform is in beta."
    >
      <LegalSection title="Information we collect">
        <p>GearUp may collect your name, username, email address, phone number, city, saved addresses, authentication information, listings, item images, serial numbers, messages, device information, browser information, and activity within the platform.</p>
      </LegalSection>

      <LegalSection title="How information is used">
        <p>We use information to create and maintain accounts, support authentication and verification, publish listings, enable marketplace communication, improve safety, provide support, prevent fraud, communicate service updates, and operate beta features.</p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>GearUp uses Firebase, Google, and other service providers to operate authentication, database, hosting, analytics, communication, and related platform functionality. These providers may process data according to their own terms and privacy policies.</p>
      </LegalSection>

      <LegalSection title="Storage and security">
        <p>We use reasonable safeguards designed to protect stored information. No online service or storage system is completely secure, and GearUp cannot guarantee absolute security.</p>
      </LegalSection>

      <LegalSection title="Deletion and support requests">
        <p>You may request account or personal data deletion, or ask questions about your information, by contacting GearUp Beta Support through the Contact page. Some records may be retained when required for safety, fraud prevention, support, transactions, or legal obligations.</p>
      </LegalSection>

      <LegalSection title="Beta notice">
        <p>GearUp is in beta. Our data practices and this policy may change as the platform develops. Material updates will be reflected on this page.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
