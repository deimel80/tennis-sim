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

function clean(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function pair(value) {
  const match = String(value || '').trim().replace(/\s/g, '').replace(/[;/-]/g, ':').match(/^(\d+):(\d+)$/)
  return match ? [Number(match[1]), Number(match[2])] : null
}

function ratio(a, b) {
  return `${a}:${b}`
}

function splitLine(line) {
  if (line.includes('\t')) return line.split('\t').map(clean)
  return line.replace(/\s{2,}/g, '\t').split('\t').map(clean)
}

function parseTableRow(line) {
  const cells = splitLine(line).filter(Boolean)
  const joined = clean(line)
  if (/rang|mannschaft|begegnungen|punkte|matches|sätze|saetze|games/i.test(joined)) return null
  if (cells.filter(cell => pair(cell)).length < 4) return null

  const rankIndex = cells.findIndex(cell => /^\d+$/.test(cell))
  if (rankIndex < 0) return null

  const leaguePoints = pair(cells[rankIndex + 6])
  const matches = pair(cells[rankIndex + 7])
  const sets = pair(cells[rankIndex + 8])
  const games = pair(cells[rankIndex + 9])
  const name = clean(cells[rankIndex + 1]).replace(/^Aufsteiger\s+/i, '').replace(/^Absteiger\s+/i, '')
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
  const hit = sorted.find(team => normalized.startsWith(team.name.toLowerCase()))
  return hit ? hit.name : ''
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

    const mdA = a.matchesWon - a.matchesLost
    const mdB = b.matchesWon - b.matchesLost
    if (mdB !== mdA) return mdB - mdA
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon

    const sdA = a.setsWon - a.setsLost
    const sdB = b.setsWon - b.setsLost
    if (sdB !== sdA) return sdB - sdA
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon

    const gdA = a.gamesWon - a.gamesLost
    const gdB = b.gamesWon - b.gamesLost
    if (gdB !== gdA) return gdB - gdA
    return b.gamesWon - a.gamesWon
  })
}

function applySingleFixture(teams, fixture, resultText) {
  const home = teams.find(team => team.name === fixture.home)
  const away = teams.find(team => team.name === fixture.away)
  const result = pair(resultText)
  if (!home || !away || !result) return
  const [hm, am] = result
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
  const selected = fixtures.filter(fixture => fixture.status === 'open' && (selectedDay === 'alle' || fixtureDay(fixture.date) === selectedDay) && pair(fixture.result))
  selected.forEach(fixture => {
    applySingleFixture(teams, fixture, fixture.result)
    const home = teams.find(team => team.name === fixture.home)
    const away = teams.find(team => team.name === fixture.away)
    const setPair = pair(fixture.sets)
    const gamePair = pair(fixture.games)
    if (home && away && setPair) {
      home.setsWon += setPair[0]
      home.setsLost += setPair[1]
      away.setsWon += setPair[1]
      away.setsLost += setPair[0]
    }
    if (home && away && gamePair) {
      home.gamesWon += gamePair[0]
      home.gamesLost += gamePair[1]
      away.gamesWon += gamePair[1]
      away.gamesLost += gamePair[0]
    }
  })
  return { teams: sortTeams(teams, direct), count: selected.length }
}

function teamAverage(team, maxMatches) {
  const played = Math.max(1, team.played || 0)
  return {
    matchRatio: (team.matchesWon - team.matchesLost) / played / Math.max(1, maxMatches),
    setRatio: (team.setsWon - team.setsLost) / played / Math.max(1, maxMatches * 2),
    gameRatio: (team.gamesWon - team.gamesLost) / played / Math.max(1, maxMatches * 10),
    pointsPerMatch: team.leaguePointsWon / played
  }
}

function commonOpponentScore(homeName, awayName, fixtures, maxMatches) {
  const homeGames = fixtures.filter(f => f.status === 'played' && (f.home === homeName || f.away === homeName))
  const awayGames = fixtures.filter(f => f.status === 'played' && (f.home === awayName || f.away === awayName))
  const scores = []
  for (const homeFixture of homeGames) {
    const common = homeFixture.home === homeName ? homeFixture.away : homeFixture.home
    for (const awayFixture of awayGames.filter(f => f.home === common || f.away === common)) {
      const hp = pair(homeFixture.result)
      const ap = pair(awayFixture.result)
      if (!hp || !ap) continue
      const hOwn = homeFixture.home === homeName ? hp[0] : hp[1]
      const hOpp = homeFixture.home === homeName ? hp[1] : hp[0]
      const aOwn = awayFixture.home === awayName ? ap[0] : ap[1]
      const aOpp = awayFixture.home === awayName ? ap[1] : ap[0]
      scores.push(((hOwn - hOpp) - (aOwn - aOpp)) / maxMatches)
    }
  }
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
}

