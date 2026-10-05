import Link from 'next/link';

const LINKS = {
  Company: [
    { label: 'About Us',  href: '/about' },
    { label: 'Solutions', href: '/solutions' },
    { label: 'Products',  href: '/products' },
    { label: 'Contact',   href: '/contact' },
  ],
  Platform: [
    { label: 'Autoconnecto',        href: 'https://autoconnecto.in', external: true },
    { label: 'Live Dashboard',      href: 'https://app.autoconnecto.in/login', external: true },
    { label: 'Documentation',       href: 'https://docs.autoconnecto.in', external: true },
  ],
  Industries: [
    { label: 'Smart Energy',         href: '/solutions' },
    { label: 'Fleet Tracking',       href: '/solutions' },
    { label: 'Smart Agriculture',    href: '/solutions' },
    { label: 'Industrial Monitoring',href: '/solutions' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">PC</span>
              </div>
              <span className="font-bold text-white text-lg">
                Purple<span className="text-brand-400">Chilly</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              End-to-end IoT solutions company based in Jaipur, India. We build the connected infrastructure that runs the real world.
            </p>
            <div className="space-y-1 text-sm">
              <p>
                <a href="tel:+919212100555" className="hover:text-white transition-colors">
                  +91 92121 00555
                </a>
              </p>
              <p>
                <a href="mailto:ceo@purplechilly.com" className="hover:text-white transition-colors">
                  ceo@purplechilly.com
                </a>
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Villa-71, Galaxy Enclave, Mahindra SEZ Road,<br />
                Kalwara, Jaipur – 302037, Rajasthan, India
              </p>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([section, items]) => (
            <div key={section}>
              <h4 className="text-white font-semibold text-sm mb-4">{section}</h4>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.label}>
                    {'external' in item && item.external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:text-white transition-colors"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link href={item.href} className="text-sm hover:text-white transition-colors">
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-600">
          <p>&copy; {new Date().getFullYear()} Purple Chilly. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
