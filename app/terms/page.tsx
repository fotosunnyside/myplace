import type { Metadata } from 'next'
import { LegalPage } from '@/components/layout/LegalPage'

export const metadata: Metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="September 27, 2026">
      <p>Welcome to PLACES. By using the site you agree to these terms.</p>
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
      <h2>Opportunities in WorkPlace</h2>
      <p>Posters are responsible for the accuracy and lawfulness of their opportunities. Never pay to apply for a job; report anything suspicious.</p>
      <h2>Your content</h2>
      <p>You own what you create. You give PLACES permission to display it so the service can work. You can delete it at any time.</p>
      <h2>No warranty</h2>
      <p>PLACES is an early version provided “as is”. Features may change, and content stored on your device can be lost if browser data is cleared.</p>
      <h2>Changes</h2>
      <p>We may update these terms. We will note the date above when we do.</p>
    </LegalPage>
  )
}
