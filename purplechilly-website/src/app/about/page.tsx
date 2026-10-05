import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'Purple Chilly is an IoT solutions company based in Jaipur, India. We design and build end-to-end connected device infrastructure — and we make Autoconnecto, our flagship IoT platform.',
};

const VALUES = [
  {
    title: 'Engineering First',
    desc: 'We build with deterministic engineering principles — explicit design, explicit lifecycle, explicit failure modes. No shortcuts that bite back in production.',
  },
  {
    title: 'Real-World Pragmatism',
    desc: "IoT is hard because the real world is messy — flaky networks, power cycles, firmware bugs. We design for resilience, not just the happy path.",
  },
  {
    title: 'Ownership',
    desc: 'We take responsibility for the full stack. If the device is not talking to the dashboard, that is our problem to solve — not yours.',
  },
  {
    title: 'Long-Term Partnership',
    desc: 'We build platforms meant to run for years, not demos meant to impress once. Our clients come back because the systems we build keep working.',
  },
];

const TECH = [
  'MQTT 3.1.1 / 5.0', 'HTTPS / REST', 'WebSocket', 'TLS/SSL', 'Modbus TCP/RTU',
  'LoRaWAN', 'BLE', 'NB-IoT', 'ESP32', 'Arduino', 'NestJS', 'React',
  'Postgres', 'Redis', 'AWS S3', 'CloudFront', 'Docker',
];

export default function About() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gray-950 text-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-brand-400 text-sm font-semibold uppercase tracking-widest">About</span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-3 mb-5 leading-tight">
            We Build the Infrastructure<br />
            <span className="text-brand-400">That Connects the Real World</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl leading-relaxed">
            Purple Chilly is an IoT solutions company based in Jaipur, India. We design,
            build, and deploy end-to-end connected device systems — from sensor firmware
            to enterprise cloud platforms.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Story</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Purple Chilly started with a frustration that every IoT engineer eventually
                  hits: there is no shortage of device hardware, cloud platforms, or dashboard
                  tools — but assembling them into a coherent, production-grade system that
                  actually works reliably is still surprisingly hard.
                </p>
                <p>
                  We built our practice around solving exactly that problem. We take ownership
                  of the full stack — hardware integration, connectivity protocols, backend
                  infrastructure, and user-facing dashboards — so our clients can focus on
                  their core product.
                </p>
                <p>
                  Out of that practice grew <strong>Autoconnecto</strong> — our own IoT platform
                  that we now deploy for clients who need a production-ready, white-label
                  foundation without the years of engineering time it would take to build it
                  in-house.
                </p>
                <p>
                  We are based in Jaipur, Rajasthan — and we work with clients across India
                  and internationally, across smart energy, fleet, agriculture, industrial,
                  and building automation sectors.
                </p>
              </div>
            </div>
            <div className="space-y-5">
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Our Platform Product</h3>
                <p className="text-gray-500 text-sm mb-4">
                  Autoconnecto is our flagship IoT platform — full-stack, production-ready,
                  enterprise-grade.
                </p>
                <a
                  href="https://autoconnecto.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-700 font-medium text-sm hover:text-brand-800 transition-colors"
                >
                  Visit autoconnecto.in →
                </a>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Location</h3>
                <address className="not-italic text-gray-600 text-sm leading-relaxed">
                  Villa-71, Galaxy Enclave<br />
                  Mahindra SEZ Road, Kalwara<br />
                  Jaipur – 302037, Rajasthan<br />
                  India
                </address>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>
                    <a href="tel:+919212100555" className="hover:text-brand-700 transition-colors">
                      +91 92121 00555
                    </a>
                  </p>
                  <p>
                    <a href="mailto:hello@purplechilly.com" className="hover:text-brand-700 transition-colors">
                      hello@purplechilly.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">How We Work</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-white rounded-xl border border-gray-100 p-7">
                <div className="w-6 h-1 bg-brand-600 rounded mb-4" />
                <h3 className="font-bold text-gray-900 mb-2">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Technologies We Work With</h2>
          <div className="flex flex-wrap gap-2">
            {TECH.map((t) => (
              <span
                key={t}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-white">
            <h2 className="text-2xl font-bold">Want to work with us?</h2>
            <p className="text-brand-200 mt-1">Tell us about your project.</p>
          </div>
          <Link
            href="/contact"
            className="px-8 py-3 bg-white text-brand-700 font-semibold rounded-lg hover:bg-brand-50 transition-colors whitespace-nowrap"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}
