import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Autoconnecto — Purple Chilly\'s flagship IoT platform. Full-stack device connectivity, live dashboards, enterprise RBAC, alarms, white-label, and multi-tenant architecture for engineering teams.',
};

const FEATURES = [
  {
    category: 'Connectivity',
    items: [
      'MQTT 3.1.1 & MQTT 5.0',
      'HTTPS / REST API',
      'WebSocket (raw device WS)',
      'TLS/SSL with device certificates',
      'Device credential management',
    ],
  },
  {
    category: 'Dashboards',
    items: [
      '50+ drag-and-drop widget types',
      'Real-time telemetry streaming',
      'Line/area charts, gauges, maps',
      'Tables, heatmaps, pie/donut charts',
      'Custom HTML widgets',
    ],
  },
  {
    category: 'Device Management',
    items: [
      'Device registry and groups',
      'Client & shared attributes',
      'Bidirectional RPC commands',
      'Firmware OTA (roadmap)',
      'Inactivity detection',
    ],
  },
  {
    category: 'Alarms & Notifications',
    items: [
      'Telemetry threshold rules',
      'Inactivity & device offline alarms',
      'Email, Slack, webhook routing',
      'Alarm acknowledgement & audit trail',
      'Escalation settings per tenant',
    ],
  },
  {
    category: 'Enterprise & Multi-Tenant',
    items: [
      'Multi-tenant isolation',
      'Role-based access control (RBAC)',
      'White-label branding per tenant',
      'Custom domain support',
      '99.9% uptime SLA',
    ],
  },
  {
    category: 'Developer SDK',
    items: [
      'Arduino / ESP32 C++ SDK',
      'MQTT-over-WSS with auto-reconnect',
      'Telemetry, attributes, RPC support',
      'REST API for server-side integration',
      'OpenAPI / Swagger documentation',
    ],
  },
];

const COMPARISON = [
  ['Feature',               'Autoconnecto',  'Build from Scratch'],
  ['Time to first device',  'Under 1 hour',  'Weeks to months'],
  ['MQTT broker',           'Included',       'You manage it'],
  ['Live dashboards',       '50+ widgets',    'Build everything'],
  ['RBAC',                  'Built-in',       'Build everything'],
  ['Multi-tenant',          'Built-in',       'Complex custom work'],
  ['White-label',           'Built-in',       'Custom branding dev'],
  ['Arduino/ESP32 SDK',     'Included',       'Write your own'],
  ['Alarm routing',         'Email/Slack/WH', 'Build everything'],
  ['Cost',                  'Platform fee',   'Dev team cost'],
];

export default function Products() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gray-950 text-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-brand-400 text-sm font-semibold uppercase tracking-widest">Products</span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-3 mb-5 leading-tight">
            Autoconnecto<br />
            <span className="text-brand-400">Our Flagship IoT Platform</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl leading-relaxed mb-8">
            A production-ready, full-stack IoT platform with device connectivity, live dashboards,
            enterprise RBAC, alarm rule chains, and white-label multi-tenant architecture —
            built for engineering teams who need to ship fast.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="https://app.autoconnecto.in/login"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-brand-700 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors text-center"
            >
              Try Live Dashboard
            </a>
            <a
              href="https://docs.autoconnecto.in"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg border border-white/20 transition-colors text-center"
            >
              Read Documentation
            </a>
            <a
              href="https://autoconnecto.in"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 text-brand-300 hover:text-brand-200 font-medium transition-colors text-center"
            >
              Visit autoconnecto.in →
            </a>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-brand-700 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { v: '10M+',  l: 'Devices supported' },
              { v: '50+',   l: 'Dashboard widgets' },
              { v: '99.9%', l: 'Uptime SLA' },
              { v: '<1 hr', l: 'Time to first device' },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-2xl font-extrabold">{s.v}</div>
                <div className="text-brand-200 text-sm mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything You Need</h2>
          <p className="text-gray-500 mb-12 max-w-2xl">
            Autoconnecto ships with every layer of IoT infrastructure out of the box — no
            stitching together disconnected tools.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.category} className="bg-gray-50 rounded-xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wider">
                  {f.category}
                </h3>
                <ul className="space-y-2">
                  {f.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-brand-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Why not build it yourself?</h2>
          <p className="text-gray-500 mb-10">
            A fair comparison — what Autoconnecto gives you vs. building the same infrastructure
            in-house.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-white">
                  {COMPARISON[0].map((h, i) => (
                    <th key={i} className={`px-5 py-3 text-left font-semibold ${i === 1 ? 'text-brand-300' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.slice(1).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-5 py-3 font-medium text-gray-700">{row[0]}</td>
                    <td className="px-5 py-3 text-brand-700 font-medium">{row[1]}</td>
                    <td className="px-5 py-3 text-gray-500">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Want Autoconnecto deployed for your product?</h2>
          <p className="text-brand-200 mb-8">
            We handle the full setup — deployment, white-labelling, device onboarding, and ongoing
            platform management. Talk to us.
          </p>
          <Link
            href="/contact"
            className="inline-block px-8 py-3 bg-white text-brand-700 font-semibold rounded-lg hover:bg-brand-50 transition-colors"
          >
            Book a Call
          </Link>
        </div>
      </section>
    </>
  );
}
