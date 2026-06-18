// Privacy-respecting product analytics via PostHog.
//
// Entirely env-gated: with no VITE_POSTHOG_KEY set, every function here is a
// no-op and posthog-js is never even loaded. Set the key in your host (e.g.
// Netlify → Environment variables) to switch it on; nothing tracks until then.
//
// The app uses HashRouter, so real URLs look like "/#/schedule" and PostHog's
// automatic (History-API based) pageview tracking can't see in-app navigation.
// We therefore disable auto pageviews and capture them manually on each route
// change (see App.jsx), presenting a clean path to PostHog's reports.
const env = import.meta.env ?? {}
const KEY = env.VITE_POSTHOG_KEY
const HOST = env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let client = null
let initPromise = null

export function analyticsEnabled() {
  return Boolean(KEY)
}

export function initAnalytics() {
  if (!KEY || typeof window === 'undefined') return Promise.resolve(null)
  if (initPromise) return initPromise
  initPromise = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        capture_pageview: false, // hash routing: captured manually instead
        capture_pageleave: true,
        autocapture: true, // taps/clicks recorded without per-element wiring
        persistence: 'localStorage', // cookieless -> lighter consent burden
        person_profiles: 'identified_only', // anonymous; no person profiles
      })
      client = posthog
      return posthog
    })
    .catch(() => null) // blocked by an ad blocker / offline: analytics stays off
  return initPromise
}

// HashRouter pathnames already carry the real route; collapse high-cardinality
// ids so reports group cleanly (every team page under /team/:slug).
export function normalizeRoute(pathname) {
  if (/^\/team\//.test(pathname)) return '/team/:slug'
  return pathname || '/'
}

export function trackPageview(pathname) {
  if (!KEY || typeof window === 'undefined') return
  // show PostHog a clean URL — the real one is all "#/…" which it can't parse
  const cleanUrl = window.location.origin + (pathname === '/' ? '/' : pathname)
  const props = { $current_url: cleanUrl, route: normalizeRoute(pathname) }
  if (client) client.capture('$pageview', props)
  else initAnalytics().then((c) => c && c.capture('$pageview', props))
}

export function track(event, props) {
  if (!KEY) return
  if (client) client.capture(event, props)
  else initAnalytics().then((c) => c && c.capture(event, props))
}
