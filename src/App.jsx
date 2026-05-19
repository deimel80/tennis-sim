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

const clean = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()

function pair(value) {
  const m = clean(value).replace(/\s/g, '').replace(/[;/-]/g, ':').match(/^(\d+):(\d+)$/)
  return m ? [Number(m[1]), Number(m[2])] : null
}

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t').map(clean)
  return line.replace(/\s{2,}/g, '\t').split('\t').map(clean)
}

function parseTableRow(line) {
  const cells = splitLine(line).filter(Boolean)
  const joined = clean(line)
  if (/rang|mannschaft|begegnungen|punkte|matches|sätze|saetze|games/i.test(joined)) return null

  const rankIndex = cells.findIndex(cell => /^\d+$/.test(cell))
  if (rankIndex < 0) return null

  const leaguePoints = pair(cells[rankIndex + 6])
  const matches = pair(cells[rankIndex + 7])
  const sets = pair(cells[rankIndex + 8])
  const games = pair(cells[rankIndex + 9])
  if (!leaguePoints || !matches || !sets || !games) return null

  const name = clean(cells[rankIndex + 1]).replace(/^Aufsteiger\s+/i, '').replace(/^Absteiger\s+/i, '')
  if (!name) return null

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
      const dateMatch = clean(line).match(/(?:Mo\.|Di\.|Mi\.|Do\.|Fr\.|Sa\.|So\.)?\s*\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/i)
      if (dateMatch) lastDate = clean(dateMatch[0])
      const parsed = parseFixtureLine(line, teams, lastDate)
      if (parsed) fixtures.push(parsed)
    }
  }
  return { teams, fixtures, maxMatches: inferMaxMatches(teams, fixtures) }
}

