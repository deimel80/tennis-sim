import { useMemo, useState } from 'react'
import Tesseract from 'tesseract.js'

const demoTeams = [
  { name: 'Lüdenscheider TV 1899 1', played: 2, wins: 2, draws: 0, losses: 0, leaguePointsWon: 2, leaguePointsLost: 0, matchesWon: 13, matchesLost: 5, setsWon: 29, setsLost: 12, gamesWon: 186, gamesLost: 100 },
  { name: 'TC RW Siedlinghausen 1', played: 2, wins: 2, draws: 0, losses: 0, leaguePointsWon: 2, leaguePointsLost: 0, matchesWon: 10, matchesLost: 8, setsWon: 23, setsLost: 21, gamesWon: 167, gamesLost: 158 },
  { name: 'Siegener SC 07/09 1', played: 2, wins: 1, draws: 0, losses: 1, leaguePointsWon: 1, leaguePointsLost: 1, matchesWon: 10, matchesLost: 8, setsWon: 24, setsLost: 19, gamesWon: 175, gamesLost: 137 },
  { name: 'TV Eiserfeld 74 1', played: 2, wins: 1, draws: 0, losses: 1, leaguePointsWon: 1, leaguePointsLost: 1, matchesWon: 9, matchesLost: 9, setsWon: 21, setsLost: 20, gamesWon: 162, gamesLost: 152 },
  { name: 'SuS Stemel 1', played: 1, wins: 0, draws: 0, losses: 1, leaguePointsWon: 0, leaguePointsLost: 1, matchesWon: 3, matchesLost: 6, setsWon: 7, setsLost: 13, gamesWon: 60, gamesLost: 92 },
  { name: 'TuS Ferndorf 1', played: 1, wins: 0, draws: 0, losses: 1, leaguePointsWon: 0, leaguePointsLost: 1, matchesWon: 3, matchesLost: 6, setsWon: 7, setsLost: 14, gamesWon: 56, gamesLost: 94 },
  { name: 'TC Wiesental Herscheid 1', played: 2, wins: 0, draws: 0, losses: 2, leaguePointsWon: 0, leaguePointsLost: 2, matchesWon: 6, matchesLost: 12, setsWon: 14, setsLost: 26, gamesWon: 106, gamesLost: 179 }
]

const demoFixtures = [
  { date: '30.05.2026 11:00', home: 'TC RW Siedlinghausen 1', away: 'SuS Stemel 1', result: '', sets: '', games: '' },
  { date: '30.05.2026 13:00', home: 'Lüdenscheider TV 1899 1', away: 'TV Eiserfeld 74 1', result: '', sets: '', games: '' },
  { date: '30.05.2026 13:00', home: 'TuS Ferndorf 1', away: 'Siegener SC 07/09 1', result: '', sets: '', games: '' }
]

const emptyFixture = { date: '', home: '', away: '', result: '', sets: '', games: '' }
const quickResults = ['9:0', '8:1', '7:2', '6:3', '5:4', '4:5', '3:6', '2:7', '1:8', '0:9']

function cleanLine(line) {
  return line.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim()
}

function pair(text) {
  const m = String(text || '').replace(/\s/g, '').replace('-', ':').replace('/', ':').replace(';', ':').match(/^(\d+):(\d+)$/)
  return m ? [Number(m[1]), Number(m[2])] : null
}

