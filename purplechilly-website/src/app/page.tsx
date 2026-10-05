import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Purple Chilly — IoT Solutions Company',
  description:
    'We design, build, and deploy end-to-end IoT solutions — from hardware integration to cloud platforms — for enterprises across smart energy, fleet, agriculture, and industrial sectors.',
};

const SERVICES = [
  {
    icon: '⚡',
    title: 'Custom IoT Development',
    desc: 'End-to-end device-to-cloud solutions tailored to your hardware, protocols, and business logic.',
  },
  {
    icon: '📡',
    title: 'Hardware Integration',
    desc: 'Connect ESP32, Arduino, industrial PLCs, sensors, and gateways to your cloud infrastructure.',
  },
  {
    icon: '📊',
    title: 'Live Dashboards & Analytics',
    desc: 'Real-time visualization, alarms, and reporting — powered by Autoconnecto or custom-built.',
  },
  {
    icon: '🔒',
    title: 'Secure Connectivity',
    desc: 'MQTT over TLS, HTTPS/REST, WebSocket — with device authentication and credential management.',
  },
  {
    icon: '🏢',
    title: 'Enterprise Platform',
    desc: 'Multi-tenant, white-label IoT platform delivery with RBAC, audit logs, and SLA-grade uptime.',
  },
  {
    icon: '🤝',
    title: 'Consulting & Architecture',
    desc: 'IoT strategy, system design, and technology selection for teams at any stage of maturity.',
  },
];

const INDUSTRIES = [
  { name: 'Smart Energy',           desc: 'Meter reading, grid monitoring, solar tracking' },
  { name: 'Fleet & Logistics',      desc: 'GPS tracking, trip analytics, fuel management' },
  { name: 'Smart Agriculture',      desc: 'Soil sensors, irrigation control, weather stations' },
  { name: 'Industrial Monitoring',  desc: 'Machine health, OEE, predictive maintenance' },
  { name: 'Smart Buildings',        desc: 'HVAC, access control, energy sub-metering' },
  { name: 'Environmental Sensing',  desc: 'Air quality, water quality, pollution index' },
];

const STATS = [
  { value: '10M+',  label: 'Devices supported' },
  { value: '50+',   label: 'Dashboard widget types' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '6+',    label: 'Industry verticals' },
];

export default function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative bg-gray-950 text-white overflow-hidden">
        {/* subtle grid background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(124,58,237,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.4) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 bg-brand-700/20 text-brand-300 text-sm font-medium rounded-full border border-brand-700/30 mb-6">
              IoT Solutions Company · Jaipur, India
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              IoT Solutions That<br />
              <span className="text-brand-400">Work in the Real World</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-10 max-w-2xl">
              We design, build, and deploy end-to-end connected device infrastructure — from
              hardware integration to enterprise cloud platforms — so your team ships faster
              and operates smarter.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/solutions"
                className="px-6 py-3 bg-brand-700 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors text-center"
              >
                Explore Solutions
              </Link>
              <Link
                href="https://autoconnecto.in"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20 transition-colors text-center"
              >
                View Autoconnecto Platform →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-brand-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-extrabold">{s.value}</div>
                <div className="text-sm text-brand-200 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Do ── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">What We Do</h2>
            <p className="text-gray-500 max-w-2xl">
              From a single sensor to a million devices — we handle every layer of the IoT stack,
              so you can focus on your product.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s) => (
              <div
                key={s.title}
                className="p-6 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-colors group"
              >
                <div className="text-2xl mb-3">{s.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-brand-700 transition-colors">
                  {s.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              href="/solutions"
              className="inline-flex items-center gap-2 text-brand-700 font-medium hover:text-brand-800 transition-colors"
            >
              See all our solutions →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured Product ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-950 rounded-2xl p-10 md:p-14 text-white">
            <div className="max-w-2xl">
              <span className="text-brand-400 text-sm font-semibold uppercase tracking-widest">
                Our Platform Product
              </span>
              <h2 className="text-3xl font-bold mt-3 mb-4">Autoconnecto</h2>
              <p className="text-gray-300 leading-relaxed mb-8">
                A full-stack, production-ready IoT platform with MQTT & HTTPS connectivity,
                50+ live dashboard widgets, enterprise RBAC, alarm rule chains, white-label
                capability, and multi-tenant architecture. Connect your first device in under
                an hour.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://autoconnecto.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-brand-700 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors text-center"
                >
                  Visit autoconnecto.in
                </a>
                <a
                  href="https://docs.autoconnecto.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg border border-white/20 transition-colors text-center"
                >
                  Read the Docs
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Industries ── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Industries We Serve</h2>
            <p className="text-gray-500">
              We bring IoT expertise across verticals — adapting our solutions to each sector's
              protocols, regulations, and operational realities.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {INDUSTRIES.map((ind) => (
              <div key={ind.name} className="flex gap-4 p-5 rounded-xl border border-gray-100">
                <div className="w-2 h-2 rounded-full bg-brand-600 mt-2 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{ind.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{ind.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-brand-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to build your IoT product?
          </h2>
          <p className="text-brand-200 mb-8 max-w-xl mx-auto">
            Talk to our team. We'll help you scope, architect, and ship your IoT infrastructure —
            from proof of concept to production.
          </p>
          <Link
            href="/contact"
            className="inline-block px-8 py-3 bg-white text-brand-700 font-semibold rounded-lg hover:bg-brand-50 transition-colors"
          >
            Get in Touch
          </Link>
        </div>
      </section>
    </>
  );
}
