import { useMemo, useState } from 'react'
import Tesseract from 'tesseract.js'

const demoTeams = [
  { name: 'TC Lese GW Köln 1', played: 3, wins: 3, draws: 0, losses: 0, leaguePointsWon: 6, leaguePointsLost: 0, matchesWon: 20, matchesLost: 7, setsWon: 46, setsLost: 15, gamesWon: 310, gamesLost: 189 },
  { name: 'ETB SW Essen 1', played: 3, wins: 3, draws: 0, losses: 0, leaguePointsWon: 6, leaguePointsLost: 0, matchesWon: 18, matchesLost: 9, setsWon: 38, setsLost: 23, gamesWon: 265, gamesLost: 206 },
  { name: 'TC GW Aachen 1', played: 3, wins: 2, draws: 0, losses: 1, leaguePointsWon: 4, leaguePointsLost: 2, matchesWon: 18, matchesLost: 9, setsWon: 36, setsLost: 19, gamesWon: 279, gamesLost: 193 },
  { name: 'Kölner THC Stadion RW 1', played: 2, wins: 1, draws: 0, losses: 1, leaguePointsWon: 2, leaguePointsLost: 2, matchesWon: 8, matchesLost: 10, setsWon: 17, setsLost: 23, gamesWon: 166, gamesLost: 201 },
  { name: 'Marienburger SC 1', played: 2, wins: 0, draws: 0, losses: 2, leaguePointsWon: 0, leaguePointsLost: 4, matchesWon: 5, matchesLost: 13, setsWon: 11, setsLost: 27, gamesWon: 117, gamesLost: 191 },
  { name: 'TC Bovert 1', played: 2, wins: 0, draws: 0, losses: 2, leaguePointsWon: 0, leaguePointsLost: 4, matchesWon: 2, matchesLost: 16, setsWon: 8, setsLost: 33, gamesWon: 108, gamesLost: 202 },
  { name: 'Sauerländer TK Arnsberg 1907 1', played: 3, wins: 0, draws: 0, losses: 3, leaguePointsWon: 0, leaguePointsLost: 6, matchesWon: 10, matchesLost: 17, setsWon: 21, setsLost: 37, gamesWon: 197, gamesLost: 260 }
]

const demoFixtures = [
  { date: '30.05.2026 13:00', home: 'TC Lese GW Köln 1', away: 'TC GW Aachen 1', result: '', sets: '', games: '' },
  { date: '30.05.2026 13:00', home: 'Marienburger SC 1', away: 'TC Bovert 1', result: '', sets: '', games: '' },
  { date: '30.05.2026 13:00', home: 'Kölner THC Stadion RW 1', away: 'Sauerländer TK Arnsberg 1907 1', result: '', sets: '', games: '' }
]

const quickResults = ['9:0', '8:1', '7:2', '6:3', '5:4', '4:5', '3:6', '2:7', '1:8', '0:9']

