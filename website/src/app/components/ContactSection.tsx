'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface FormState {
  name: string;
  email: string;
  company: string;
  role: string;
  devices: string;
  message: string;
  useCase: string;
}

const EMPTY_DEMO: FormState = {
  name: '', email: '', company: '', role: '', devices: '', message: '', useCase: '',
};

const EMPTY_CONTACT = { name: '', email: '', subject: '', message: '' };

export default function ContactSection() {
  const [demoForm, setDemoForm] = useState(EMPTY_DEMO);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<'demo' | 'contact'>('demo');

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Backend integration point — connect to your CRM or booking system here
    setDemoSubmitted(true);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Backend integration point — connect to your email/CRM system here
    setContactSubmitted(true);
  };

  return (
    <section id="contact" className="py-16 pb-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section label */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
            <Icon name="CalendarDaysIcon" size={12} />
            Get Started Today
          </span>
        </div>

        {/* Heading */}
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <h2 className="font-display font-bold text-4xl sm:text-5xl tracking-tight text-foreground mb-4">
            Ready to Deploy Your{' '}
            <span className="text-gradient-primary">IoT Platform?</span>
          </h2>
          <p className="text-muted-foreground text-lg font-light">
            Book a live demo or drop us a message. Our team responds within 2 business hours.
          </p>
        </div>

        {/* Contact info strip */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {[
            { icon: 'CurrencyDollarIcon', label: 'Sales', email: 'founder@autoconnecto.in' },
            { icon: 'WrenchScrewdriverIcon', label: 'Support', email: 'support@autoconnecto.in' },
            { icon: 'QuestionMarkCircleIcon', label: 'Help', email: 'help@autoconnecto.in' },
          ].map((item) => (
            <a
              key={item.label}
              href={`mailto:${item.email}`}
              className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Icon name={item.icon as 'CurrencyDollarIcon'} size={15} className="text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-muted-foreground leading-none mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.email}</p>
              </div>
            </a>
          ))}
          {/* Phone */}
          <a
            href="tel:+919212100555"
            className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Icon name="PhoneIcon" size={15} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-muted-foreground leading-none mb-1">Phone</p>
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">+91 92121 00555</p>
            </div>
          </a>
          {/* Address */}
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl border border-border bg-card">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Icon name="MapPinIcon" size={15} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-muted-foreground leading-none mb-1">Address</p>
              <p className="text-sm font-semibold text-foreground">Villa-71, Galaxy Enclave, Mahindra SEZ Road,<br />Kalwara, Jaipur – 302037</p>
            </div>
          </div>
        </div>

        {/* Tab switcher (mobile) */}
        <div className="flex justify-center mb-8 lg:hidden">
          <div className="flex rounded-full border border-border bg-secondary/30 p-1">
            <button
              onClick={() => setActiveTab('demo')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'demo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              Book Demo
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'contact' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              Contact Us
            </button>
          </div>
        </div>

        {/* Forms split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Demo booking form */}
          <div className={`${activeTab === 'contact' ? 'hidden lg:block' : ''} bg-card border border-border rounded-2xl p-6 sm:p-8 card-glow`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                <Icon name="VideoCameraIcon" size={18} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">Book a Live Demo</h3>
                <p className="text-xs text-muted-foreground">30-min walkthrough with a solutions engineer</p>
              </div>
            </div>

            {demoSubmitted ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Icon name="CheckCircleIcon" size={40} className="text-emerald-400" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Icon name="CheckIcon" size={12} className="text-white" />
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xl text-foreground mb-1">Demo Request Received!</h4>
                  <p className="text-muted-foreground text-sm">
                    Thanks, <span className="text-foreground font-medium">{demoForm.name || 'there'}</span>. Your request has been logged.
                  </p>
                </div>
                <div className="w-full bg-secondary/30 border border-border rounded-xl p-4 text-left space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">What happens next</p>
                  {[
                    { icon: 'EnvelopeIcon', step: 'Confirmation email', desc: `Sent to ${demoForm.email || 'your inbox'} within minutes` },
                    { icon: 'ClockIcon', step: 'Team review', desc: 'A solutions engineer reviews your request within 2 business hours' },
                    { icon: 'CalendarDaysIcon', step: 'Calendar invite', desc: 'We\'ll share a 30-min slot that works for your schedule' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon name={item.icon as 'EnvelopeIcon'} size={13} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">{item.step}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-2.5 w-full justify-center">
                  <Icon name="ClockIcon" size={13} className="text-emerald-400 flex-shrink-0" />
                  <span>Expected response: <span className="text-emerald-400 font-semibold">within 2 business hours</span></span>
                </div>
                <button
                  onClick={() => { setDemoSubmitted(false); setDemoForm(EMPTY_DEMO); }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Full Name *</label>
                    <input
                      type="text" required
                      value={demoForm.name}
                      onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                      placeholder="Marcus Hoffmann"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Work Email *</label>
                    <input
                      type="email" required
                      value={demoForm.email}
                      onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                      placeholder="marcus@nexusindustrial.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company *</label>
                    <input
                      type="text" required
                      value={demoForm.company}
                      onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })}
                      placeholder="Nexus Industrial Systems"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Your Role</label>
                    <select
                      value={demoForm.role}
                      onChange={(e) => setDemoForm({ ...demoForm, role: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                    >
                      <option value="">Select role</option>
                      <option>CTO / VP Engineering</option>
                      <option>Product Manager</option>
                      <option>Solutions Architect</option>
                      <option>Developer</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Estimated Device Count</label>
                  <select
                    value={demoForm.devices}
                    onChange={(e) => setDemoForm({ ...demoForm, devices: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                  >
                    <option value="">Select range</option>
                    <option>Under 1,000</option>
                    <option>1,000 – 50,000</option>
                    <option>50,000 – 500,000</option>
                    <option>500,000+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Use Case</label>
                  <input
                    type="text"
                    value={demoForm.useCase}
                    onChange={(e) => setDemoForm({ ...demoForm, useCase: e.target.value })}
                    placeholder="e.g. Fleet tracking, smart metering, industrial monitoring..."
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all duration-200 shadow-[0_0_20px_rgba(14,165,233,0.25)] mt-2"
                >
                  <Icon name="CalendarDaysIcon" size={16} />
                  Book My Demo
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  No credit card required · Respond within 2 hours
                </p>
              </form>
            )}
          </div>

          {/* Contact form */}
          <div className={`${activeTab === 'demo' ? 'hidden lg:block' : ''} bg-card border border-border rounded-2xl p-6 sm:p-8 card-glow flex flex-col`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center">
                <Icon name="EnvelopeIcon" size={18} className="text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-foreground">Send a Message</h3>
                <p className="text-xs text-muted-foreground">Questions, partnerships, or custom requirements</p>
              </div>
            </div>

            {contactSubmitted ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-5 flex-1">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Icon name="PaperAirplaneIcon" size={36} className="text-emerald-400" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Icon name="CheckIcon" size={12} className="text-white" />
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-xl text-foreground mb-1">Message Sent!</h4>
                  <p className="text-muted-foreground text-sm">
                    Thanks, <span className="text-foreground font-medium">{contactForm.name || 'there'}</span>. We&apos;ve received your message.
                  </p>
                </div>
                <div className="w-full bg-secondary/30 border border-border rounded-xl p-4 text-left space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">What to expect</p>
                  {[
                    { icon: 'EnvelopeIcon', step: 'Auto-confirmation', desc: `A copy of your message was sent to ${contactForm.email || 'your email'}` },
                    { icon: 'UserCircleIcon', step: 'Personal reply', desc: 'A real team member (not a bot) will respond to your query' },
                    { icon: 'ClockIcon', step: 'Response time', desc: 'We aim to reply within 2 business hours during working days' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon name={item.icon as 'EnvelopeIcon'} size={13} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">{item.step}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-2.5 w-full justify-center">
                  <Icon name="ClockIcon" size={13} className="text-emerald-400 flex-shrink-0" />
                  <span>Expected response: <span className="text-emerald-400 font-semibold">within 2 business hours</span></span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Need urgent help?{' '}
                  <a href="tel:+919212100555" className="text-primary hover:underline font-medium">Call +91 92121 00555</a>
                </div>
                <button
                  onClick={() => { setContactSubmitted(false); setContactForm(EMPTY_CONTACT); }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4 flex-1 flex flex-col">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name *</label>
                    <input
                      type="text" required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Sarah Chen"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email *</label>
                    <input
                      type="email" required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="sarah@acuityiot.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    placeholder="e.g. White-label pricing inquiry"
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message *</label>
                  <textarea
                    required rows={5}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Tell us about your project, scale requirements, or any questions..."
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/30 text-foreground text-sm placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-all duration-200 mt-auto"
                >
                  <Icon name="PaperAirplaneIcon" size={16} />
                  Send Message
                </button>
                <div className="flex flex-col gap-3 pt-2 border-t border-border">
                  {[
                    { icon: 'ClockIcon', text: 'Response within 2 business hours' },
                    { icon: 'ShieldCheckIcon', text: 'Your data is never shared or sold' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon name={item.icon as 'ClockIcon'} size={13} className="text-primary flex-shrink-0" />
                      {item.text}
                    </div>
                  ))}
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Final CTA strip */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm mb-4">
            Prefer to explore on your own?
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="#platform"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-border text-foreground text-sm font-medium hover:bg-white/5 hover:border-primary/30 transition-all">
              <Icon name="DocumentTextIcon" size={15} className="text-primary" />
              View Documentation
            </a>
            <a href="#features"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-border text-foreground text-sm font-medium hover:bg-white/5 hover:border-primary/30 transition-all">
              <Icon name="CpuChipIcon" size={15} className="text-primary" />
              Explore Features
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}