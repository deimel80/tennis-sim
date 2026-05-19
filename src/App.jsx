import { useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'

const exampleText = `Tabelle
 	Rang	Mannschaft	Begegnungen	S	U	N	Punkte	Matches	Sätze	Games
Aufsteiger  	1	Schwelmer TC RW 1	1	1	0	0	2:0	5:1	11:3	67:34
 	2	TC Menden 1	1	1	0	0	2:0	5:1	10:2	68:40
 	3	TC Halver 1960 1	1	1	0	0	2:0	5:1	11:3	71:45
 	4	TC Lössel-Roden 2	1	0	0	1	0:2	1:5	3:11	45:71
 	5	TC Halden 2000 1	1	0	0	1	0:2	1:5	2:10	40:68
Absteiger 	6	TuS Neuenrade 1	1	0	0	1	0:2	1:5	3:11	34:67

Spielplan
Datum	Heimmannschaft	Gastmannschaft	Matches	Sätze	Games	Spielbericht
Sa.	09.05.2026 13:00	 	TuS Neuenrade 1	Schwelmer TC RW 1	1:5	3:11	34:67	anzeigen 
So.	10.05.2026 10:00	 	TC Halver 1960 1	TC Lössel-Roden 2	5:1	11:3	71:45	anzeigen 
 	 	 	TC Halden 2000 1	TC Menden 1	1:5	2:10	40:68	anzeigen 
Sa.	30.05.2026 13:00	 	TC Menden 1	TuS Neuenrade 1	 	 	 	ursprünglich am 31.05. 10:00 
So.	31.05.2026 10:00	 	TC Lössel-Roden 2	TC Halden 2000 1	 	 	 	offen 
 	 	 	Schwelmer TC RW 1	TC Halver 1960 1	 	 	 	offen`

function pair(value) {
  const match = String(value || '').trim().replace(/\s/g, '').replace(/[;/-]/g, ':').match(/^(\d+):(\d+)$/)
  return match ? [Number(match[1]), Number(match[2])] : null
}

function clean(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t').map(clean)
  return line.replace(/\s{2,}/g, '\t').split('\t').map(clean)
}

function parseTableRow(line) {
  const cells = splitLine(line).filter(Boolean)
  const joined = clean(line)
  if (/rang|mannschaft|begegnungen|punkte|matches|sätze|saetze|games/i.test(joined)) return null
  const ratios = cells.filter(cell => pair(cell))
  if (ratios.length < 4) return null
  const rankIndex = cells.findIndex(cell => /^\d+$/.test(cell))
  if (rankIndex < 0) return null

  const name = clean(cells[rankIndex + 1]).replace(/^Aufsteiger\s+/i, '').replace(/^Absteiger\s+/i, '')
  const leaguePoints = pair(cells[rankIndex + 6])
  const matches = pair(cells[rankIndex + 7])
  const sets = pair(cells[rankIndex + 8])
  const games = pair(cells[rankIndex + 9])
  if (!name || !leaguePoints || !matches || !sets || !games) return null

  return {
    name,
    played: Number(cells[rankIndex + 2] || 0),
    wins: Number(cells[rankIndex + 3] || 0),
    draws: Number(cells[rankIndex + 4] || 0),
    losses: Number(cells[rankIndex + 5] || 0),
    leaguePointsWon: leaguePoints[0],
    leaguePointsLost: leaguePoints[1],
    matchesWon: matches[0],
    matchesLost: matches[1],
    setsWon: sets[0],
    setsLost: sets[1],
    gamesWon: games[0],
    gamesLost: games[1],
    promotion: /^Aufsteiger/i.test(joined),
    relegation: /^Absteiger/i.test(joined),
    withdrawn: /zurückgezogen|zurueckgezogen|nicht gewertet/i.test(joined)
  }
}

function findTeamAtStart(text, teams) {
  const normalized = clean(text).toLowerCase()
  const sorted = [...teams].sort((a, b) => b.name.length - a.name.length)
  for (const team of sorted) {
    if (normalized.startsWith(team.name.toLowerCase())) return team.name
  }
  return ''
}

function parseFixtureLine(line, teams, lastDate) {
  const joined = clean(line)
  if (/datum|heimmannschaft|gastmannschaft|spielbericht/i.test(joined)) return null

  const dateRegex = /(?:Mo\.|Di\.|Mi\.|Do\.|Fr\.|Sa\.|So\.)?\s*\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/i
  const dateMatch = joined.match(dateRegex)
  const date = dateMatch ? clean(dateMatch[0]) : lastDate

  const area = dateMatch ? joined.slice(dateMatch.index + dateMatch[0].length).trim() : joined
  const home = findTeamAtStart(area, teams)
  if (!home) return null
  const afterHome = area.slice(home.length).trim()
  const away = findTeamAtStart(afterHome, teams)
  if (!away) return null

  const afterAway = afterHome.slice(away.length).trim()
  const ratios = [...afterAway.matchAll(/(\d+)\s*[:;]\s*(\d+)/g)].map(m => `${m[1]}:${m[2]}`)
  const played = /anzeigen/i.test(afterAway)

  return {
    date,
    home,
    away,
    result: played ? ratios[0] || '' : '',
    sets: played ? ratios[1] || '' : '',
    games: played ? ratios[2] || '' : '',
    status: played ? 'played' : 'open',
    note: /ursprünglich|urspr/i.test(afterAway) ? clean(afterAway) : ''
  }
}

function parseLeagueText(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const tableStart = lines.findIndex(line => /Tabelle/i.test(line))
  const planStart = lines.findIndex(line => /Spielplan/i.test(line))
  const tableLines = lines.slice(tableStart >= 0 ? tableStart + 1 : 0, planStart >= 0 ? planStart : lines.length)
  const teams = tableLines.map(parseTableRow).filter(Boolean)
  const fixtures = []
  let lastDate = ''

  if (planStart >= 0) {
    for (const line of lines.slice(planStart + 1)) {
      const joined = clean(line)
      const dateMatch = joined.match(/(?:Mo\.|Di\.|Mi\.|Do\.|Fr\.|Sa\.|So\.)?\s*\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/i)
      if (dateMatch) lastDate = clean(dateMatch[0])
      const parsed = parseFixtureLine(line, teams, lastDate)
      if (parsed) {
        fixtures.push(parsed)
        if (parsed.date) lastDate = parsed.date
      }
    }
  }

  return { teams, fixtures, maxMatches: inferMaxMatches(teams, fixtures) }
}

function inferMaxMatches(teams, fixtures) {
  const values = []
  for (const team of teams) {
    if (team.played > 0) values.push(Math.round((team.matchesWon + team.matchesLost) / team.played))
  }
  for (const fixture of fixtures) {
    const p = pair(fixture.result)
    if (p) values.push(p[0] + p[1])
  }
  const counts = values.reduce((acc, value) => {
    if (value > 0) acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return best ? Number(best[0]) : 9
}

function resultOptions(maxMatches) {
  const total = Number(maxMatches) || 9
  return Array.from({ length: total + 1 }, (_, index) => `${total - index}:${index}`)
}

function fixtureDay(date) {
  const match = String(date || '').match(/\d{2}\.\d{2}\.\d{4}/)
  return match ? match[0] : 'ohne Datum'
}

function sortTeams(teams, direct = {}) {
  return [...teams].filter(team => !team.withdrawn).sort((a, b) => compareSeasonProjection(a, b, maxMatches))
}

function mostLikelyRank(entry) {
  const best = Object.entries(entry.rankCounts || {}).sort((a, b) => b[1] - a[1])[0]
  return best ? Number(best[0]) : 0
}

function formatPercent(value) {
  return `${Math.round(value)}%`
}



function exportTableText(activeTeams, statusText) {
  const lines = []
  lines.push('🎾 tennis-sim')
  lines.push('')

  if (statusText) lines.push(statusText)
  lines.push('')

  activeTeams.forEach((team, index) => {
    lines.push(`${index + 1}. ${team.name}`)
    lines.push(`   Punkte ${ratio(team.leaguePointsWon, team.leaguePointsLost)} | Matches ${ratio(team.matchesWon, team.matchesLost)} | Sätze ${ratio(team.setsWon, team.setsLost)}`)
  })

  return lines.join('\n')
}

async function copyOrShareText(text) {
  if (!text) return 'Kein Export möglich.'

  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'Teilen geöffnet.'
    } catch {}
  }

  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return 'Export kopiert.'
  }

  return 'Nicht unterstützt.'
}