function ratio(a, b) {
  return `${a}:${b}`
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
  const lines = text.split('\n').map(cleanLine).filter(Boolean)
  const teams = []

  for (const line of lines) {
    const pairs = [...line.matchAll(/(\d+)\s*[:;]\s*(\d+)/g)].map(m => [Number(m[1]), Number(m[2])])
    if (pairs.length < 4) continue

    const prefix = line.match(/^\D*(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+/)
    if (!prefix) continue

    const name = prefix[2].trim()
    if (/rang|mannschaft|begegnungen|spielplan|datum|heim|gast/i.test(name)) continue

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

function parseFixtures(text, teams) {
  const lines = text.split('\n').map(cleanLine).filter(Boolean)
  const names = teams.map(t => t.name)
  const fixtures = []

  for (const line of lines) {
    if (!/offen|ursprünglich|urspr/i.test(line)) continue

    const found = names.filter(name => line.toLowerCase().includes(name.toLowerCase()))
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

    setStatus('OCR läuft. Einen Moment warten.')
    setFixtures([])
    setTeams([])
    setBaseTeams([])

    const result = await Tesseract.recognize(file, 'deu', {
      logger: msg => {
        if (msg.status === 'recognizing text') setStatus(`OCR läuft: ${Math.round((msg.progress || 0) * 100)} %`)
      }
    })

    const text = result.data.text
    const parsedTeams = parseTable(text)
    const parsedFixtures = parsedTeams.length ? parseFixtures(text, parsedTeams) : []

    setOcrText(text)

    if (!parsedTeams.length) {
      setBaseTeams([])
      setTeams([])
      setFixtures([])
      setSelectedDay('alle')
      setStatus('Tabelle nicht erkannt. Bitte Screenshot größer/gerader hochladen oder Demo prüfen.')
      return
    }

    setBaseTeams(parsedTeams)
    setTeams(parsedTeams)
    setFixtures(parsedFixtures)
    setSelectedDay(parsedFixtures.length ? dayKey(parsedFixtures[0].date) : 'alle')

    if (!parsedFixtures.length) {
      setStatus(`Erkannt: ${parsedTeams.length} Teams. Spielplan wurde nicht erkannt — bitte Spiele unten manuell hinzufügen.`)
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
    const next = [...fixtures, { ...emptyFixture }]
    setFixtures(next)
    setSelectedDay('alle')
  }

  function updateFixture(index, field, value) {
    const target = visibleFixtures[index]
    setFixtures(current => current.map(f => f === target ? { ...f, [field]: value } : f))
  }

  function deleteFixture(index) {
    const target = visibleFixtures[index]
    setFixtures(current => current.filter(f => f !== target))
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
        home.leaguePointsWon += 1
        away.leaguePointsLost += 1
      } else if (am > hm) {
        away.wins += 1
        home.losses += 1
        away.leaguePointsWon += 1
        home.leaguePointsLost += 1
      } else {
        home.draws += 1
        away.draws += 1
      }
    })

    setTeams(sortTeams(updated, direct))
    setStatus(selected.length ? `${selected.length} Begegnungen berechnet.` : 'Kein gültiges Ergebnis vorhanden.')
  }

  function resetSimulation() {
    setTeams(baseTeams)
    setStatus('Simulation zurückgesetzt.')
  }

  return (
    <main className="app">
      <section className="top">
        <p className="label">WTV / nuLiga</p>
        <h1>Tabellenrechner</h1>
        <p className="sub">Screenshot mit Tabelle + Spielplan hochladen. Kein Demo-Fallback mehr bei echtem Upload.</p>
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
            <p>Füge die offenen Spiele manuell hinzu. Die Teams aus der erkannten Tabelle stehen in der Auswahl.</p>
          </div>
        )}

        <div className="fixtureList">
          {visibleFixtures.map((fixture, index) => (
            <article className="fixtureCard" key={`${fixture.home}-${fixture.away}-${index}`}>
              <input className="dateInput" placeholder="Datum optional" value={fixture.date} onChange={e => updateFixture(index, 'date', e.target.value)} />
              <div className="selectGrid">
                <select value={fixture.home} onChange={e => updateFixture(index, 'home', e.target.value)}>
                  <option value="">Heimteam</option>
                  {baseTeams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                <select value={fixture.away} onChange={e => updateFixture(index, 'away', e.target.value)}>
                  <option value="">Gastteam</option>
                  {baseTeams.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>

              <div className="quickGrid">
                {quickResults.map(result => (
                  <button key={result} type="button" className={fixture.result === result ? 'quick active' : 'quick'} onClick={() => updateFixture(index, 'result', result)}>
                    {result}
                  </button>
                ))}
              </div>

              <div className="resultGrid">
                <input inputMode="text" placeholder="Matches z. B. 6:3" value={fixture.result} onChange={e => updateFixture(index, 'result', e.target.value)} />
                <input inputMode="text" placeholder="Sätze optional" value={fixture.sets} onChange={e => updateFixture(index, 'sets', e.target.value)} />
                <input inputMode="text" placeholder="Games optional" value={fixture.games} onChange={e => updateFixture(index, 'games', e.target.value)} />
              </div>
              <button className="deleteBtn" onClick={() => deleteFixture(index)}>Spiel entfernen</button>
            </article>
          ))}
        </div>

        <div className="actionGrid">
          <button className="ghost" onClick={addFixture}>+ Spiel hinzufügen</button>
          <button className="ghost" onClick={resetSimulation}>Zurücksetzen</button>
          <button className="primary" onClick={simulate}>Berechnen</button>
        </div>
      </section>

      <section className="panel">
        <div className="head"><h2>Tabelle</h2><span>{sortedTeams.length} Teams</span></div>
        {sortedTeams.length === 0 && <p className="status">Noch keine Tabelle erkannt.</p>}
        <div className="teamCards">
          {sortedTeams.map((team, index) => (
            <article className="teamCard" key={team.name}>
              <div className="rank">{index + 1}</div>
              <div className="teamMain">
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