function directHistory(homeName, awayName, fixtures, maxMatches) {
  const played = fixtures.filter(f => f.status === 'played' && ((f.home === homeName && f.away === awayName) || (f.home === awayName && f.away === homeName)))
  if (!played.length) return null
  const latest = played[played.length - 1]
  const p = pair(latest.result)
  if (!p) return null
  const homeWasHome = latest.home === homeName
  const homeMatches = homeWasHome ? p[0] : p[1]
  return (homeMatches - maxMatches / 2) / maxMatches
}

function predictFixture(fixture, teams, fixtures, maxMatches) {
  const home = teams.find(team => team.name === fixture.home)
  const away = teams.find(team => team.name === fixture.away)
  const total = Number(maxMatches) || 9
  if (!home || !away) return { result: '', confidence: '' }

  const h = teamAverage(home, total)
  const a = teamAverage(away, total)
  let advantage =
    (h.pointsPerMatch - a.pointsPerMatch) * 0.18 +
    (h.matchRatio - a.matchRatio) * 0.42 +
    (h.setRatio - a.setRatio) * 0.22 +
    (h.gameRatio - a.gameRatio) * 0.10 +
    commonOpponentScore(home.name, away.name, fixtures, total) * 0.22 +
    0.035
  const direct = directHistory(home.name, away.name, fixtures, total)
  if (direct !== null) advantage += direct * 0.25
  advantage *= Math.min(1, 0.45 + Math.max(1, home.played + away.played) * 0.12)

  let homePoints = Math.round(total / 2 + advantage * total)
  const cap = total === 9 ? 3.35 : total * 0.36
  homePoints = Math.max(Math.ceil(total / 2 - cap), Math.min(Math.floor(total / 2 + cap), homePoints))
  if (total === 9 && homePoints >= 9 && advantage < 0.47) homePoints = 8
  if (total === 9 && homePoints <= 0 && advantage > -0.47) homePoints = 1
  homePoints = Math.max(0, Math.min(total, homePoints))

  let confidence = 'vorsichtig'
  if (Math.abs(advantage) > 0.26) confidence = 'klar'
  if (Math.abs(advantage) > 0.40) confidence = 'sehr klar'
  return { result: `${homePoints}:${total - homePoints}`, confidence }
}

function randomResultAroundPrediction(prediction, maxMatches) {
  const total = Number(maxMatches) || 9
  const p = pair(prediction)
  if (!p) return prediction
  const margin = Math.abs(p[0] - total / 2)
  let pool
  if (margin >= 2.5) pool = [0, 0, 0, 0, 0, 0, 1, -1]
  else if (margin >= 1.5) pool = [0, 0, 0, 0, 1, -1]
  else pool = [0, 0, 0, 1, -1, 1, -1]
  const shift = pool[Math.floor(Math.random() * pool.length)]
  const home = Math.max(0, Math.min(total, p[0] + shift))
  return `${home}:${total - home}`
}

function seasonStrength(team, maxMatches) {
  const played = Math.max(1, team.played || 0)
  return (team.leaguePointsWon / played) * 12 + ((team.matchesWon - team.matchesLost) / played) * 2.8 + ((team.setsWon - team.setsLost) / played) * 0.45 + ((team.gamesWon - team.gamesLost) / played) * 0.045
}

function mostLikelyRank(entry) {
  const best = Object.entries(entry.rankCounts || {}).sort((a, b) => b[1] - a[1])[0]
  return best ? Number(best[0]) : 0
}

function compareSeasonProjection(a, b, maxMatches) {
  const strengthDiff = (b.baseStrength || 0) - (a.baseStrength || 0)
  if (Math.abs(strengthDiff) > 0.01) return strengthDiff
  return a.avgRank - b.avgRank
}


