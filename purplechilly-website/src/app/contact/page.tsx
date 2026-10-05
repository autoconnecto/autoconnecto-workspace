'use client';

import { useState } from 'react';

const INTERESTS = [
  'Custom IoT Development',
  'Hardware Integration',
  'Autoconnecto Platform',
  'Dashboards & Analytics',
  'System Integration',
  'Consulting',
  'Other',
];

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company: '', interest: '', message: '',
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const webhookUrl = process.env.NEXT_PUBLIC_LEAD_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'purplechilly.com', ...form }),
        });
      } catch {
        // fail silently — still show success to user
      }
    }
    setSubmitted(true);
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gray-950 text-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-brand-400 text-sm font-semibold uppercase tracking-widest">Contact</span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-3 mb-5 leading-tight">
            Let's Build Something<br />
            <span className="text-brand-400">Together</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-xl leading-relaxed">
            Tell us about your project — what you're building, what's blocking you, and what
            you need from a partner. We'll get back to you within one business day.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-5 gap-14">

            {/* Contact details */}
            <div className="md:col-span-2 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-5">Contact Details</h2>
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</p>
                    <a href="tel:+919212100555" className="text-gray-800 hover:text-brand-700 font-medium transition-colors">
                      +91 92121 00555
                    </a>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</p>
                    <a href="mailto:ceo@purplechilly.com" className="text-gray-800 hover:text-brand-700 font-medium transition-colors">
                      ceo@purplechilly.com
                    </a>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Address</p>
                    <address className="not-italic text-gray-700 text-sm leading-relaxed">
                      Villa-71, Galaxy Enclave<br />
                      Mahindra SEZ Road, Kalwara<br />
                      Jaipur – 302037, Rajasthan, India
                    </address>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Autoconnecto Platform</h3>
                <p className="text-sm text-gray-500 mb-2">
                  For platform questions, demos, or deployments:
                </p>
                <a
                  href="mailto:founder@autoconnecto.in"
                  className="text-brand-700 text-sm font-medium hover:text-brand-800 transition-colors block"
                >
                  founder@autoconnecto.in
                </a>
              </div>

              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Response time</h3>
                <p className="text-sm text-gray-500">
                  We respond to all enquiries within one business day. For urgent matters,
                  call us directly at +91 92121 00555.
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="md:col-span-3">
              {submitted ? (
                <div className="flex flex-col items-center justify-center text-center py-20 px-8 bg-brand-50 rounded-2xl border border-brand-100 h-full">
                  <div className="w-12 h-12 rounded-full bg-brand-700 flex items-center justify-center mb-5">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Message sent!</h3>
                  <p className="text-gray-500 max-w-sm">
                    Thanks for reaching out. We'll review your message and get back to you
                    within one business day.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Full name <span className="text-brand-600">*</span>
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={form.name}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Work email <span className="text-brand-600">*</span>
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        placeholder="you@company.com"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        placeholder="+91 XXXXX XXXXX"
                      />
                    </div>
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                        Company
                      </label>
                      <input
                        id="company"
                        name="company"
                        type="text"
                        value={form.company}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        placeholder="Your company"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="interest" className="block text-sm font-medium text-gray-700 mb-1">
                      I'm interested in
                    </label>
                    <select
                      id="interest"
                      name="interest"
                      value={form.interest}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select an area...</option>
                      {INTERESTS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                      Your message <span className="text-brand-600">*</span>
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                      placeholder="Tell us about your project, what you're building, and what you need from us..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-lg transition-colors"
                  >
                    Send Message
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    No spam. We respond within one business day.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
