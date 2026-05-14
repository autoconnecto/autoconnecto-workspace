'use client';

import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

const DOCS_PUBLIC = 'https://docs.autoconnecto.in/';
const SDK_GITHUB = 'https://github.com/autoconnecto/autoconnecto-sdk';

const cards = [
  {
    title: 'Public documentation',
    description:
      'User guides, dashboard widgets, devices, alarms, tenant settings — maintained as a dedicated docs site.',
    href: DOCS_PUBLIC,
    cta: 'Open docs.autoconnecto.in',
    icon: 'BookOpenIcon' as const,
  },
  {
    title: 'Device SDK (Arduino / ESP32)',
    description:
      'Clone or download the SDK from GitHub. Connect devices over MQTT/WSS with attributes, RPC, and automatic dashboard sync.',
    href: SDK_GITHUB,
    cta: 'View on GitHub',
    icon: 'CodeBracketIcon' as const,
  },
];

export default function DevelopersSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.querySelectorAll<HTMLElement>('.scroll-reveal').forEach((el) => {
              el.classList.remove('hidden-init');
            });
          }
        });
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.05 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="developers" ref={sectionRef} className="py-16 relative scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="scroll-reveal hidden-init flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Icon name="CommandLineIcon" size={12} />
            Developers
          </span>
        </div>

        <div className="scroll-reveal hidden-init scroll-reveal-delay-1 text-center mb-12 max-w-2xl mx-auto">
          <h2 className="font-display font-bold text-4xl sm:text-5xl tracking-tight text-foreground mb-4">
            Ship firmware against a{' '}
            <span className="text-gradient-primary">documented platform</span>
          </h2>
          <p className="text-muted-foreground text-lg font-light">
            Public docs for operators and integrators, plus the open device SDK for ESP32 — no hunting through search
            results.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card, i) => (
            <a
              key={card.title}
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`scroll-reveal hidden-init group relative overflow-hidden rounded-2xl border border-border bg-card p-8 card-glow card-glow-hover transition-all duration-300 flex flex-col gap-4 min-h-[200px] ${
                i === 0 ? 'scroll-reveal-delay-2' : 'scroll-reveal-delay-3'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                <Icon name={card.icon} size={22} className="text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-xl text-foreground mb-2 group-hover:text-primary transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {card.cta}
                <Icon name="ArrowTopRightOnSquareIcon" size={16} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
