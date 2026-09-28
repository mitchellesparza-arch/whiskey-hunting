/**
 * lib/site.js — public site URL and email sender, from env.
 *
 * NEXT_PUBLIC_BASE_URL  — canonical origin, no trailing slash (https://tatertracker.app)
 * EMAIL_FROM            — Resend sender; needs a domain verified in Resend.
 *                         onboarding@resend.dev only delivers to the Resend
 *                         account owner's own address.
 */

export const SITE_URL   = (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://tatertracker.app').replace(/\/+$/, '')
export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Tater Tracker <onboarding@resend.dev>'
