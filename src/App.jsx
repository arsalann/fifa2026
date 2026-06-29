import { useEffect } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useData } from './lib/data.jsx'
import { useTheme } from './lib/prefs'
import { initAnalytics, trackPageview, track } from './lib/analytics'
import GroupsPage from './pages/GroupsPage'
import SchedulePage from './pages/SchedulePage'
import TeamsPage from './pages/TeamsPage'
import TeamPage from './pages/TeamPage'
import BracketPage from './pages/BracketPage'
import ScorersPage from './pages/ScorersPage'
import ComparePage from './pages/ComparePage'

function UpdatedChip() {
  const { updatedAt, source, refresh } = useData()
  const label = updatedAt
    ? `Updated ${updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : source === 'bundled'
      ? 'Offline data'
      : 'Loading…'
  return (
    <button className="chip" onClick={refresh} title="Scores refresh at half-time and full-time. Tap to refresh now.">
      ⟳ {label}
    </button>
  )
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const location = useLocation()

  useEffect(() => {
    initAnalytics()
  }, [])
  useEffect(() => {
    trackPageview(location.pathname)
  }, [location.pathname])

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <span aria-hidden="true">🏆</span> World Cup 2026
        </h1>
        <div className="topbar-actions">
          <div className="powered-by" aria-label="Powered by Bruin, Netlify, and MotherDuck">
            <span>Powered by</span>
            <a className="powered-link" href="https://getbruin.com" target="_blank" rel="noreferrer">
              <img className="powered-logo powered-logo-bruin" src="/bruin-logo.svg" alt="Bruin" />
            </a>
            <a className="powered-link" href="https://join.netlify.com/gpym1z3g2vry-w6zrwt" target="_blank" rel="noreferrer">
              <img className="powered-logo powered-logo-netlify" src="/netlify-logo.png" alt="Netlify" />
            </a>
            <a className="powered-link" href="https://motherduck.com/ecosystem/bruin/" target="_blank" rel="noreferrer">
              <img className="powered-logo powered-logo-motherduck" src="/motherduck-wordmark.png" alt="MotherDuck" />
            </a>
          </div>
          <UpdatedChip />
          <button
            className="chip"
            onClick={() => {
              track('theme_toggled', { to: theme === 'dark' ? 'light' : 'dark' })
              toggleTheme()
            }}
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<GroupsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/team/:slug" element={<TeamPage />} />
          <Route path="/bracket" element={<BracketPage />} />
          <Route path="/scorers" element={<ScorersPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="*" element={<GroupsPage />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>
          <span>📊</span>Groups
        </NavLink>
        <NavLink to="/schedule">
          <span>📅</span>Schedule
        </NavLink>
        <NavLink to="/teams">
          <span>🔎</span>Teams
        </NavLink>
        <NavLink to="/bracket">
          <span>🏆</span>Bracket
        </NavLink>
        <NavLink to="/scorers">
          <span>👟</span>Boot
        </NavLink>
      </nav>
    </div>
  )
}
