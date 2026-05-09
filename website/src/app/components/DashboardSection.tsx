'use client';

import React, { useEffect, useRef } from 'react';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';

// Mock chart data — pre-computed, no Math.random in render
const CHART_BARS = [
{ h: 55, active: false }, { h: 70, active: false }, { h: 45, active: false },
{ h: 85, active: false }, { h: 62, active: false }, { h: 90, active: true },
{ h: 78, active: false }, { h: 68, active: false }, { h: 82, active: false },
{ h: 74, active: false }, { h: 88, active: false }, { h: 65, active: false }];


const SPARKLINE_POINTS = "0,40 20,35 40,42 60,28 80,32 100,20 120,25 140,18 160,22 180,15 200,18";

const WIDGETS = [
{ icon: 'BoltIcon', label: 'Live Telemetry', value: '2,847', unit: 'msg/s', color: 'text-primary' },
{ icon: 'SignalIcon', label: 'Active Devices', value: '14,203', unit: 'online', color: 'text-accent' },
{ icon: 'ExclamationTriangleIcon', label: 'Active Alarms', value: '3', unit: 'critical', color: 'text-orange-400' },
{ icon: 'ShieldCheckIcon', label: 'Auth Success', value: '99.97', unit: '%', color: 'text-emerald-400' }];


export default function DashboardSection() {
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
      { rootMargin: '0px 0px -80px 0px', threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="platform" ref={sectionRef} className="py-20 pt-12 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section label */}
        <div className="scroll-reveal hidden-init flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Icon name="ChartBarIcon" size={12} />
            Live Dashboard Engine
          </span>
        </div>

        {/* Heading */}
        <div className="scroll-reveal hidden-init scroll-reveal-delay-1 text-center mb-14 max-w-2xl mx-auto">
          <h2 className="font-display font-bold text-4xl sm:text-5xl tracking-tight text-foreground mb-4">
            See Your Devices.{' '}
            <span className="text-gradient-primary">In Real Time.</span>
          </h2>
          <p className="text-muted-foreground text-lg font-light leading-relaxed">
            Build pixel-perfect dashboards with 50+ chart types, maps, gauges, and custom widgets — no code required.
          </p>
        </div>

        {/* Dashboard mock UI */}
        <div className="scroll-reveal hidden-init scroll-reveal-delay-2 relative rounded-2xl border border-border bg-card overflow-hidden card-glow">
          {/* Mock toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/20">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Fleet Monitoring — Live Dashboard</span>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
          </div>

          {/* Dashboard body */}
          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stat widgets row */}
            <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              {WIDGETS.map((w, i) =>
              <div key={i} className="bg-secondary/30 border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">{w.label}</span>
                    <Icon name={w.icon as 'BoltIcon'} size={14} className={w.color} />
                  </div>
                  <div className="font-display font-bold text-2xl text-foreground">
                    {w.value}
                    <span className="text-xs font-sans font-normal text-muted-foreground ml-1">{w.unit}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Line chart */}
            <div className="lg:col-span-2 bg-secondary/30 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-foreground">Temperature Telemetry</span>
                <span className="text-xs text-muted-foreground">Last 24h</span>
              </div>
              <div className="relative h-32">
                <svg className="w-full h-full" viewBox="0 0 200 50" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`M${SPARKLINE_POINTS.split(' ').map((p, i, arr) => {
                    if (i === 0) return `M${p}`;
                    return `L${p}`;
                  }).join(' ')} L200,50 L0,50 Z`}
                  fill="url(#lineGrad)" />
                  <polyline
                    points={SPARKLINE_POINTS}
                    fill="none"
                    stroke="#0EA5E9"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round" />
                  
                </svg>
              </div>
            </div>

            {/* Bar chart */}
            <div className="bg-secondary/30 border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-foreground">Messages/Hour</span>
                <Icon name="ChartBarIcon" size={14} className="text-muted-foreground" />
              </div>
              <div className="flex items-end gap-1 h-24">
                {CHART_BARS.map((bar, i) =>
                <div
                  key={i}
                  className="flex-1 rounded-t-sm transition-all"
                  style={{
                    height: `${bar.h}%`,
                    background: bar.active ? '#0EA5E9' : 'rgba(14,165,233,0.25)'
                  }} />

                )}
              </div>
            </div>

            {/* Map widget placeholder */}
            <div className="lg:col-span-2 bg-secondary/30 border border-border rounded-xl overflow-hidden relative" style={{ minHeight: 160 }}>
              <AppImage
                src="https://img.rocket.new/generatedImages/rocket_gen_img_111965df0-1776609584105.png"
                alt="Dark world map showing connected device locations across continents with teal pin markers"
                fill
                className="object-cover opacity-30" />
              
              <div className="absolute inset-0 p-4">
                <span className="text-sm font-medium text-foreground">Device Map</span>
                {/* Mock pins */}
                {[
                { top: '30%', left: '22%' }, { top: '45%', left: '48%' },
                { top: '35%', left: '72%' }, { top: '55%', left: '60%' },
                { top: '28%', left: '85%' }].
                map((pin, i) =>
                <div key={i} className="absolute w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse-glow"
                style={{ top: pin.top, left: pin.left }} />
                )}
              </div>
            </div>

            {/* Gauge widget */}
            <div className="bg-secondary/30 border border-border rounded-xl p-4 flex flex-col items-center justify-center">
              <span className="text-sm font-medium text-foreground mb-3">CPU Load</span>
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(14,165,233,0.15)" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#0EA5E9" strokeWidth="10"
                  strokeDasharray="251.2" strokeDashoffset="62.8" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display font-bold text-xl text-foreground">75%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Widget count callout */}
        <div className="scroll-reveal hidden-init scroll-reveal-delay-3 mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          {[
          'Line & Area Charts', 'Digital Gauges', 'Analog Gauges', 'Device Maps',
          'Data Tables', 'Pie & Donut', 'Heatmaps', 'Custom HTML'].
          map((w) =>
          <span key={w} className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={14} className="text-primary" />
              {w}
            </span>
          )}
          <span className="text-primary font-semibold">+ 42 more</span>
        </div>
      </div>
    </section>);

}