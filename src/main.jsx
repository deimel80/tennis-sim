import React, {useMemo, useState} from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

const EXAMPLE = `Tabelle
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
 	 	 	Schwelmer TC RW 1	TC Halver 1960 1	 	 	 	offen 
So.	14.06.2026 10:00	 	TuS Neuenrade 1	TC Lössel-Roden 2	 	 	 	offen`;

function clean(v){return String(v||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function cells(line){return line.includes('\t')?line.split('\t').map(clean):line.replace(/\s{2,}/g,'\t').split('\t').map(clean)}
function pair(v){const m=String(v||'').replace(/\s/g,'').replace(/[;/-]/g,':').match(/^(\d+):(\d+)$/);return m?[+m[1],+m[2]]:null}
function ratio(a,b){return `${a}:${b}`}
function day(date){const m=String(date||'').match(/\d{2}\.\d{2}\.\d{4}/);return m?m[0]:'ohne Datum'}
function normName(n){return clean(n).replace(/^Aufsteiger\s+/i,'').replace(/^Absteiger\s+/i,'').replace(/^Zurückgezogen\s+/i,'')}
function withdrawn(line){return /zurückgezogen|zurueckgezogen|nicht gewertet|außer konkurrenz|a\.k\./i.test(line)}

function parseTableRow(line){
 const cs=cells(line).filter((c,i)=>c!==''), joined=clean(line);
 if(/rang|mannschaft|begegnungen|punkte|matches|sätze|saetze|games/i.test(joined)) return null;
 const ratios=cs.filter(pair); if(ratios.length<4) return null;
 const rix=cs.findIndex(c=>/^\d+$/.test(c)); if(rix<0) return null;
 const league=pair(cs[rix+6]), matches=pair(cs[rix+7]), sets=pair(cs[rix+8]), games=pair(cs[rix+9]);
 if(!league||!matches||!sets||!games) return null;
 return {rank:+cs[rix],name:normName(cs[rix+1]),played:+cs[rix+2],wins:+cs[rix+3],draws:+cs[rix+4],losses:+cs[rix+5],leaguePointsWon:league[0],leaguePointsLost:league[1],matchesWon:matches[0],matchesLost:matches[1],setsWon:sets[0],setsLost:sets[1],gamesWon:games[0],gamesLost:games[1],promotion:/^Aufsteiger/i.test(joined),relegation:/^Absteiger/i.test(joined),withdrawn:withdrawn(joined)}
}
function startsWithTeam(text, names){const t=clean(text).toLowerCase();return [...names].sort((a,b)=>b.length-a.length).find(n=>t.startsWith(n.toLowerCase()))||''}
function parseFixture(line, teams, lastDate){
 const joined=clean(line); if(/datum|heimmannschaft|gastmannschaft|spielbericht/i.test(joined)) return null;
 const names=teams.map(t=>t.name); const dm=joined.match(/(?:Mo\.|Di\.|Mi\.|Do\.|Fr\.|Sa\.|So\.)?\s*\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/i);
 const date=dm?clean(dm[0]):lastDate; const area=dm?joined.slice(dm.index+dm[0].length).trim():joined;
 const home=startsWithTeam(area,names); if(!home)return null; const rest=area.slice(home.length).trim(); const away=startsWithTeam(rest,names); if(!away)return null;
 const tail=rest.slice(away.length).trim(); const rs=[...tail.matchAll(/(\d+)\s*[:;]\s*(\d+)/g)].map(m=>`${m[1]}:${m[2]}`);
 const status=/anzeigen/i.test(tail)?'played':'open';
 return {date,home,away,result:status==='played'?(rs[0]||''):'',sets:status==='played'?(rs[1]||''):'',games:status==='played'?(rs[2]||''):'',status,note:/ursprünglich|urspr/i.test(tail)?tail:''}
}
function parseNuLiga(text){
 const lines=String(text||'').replace(/\r/g,'').split('\n'); const ti=lines.findIndex(l=>/Tabelle/i.test(l)); const pi=lines.findIndex(l=>/Spielplan/i.test(l));
 const tableLines=lines.slice(ti>=0?ti+1:0,pi>=0?pi:lines.length); const teams=tableLines.map(parseTableRow).filter(Boolean);
 const fixtures=[]; let lastDate=''; const planLines=pi>=0?lines.slice(pi+1):[];
 for(const line of planLines){const dm=clean(line).match(/(?:Mo\.|Di\.|Mi\.|Do\.|Fr\.|Sa\.|So\.)?\s*\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}/i); if(dm)lastDate=clean(dm[0]); const f=parseFixture(line,teams,lastDate); if(f){fixtures.push(f); if(f.date)lastDate=f.date}}
 const vals=[]; teams.forEach(t=>{if(t.played>0) vals.push(Math.round((t.matchesWon+t.matchesLost)/t.played))}); fixtures.forEach(f=>{const p=pair(f.result); if(p) vals.push(p[0]+p[1])});
 const max=vals.sort((a,b)=>vals.filter(v=>v===b).length-vals.filter(v=>v===a).length)[0]||9;
 return {teams,fixtures,maxMatches:max,warnings:[!teams.length?'Keine Tabelle erkannt.':'',!fixtures.length?'Kein Spielplan erkannt.':''].filter(Boolean)}
}
function resultOptions(max){return Array.from({length:max+1},(_,i)=>`${max-i}:${i}`)}
function sortTeams(teams,direct={}){return [...teams].filter(t=>!t.withdrawn).sort((a,b)=>{if(b.leaguePointsWon!==a.leaguePointsWon)return b.leaguePointsWon-a.leaguePointsWon; const ab=`${a.name}__${b.name}`,ba=`${b.name}__${a.name}`; if(direct[ab]==='a')return-1;if(direct[ab]==='b')return 1;if(direct[ba]==='a')return 1;if(direct[ba]==='b')return-1; const mdA=a.matchesWon-a.matchesLost,mdB=b.matchesWon-b.matchesLost;if(mdB!==mdA)return mdB-mdA;if(b.matchesWon!==a.matchesWon)return b.matchesWon-a.matchesWon; const sdA=a.setsWon-a.setsLost,sdB=b.setsWon-b.setsLost;if(sdB!==sdA)return sdB-sdA;if(b.setsWon!==a.setsWon)return b.setsWon-a.setsWon; const gdA=a.gamesWon-a.gamesLost,gdB=b.gamesWon-b.gamesLost;if(gdB!==gdA)return gdB-gdA;return b.gamesWon-a.gamesWon})}
function applySim(base, fixtures, selectedDay, direct){const teams=base.map(t=>({...t}));const apps=fixtures.filter(f=>f.status==='open'&&(selectedDay==='alle'||day(f.date)===selectedDay)&&pair(f.result));for(const f of apps){const h=teams.find(t=>t.name===f.home),a=teams.find(t=>t.name===f.away),mp=pair(f.result);if(!h||!a||!mp||h.withdrawn||a.withdrawn)continue;const [hm,am]=mp,sp=pair(f.sets),gp=pair(f.games);h.played++;a.played++;h.matchesWon+=hm;h.matchesLost+=am;a.matchesWon+=am;a.matchesLost+=hm;if(sp){h.setsWon+=sp[0];h.setsLost+=sp[1];a.setsWon+=sp[1];a.setsLost+=sp[0]}if(gp){h.gamesWon+=gp[0];h.gamesLost+=gp[1];a.gamesWon+=gp[1];a.gamesLost+=gp[0]}if(hm>am){h.wins++;a.losses++;h.leaguePointsWon+=2;a.leaguePointsLost+=2}else if(am>hm){a.wins++;h.losses++;a.leaguePointsWon+=2;h.leaguePointsLost+=2}else{h.draws++;a.draws++;h.leaguePointsWon++;h.leaguePointsLost++;a.leaguePointsWon++;a.leaguePointsLost++}}return {teams:sortTeams(teams,direct),count:apps.length}}

function App(){
 const [source,setSource]=useState(''),[teams,setTeams]=useState([]),[fixtures,setFixtures]=useState([]),[simTeams,setSimTeams]=useState([]),[max,setMax]=useState(9),[selected,setSelected]=useState('alle'),[status,setStatus]=useState('Text aus nuLiga kopieren und hier einfügen.'),[warnings,setWarnings]=useState([]),[direct,setDirect]=useState({});
 const active=simTeams.length?simTeams:sortTeams(teams,direct); const days=useMemo(()=>[...new Set(fixtures.filter(f=>f.status==='open').map(f=>day(f.date)))],[fixtures]); const sel=(selected==='alle'||days.includes(selected))?selected:(days[0]||'alle'); const visible=fixtures.filter(f=>f.status==='open'&&(sel==='alle'||day(f.date)===sel)); const opts=resultOptions(max);
 const tieGroups=useMemo(()=>{const g={};active.forEach(t=>{(g[t.leaguePointsWon]??=[]).push(t)});return Object.values(g).filter(x=>x.length>1)},[active]);
 function parseText(txt){const p=parseNuLiga(txt);setTeams(p.teams);setFixtures(p.fixtures);setSimTeams([]);setMax(p.maxMatches);setWarnings(p.warnings);const open=p.fixtures.filter(f=>f.status==='open');setSelected(open[0]?day(open[0].date):'alle');setStatus(`Erkannt: ${p.teams.length} Teams, ${p.fixtures.length} Spiele, davon ${open.length} offen.`);setDirect({})}
 function upd(target,field,value){setFixtures(fs=>fs.map(f=>f===target?{...f,[field]:value}:f));setSimTeams([])}
 function simulate(){const r=applySim(teams,fixtures,sel,direct);setSimTeams(r.teams);setStatus(r.count?`${r.count} Begegnung(en) berechnet.`:'Kein gültiges offenes Ergebnis ausgewählt.')}
 return <main className="app"><section className="hero"><p className="eyebrow">WTV / nuLiga</p><h1>Tabellenrechner</h1><p>Text aus der nuLiga-Seite einfügen. Kein OCR, keine Screenshots.</p></section>
 <section className="panel"><div className="head"><h2>1. Daten einfügen</h2><button className="small dark" onClick={()=>{setSource(EXAMPLE);parseText(EXAMPLE)}}>Beispiel laden</button></div><textarea className="source" placeholder="Hier den kopierten Text einfügen..." value={source} onChange={e=>setSource(e.target.value)}/><div className="actionRow"><button onClick={()=>parseText(source)}>Text auswerten</button><button className="dark" onClick={()=>{setSource('');setTeams([]);setFixtures([]);setSimTeams([]);setStatus('Gelöscht.')}}>Alles löschen</button></div><p className="status">{status}</p>{warnings.length>0&&<div className="warnings">{warnings.map(w=><p key={w}>{w}</p>)}</div>}</section>
 <section className="panel"><div className="head"><h2>2. Spieltag simulieren</h2><select value={sel} onChange={e=>{setSelected(e.target.value);setSimTeams([])}}>{days.map(d=><option key={d} value={d}>{d}</option>)}<option value="alle">alle offenen Spiele</option></select></div>{!visible.length&&<p className="empty">Keine offenen Spiele für diese Auswahl erkannt.</p>}<div className="fixtureList">{visible.map(f=><article className="fixture" key={f.date+f.home+f.away}><div className="fixtureDate">{f.date||'ohne Datum'}</div><div className="teams"><strong>{f.home}</strong><span>gegen</span><strong>{f.away}</strong></div>{f.note&&<p className="note">{f.note}</p>}<div className="quickGrid">{opts.map(o=><button key={o} className={f.result===o?'quick active':'quick'} onClick={()=>upd(f,'result',o)}>{o}</button>)}</div><div className="inputGrid"><input inputMode="text" placeholder="Matches" value={f.result} onChange={e=>upd(f,'result',e.target.value)}/><input inputMode="text" placeholder="Sätze optional" value={f.sets} onChange={e=>upd(f,'sets',e.target.value)}/><input inputMode="text" placeholder="Games optional" value={f.games} onChange={e=>upd(f,'games',e.target.value)}/></div></article>)}</div><div className="actionRow stickyActions"><button onClick={simulate}>Berechnen</button><button className="dark" onClick={()=>setSimTeams([])}>Zurücksetzen</button></div></section>
 <section className="panel"><div className="head"><h2>3. Tabelle</h2><span>{active.length} Teams · {max} Matches</span></div>{!active.length&&<p className="empty">Noch keine Tabelle erkannt.</p>}<div className="teamList">{active.map((t,i)=><article className={`team ${t.promotion?'promotion':''} ${t.relegation?'relegation':''}`} key={t.name}><div className="rank">{i+1}</div><div className="teamBody"><h3>{t.name}</h3><div className="stats"><span>Punkte <b>{ratio(t.leaguePointsWon,t.leaguePointsLost)}</b></span><span>Matches <b>{ratio(t.matchesWon,t.matchesLost)}</b></span><span>Sätze <b>{ratio(t.setsWon,t.setsLost)}</b></span><span>Games <b>{ratio(t.gamesWon,t.gamesLost)}</b></span></div></div></article>)}</div></section>
 {tieGroups.length>0&&<section className="panel"><div className="head"><h2>Direkter Vergleich</h2><span>bei Punktgleichheit</span></div>{tieGroups.map(g=><div className="directGroup" key={g.map(t=>t.name).join('|')}>{g.flatMap((a,i)=>g.slice(i+1).map(b=>{const key=`${a.name}__${b.name}`;return <div className="directRow" key={key}><p><b>{a.name}</b><br/>gegen<br/><b>{b.name}</b></p><select value={direct[key]||''} onChange={e=>setDirect(d=>({...d,[key]:e.target.value}))}><option value="">nicht festlegen</option><option value="a">{a.name} vorne</option><option value="b">{b.name} vorne</option></select></div>}))}</div>)}</section>}
 <section className="panel hint"><h2>Hinweis iPhone</h2><p>nuLiga-Seite öffnen, Tabellenbereich kopieren und hier einfügen. Falls Safari nicht sauber kopiert, die Seite einmal im Reader/Querformat versuchen.</p></section></main>
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
