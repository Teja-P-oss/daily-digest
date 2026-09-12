const q = (title) => `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`;
const days = [
  {date:'Sep 12',title:'Land softly',mood:'Short, familiar voices for the first quiet day.',tracks:[
    ['🎙️','Conversation','Lex Fridman + Andrew Huberman','Friendship, focus, learning and the mind. Easy company for resting.',q('Lex Fridman Andrew Huberman podcast full episode')],
    ['😂','Telugu laughter','Brahmanandam comedy marathon','A familiar, family-safe collection from Sri Balaji Comedy.','https://www.youtube.com/watch?v=uLOoh74F0q0'],
    ['📻','Story series','BBC Sherlock Holmes radio drama','Close your eyes and let a classic mystery build the pictures.',q('BBC Sherlock Holmes radio drama full episode')]]},
  {date:'Sep 13',title:'Big questions, easy pace',mood:'Wonder, wisdom and a warm Telugu classic.',tracks:[
    ['🧠','Deep podcast','Lex Fridman + Donald Hoffman','A playful investigation of consciousness and reality.',q('Lex Fridman Donald Hoffman reality consciousness full podcast')],
    ['🎭','Telugu classic','Jandhyala comedy scenes','Witty dialogue and timeless situational comedy for the whole room.',q('Jandhyala best comedy scenes family TeluguOne')],
    ['🌍','Audio series','Fall of Civilizations: Vijayanagara','A calm, cinematic history journey made for listening.',q('Fall of Civilizations Vijayanagara podcast')]]},
  {date:'Sep 14',title:'Meaning & mischief',mood:'Thoughtful in the morning, wonderfully silly later.',tracks:[
    ['🧭','Ideas','Jordan Peterson + Jonathan Pageau','Stories, symbols and how people make meaning.',q('Jordan Peterson Jonathan Pageau full podcast meaning')],
    ['🤣','Telugu laughter','Amrutham classic episodes','Beloved clean comedy with characters the family can enjoy together.',q('Amrutham Telugu serial full episodes official')],
    ['✨','Science story','The Infinite Monkey Cage','Scientists and comedians make one big idea delightfully light.',q('BBC Infinite Monkey Cage best episodes full')]]},
  {date:'Sep 15',title:'The minds behind AI',mood:'A future-facing day balanced with old-school laughter.',tracks:[
    ['🤖','Deep podcast','Lex Fridman + Demis Hassabis','Games, intelligence, science and the road toward capable AI.',q('Lex Fridman Demis Hassabis full podcast')],
    ['🎬','Telugu classic','Missamma comedy & songs','Gentle vintage charm, clever dialogue and memorable music.',q('Missamma Telugu comedy scenes songs official')],
    ['💡','Curiosity','Veritasium: the best science stories','Choose any long episode; the explanations work surprisingly well as audio.',q('Veritasium best long science documentary')]]},
  {date:'Sep 16',title:'Build a better life',mood:'Practical wisdom without turning recovery into homework.',tracks:[
    ['🛠️','Conversation','Naval Ravikant on happiness','Clear ideas about peace, work, wealth and wanting less.',q('Naval Ravikant happiness full podcast')],
    ['😂','Telugu laughter','Nuvvu Naaku Nachav comedy scenes','Venky, Banthi and a house full of eminently quotable comedy.',q('Nuvvu Naaku Nachav comedy scenes official')],
    ['🏛️','Audio series','In Our Time: philosophy','Pick a topic and hear scholars unpack it without visual distractions.',q('BBC In Our Time philosophy full episode')]]},
  {date:'Sep 17',title:'Biology is stranger than fiction',mood:'Living systems, lovable chaos and one continuing mystery.',tracks:[
    ['🧬','Deep podcast','Lex Fridman + Michael Levin','Cells, intelligence, regeneration and surprising forms of life.',q('Lex Fridman Michael Levin full podcast')],
    ['🍿','Telugu laughter','Malliswari comedy scenes','Classic Venkatesh and Brahmanandam chaos; cheerful group listening.',q('Malliswari Telugu movie comedy scenes official')],
    ['🕵️','Story series','Sherlock Holmes: episode two','Continue the radio mystery from day one—or choose another case.',q('Sherlock Holmes radio drama full cast episode 2')]]},
  {date:'Sep 18',title:'Stories that shape us',mood:'Myth, memory and a very Telugu dose of confusion.',tracks:[
    ['📚','Lecture','Jordan Peterson: Maps of Meaning','A selected lecture on stories, belief and human motivation.',q('Jordan Peterson Maps of Meaning lecture best')],
    ['😄','Telugu laughter','Aa Okkati Adakku comedy','Rajendra Prasad, Rao Gopal Rao and peak 1990s comic timing.',q('Aa Okkati Adakku comedy scenes official')],
    ['🌌','Audio wonder','Carl Sagan: Cosmos audio journey','A soothing tour of the universe through a master storyteller.',q('Carl Sagan Cosmos audiobook full')]]},
  {date:'Sep 19',title:'A week of progress',mood:'Celebrate gently: conversation, comfort comedy and music stories.',tracks:[
    ['♟️','Conversation','Lex Fridman + Magnus Carlsen','Chess, intuition, pressure and the pleasure of mastery.',q('Lex Fridman Magnus Carlsen full podcast')],
    ['📺','Telugu comfort','Amrutham: another favorite','Let the family pick a beloved episode and quote along.',q('Amrutham best episodes Telugu full')],
    ['🎼','Music series','Song Exploder','Artists take apart one song and tell the story of how it was made.',q('Song Exploder full episodes playlist')]]},
  {date:'Sep 20',title:'Calm ambition',mood:'Good work, good humor and lessons from a long-lived civilization.',tracks:[
    ['🎯','Ideas','Jordan Peterson on responsibility','A long-form conversation about purpose, resilience and useful work.',q('Jordan Peterson responsibility purpose full lecture')],
    ['😂','Telugu laughter','EVV Satyanarayana comedy mix','Fast, warm ensemble comedy from Telugu cinema favorites.',q('EVV Satyanarayana best comedy scenes family')],
    ['🏺','History series','Fall of Civilizations: the Maya','Slow, vivid storytelling that rewards eyes-closed listening.',q('Fall of Civilizations Maya full podcast')]]},
  {date:'Sep 21',title:'Emotion, explained',mood:'Understand the mind, then laugh without analyzing anything.',tracks:[
    ['🫶','Deep podcast','Lex Fridman + Lisa Feldman Barrett','What emotions are, how brains predict and why feelings differ.',q('Lex Fridman Lisa Feldman Barrett full podcast')],
    ['🎬','Telugu comfort','Manmadhudu comedy scenes','Dry wit, office chaos and Brahmanandam at full power.',q('Manmadhudu comedy scenes official')],
    ['🔬','Curiosity series','The Curious Cases of Rutherford & Fry','Friendly investigations of questions you never knew you had.',q('Rutherford and Fry full podcast episodes')]]},
  {date:'Sep 22',title:'Make and imagine',mood:'Creators, performers and the surprising craft behind great work.',tracks:[
    ['💻','Deep podcast','Lex Fridman + Chris Lattner','Programming languages, building tools and a life spent creating.',q('Lex Fridman Chris Lattner full podcast')],
    ['🤣','Telugu laughter','Venky train comedy','A legendary ensemble sequence that works almost like radio theatre.',q('Venky train comedy full scenes official')],
    ['🎥','Creative series','Team Deakins podcast','Filmmakers explain the invisible choices behind memorable scenes.',q('Team Deakins podcast best full episode')]]},
  {date:'Sep 23',title:'Wonder is good medicine',mood:'Space, cinema and an impossible question or two.',tracks:[
    ['🪐','Deep podcast','Lex Fridman + Avi Loeb','Life beyond Earth, unusual objects and scientific courage.',q('Lex Fridman Avi Loeb full podcast')],
    ['🌙','Telugu classic','Mayabazar scenes & songs','Mythology, wordplay and music that belongs to every generation.',q('Mayabazar Telugu best scenes songs official')],
    ['❓','Ideas series','Closer To Truth: consciousness','Philosophers and scientists wrestle with the mind’s hardest questions.',q('Closer To Truth consciousness full episodes')]]},
  {date:'Sep 24',title:'People worth listening to',mood:'Human stories, gentle comedy and one final radio adventure.',tracks:[
    ['🎤','Conversation','The Diary of a CEO + Mo Gawdat','A candid discussion about happiness, grief and what matters.',q('Diary of a CEO Mo Gawdat happiness full podcast')],
    ['🍿','Telugu comfort','Pelli Choopulu comedy scenes','Warm, modern humor about family, food and finding direction.',q('Pelli Choopulu comedy scenes official')],
    ['🔎','Story series','Sherlock Holmes: final case','Finish recovery with a satisfying full-cast mystery.',q('Sherlock Holmes BBC radio drama best full episode')]]},
  {date:'Sep 25',title:'Back to the light',mood:'A hopeful finale—intelligence, laughter and perspective.',tracks:[
    ['🌱','Deep podcast','Lex Fridman + Manolis Kellis','Biology, evolution, meaning and the information inside life.',q('Lex Fridman Manolis Kellis full podcast')],
    ['😂','Telugu finale','Family picks the comedy champion','Search the best of Brahmanandam and replay the room’s favorite.',q('Brahmanandam best comedy scenes family official')],
    ['🌎','Finale','David Attenborough audio documentary','End with a calm voice, a living planet and a sense of perspective.',q('David Attenborough full nature documentary audio')]]}
];