function simulateRemainingSeason(baseTeams, fixtures, maxMatches, iterations = 1000) {
  const activeTeams = baseTeams.filter(team => !team.withdrawn)
  const resultMap = {}
  activeTeams.forEach(team => {
    resultMap[team.name] = { name: team.name, baseStrength: seasonStrength(team, maxMatches), first: 0, last: 0, rankSum: 0, rankCounts: {} }
  })
  for (let i = 0; i < iterations; i++) {
    const simulated = activeTeams.map(team => ({ ...team }))
    const playedFixtures = fixtures.filter(f => f.status === 'played')
    const openFixtures = fixtures.filter(f => f.status === 'open')
    for (const fixture of openFixtures) {
      const prediction = predictFixture(fixture, simulated, playedFixtures, maxMatches).result
      const randomResult = randomResultAroundPrediction(prediction, maxMatches)
      applySingleFixture(simulated, fixture, randomResult)
      playedFixtures.push({ ...fixture, status: 'played', result: randomResult })
    }
    sortTeams(simulated).forEach((team, index) => {
      const rank = index + 1
      const entry = resultMap[team.name]
      if (!entry) return
      if (rank === 1) entry.first += 1
      if (rank === simulated.length) entry.last += 1
      entry.rankSum += rank
      entry.rankCounts[rank] = (entry.rankCounts[rank] || 0) + 1
    })
  }
  return Object.values(resultMap).map(entry => ({ ...entry, firstPct: Math.round(entry.first / iterations * 100), lastPct: Math.round(entry.last / iterations * 100), avgRank: entry.rankSum / iterations })).sort((a, b) => {
    const modalA = mostLikelyRank(a) || 999
    const modalB = mostLikelyRank(b) || 999
    if (modalA !== modalB) return modalA - modalB
    if (Math.abs(a.avgRank - b.avgRank) > 0.05) return a.avgRank - b.avgRank
    return b.baseStrength - a.baseStrength
  })
}

function formatPercent(value) {
  return `${Math.round(value)}%`
}

