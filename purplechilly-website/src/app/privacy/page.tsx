import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Purple Chilly — how we collect, use, and protect your information.',
};

export default function Privacy() {
  return (
    <section className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-gray">
        <h1>Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: September 2026</p>
        <p>
          Purple Chilly ("we", "us", or "our") is committed to protecting your personal
          information. This policy describes how we collect, use, and safeguard data when you
          use <strong>purplechilly.com</strong>.
        </p>
        <h2>Information We Collect</h2>
        <p>
          When you contact us via the contact form, we collect your name, email address, phone
          number, company name, and the message you send. We do not collect payment information
          on this website.
        </p>
        <h2>How We Use Your Information</h2>
        <p>
          We use the information you provide solely to respond to your enquiry and, if you
          consent, to send you relevant updates about our services. We do not sell, rent, or
          share your personal data with third parties for marketing purposes.
        </p>
        <h2>Data Retention</h2>
        <p>
          We retain contact form submissions for up to 12 months, after which they are
          deleted from our systems.
        </p>
        <h2>Cookies</h2>
        <p>
          This website does not use tracking cookies or third-party analytics scripts.
        </p>
        <h2>Contact</h2>
        <p>
          For privacy-related queries, email us at{' '}
          <a href="mailto:ceo@purplechilly.com">ceo@purplechilly.com</a>.
        </p>
      </div>
    </section>
  );
}
