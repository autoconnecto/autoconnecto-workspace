'use client';

import React, { useEffect, useRef } from 'react';
import AppImage from '@/components/ui/AppImage';
import AppIcon from '@/components/ui/AppIcon';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatar: string;
  avatarAlt: string;
  rating: number;
  tag: string;
}

const TESTIMONIALS: Testimonial[] = [
{
  quote:
  "Autoconnecto cut our time-to-dashboard from 3 weeks to 2 days. We connected 4,000 field sensors and had live alerts running before our sprint ended.",
  author: 'Priya Nair',
  role: 'Head of Engineering',
  company: 'Volterra Energy',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1c87ea563-1772987998409.png",
  avatarAlt: 'Professional woman in her 30s with dark hair, engineering background',
  rating: 5,
  tag: 'Smart Energy'
},
{
  quote:
  "White-label worked out of the box. Our enterprise clients log in and see our brand, not a third-party tool. That alone justified the switch.",
  author: 'Lars Eriksson',
  role: 'VP Product',
  company: 'Trackify Fleet',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_1d74104fa-1763301518094.png",
  avatarAlt: 'Professional man in his 40s with light hair, product leadership headshot',
  rating: 5,
  tag: 'Fleet Tracking'
},
{
  quote:
  "RBAC and multi-tenancy were the blockers with every other platform. Autoconnecto had both configured and tested in under 48 hours.",
  author: 'Marcus Hoffmann',
  role: 'CTO',
  company: 'Nexus Industrial',
  avatar: "https://img.rocket.new/generatedImages/rocket_gen_img_15b6b3a45-1763296171775.png",
  avatarAlt: 'Professional man in his 40s with short hair, neutral background, corporate headshot',
  rating: 5,
  tag: 'Industrial IoT'
},
{
  quote:
  "We process 2M+ MQTT messages per hour across 12 countries. Latency stays under 40ms. The alarms engine alone replaced two internal tools.",
  author: 'Amara Diallo',
  role: 'Platform Architect',
  company: 'AgroSense Africa',
  avatar: 'https://img.rocket.new/generatedImages/rocket_gen_img_17c6ec630-1763296514678.png',
  avatarAlt: 'Professional woman in her 30s, technology background, confident headshot',
  rating: 5,
  tag: 'Smart Agriculture'
}];


const CLIENT_LOGOS = [
{ name: 'Volterra Energy', abbr: 'VE' },
{ name: 'Trackify Fleet', abbr: 'TF' },
{ name: 'Nexus Industrial', abbr: 'NI' },
{ name: 'AgroSense', abbr: 'AS' },
{ name: 'GridWatch', abbr: 'GW' },
{ name: 'PulseMetrics', abbr: 'PM' },
{ name: 'SkyNode', abbr: 'SN' },
{ name: 'DataBridge', abbr: 'DB' }];


function StarRating({ count }: {count: number;}) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) =>
      <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )}
    </div>);

}