function exportTableText(activeTeams, statusText) {
  const lines = ['🎾 tennis-sim', '', statusText || '', '']
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
  const [seasonResults, setSeasonResults] = useState([])
  const [maxMatches, setMaxMatches] = useState(9)
  const [selectedDay, setSelectedDay] = useState('alle')
  const [status, setStatus] = useState('Text einfügen und auswerten.')
  const [direct, setDirect] = useState({})
  const [exportText, setExportText] = useState('')
  const exportRef = useRef(null)

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
    setTeams(parsed.teams)
    setFixtures(parsed.fixtures)
    setSimulatedTeams([])
    setSeasonResults([])
    setExportText('')
    setMaxMatches(parsed.maxMatches)
    setSelectedDay(openFixtures[0] ? fixtureDay(openFixtures[0].date) : 'alle')
    setDirect({})
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

  function simulate() {
    const result = applySimulation(teams, fixtures, selectedDay, direct)
    setSimulatedTeams(result.teams)
    setStatus(result.count ? `${result.count} Begegnung(en) berechnet.` : 'Kein gültiges Ergebnis ausgewählt.')
  }

  function runSeasonSimulation() {
    const results = simulateRemainingSeason(teams, fixtures, maxMatches, 1000)
    setSeasonResults(results)
    setStatus(results.length ? 'Rest-Saison 1000-mal simuliert.' : 'Keine Saison-Simulation möglich.')
  }

  async function exportImage() {
    if (!exportRef.current) return
    const canvas = await html2canvas(exportRef.current, { backgroundColor: '#ffffff', scale: 2 })
    const link = document.createElement('a')
    link.download = 'tennis-sim.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
    setStatus('Bild exportiert.')
  }

  async function shareTable() {
    const text = exportTableText(activeTeams, simulatedTeams.length ? 'Simulierte Tabelle' : 'Aktuelle Tabelle')
    setExportText(text)
    setStatus(await copyOrShareText(text))
  }

  return (
    <main className="app">
      <section className="hero">
        <p className="eyebrow">Tennis · Tabellen-Simulation</p>
        <h1>tennis-sim</h1>
        <p>Text aus der Ligaseite kopieren, einfügen und kommende Spieltage simulieren.</p>
      </section>

      <section className="panel help">
        <h2>So kopierst du die Daten</h2>
        <p>Auf der Ligaseite den Bereich von <b>„Tabelle“ bis zum Ende des „Spielplan“</b> markieren. Danach kopieren und unten einfügen.</p>
      </section>

      <section className="panel">
        <div className="head">
          <h2>1. Daten einfügen</h2>
          <button className="small dark" onClick={loadExample}>Beispiel</button>
        </div>
        <textarea className="source" placeholder="Hier den kopierten Tabellen- und Spielplantext einfügen..." value={sourceText} onChange={event => setSourceText(event.target.value)} />
        <div className="actionRow">
          <button onClick={() => parseText(sourceText)}>Text auswerten</button>
          <button className="dark" onClick={() => { setSourceText(''); setTeams([]); setFixtures([]); setSimulatedTeams([]); setSeasonResults([]); setExportText(''); setStatus('Gelöscht.') }}>Löschen</button>
        </div>
        <p className="status">{status}</p>
      </section>

      <section className="panel">
        <div className="head">
          <h2>2. Spieltag</h2>
          <select value={selectedDay} onChange={event => { setSelectedDay(event.target.value); setSimulatedTeams([]); setSeasonResults([]) }}>
            {days.map(day => <option key={day} value={day}>{day}</option>)}
            <option value="alle">alle offenen Spiele</option>
          </select>
        </div>
        {!visibleFixtures.length && <p className="empty">Keine offenen Spiele erkannt.</p>}
        <div className="fixtureList">
          {visibleFixtures.map(fixture => {
            const prediction = predictFixture(fixture, teams, fixtures, maxMatches)
            return (
              <article className="fixture" key={`${fixture.date}-${fixture.home}-${fixture.away}`}>
                <div className="fixtureDate">{fixture.date || 'ohne Datum'}</div>
                <div className="teams"><strong>{fixture.home}</strong><span>gegen</span><strong>{fixture.away}</strong></div>
                {!!fixture.note && <p className="note">{fixture.note}</p>}
                {!!prediction.result && <button className="prediction" onClick={() => updateFixture(fixture, 'result', prediction.result)}>Schätzung übernehmen: {prediction.result} · {prediction.confidence}</button>}
                <div className="quickGrid">
                  {options.map(option => <button key={option} className={fixture.result === option ? 'quick active' : 'quick'} onClick={() => updateFixture(fixture, 'result', option)}>{option}</button>)}
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
        <div className="head"><h2>3. Tabelle</h2><span>{activeTeams.length} Teams · {maxMatches} Matches</span></div>
        <div className="actionRow"><button onClick={exportImage}>PNG exportieren</button><button className="dark" onClick={shareTable}>WhatsApp Export</button></div>
        {!!exportText && <textarea className="exportBox" value={exportText} readOnly />}
        <div ref={exportRef} className="exportImageCard">
          {!activeTeams.length && <p className="empty">Noch keine Tabelle erkannt.</p>}
          <div className="teamList">
            {activeTeams.map((team, index) => (
              <article className={`team ${team.promotion ? 'promotion' : ''} ${team.relegation ? 'relegation' : ''}`} key={team.name}>
                <div className="rank">{index + 1}</div>
                <div className="teamBody"><h3>{team.name}</h3><div className="stats"><span>Punkte <b>{ratio(team.leaguePointsWon, team.leaguePointsLost)}</b></span><span>Matches <b>{ratio(team.matchesWon, team.matchesLost)}</b></span><span>Sätze <b>{ratio(team.setsWon, team.setsLost)}</b></span><span>Games <b>{ratio(team.gamesWon, team.gamesLost)}</b></span></div></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="head"><h2>4. Saison-Prognose</h2><span>1000 Simulationen</span></div>
        <p className="status">Simuliert alle offenen Begegnungen. Klare Kräfteverhältnisse streuen nur wenig, enge Spiele stärker. Die Sortierung nutzt die Stärke aus Punkten, Matches, Sätzen und Games als Plausibilitätsbremse.</p>
        <div className="actionRow"><button onClick={runSeasonSimulation}>Rest-Saison simulieren</button><button className="dark" onClick={() => setSeasonResults([])}>Prognose löschen</button></div>
        {!!seasonResults.length && <div className="seasonList">{seasonResults.map((entry, index) => <article className="seasonCard" key={entry.name}><div className="rank">{index + 1}</div><div className="teamBody"><h3>{entry.name}</h3><div className="stats"><span>häufigster Platz <b>{mostLikelyRank(entry)}</b></span><span>Ø Platz <b>{entry.avgRank.toFixed(1)}</b></span><span>Stärke <b>{entry.baseStrength.toFixed(1)}</b></span><span>Letzter <b>{formatPercent(entry.lastPct)}</b></span></div></div></article>)}</div>}
      </section>

      {!!tieGroups.length && <section className="panel"><div className="head"><h2>Direkter Vergleich</h2><span>bei Punktgleichheit</span></div>{tieGroups.map(group => <div className="directGroup" key={group.map(team => team.name).join('|')}>{group.flatMap((a, index) => group.slice(index + 1).map(b => { const key = `${a.name}__${b.name}`; return <div className="directRow" key={key}><p><b>{a.name}</b><br />gegen<br /><b>{b.name}</b></p><select value={direct[key] || ''} onChange={event => setDirect(current => ({ ...current, [key]: event.target.value }))}><option value="">nicht festlegen</option><option value="a">{a.name} vorne</option><option value="b">{b.name} vorne</option></select></div> }))}</div>)}</section>}
    </main>
  )
}