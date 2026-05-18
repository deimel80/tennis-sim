
import { useState } from 'react'
import Tesseract from 'tesseract.js'

function App() {
  const [ocrText, setOcrText] = useState('')
  const [loading, setLoading] = useState(false)
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([
    { home: '', away: '', result: '6:3' }
  ])

  async function handleImage(e) {
    const file = e.target.files[0]
    if (!file) return

    setLoading(true)

    const result = await Tesseract.recognize(file, 'deu')

    setOcrText(result.data.text)

    const parsed = parseTable(result.data.text)

    setTeams(parsed)

    setLoading(false)
  }

  function parseTable(text) {
    const lines = text
      .split('\n')
      .map(x => x.trim())
      .filter(x => x.length > 5)

    const parsedTeams = []

    for (const line of lines) {
      const regex = /^(\d+)\s+([A-Za-z0-9\s\-\./äöüÄÖÜ]+)\s+(\d+)\s+(\d+:\d+)/
      const match = line.match(regex)

      if (match) {
        const teamName = match[2].trim()
        const points = match[4]

        const [won, lost] = points.split(':').map(Number)

        parsedTeams.push({
          name: teamName,
          pointsWon: won,
          pointsLost: lost,
          tablePoints: won * 2,
          diff: won - lost
        })
      }
    }

    if (parsedTeams.length === 0) {
      return [
        {
          name: 'TC Siedlinghausen',
          pointsWon: 30,
          pointsLost: 15,
          tablePoints: 8,
          diff: 15
        },
        {
          name: 'Siegener SC',
          pointsWon: 27,
          pointsLost: 18,
          tablePoints: 6,
          diff: 9
        }
      ]
    }

    return parsedTeams
  }

  function addMatch() {
    setMatches([
      ...matches,
      { home: '', away: '', result: '6:3' }
    ])
  }

  function updateMatch(index, key, value) {
    const clone = [...matches]
    clone[index][key] = value
    setMatches(clone)
  }

  function simulate() {
    const updated = [...teams]

    matches.forEach(match => {
      const home = updated.find(t => t.name === match.home)
      const away = updated.find(t => t.name === match.away)

      if (!home || !away) return

      const [h, a] = match.result.split(':').map(Number)

      home.pointsWon += h
      home.pointsLost += a
      home.diff = home.pointsWon - home.pointsLost

      away.pointsWon += a
      away.pointsLost += h
      away.diff = away.pointsWon - away.pointsLost

      if (h > a) {
        home.tablePoints += 2
      } else {
        away.tablePoints += 2
      }
    })

    updated.sort((a, b) => {
      if (b.tablePoints !== a.tablePoints) {
        return b.tablePoints - a.tablePoints
      }

      if (b.diff !== a.diff) {
        return b.diff - a.diff
      }

      return b.pointsWon - a.pointsWon
    })

    updated.forEach((t, i) => {
      t.rank = i + 1
    })

    setTeams(updated)
  }

  return (
    <div className="container">
      <div className="title">🎾 Tennis Tabellen Simulator</div>
      <div className="subtitle">
        Screenshot hochladen → OCR erkennt Tabelle → nächsten Spieltag simulieren
      </div>

      <div className="card">
        <div className="upload-box">
          <input type="file" accept="image/*" onChange={handleImage} />

          {loading && (
            <p>OCR läuft... Screenshot wird analysiert.</p>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>OCR Rohtext</h2>

          <textarea
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
          />
        </div>

        <div className="card">
          <h2>Nächster Spieltag</h2>

          {matches.map((match, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '10px',
                flexWrap: 'wrap'
              }}
            >
              <select
                value={match.home}
                onChange={(e) => updateMatch(index, 'home', e.target.value)}
              >
                <option value="">Heim</option>

                {teams.map(team => (
                  <option key={team.name}>{team.name}</option>
                ))}
              </select>

              <select
                value={match.away}
                onChange={(e) => updateMatch(index, 'away', e.target.value)}
              >
                <option value="">Gast</option>

                {teams.map(team => (
                  <option key={team.name}>{team.name}</option>
                ))}
              </select>

              <input
                value={match.result}
                onChange={(e) => updateMatch(index, 'result', e.target.value)}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={addMatch}>
              + Weiteres Spiel
            </button>

            <button onClick={simulate}>
              Tabelle simulieren
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Berechnete Tabelle</h2>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Mannschaft</th>
              <th>Tabellenpunkte</th>
              <th>Matchpunkte</th>
              <th>Differenz</th>
            </tr>
          </thead>

          <tbody>
            {teams.map((team, index) => (
              <tr key={team.name}>
                <td>{index + 1}</td>
                <td>{team.name}</td>
                <td>{team.tablePoints}</td>
                <td>{team.pointsWon}:{team.pointsLost}</td>
                <td className={team.diff >= 0 ? 'green' : 'red'}>
                  {team.diff >= 0 ? '+' : ''}{team.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Geplante Erweiterungen</h2>

        <ul>
          <li>Direkter Vergleich bei Punktgleichheit</li>
          <li>Automatische nuLiga/WTV-Erkennung</li>
          <li>Satz- und Spielwertung</li>
          <li>Best/Worst-Case-Rechner</li>
          <li>Live-Tabelle während des Spieltags</li>
          <li>Import direkt per Tabellen-Link</li>
        </ul>
      </div>
    </div>
  )
}

export default App
