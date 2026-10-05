'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { label: 'Solutions', href: '/solutions' },
  { label: 'Products',  href: '/products' },
  { label: 'About',     href: '/about' },
  { label: 'Contact',   href: '/contact' },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">PC</span>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">
              Purple<span className="text-brand-700">Chilly</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === n.href
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="https://autoconnecto.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors"
            >
              Autoconnecto Platform →
            </Link>
            <Link
              href="/contact"
              className="px-4 py-2 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 transition-colors"
            >
              Get in Touch
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 rounded-lg text-sm font-medium ${
                pathname === n.href
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {n.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <Link
              href="https://autoconnecto.in"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 text-sm text-brand-700 font-medium"
            >
              Autoconnecto Platform →
            </Link>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 bg-brand-700 text-white text-sm font-medium rounded-lg text-center"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