export default function App() {
  const [sourceText, setSourceText] = useState('')
  const [teams, setTeams] = useState([])
  const [fixtures, setFixtures] = useState([])
  const [simulatedTeams, setSimulatedTeams] = useState([])
  const [maxMatches, setMaxMatches] = useState(9)
  const [selectedDay, setSelectedDay] = useState('alle')
  const [status, setStatus] = useState('Text einfügen und auswerten.')
  const [direct, setDirect] = useState({})
  const [seasonResults, setSeasonResults] = useState([])

  const activeTeams = simulatedTeams.length ? simulatedTeams : sortTeams(teams, direct)
  const days = useMemo(() => {
    const values = [...new Set(fixtures.filter(f => f.status === 'open').map(f => fixtureDay(f.date)))]
    return values.length ? values : ['alle']
  }, [fixtures])
  const visibleFixtures = fixtures.filter(f => f.status === 'open' && (selectedDay === 'alle' || fixtureDay(f.date) === selectedDay))
  const options = resultOptions(maxMatches)

  const tieGroups = useMemo(() => {
    const groups = {}
    activeTeams.forEach(team => {
      groups[team.leaguePointsWon] ||= []
      groups[team.leaguePointsWon].push(team)
    })
    return Object.values(groups).filter(group => group.length > 1)
  }, [activeTeams])

  function parseText(text) {
    const parsed = parseLeagueText(text)
    const openFixtures = parsed.fixtures.filter(f => f.status === 'open')
    const firstDay = openFixtures[0] ? fixtureDay(openFixtures[0].date) : 'alle'
    setTeams(parsed.teams)
    setFixtures(parsed.fixtures)
    setSimulatedTeams([])
    setMaxMatches(parsed.maxMatches)
    setSelectedDay(firstDay)
    setDirect({})
    setSeasonResults([])
    setStatus(`Erkannt: ${parsed.teams.length} Teams, ${parsed.fixtures.length} Spiele, ${openFixtures.length} offen.`)
  }

  function loadExample() {
    setSourceText(exampleText)
    parseText(exampleText)
  }

  function updateFixture(target, field, value) {
    setFixtures(current => current.map(f => f === target ? { ...f, [field]: value } : f))
    setSimulatedTeams([])
    setSeasonResults([])
  }

  function runSeasonSimulation() {
    const results = simulateRemainingSeason(teams, fixtures, maxMatches, 1000)
    setSeasonResults(results)
    setStatus(results.length ? 'Rest-Saison 1000-mal simuliert.' : 'Keine Saison-Simulation möglich.')
  }

  function simulate() {
    const result = applySimulation(teams, fixtures, selectedDay, direct)
    setSimulatedTeams(result.teams)
    setStatus(result.count ? `${result.count} Begegnung(en) berechnet.` : 'Kein gültiges Ergebnis ausgewählt.')
  }

    <main className="app">
      <section className="hero">
        <p className="eyebrow">Tennis · Tabellen-Simulation</p>
        <h1>Tabellenrechner</h1>
        <p>Text aus der Ligaseite kopieren, einfügen und kommende Spieltage simulieren.</p>
      </section>

      <section className="panel help">
        <h2>So kopierst du die Daten</h2>
        <p>Auf der Ligaseite den Bereich von <b>„Tabelle“ bis zum Ende des „Spielplan“</b> markieren. Danach kopieren und unten einfügen.</p><p>Die Schätzung nutzt Tabelle, bisherige Ergebnisse, direkte Duelle und Quervergleiche über gemeinsame Gegner. Extreme Tipps werden bewusst gedämpft.</p>
      </section>

      <section className="panel">
        <div className="head">
          <h2>1. Daten einfügen</h2>
          <button className="small dark" onClick={loadExample}>Beispiel</button>
        </div>

        <textarea className="source" placeholder="Hier den kopierten Tabellen- und Spielplantext einfügen..." value={sourceText} onChange={event => setSourceText(event.target.value)} />

        <div className="actionRow">
          <button onClick={() => parseText(sourceText)}>Text auswerten</button>
          <button className="dark" onClick={() => {
            setSourceText('')
            setTeams([])
            setFixtures([])
            setSimulatedTeams([])
            setSeasonResults([])
            setStatus('Gelöscht.')
          }}>Löschen</button>
        </div>

        <p className="status">{status}</p>
      </section>

      <section className="panel">
        <div className="head">
          <h2>2. Spieltag</h2>
          <select value={selectedDay} onChange={event => { setSelectedDay(event.target.value); setSimulatedTeams([]) }}>
            {days.map(day => <option key={day} value={day}>{day}</option>)}
            <option value="alle">alle offenen Spiele</option>
          </select>
        </div>

        {!visibleFixtures.length && <p className="empty">Keine offenen Spiele erkannt.</p>}

        <div className="fixtureList">
          {visibleFixtures.map(fixture => {
            const prediction = predictedResult(fixture, teams, fixtures, maxMatches)
          
  async function exportImage() {
    if (!exportRef.current) return

    const canvas = await html2canvas(exportRef.current, {
      backgroundColor: '#ffffff',
      scale: 2
    })

    const link = document.createElement('a')
    link.download = 'tennis-sim.png'
    link.href = canvas.toDataURL('image/png')
    link.click()

    setStatus('Bild exportiert.')
  }

  async function shareTable() {
    const text = exportTableText(activeTeams, simulatedTeams.length ? 'Simulierte Tabelle' : 'Aktuelle Tabelle')
    setExportText(text)

    const result = await copyOrShareText(text)
    setStatus(result)
  }

  return (

              <article className="fixture" key={`${fixture.date}-${fixture.home}-${fixture.away}`}>
                <div className="fixtureDate">{fixture.date || 'ohne Datum'}</div>
                <div className="teams">
                  <strong>{fixture.home}</strong>
                  <span>gegen</span>
                  <strong>{fixture.away}</strong>
                </div>
                {!!fixture.note && <p className="note">{fixture.note}</p>}
                {!!prediction && (
                  <button className="prediction" onClick={() => updateFixture(fixture, 'result', prediction)}>
                    Schätzung übernehmen: {prediction}
                  </button>
                )}
                <div className="quickGrid">
                  {options.map(option => (
                    <button key={option} className={fixture.result === option ? 'quick active' : 'quick'} onClick={() => updateFixture(fixture, 'result', option)}>
                      {option}
                    </button>
                  ))}
                </div>
                <div className="inputGrid">
                  <input inputMode="text" placeholder="Matches" value={fixture.result} onChange={event => updateFixture(fixture, 'result', event.target.value)} />
                  <input inputMode="text" placeholder="Sätze optional" value={fixture.sets} onChange={event => updateFixture(fixture, 'sets', event.target.value)} />
                  <input inputMode="text" placeholder="Games optional" value={fixture.games} onChange={event => updateFixture(fixture, 'games', event.target.value)} />
                </div>
              </article>
            )
          })}
        </div>

        <div className="actionRow">
          <button onClick={simulate}>Berechnen</button>
          <button className="dark" onClick={() => setSimulatedTeams([])}>Zurücksetzen</button>
        </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>3. Tabelle</h2>
          <span>{activeTeams.length} Teams · {maxMatches} Matches</span>
        </div>

        <div className="actionRow">
          <button onClick={exportImage}>PNG exportieren</button>
          <button className="dark" onClick={shareTable}>WhatsApp Export</button>
        </div>

        {!!exportText && (
          <textarea className="exportBox" value={exportText} readOnly />
        )}

        <div ref={exportRef} className="exportImageCard">

        {!activeTeams.length && <p className="empty">Noch keine Tabelle erkannt.</p>}

        <div className="teamList">
          {activeTeams.map((team, index) => (
            <article className={`team ${team.promotion ? 'promotion' : ''} ${team.relegation ? 'relegation' : ''}`} key={team.name}>
              <div className="rank">{index + 1}</div>
              <div className="teamBody">
                <h3>{team.name}</h3>
                <div className="stats">
                  <span>Punkte <b>{ratio(team.leaguePointsWon, team.leaguePointsLost)}</b></span>
                  <span>Matches <b>{ratio(team.matchesWon, team.matchesLost)}</b></span>
                  <span>Sätze <b>{ratio(team.setsWon, team.setsLost)}</b></span>
                  <span>Games <b>{ratio(team.gamesWon, team.gamesLost)}</b></span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      </section>

      <section className="panel">
        <div className="head">
          <h2>4. Saison-Prognose</h2>
          <span>1000 Simulationen</span>
        </div>

        <p className="status">Simuliert alle offenen Begegnungen um die jeweilige Schätzung herum. Klare Kräfteverhältnisse streuen nur wenig, enge Spiele stärker. Die Sortierung nutzt zusätzlich eine Plausibilitätsbremse über Match-, Satz- und Gamebilanz.</p>

        <div className="actionRow">
          <button onClick={runSeasonSimulation}>Rest-Saison simulieren</button>
          <button className="dark" onClick={() => setSeasonResults([])}>Prognose löschen</button>
        </div>

        {!!seasonResults.length && (
          <div className="seasonList">
            {seasonResults.map((entry, index) => (
              <article className="seasonCard" key={entry.name}>
                <div className="rank">{index + 1}</div>
                <div className="teamBody">
                  <h3>{entry.name}</h3>
                  <div className="stats">
                    <span>häufigster Platz <b>{mostLikelyRank(entry)}</b></span>
                    <span>Ø Platz <b>{entry.avgRank.toFixed(1)}</b></span>
                    <span>Stärke <b>{entry.baseStrength.toFixed(1)}</b></span>
                    <span>Letzter <b>{formatPercent(entry.lastPct)}</b></span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {!!tieGroups.length && (
        <section className="panel">
          <div className="head">
            <h2>Direkter Vergleich</h2>
            <span>bei Punktgleichheit</span>
          </div>
          {tieGroups.map(group => (
            <div className="directGroup" key={group.map(team => team.name).join('|')}>
              {group.flatMap((a, index) => group.slice(index + 1).map(b => {
                const key = `${a.name}__${b.name}`
              
  async function exportImage() {
    if (!exportRef.current) return

    const canvas = await html2canvas(exportRef.current, {
      backgroundColor: '#ffffff',
      scale: 2
    })

    const link = document.createElement('a')
    link.download = 'tennis-sim.png'
    link.href = canvas.toDataURL('image/png')
    link.click()

    setStatus('Bild exportiert.')
  }

  async function shareTable() {
    const text = exportTableText(activeTeams, simulatedTeams.length ? 'Simulierte Tabelle' : 'Aktuelle Tabelle')
    setExportText(text)

    const result = await copyOrShareText(text)
    setStatus(result)
  }

  return (

                  <div className="directRow" key={key}>
                    <p><b>{a.name}</b><br />gegen<br /><b>{b.name}</b></p>
                    <select value={direct[key] || ''} onChange={event => setDirect(current => ({ ...current, [key]: event.target.value }))}>
                      <option value="">nicht festlegen</option>
                      <option value="a">{a.name} vorne</option>
                      <option value="b">{b.name} vorne</option>
                    </select>
                  </div>
                )
              }))}
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