function normalize(s) {
  return String(s || '')
    .replace(/[|]/g, ' ')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeName(s) {
  return normalize(s)
    .replace(/_/g, ' ')
    .replace(/\bT C\b/gi, 'TC')
    .replace(/\bG W\b/gi, 'GW')
    .replace(/\bS W\b/gi, 'SW')
    .replace(/\bR W\b/gi, 'RW')
    .replace(/\bT H C\b/gi, 'THC')
    .replace(/\s+/g, ' ')
    .trim()
}

function pair(text) {
  const m = String(text || '').replace(/\s/g, '').replace('-', ':').replace('/', ':').replace(';', ':').match(/^(\d+):(\d+)$/)
  return m ? [Number(m[1]), Number(m[2])] : null
}

function ratio(a, b) {
  return `${a}:${b}`
}

async function preprocessImage(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(3, Math.max(2, 2600 / bitmap.width))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    let gray = 0.299 * r + 0.587 * g + 0.114 * b

    gray = (gray - 128) * 1.85 + 128
    gray = Math.max(0, Math.min(255, gray))

    if (gray > 188) gray = 255
    if (gray < 115) gray = 0

    data[i] = gray
    data[i + 1] = gray
    data[i + 2] = gray
  }

  ctx.putImageData(image, 0, 0)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

function sortTeams(list, direct) {
  return [...list].sort((a, b) => {
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

function parseTable(text) {
  const rawLines = text.split('\n').map(normalize).filter(Boolean)
  const tableLines = []
  let inTable = false

  for (const line of rawLines) {
    if (/tabelle/i.test(line)) {
      inTable = true
      continue
    }

    if (/spielplan/i.test(line)) {
      inTable = false
    }

    if (inTable) tableLines.push(line)
  }

  const lines = tableLines.length ? tableLines : rawLines
  const teams = []

  for (const line of lines) {
    const pairs = [...line.matchAll(/(\d+)\s*[:;]\s*(\d+)/g)].map(m => [Number(m[1]), Number(m[2])])
    if (pairs.length < 4) continue

    const beforePairs = line.split(/\d+\s*[:;]\s*\d+/)[0]
    const prefix = beforePairs.match(/^\D*(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/)

    if (!prefix) {
      const loose = beforePairs.match(/^\D*(\d+)\s+(.+?)\s+(\d)\s+(\d)\s+(\d)\s+(\d)\s*$/)
      if (!loose) continue
      const name = normalizeName(loose[2])
      if (/rang|mannschaft|begegnungen|spielplan|datum|punkte/i.test(name)) continue
      teams.push({
        name,
        played: Number(loose[3]),
        wins: Number(loose[4]),
        draws: Number(loose[5]),
        losses: Number(loose[6]),
        leaguePointsWon: pairs[0][0],
        leaguePointsLost: pairs[0][1],
        matchesWon: pairs[1][0],
        matchesLost: pairs[1][1],
        setsWon: pairs[2][0],
        setsLost: pairs[2][1],
        gamesWon: pairs[3][0],
        gamesLost: pairs[3][1]
      })
      continue
    }

    const name = normalizeName(prefix[2])
    if (/rang|mannschaft|begegnungen|spielplan|datum|punkte/i.test(name)) continue

    teams.push({
      name,
      played: Number(prefix[3]),
      wins: Number(prefix[4]),
      draws: Number(prefix[5]),
      losses: Number(prefix[6]),
      leaguePointsWon: pairs[0][0],
      leaguePointsLost: pairs[0][1],
      matchesWon: pairs[1][0],
      matchesLost: pairs[1][1],
      setsWon: pairs[2][0],
      setsLost: pairs[2][1],
      gamesWon: pairs[3][0],
      gamesLost: pairs[3][1]
    })
  }

  return teams
}

function findTeamsInLine(line, teams) {
  const normalizedLine = normalizeName(line).toLowerCase()
  const hits = []

  for (const team of teams) {
    const full = team.name.toLowerCase()
    const withoutNumber = full.replace(/\s+\d+$/, '')
    const tokens = withoutNumber.split(/\s+/).filter(t => t.length >= 3)
    const tokenHits = tokens.filter(t => normalizedLine.includes(t)).length

    if (normalizedLine.includes(full) || normalizedLine.includes(withoutNumber) || tokenHits >= Math.min(2, tokens.length)) {
      hits.push(team.name)
    }
  }

  return [...new Set(hits)]
}

function parseFixtures(text, teams) {
  const rawLines = text.split('\n').map(normalize).filter(Boolean)
  const lines = []
  let inPlan = false

  for (const line of rawLines) {
    if (/spielplan/i.test(line)) {
      inPlan = true
      continue
    }

    if (inPlan) lines.push(line)
  }

  const source = lines.length ? lines : rawLines
  const fixtures = []

  for (const line of source) {
    if (!/offen|ursprünglich|urspr/i.test(line)) continue

    const found = findTeamsInLine(line, teams)
    if (found.length >= 2) {
      const dateMatch = line.match(/(\d{2}\.\d{2}\.\d{4}(?:\s+\d{1,2}:\d{2})?)/)
      fixtures.push({
        date: dateMatch ? dateMatch[1] : '',
        home: found[0],
        away: found[1],
        result: '',
        sets: '',
        games: ''
      })
    }
  }

  return fixtures
}

function dayKey(date) {
  const m = String(date || '').match(/\d{2}\.\d{2}\.\d{4}/)
  return m ? m[0] : 'ohne Datum'
}

export default function App() {
  const [baseTeams, setBaseTeams] = useState(demoTeams)
  const [teams, setTeams] = useState(demoTeams)
  const [fixtures, setFixtures] = useState(demoFixtures)
  const [selectedDay, setSelectedDay] = useState('30.05.2026')
  const [status, setStatus] = useState('Screenshot mit Tabelle und Spielplan hochladen.')
  const [ocrText, setOcrText] = useState('')
  const [direct, setDirect] = useState({})

  const sortedTeams = useMemo(() => sortTeams(teams, direct), [teams, direct])
  const days = useMemo(() => [...new Set(fixtures.map(f => dayKey(f.date)))], [fixtures])
  const visibleFixtures = fixtures.filter(f => selectedDay === 'alle' || dayKey(f.date) === selectedDay)

  const tieGroups = useMemo(() => {
    const groups = {}
    sortedTeams.forEach(t => {
      groups[t.leaguePointsWon] ||= []
      groups[t.leaguePointsWon].push(t)
    })
    return Object.values(groups).filter(g => g.length > 1)
  }, [sortedTeams])

  async function handleImage(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setStatus('Bild wird für OCR optimiert.')
    setFixtures([])
    setTeams([])
    setBaseTeams([])

    const processed = await preprocessImage(file)

    setStatus('OCR läuft. Das kann auf dem iPhone 20–90 Sekunden dauern.')

    const result = await Tesseract.recognize(processed, 'deu', {
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
      logger: msg => {
        if (msg.status === 'recognizing text') {
          setStatus(`OCR läuft: ${Math.round((msg.progress || 0) * 100)} %`)
        }
      }
    })

    const text = result.data.text
    const parsedTeams = parseTable(text)
    const parsedFixtures = parsedTeams.length ? parseFixtures(text, parsedTeams) : []

    setOcrText(text)

    if (!parsedTeams.length) {
      setStatus('Tabelle nicht erkannt. Bitte Screenshot näher ran, gerade und ohne Browserleisten hochladen.')
      return
    }

    setBaseTeams(parsedTeams)
    setTeams(parsedTeams)
    setFixtures(parsedFixtures)
    setSelectedDay(parsedFixtures.length ? dayKey(parsedFixtures[0].date) : 'alle')

    if (!parsedFixtures.length) {
      setStatus(`Erkannt: ${parsedTeams.length} Teams. Spielplan nicht sicher erkannt — Spiele unten manuell hinzufügen.`)
    } else {
      setStatus(`Erkannt: ${parsedTeams.length} Teams, ${parsedFixtures.length} offene Spiele.`)
    }
  }

  function loadDemo() {
    setBaseTeams(demoTeams)
    setTeams(demoTeams)
    setFixtures(demoFixtures)
    setSelectedDay('30.05.2026')
    setDirect({})
    setStatus('Demo-Daten geladen.')
  }

  function addFixture() {
    setFixtures([...fixtures, { date: '', home: '', away: '', result: '', sets: '', games: '' }])
    setSelectedDay('alle')
  }

  function updateFixture(target, field, value) {
    setFixtures(current => current.map(f => f === target ? { ...f, [field]: value } : f))
  }

  function deleteFixture(target) {
    setFixtures(current => current.filter(f => f !== target))
  }

  function updateTeam(index, field, value) {
    const update = list => list.map((t, i) => i === index ? { ...t, [field]: value } : t)
    setBaseTeams(update)
    setTeams(update)
  }

  function simulate() {
    const updated = baseTeams.map(t => ({ ...t }))
    const selected = fixtures.filter(f => (selectedDay === 'alle' || dayKey(f.date) === selectedDay) && pair(f.result))

    selected.forEach(f => {
      const home = updated.find(t => t.name === f.home)
      const away = updated.find(t => t.name === f.away)
      const matchPair = pair(f.result)
      if (!home || !away || !matchPair) return

      const [hm, am] = matchPair
      const setPair = pair(f.sets)
      const gamePair = pair(f.games)

      home.played += 1
      away.played += 1

      home.matchesWon += hm
      home.matchesLost += am
      away.matchesWon += am
      away.matchesLost += hm

      if (setPair) {
        const [hs, as] = setPair
        home.setsWon += hs
        home.setsLost += as
        away.setsWon += as
        away.setsLost += hs
      }

      if (gamePair) {
        const [hg, ag] = gamePair
        home.gamesWon += hg
        home.gamesLost += ag
        away.gamesWon += ag
        away.gamesLost += hg
      }

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
      }
    })

    setTeams(sortTeams(updated, direct))
    setStatus(selected.length ? `${selected.length} Begegnungen berechnet.` : 'Kein gültiges Ergebnis vorhanden.')
  }

  return (
    <main className="app">
      <section className="top">
        <p className="label">WTV / nuLiga</p>
        <h1>Tabellenrechner</h1>
        <p className="sub">OCR mit Bildoptimierung. Für gelbe nuLiga-Screenshots besser geeignet.</p>
      </section>

      <section className="panel uploadPanel">
        <label className="uploadButton">Screenshot hochladen<input type="file" accept="image/*" onChange={handleImage} /></label>
        <button className="ghost" onClick={loadDemo}>Demo laden</button>
        <p className="status">{status}</p>
      </section>

      <section className="panel">
        <div className="head">
          <h2>Spieltag simulieren</h2>
          <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
            <option value="alle">alle Spiele</option>
          </select>
        </div>

        {visibleFixtures.length === 0 && (
          <div className="empty">
            <b>Kein Spielplan erkannt.</b>
            <p>Füge die offenen Spiele manuell hinzu. Die Teams aus der Tabelle stehen in der Auswahl.</p>
          </div>
        )}

        <div className="fixtureList">
          {visibleFixtures.map((fixture, index) => (
            <article className="fixtureCard" key={`${fixture.home}-${fixture.away}-${index}`}>
              <input className="dateInput" placeholder="Datum optional" value={fixture.date} onChange={e => updateFixture(fixture, 'date', e.target.value)} />
              <div className="selectGrid">
                <select value={fixture.home} onChange={e => updateFixture(fixture, 'home', e.target.value)}>
                  <option value="">Heimteam</option>
                  {baseTeams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                <select value={fixture.away} onChange={e => updateFixture(fixture, 'away', e.target.value)}>
                  <option value="">Gastteam</option>
                  {baseTeams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>

              <div className="quickGrid">
                {quickResults.map(result => (
                  <button key={result} type="button" className={fixture.result === result ? 'quick active' : 'quick'} onClick={() => updateFixture(fixture, 'result', result)}>
                    {result}
                  </button>
                ))}
              </div>

              <div className="resultGrid">
                <input inputMode="text" placeholder="Matches z. B. 6:3" value={fixture.result} onChange={e => updateFixture(fixture, 'result', e.target.value)} />
                <input inputMode="text" placeholder="Sätze optional" value={fixture.sets} onChange={e => updateFixture(fixture, 'sets', e.target.value)} />
                <input inputMode="text" placeholder="Spiele optional" value={fixture.games} onChange={e => updateFixture(fixture, 'games', e.target.value)} />
              </div>
              <button className="deleteBtn" onClick={() => deleteFixture(fixture)}>Spiel entfernen</button>
            </article>
          ))}
        </div>

        <div className="actionGrid">
          <button className="ghost" onClick={addFixture}>+ Spiel hinzufügen</button>
          <button className="ghost" onClick={() => setTeams(baseTeams)}>Zurücksetzen</button>
          <button className="primary" onClick={simulate}>Berechnen</button>
        </div>
      </section>

      <section className="panel">
        <div className="head"><h2>Tabelle</h2><span>{sortedTeams.length} Teams</span></div>
        {sortedTeams.length === 0 && <p className="status">Noch keine Tabelle erkannt.</p>}
        <div className="teamCards">
          {sortedTeams.map((team, index) => (
            <article className="teamCard" key={`${team.name}-${index}`}>
              <div className="rank">{index + 1}</div>
              <div className="teamMain">
                <input className="teamNameInput" value={team.name} onChange={e => updateTeam(index, 'name', e.target.value)} />
                <div className="stats">
                  <span>Punkte <b>{ratio(team.leaguePointsWon, team.leaguePointsLost)}</b></span>
                  <span>Matches <b>{ratio(team.matchesWon, team.matchesLost)}</b></span>
                  <span>Sätze <b>{ratio(team.setsWon, team.setsLost)}</b></span>
                  <span>Spiele <b>{ratio(team.gamesWon, team.gamesLost)}</b></span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {tieGroups.length > 0 && (
        <section className="panel">
          <div className="head"><h2>Direkter Vergleich</h2><span>bei Punktgleichheit</span></div>
          {tieGroups.map(group => (
            <div className="directGroup" key={group.map(t => t.name).join('')}>
              {group.flatMap((a, i) => group.slice(i + 1).map(b => {
                const key = `${a.name}__${b.name}`
                return (
                  <div className="directRow" key={key}>
                    <p>{a.name}<br /><small>gegen</small><br />{b.name}</p>
                    <select value={direct[key] || ''} onChange={e => setDirect({ ...direct, [key]: e.target.value })}>
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

      <details className="panel">
        <summary>OCR-Rohtext / Fehleranalyse</summary>
        <textarea value={ocrText} onChange={e => setOcrText(e.target.value)} />
      </details>
    </main>
  )
}
