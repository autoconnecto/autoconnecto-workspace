import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'IoT Solutions',
  description:
    'Explore Purple Chilly\'s end-to-end IoT solutions — custom device development, hardware integration, cloud platform setup, dashboards, alarms, and enterprise consulting for smart energy, fleet, agriculture, and industrial sectors.',
};

const SOLUTIONS = [
  {
    id: 'custom-dev',
    title: 'Custom IoT Development',
    tagline: 'Your hardware. Your protocol. Our expertise.',
    body: [
      'We build complete device-to-cloud pipelines from scratch — firmware, connectivity, backend, and dashboards — tailored to your exact hardware and business requirements.',
      'Whether you need a proof of concept in 2 weeks or a production-scale deployment for thousands of devices, we scope and deliver with engineering discipline.',
    ],
    bullets: [
      'Firmware development for ESP32, STM32, Arduino, and industrial PLCs',
      'Protocol design (MQTT, HTTPS, Modbus, CAN, BLE, LoRaWAN)',
      'Backend APIs, device registry, telemetry pipeline',
      'Frontend dashboards and mobile apps',
    ],
  },
  {
    id: 'hardware',
    title: 'Hardware Integration',
    tagline: 'Connect any device to any cloud.',
    body: [
      'We integrate your existing or new hardware with cloud infrastructure using the right protocol for your constraints — bandwidth, power, latency, and cost.',
      'We have hands-on experience with dozens of sensor types, gateway configurations, and communication stacks.',
    ],
    bullets: [
      'Sensor integration (temperature, humidity, current, GPS, vibration, flow, level)',
      'Gateway and edge device setup (4G/NB-IoT/WiFi/Ethernet)',
      'MQTT, HTTPS, Modbus TCP/RTU, OPC-UA bridging',
      'TLS/SSL device authentication and certificate provisioning',
    ],
  },
  {
    id: 'platform',
    title: 'Platform Deployment & White-Labelling',
    tagline: 'Ship your IoT product faster with Autoconnecto.',
    body: [
      'We deploy and configure Autoconnecto — our full-stack IoT platform — as the backend and dashboard layer for your product. Branded as yours, operated at your scale.',
      'This is ideal for product companies who need a production-grade platform without building one from scratch.',
    ],
    bullets: [
      'Full Autoconnecto deployment (cloud or on-prem)',
      'Custom branding, domain, and theme setup',
      'Multi-tenant configuration and onboarding flows',
      'RBAC roles tailored to your team structure',
      'Ongoing platform management and upgrades',
    ],
  },
  {
    id: 'analytics',
    title: 'Dashboards & Analytics',
    tagline: 'See what your devices are doing, live.',
    body: [
      'We build real-time operational dashboards that let operators, engineers, and managers see exactly what is happening across their device fleet — with alarms when things go wrong.',
    ],
    bullets: [
      '50+ widget types: charts, gauges, maps, tables, heatmaps',
      'Drag-and-drop dashboard builder',
      'Real-time MQTT/WebSocket data streaming',
      'Alarm rule chains (telemetry, inactivity, threshold)',
      'Email, Slack, and webhook notifications',
    ],
  },
  {
    id: 'integration',
    title: 'System Integration',
    tagline: 'Connect IoT to your existing stack.',
    body: [
      'IoT data is most valuable when it flows into your existing business systems. We integrate device telemetry with ERPs, SCADAs, databases, and third-party APIs.',
    ],
    bullets: [
      'REST API and webhook integration with ERP/CRM',
      'Time-series database export (InfluxDB, TimescaleDB)',
      'SCADA and HMI bridging',
      'Cloud-to-cloud integrations (AWS IoT, Azure IoT Hub)',
    ],
  },
  {
    id: 'consulting',
    title: 'Consulting & Architecture',
    tagline: 'Get the architecture right before you build.',
    body: [
      'We work with engineering and product teams to define the right IoT architecture for their scale, budget, and timeline — before a line of production code is written.',
      'Our consulting engagements typically include a technical assessment, architecture document, and vendor/technology recommendations.',
    ],
    bullets: [
      'IoT stack technology selection',
      'Protocol and connectivity architecture',
      'Security and device identity design',
      'Cloud cost modelling for device scale',
      'Team capability assessment and training',
    ],
  },
];

const INDUSTRIES = [
  {
    name: 'Smart Energy & Utilities',
    points: ['Energy metering (single/three-phase)', 'Solar plant monitoring', 'Grid fault detection', 'Remote load control'],
  },
  {
    name: 'Fleet & Logistics',
    points: ['Real-time GPS tracking', 'Driver behaviour analytics', 'Fuel monitoring', 'Trip history and geofencing'],
  },
  {
    name: 'Smart Agriculture',
    points: ['Soil moisture and NPK sensing', 'Automated irrigation control', 'Weather station integration', 'Crop disease early warning'],
  },
  {
    name: 'Industrial Manufacturing',
    points: ['Machine health monitoring', 'OEE and downtime tracking', 'Predictive maintenance alerts', 'Quality control dashboards'],
  },
  {
    name: 'Smart Buildings',
    points: ['HVAC automation', 'Energy sub-metering per floor/zone', 'Access control integration', 'Occupancy analytics'],
  },
  {
    name: 'Environmental Monitoring',
    points: ['Air quality (PM2.5, CO2, VOC)', 'Water quality (pH, TDS, turbidity)', 'Noise level monitoring', 'Pollution index dashboards'],
  },
];

export default function Solutions() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gray-950 text-white py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="text-brand-400 text-sm font-semibold uppercase tracking-widest">Solutions</span>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-3 mb-5 leading-tight">
            End-to-End IoT Solutions<br />
            <span className="text-brand-400">For Every Layer of the Stack</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl leading-relaxed">
            From hardware selection to cloud deployment — we cover every step so your team can ship
            connected products faster and operate them reliably at scale.
          </p>
        </div>
      </section>

      {/* Solutions */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {SOLUTIONS.map((sol, i) => (
            <div
              key={sol.id}
              id={sol.id}
              className={`grid md:grid-cols-2 gap-10 items-start ${i % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
            >
              <div>
                <span className="text-brand-600 text-xs font-semibold uppercase tracking-widest">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mt-2 mb-2">{sol.title}</h2>
                <p className="text-brand-600 font-medium text-sm mb-4">{sol.tagline}</p>
                {sol.body.map((para, j) => (
                  <p key={j} className="text-gray-600 text-sm leading-relaxed mb-3">{para}</p>
                ))}
              </div>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">What's included</p>
                <ul className="space-y-3">
                  {sol.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-600 mt-2 flex-shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Industries We Serve</h2>
          <p className="text-gray-500 mb-12 max-w-2xl">
            Our solutions are adapted for the specific protocols, regulations, and operational
            realities of each sector.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {INDUSTRIES.map((ind) => (
              <div key={ind.name} className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">{ind.name}</h3>
                <ul className="space-y-2">
                  {ind.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-brand-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-white">
            <h2 className="text-2xl font-bold">Have a project in mind?</h2>
            <p className="text-brand-200 mt-1">Let's talk about your requirements.</p>
          </div>
          <Link
            href="/contact"
            className="px-8 py-3 bg-white text-brand-700 font-semibold rounded-lg hover:bg-brand-50 transition-colors whitespace-nowrap"
          >
            Start a Conversation
          </Link>
        </div>
      </section>
    </>
  );
}