export default function TestimonialsSection() {
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
    <section id="testimonials" ref={sectionRef} className="py-20 relative overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full blur-[140px] opacity-5 pointer-events-none"
      style={{ background: 'radial-gradient(ellipse, #0EA5E9 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section label */}
        <div className="scroll-reveal hidden-init flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <AppIcon name="ChatBubbleLeftRightIcon" size={12} />
            Trusted by Engineering Teams
          </span>
        </div>

        {/* Heading */}
        <div className="scroll-reveal hidden-init scroll-reveal-delay-1 text-center mb-14 max-w-2xl mx-auto">
          <h2 className="font-display font-bold text-4xl sm:text-5xl tracking-tight text-foreground mb-4">
            Real Teams.{' '}
            <span className="text-gradient-primary">Real Deployments.</span>
          </h2>
          <p className="text-muted-foreground text-lg font-light">
            From 500 sensors to 10 million devices — here&apos;s what engineers say after going live.
          </p>
        </div>

        {/* Bento testimonials grid — asymmetric */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {/* Featured large card — spans 2 rows on lg */}
          <div className="scroll-reveal hidden-init lg:row-span-2 relative group">
            {/* Stacked depth layers */}
            <div className="absolute inset-x-3 -top-2 h-full bg-secondary/20 border border-border rounded-2xl" />
            <div className="absolute inset-x-1.5 -top-1 h-full bg-secondary/40 border border-border rounded-2xl" />
            <div className="relative z-10 bg-card border border-primary/20 rounded-2xl p-7 card-glow h-full flex flex-col justify-between group-hover:border-primary/40 transition-colors duration-300">
              <div>
                <div className="flex items-start justify-between mb-5">
                  <StarRating count={TESTIMONIALS[0].rating} />
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                    {TESTIMONIALS[0].tag}
                  </span>
                </div>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" className="text-primary/20 mb-4">
                  <path d="M14.017 21v-3c0-1.105.895-2 2-2h3c.552 0 1-.448 1-1V9c0-.552-.448-1-1-1h-4c-.552 0-1 .448-1 1v2c0 .552-.448 1-1 1h-1V5h10v10c0 3.314-2.686 6-6 6h-2zm-9 0v-3c0-1.105.895-2 2-2h3c.552 0 1-.448 1-1V9c0-.552-.448-1-1-1H6c-.552 0-1 .448-1 1v2c0 .552-.448 1-1 1H3V5h10v10c0 3.314-2.686 6-6 6H5z" />
                </svg>
                <p className="text-foreground text-base leading-relaxed font-light italic mb-6">
                  &ldquo;{TESTIMONIALS[0].quote}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-5 border-t border-border">
                <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/20">
                  <AppImage
                    src={TESTIMONIALS[0].avatar}
                    alt={TESTIMONIALS[0].avatarAlt}
                    width={44}
                    height={44}
                    className="object-cover w-full h-full" />
                  
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{TESTIMONIALS[0].author}</div>
                  <div className="text-xs text-muted-foreground">{TESTIMONIALS[0].role}, {TESTIMONIALS[0].company}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Remaining 3 cards */}
          {TESTIMONIALS.slice(1).map((t, i) =>
          <div
            key={i}
            className={`scroll-reveal hidden-init scroll-reveal-delay-${i + 1} bg-card border border-border rounded-2xl p-6 card-glow card-glow-hover flex flex-col justify-between transition-colors duration-300`}>
            
              <div>
                <div className="flex items-start justify-between mb-4">
                  <StarRating count={t.rating} />
                  <span className="px-2.5 py-1 rounded-full bg-secondary/60 border border-border text-xs font-medium text-muted-foreground">
                    {t.tag}
                  </span>
                </div>
                <p className="text-foreground/90 text-sm leading-relaxed font-light italic mb-5">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-border">
                  <AppImage
                  src={t.avatar}
                  alt={t.avatarAlt}
                  width={36}
                  height={36}
                  className="object-cover w-full h-full" />
                
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.author}</div>
                  <div className="text-xs text-muted-foreground">{t.role}, {t.company}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Social proof bar */}
        <div className="scroll-reveal hidden-init scroll-reveal-delay-2 flex flex-wrap items-center justify-center gap-6 mb-14">
          {[
          { value: '4.9/5', label: 'avg. rating' },
          { value: '200+', label: 'enterprise deployments' },
          { value: '98%', label: 'renewal rate' }].
          map((stat, i) =>
          <div key={i} className="flex items-center gap-3">
              <div className="text-center">
                <div className="font-display font-bold text-2xl text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
              {i < 2 && <div className="w-px h-10 bg-border hidden sm:block" />}
            </div>
          )}
        </div>

        {/* Client logos marquee */}
        <div className="scroll-reveal hidden-init scroll-reveal-delay-3">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Trusted by teams at
          </p>
          <div className="relative overflow-hidden">
            {/* Fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, var(--background), transparent)' }} />
            <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to left, var(--background), transparent)' }} />

            <div className="flex gap-4 animate-marquee">
              {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((logo, i) =>
              <div
                key={i}
                className="flex-shrink-0 flex items-center gap-2.5 bg-card border border-border rounded-xl px-5 py-3 hover:border-primary/30 transition-colors duration-200">
                
                  <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">{logo.abbr}</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{logo.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>);

}