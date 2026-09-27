import type { Metadata } from 'next'
import { LegalPage } from '@/components/layout/LegalPage'

export const metadata: Metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="September 27, 2026">
      <p>PLACES is built to be a calmer, more respectful corner of the internet. This page explains what happens to your information.</p>
      <h2>Where your data lives today</h2>
      <p>
        Right now your account and everything you create — posts, messages, listings, applications, saved items and learning progress — are stored
        only in your browser on this device (IndexedDB). We do not receive them on a server. Clearing your browser data or using “Reset this device”
        in Settings removes them.
      </p>
      <h2>Payments</h2>
      <p>
        When you buy something with a seller’s Stripe Payment Link, you pay on Stripe’s secure checkout. Stripe processes your payment details
        under its own <a className="text-teal-deep underline" href="https://stripe.com/privacy">privacy policy</a>; PLACES never sees your card number.
      </p>
      <h2>Analytics</h2>
      <p>If analytics are enabled, we use privacy-friendly, cookie-free page counts. We do not sell personal data or use advertising trackers.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Download everything you created from Settings → Download my data.</li>
        <li>Delete your account and its content from Settings → Delete my account.</li>
      </ul>
      <h2>When PLACES moves to the cloud</h2>
      <p>We will update this policy before any of your data is stored on our servers, and explain how it is protected, where it is kept and how long.</p>
      <h2>Contact</h2>
      <p>Questions? Message the PLACES Guide inside the app.</p>
    </LegalPage>
  )
}
