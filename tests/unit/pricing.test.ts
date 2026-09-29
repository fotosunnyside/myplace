import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ADS, COURSE_FEE_RATE, HOSTED_SPACES, JOB_POST, PLANS } from '@/lib/config'
import { AD_DAYS, SALES_FEE_RATE } from '@/lib/store/actions'
import { separateMonthly } from '@/components/pricing/PricingPage'

/** The PLACES pricing ladder. If one of these fails, a price changed — check the whole ladder still makes sense. */
describe('pricing', () => {
  it('has the published prices', () => {
    expect(PLANS.create.price).toBe(700)
    expect(PLANS.host.price).toBe(1100)
    expect(PLANS.pass.price).toBe(2100)
    expect(JOB_POST.price).toBe(300)
    expect(ADS.week.price).toBe(1000)
    expect(ADS.month.price).toBe(4 * ADS.week.price) // four weeks, still $10/week
    expect(AD_DAYS).toEqual({ week: 7, month: 28 })
    expect(COURSE_FEE_RATE).toBe(0.05)
    expect(SALES_FEE_RATE).toBe(0.01)
  })

  it('makes the Pass far cheaper than buying the same things separately', () => {
    // Create ($7) + Host ($11) + 5% of course revenue vs the Pass ($21) at 0%: the Pass wins from $60/month of course sales.
    const separate = (revenue: number) => PLANS.create.price + PLANS.host.price + revenue * COURSE_FEE_RATE
    expect(PLANS.create.price + PLANS.host.price).toBeLessThan(PLANS.pass.price)
    expect(separate(6000)).toBe(PLANS.pass.price)
    expect(separate(5000)).toBeLessThan(PLANS.pass.price)
    expect(separate(7000)).toBeGreaterThan(PLANS.pass.price)
    // Hosting + one course + one job post already costs the Pass; the pricing page's example month costs far more.
    expect(PLANS.host.price + PLANS.create.price + JOB_POST.price).toBeGreaterThanOrEqual(PLANS.pass.price)
    expect(separateMonthly() - PLANS.pass.price).toBeGreaterThanOrEqual(1000) // $31 vs $21, before course fees
  })

  it('matches what the database enforces', () => {
    const sql = readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('_pricing.sql'))
      .map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8'))
      .join('\n')
    expect(sql).toContain(`round(new.total * ${COURSE_FEE_RATE})`)
    expect(sql).toContain(`interval '${AD_DAYS.month} days'`)
    expect(sql).toContain(`"max_participants": ${HOSTED_SPACES.maxParticipants}`)
    expect(sql).toContain(`"rooms_per_host": ${HOSTED_SPACES.roomsPerHost}`)
  })
})
