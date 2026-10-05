import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Purple Chilly.',
};

export default function Terms() {
  return (
    <section className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-gray">
        <h1>Terms of Service</h1>
        <p className="text-gray-500 text-sm">Last updated: September 2026</p>
        <p>
          By accessing <strong>purplechilly.com</strong>, you agree to the following terms.
        </p>
        <h2>Services</h2>
        <p>
          Purple Chilly provides IoT consulting, development, and platform services. Specific
          terms for individual engagements are governed by separate service agreements signed
          with each client.
        </p>
        <h2>Intellectual Property</h2>
        <p>
          All content on this website — text, graphics, and code — is the property of Purple
          Chilly or its licensors. You may not reproduce or distribute any content without
          written permission.
        </p>
        <h2>Limitation of Liability</h2>
        <p>
          This website is provided "as is". Purple Chilly makes no warranties, expressed or
          implied, regarding the accuracy or completeness of the content herein.
        </p>
        <h2>Governing Law</h2>
        <p>
          These terms are governed by the laws of India. Any disputes shall be subject to the
          exclusive jurisdiction of courts in Jaipur, Rajasthan.
        </p>
        <h2>Contact</h2>
        <p>
          For any questions, write to{' '}
          <a href="mailto:ceo@purplechilly.com">ceo@purplechilly.com</a>.
        </p>
      </div>
    </section>
  );
}