function inferMaxMatches(teams, fixtures) {
  const values = []
  teams.forEach(team => {
    if (team.played > 0) values.push(Math.round((team.matchesWon + team.matchesLost) / team.played))
  })
  fixtures.forEach(fixture => {
    const p = pair(fixture.result)
    if (p) values.push(p[0] + p[1])
  })
  const counts = values.reduce((acc, value) => {
    if (value > 0) acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return best ? Number(best[0]) : 9
}

function fixtureDay(date) {
  const match = String(date || '').match(/\d{2}\.\d{2}\.\d{4}/)
  return match ? match[0] : 'ohne Datum'
}

function resultOptions(maxMatches) {
  const total = Number(maxMatches) || 9
  return Array.from({ length: total + 1 }, (_, index) => `${total - index}:${index}`)
}

function sortTeams(teams, direct = {}) {
  return [...teams].filter(team => !team.withdrawn).sort((a, b) => {
    if (b.leaguePointsWon !== a.leaguePointsWon) return b.leaguePointsWon - a.leaguePointsWon

    const keyAB = `${a.name}__${b.name}`
    const keyBA = `${b.name}__${a.name}`
    if (direct[keyAB] === 'a') return -1
    if (direct[keyAB] === 'b') return 1
    if (direct[keyBA] === 'a') return 1
    if (direct[keyBA] === 'b') return -1

    const matchDiffA = a.matchesWon - a.matchesLost
    const matchDiffB = b.matchesWon - b.matchesLost
    if (matchDiffB !== matchDiffA) return matchDiffB - matchDiffA
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon

    const setDiffA = a.setsWon - a.setsLost
    const setDiffB = b.setsWon - b.setsLost
    if (setDiffB !== setDiffA) return setDiffB - setDiffA
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon

    const gameDiffA = a.gamesWon - a.gamesLost
    const gameDiffB = b.gamesWon - b.gamesLost
    if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA
    return b.gamesWon - a.gamesWon
  })
}

function initialStrength(team) {
  const played = Math.max(1, team.played || 0)
  return (
    (team.leaguePointsWon / played) * 10 +
    ((team.matchesWon - team.matchesLost) / played) * 3 +
    ((team.setsWon - team.setsLost) / played) * 0.35 +
    ((team.gamesWon - team.gamesLost) / played) * 0.035
  )
}

function expectedResult(fixture, teams, maxMatches) {
  const home = teams.find(t => t.name === fixture.home)
  const away = teams.find(t => t.name === fixture.away)
  const total = Number(maxMatches) || 9
  if (!home || !away) return ''
  const diff = initialStrength(home) - initialStrength(away)
  let homeMatches = Math.round(total / 2 + diff / 9)
  if (total === 9 && homeMatches >= 9 && diff < 28) homeMatches = 8
  if (total === 9 && homeMatches <= 0 && diff > -28) homeMatches = 1
  homeMatches = Math.max(0, Math.min(total, homeMatches))
  return `${homeMatches}:${total - homeMatches}`
}

function applySingleFixture(teams, fixture, resultText) {
  const home = teams.find(t => t.name === fixture.home)
  const away = teams.find(t => t.name === fixture.away)
  const p = pair(resultText)
  if (!home || !away || !p) return
  const [hm, am] = p
  home.played += 1
  away.played += 1
  home.matchesWon += hm
  home.matchesLost += am
  away.matchesWon += am
  away.matchesLost += hm
  if (hm > am) {
    home.wins += 1
    away.losses += 1
    home.leaguePointsWon += 2
    away.leaguePointsLost += 2
  } else if (am > hm) {
    away.wins += 1
    home.losses += 1
    away.leaguePointsWon += 2
    home.leaguePointsLost += 2
  } else {
    home.draws += 1
    away.draws += 1
    home.leaguePointsWon += 1
    home.leaguePointsLost += 1
    away.leaguePointsWon += 1
    away.leaguePointsLost += 1
  }
}

function applySimulation(baseTeams, fixtures, selectedDay, direct) {
  const teams = baseTeams.map(team => ({ ...team }))
  const selected = fixtures.filter(f => f.status === 'open' && (selectedDay === 'alle' || fixtureDay(f.date) === selectedDay) && pair(f.result))
  selected.forEach(fixture => applySingleFixture(teams, fixture, fixture.result))
  return { teams: sortTeams(teams, direct), count: selected.length }
}

function randomNearPrediction(prediction, maxMatches) {
  const total = Number(maxMatches) || 9
  const p = pair(prediction)
  if (!p) return prediction
  const baseHome = p[0]
  const margin = Math.abs(baseHome - total / 2)
  const pool = margin >= 2.5 ? [0, 0, 0, 1, -1] : margin >= 1.5 ? [0, 0, 1, -1] : [0, 0, 1, -1, 1, -1]
  const shift = pool[Math.floor(Math.random() * pool.length)]
  const home = Math.max(0, Math.min(total, baseHome + shift))
  return `${home}:${total - home}`
}

function simulateSeason(baseTeams, fixtures, maxMatches, iterations = 1000) {
  const activeTeams = baseTeams.filter(t => !t.withdrawn)
  const resultMap = {}
  activeTeams.forEach(team => {
    resultMap[team.name] = {
      name: team.name,
      baseStrength: initialStrength(team),
      pointsSum: 0,
      matchDiffSum: 0,
      matchesWonSum: 0,
      rankSum: 0,
      first: 0,
      last: 0
    }
  })
  for (let run = 0; run < iterations; run++) {
    const teams = activeTeams.map(t => ({ ...t }))
    fixtures.filter(f => f.status === 'open').forEach(fixture => {
      const prediction = expectedResult(fixture, teams, maxMatches)
      const randomResult = randomNearPrediction(prediction, maxMatches)
      applySingleFixture(teams, fixture, randomResult)
    })
    const sorted = sortTeams(teams, {})
    sorted.forEach((team, index) => {
      const entry = resultMap[team.name]
      const rank = index + 1
      entry.pointsSum += team.leaguePointsWon
      entry.matchDiffSum += team.matchesWon - team.matchesLost
      entry.matchesWonSum += team.matchesWon
      entry.rankSum += rank
      if (rank === 1) entry.first += 1
      if (rank === sorted.length) entry.last += 1
    })
  }
  return Object.values(resultMap)
    .map(entry => ({
      ...entry,
      avgPoints: entry.pointsSum / iterations,
      avgMatchDiff: entry.matchDiffSum / iterations,
      avgMatchesWon: entry.matchesWonSum / iterations,
      avgRank: entry.rankSum / iterations,
      firstPct: Math.round(entry.first / iterations * 100),
      lastPct: Math.round(entry.last / iterations * 100)
    }))
    .sort((a, b) => {
      if (Math.abs(b.avgPoints - a.avgPoints) > 0.01) return b.avgPoints - a.avgPoints
      if (Math.abs(b.avgMatchDiff - a.avgMatchDiff) > 0.01) return b.avgMatchDiff - a.avgMatchDiff
      if (Math.abs(b.avgMatchesWon - a.avgMatchesWon) > 0.01) return b.avgMatchesWon - a.avgMatchesWon
      return b.baseStrength - a.baseStrength
    })
}

function exportText(teams) {
  const lines = ['🎾 tennis-sim', '', 'Aktuelle Tabelle', '']
  teams.forEach((team, index) => {
    lines.push(`${index + 1}. ${team.name}`)
    lines.push(`   Punkte ${team.leaguePointsWon}:${team.leaguePointsLost} · Matches ${team.matchesWon}:${team.matchesLost}`)
  })
  return lines.join('\n')
}

export default function App() {
  const [sourceText, setSourceText] = useState('')
  const [teams, setTeams] = useState([])
  const [fixtures, setFixtures] = useState([])
  const [simulatedTeams, setSimulatedTeams] = useState([])
  const [seasonResults, setSeasonResults] = useState([])
  const [maxMatches, setMaxMatches] = useState(9)
  const [selectedDay, setSelectedDay] = useState('alle')
  const [status, setStatus] = useState('Text einfügen und auswerten.')
  const [exportBox, setExportBox] = useState('')
  const [direct, setDirect] = useState({})
  const exportRef = useRef(null)

  const activeTeams = simulatedTeams.length ? simulatedTeams : sortTeams(teams, direct)

  const days = useMemo(() => {
    const values = [...new Set(fixtures.filter(f => f.status === 'open').map(f => fixtureDay(f.date)))]
    return values.length ? values : ['alle']
  }, [fixtures])

  const visibleFixtures = fixtures.filter(f => f.status === 'open' && (selectedDay === 'alle' || fixtureDay(f.date) === selectedDay))
  const options = resultOptions(maxMatches)

  function parseText(text) {
    const parsed = parseLeagueText(text)
    const openCount = parsed.fixtures.filter(f => f.status === 'open').length
    const firstOpen = parsed.fixtures.find(f => f.status === 'open')
    setTeams(parsed.teams)
    setFixtures(parsed.fixtures)
    setSimulatedTeams([])
    setSeasonResults([])
    setMaxMatches(parsed.maxMatches)
    setSelectedDay(firstOpen ? fixtureDay(firstOpen.date) : 'alle')
    setStatus(`Erkannt: ${parsed.teams.length} Teams, ${parsed.fixtures.length} Spiele, ${openCount} offen.`)
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

  function simulateSelected() {
    const result = applySimulation(teams, fixtures, selectedDay, direct)
    setSimulatedTeams(result.teams)
    setSeasonResults([])
    setStatus(result.count ? `${result.count} Begegnung(en) berechnet.` : 'Kein gültiges Ergebnis ausgewählt.')
  }

  function simulateFullSeason() {
    const result = simulateSeason(teams, fixtures, maxMatches, 1000)
    setSeasonResults(result)
    setStatus('Rest-Saison 1000-mal simuliert.')
  }

  async function copyExport() {
    const text = exportText(activeTeams)
    setExportBox(text)
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {}
    }
    if (navigator.clipboard) await navigator.clipboard.writeText(text)
    setStatus('Export kopiert.')
  }

  async function exportImage() {
    if (!exportRef.current) return
    const canvas = await html2canvas(exportRef.current, { backgroundColor: '#ffffff', scale: 2 })
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = 'tennis-sim.png'
    link.click()
    setStatus('Bild exportiert.')
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">tennis-sim · Version 5.1.1</p>
        <h1>Tabellenrechner</h1>
        <p>Text aus der Ligaseite kopieren, einfügen und Spieltage simulieren.</p>
      </section>

      <section className="panel help">
        <h2>So kopierst du die Daten</h2>
        <p>Auf der Ligaseite den Bereich von <b>„Tabelle“ bis zum Ende des „Spielplan“</b> markieren, kopieren und unten einfügen.</p>
      </section>

      <section className="panel">
        <div className="head">
          <h2>1. Daten</h2>
          <button className="small dark" onClick={loadExample}>Beispiel</button>
        </div>
        <textarea className="source" value={sourceText} onChange={e => setSourceText(e.target.value)} placeholder="Hier Tabellen- und Spielplantext einfügen..." />
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
          <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
            {days.map(day => <option key={day} value={day}>{day}</option>)}
            <option value="alle">alle offenen Spiele</option>
          </select>
        </div>
        {!visibleFixtures.length && <p className="empty">Keine offenen Spiele erkannt.</p>}
        <div className="fixtureList">
          {visibleFixtures.map(fixture => {
            const prediction = expectedResult(fixture, teams, maxMatches)
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
                  <input inputMode="text" placeholder="Matches" value={fixture.result} onChange={e => updateFixture(fixture, 'result', e.target.value)} />
                  <input inputMode="text" placeholder="Sätze optional" value={fixture.sets} onChange={e => updateFixture(fixture, 'sets', e.target.value)} />
                  <input inputMode="text" placeholder="Games optional" value={fixture.games} onChange={e => updateFixture(fixture, 'games', e.target.value)} />
                </div>
              </article>
            )
          })}
        </div>
        <div className="actionRow">
          <button onClick={simulateSelected}>Berechnen</button>
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
          <button className="dark" onClick={copyExport}>WhatsApp Export</button>
        </div>
        {!!exportBox && <textarea className="exportBox" readOnly value={exportBox} />}
        <div ref={exportRef} className="exportImageCard">
          {!activeTeams.length && <p className="empty">Noch keine Tabelle erkannt.</p>}
          <div className="teamList">
            {activeTeams.map((team, index) => (
              <article className={`team ${team.promotion ? 'promotion' : ''} ${team.relegation ? 'relegation' : ''}`} key={team.name}>
                <div className="rank">{index + 1}</div>
                <div className="teamBody">
                  <h3>{team.name}</h3>
                  <div className="stats">
                    <span>Punkte <b>{team.leaguePointsWon}:{team.leaguePointsLost}</b></span>
                    <span>Matches <b>{team.matchesWon}:{team.matchesLost}</b></span>
                    <span>Sätze <b>{team.setsWon}:{team.setsLost}</b></span>
                    <span>Games <b>{team.gamesWon}:{team.gamesLost}</b></span>
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
        <p className="status">Version 5.1.1: Sortierung nach Ø Tabellenpunkten, Ø Matchdifferenz und Ø gewonnenen Matches.</p>
        <div className="actionRow">
          <button onClick={simulateFullSeason}>Rest-Saison simulieren</button>
          <button className="dark" onClick={() => setSeasonResults([])}>Löschen</button>
        </div>
        <div className="seasonList">
          {seasonResults.map((entry, index) => (
            <article className="seasonCard" key={entry.name}>
              <div className="rank">{index + 1}</div>
              <div className="teamBody">
                <h3>{entry.name}</h3>
                <div className="stats">
                  <span>Ø Punkte <b>{entry.avgPoints.toFixed(1)}</b></span>
                  <span>Ø Matchdiff. <b>{entry.avgMatchDiff.toFixed(1)}</b></span>
                  <span>Ø Platz <b>{entry.avgRank.toFixed(1)}</b></span>
                  <span>Platz 1 <b>{entry.firstPct}%</b></span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
