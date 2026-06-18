import { Link } from 'react-router-dom'
import teams from '../data/bruin/teams.json'
import { placeholderLabel } from '../lib/format'

// Flag + name, linking to the team page. Knockout placeholder codes
// ("1A", "W74") render as muted descriptive labels instead.
export default function TeamTag({ name, link = true, bold = false }) {
  const t = teams[name]
  if (!t) {
    return <span className="team placeholder">{placeholderLabel(name)}</span>
  }
  const inner = (
    <>
      <span className="flag" aria-hidden="true">
        {t.flag}
      </span>
      <span className={bold ? 'team-name bold' : 'team-name'}>{name}</span>
    </>
  )
  return link ? (
    <Link className="team" to={`/team/${t.slug}`}>
      {inner}
    </Link>
  ) : (
    <span className="team">{inner}</span>
  )
}
