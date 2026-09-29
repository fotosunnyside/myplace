import type { Metadata } from 'next'
import { LegalPage } from '@/components/layout/LegalPage'

export const metadata: Metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="September 29, 2026">
      <p>Welcome to PLACES FOR US (placesforus.com, “PLACES”). By using the site you agree to these terms.</p>
      <h2>Be kind</h2>
      <ul>
        <li>No harassment, hate, threats, spam, scams or illegal content.</li>
        <li>Only post things you have the right to share.</li>
        <li>You must be at least 13 years old (or the minimum age in your country) to create an account.</li>
      </ul>
      <h2>Selling in MarketPlace</h2>
      <p>
        Sellers are responsible for their listings, pricing, taxes, delivery and refunds. Payments are made directly to sellers through their own Stripe
        Payment Links; PLACES is not a party to the sale. Orders marked “Test order” involve no payment.
      </p>
      <h2>Teaching in MindPlace</h2>
      <p>
        Publishing a course or membership takes Create in MindPlace (a monthly subscription per published course or membership) or PLACES Pass. You
        can cancel anytime; while no plan covers your courses they are hidden from MindPlace, but people who bought them keep access. Creators are
        responsible for their course content and for delivering what they advertise. Paid courses and memberships are sold directly by creators through
        their own Stripe Payment Links. PLACES charges a 5% platform fee on paid enrollments and membership payments, or 0% for creators with PLACES
        Pass.
      </p>
      <h2>Opportunities in WorkPlace</h2>
      <p>
        Posting an opportunity costs a small one-time fee, or is included with PLACES Pass. Posters are responsible for the accuracy and lawfulness of their opportunities. Applying is
        always free — never pay to apply for a job, and report anything suspicious. Contracts and payments are between the employer and the person
        hired.
      </p>
      <h2>Fees</h2>
      <p>
        Joining and using PLACES is free. PLACES charges no listing fees; local MarketPlace sales are free, and items bought through PLACES and shipped
        carry a 1% platform fee (PLACES Pass does not change this). Current prices for plans (Create in MindPlace, Create Virtual Places, PLACES Pass), job posts
        and sponsored placements are shown on the Pricing page and where you buy them, and may change with notice. Payment processing fees are separate
        from PLACES fees.
      </p>
      <h2>Sponsored placements</h2>
      <p>
        Each Place shows one sponsored placement at a time, clearly labelled (it may also appear once in the YourPlace feed). Sponsored placements are not
        included in any plan. Ads must be honest, family-friendly and lawful, and link to a real
        business. PLACES may decline or remove ads that break these rules.
      </p>
      <h2>Your content</h2>
      <p>You own what you create. You give PLACES permission to display it so the service can work. You can delete it at any time.</p>
      <h2>No warranty</h2>
      <p>PLACES is an early version provided “as is”. Features may change, and content stored on your device can be lost if browser data is cleared.</p>
      <h2>Changes</h2>
      <p>We may update these terms. We will note the date above when we do.</p>
    </LegalPage>
  )
}