const state={day:Math.min(days.length-1,Math.max(0,Math.floor((new Date()-new Date('2026-09-12T00:00:00+05:30'))/86400000))),progress:JSON.parse(localStorage.getItem('teja-prk-progress')||'{}')};
const byId=id=>document.getElementById(id);
function save(){localStorage.setItem('teja-prk-progress',JSON.stringify(state.progress))}
function render(){const d=days[state.day];byId('day-select').value=state.day;byId('day-date').textContent=`Day ${state.day+1} · ${d.date}`;byId('day-title').textContent=d.title;byId('day-mood').textContent=d.mood;const played=state.progress[state.day]?.tracks||[];byId('tracks').innerHTML=d.tracks.map((t,i)=>`<article class="track ${played.includes(i)?'played':''}"><div class="track-icon" aria-hidden="true">${t[0]}</div><div><small>${t[1]} · Pick ${i+1}</small><h3>${t[2]}</h3><p>${t[3]}</p></div><a class="play" href="${t[4]}" target="_blank" rel="noopener" data-track="${i}" aria-label="Play ${t[2]} on YouTube">▶ Play on YouTube</a></article>`).join('');byId('progress-number').textContent=`${played.length}/3`;const done=state.progress[state.day]?.done;byId('finish-day').classList.toggle('done',!!done);byId('finish-day').textContent=done?'✓ Day complete':'✓ Mark this day complete';byId('previous-day').disabled=state.day===0;byId('next-day').disabled=state.day===days.length-1;renderCalendar()}
function renderCalendar(){byId('calendar').innerHTML=days.map((d,i)=>`<button class="date-tile ${i===state.day?'active':''} ${state.progress[i]?.done?'done':''}" data-day="${i}"><span>Day ${i+1}</span><strong>${d.date}</strong><small>${state.progress[i]?.done?'✓ Complete':d.title}</small></button>`).join('')}
byId('day-select').innerHTML=days.map((d,i)=>`<option value="${i}">Day ${i+1} · ${d.date}</option>`).join('');
byId('day-select').addEventListener('change',e=>{state.day=Number(e.target.value);render()});byId('previous-day').addEventListener('click',()=>{state.day--;render()});byId('next-day').addEventListener('click',()=>{state.day++;render()});byId('tracks').addEventListener('click',e=>{const a=e.target.closest('[data-track]');if(!a)return;const p=state.progress[state.day]||(state.progress[state.day]={tracks:[]});const i=Number(a.dataset.track);if(!p.tracks.includes(i))p.tracks.push(i);save();setTimeout(render,150)});byId('finish-day').addEventListener('click',()=>{const p=state.progress[state.day]||(state.progress[state.day]={tracks:[]});p.done=!p.done;save();render()});byId('calendar').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;state.day=Number(b.dataset.day);render();byId('day-view').focus()});
byId('speak-button').addEventListener('click',()=>{if(!('speechSynthesis'in window))return;const b=byId('speak-button');if(speechSynthesis.speaking){speechSynthesis.cancel();b.textContent='🔊 Read this day aloud';b.setAttribute('aria-pressed','false');return}const d=days[state.day];const text=`Day ${state.day+1}. ${d.title}. ${d.mood}. Today's picks are. ${d.tracks.map((t,i)=>`Pick ${i+1}: ${t[2]}. ${t[3]}`).join(' ')}`;const u=new SpeechSynthesisUtterance(text);u.rate=.92;u.onend=()=>{b.textContent='🔊 Read this day aloud';b.setAttribute('aria-pressed','false')};speechSynthesis.speak(u);b.textContent='■ Stop reading';b.setAttribute('aria-pressed','true')});
render();
