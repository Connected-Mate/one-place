/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Everything else people shared in each project, beyond its documents: notebooks, overviews, images, videos, other files.
// The images are generated pictures of fictional things, plus real screenshots of this demo.
import type { Artifact, Overview, TranscriptLine } from '../types'
import { dayAt } from './time'

const lines = (...l: [number, string, string][]): TranscriptLine[] => l.map(([at, who, text]) => ({ at, who, text }))
const asFile = (id: string, o: Overview, ownerId: string, updatedAt: number, sizeMb: number): Artifact => ({
  id, kind: 'video', overview: o.type, title: o.title, ownerId, updatedAt, durationSec: o.durationSec, sizeMb,
  poster: o.poster?.replace(/^\//, ''), transcript: o.transcript,
})
const image = (id: string, title: string, ownerId: string, updatedAt: number, name: string, width: number, height: number, sizeKb: number, caption?: string): Artifact => ({
  id, kind: 'image', title, ownerId, updatedAt, src: `files/${name}`, width, height, sizeKb, format: name.endsWith('.png') ? 'PNG' : 'JPG', caption,
})

function aurora(): Artifact[] {
  const audio: Overview = {
    id: 'a-ov-audio', type: 'audio', title: 'Why people hate their alarm clock', durationSec: 442,
    transcript: lines(
      [0, 'Host', 'So we read forty interviews about mornings, and one word kept coming back: violent.'],
      [28, 'Guest', 'Right. People do not resent waking up. They resent how it happens.'],
      [64, 'Host', 'Which is the whole bet behind Aurora: twenty minutes of light before any sound.'],
      [118, 'Guest', 'And the survey backs it up. Most people have already tried a sleep app and dropped it.'],
      [176, 'Host', 'What stood out on price?'],
      [191, 'Guest', 'At 149 euros it sits above entry-level smart lamps and below the wellness objects.'],
      [262, 'Host', 'And the risk the sources keep flagging is the alarm itself.'],
      [288, 'Guest', 'Yes. If the sound alarm is even a minute late, people stop trusting the lamp.'],
      [371, 'Host', 'So the one thing to get right before launch: the alarm fires on time, every time.'],
    ),
  }
  const video: Overview = {
    id: 'a-ov-video', type: 'video', title: 'Aurora in three minutes', durationSec: 186, poster: 'files/aurora-packshot.jpg',
    transcript: lines(
      [0, 'Narrator', 'Aurora is a bedside lamp that wakes you with light.'],
      [22, 'Narrator', 'Twenty minutes before the alarm, it simulates a sunrise, from deep red to warm white.'],
      [64, 'Narrator', 'The sound alarm is only a safety net.'],
      [96, 'Narrator', 'It is made for people who dislike their alarm clock but do not want one more gadget.'],
      [142, 'Narrator', 'One simple object that does one thing very well.'],
    ),
  }
  return [
    {
      id: 'a-nb-research', kind: 'notebook', title: 'Aurora launch research', ownerId: 'maya', updatedAt: dayAt(-2, 16),
      summary: 'Forty customer interviews and a survey point the same way: people dislike how alarm clocks wake them, have often tried and dropped a sleep app, and would pay for one simple object on the nightstand. The main risk named across sources is trust in the alarm.',
      sources: [
        { id: 's1', type: 'doc', title: 'Customer interviews, 40 notes', note: 'Maya’s notes from the interview round.' },
        { id: 's2', type: 'pdf', title: 'Morning habits survey', note: 'Survey results, with the price question.' },
        { id: 's3', type: 'web', title: 'Smart lamp competitor teardown', note: 'Sofia’s comparison of entry-level lamps.' },
        { id: 's4', type: 'pdf', title: 'Diffuser spec from Lumen Works', note: 'Light transmission and haze targets.' },
        { id: 's5', type: 'slides', title: 'Keynote v1', note: 'Tom’s first deck.' },
      ],
      notes: ['"Violent" is the word people use, unprompted. Worth keeping for the keynote.', 'Nobody asked for an app. Do not lead with one.', 'Gift season is why the date matters so much.'],
      overviews: [audio, video],
    },
    asFile('a-ov-audio-file', audio, 'maya', dayAt(-2, 16), 7),
    asFile('a-ov-video-file', video, 'maya', dayAt(-2, 17), 24),
    image('a-img-packshot', 'Aurora packshot, Sand', 'tom', dayAt(-1, 11), 'aurora-packshot.jpg', 1000, 914, 45, 'Studio packshot for the preorder page.'),
    image('a-img-colorways', 'Sand and Slate side by side', 'tom', dayAt(-1, 15), 'aurora-colorways.jpg', 1000, 666, 52, 'For the colorway decision.'),
    image('a-img-moodboard', 'Colorway moodboard', 'sofia', dayAt(-3, 10), 'aurora-moodboard.jpg', 800, 533, 52),
    {
      id: 'a-vid-pilot', kind: 'video', title: 'Pilot line walkthrough', ownerId: 'karim', updatedAt: dayAt(-3, 14), durationSec: 214, sizeMb: 86, poster: 'files/aurora-colorways.jpg',
      transcript: lines([0, 'Karim', 'This is the line Lumen Works has set aside for the pilot run.'], [58, 'Karim', 'Bases come in here, and the diffusers are checked at this station.'], [141, 'Karim', 'Five hundred units is about a week at this pace.']),
    },
    {
      id: 'a-file-retailers', kind: 'file', title: 'Retailer contacts.csv', ownerId: 'sofia', updatedAt: dayAt(-4, 9), ext: 'csv', sizeKb: 18, description: 'Retailers to tell if the date moves.',
      preview: [['Retailer', 'Contact', 'City', 'Units'], ['Maison Lumen', 'Claire D.', 'Paris', '120'], ['Atelier Nord', 'Hugo B.', 'Lille', '60'], ['La Veilleuse', 'Inès R.', 'Lyon', '80'], ['Forme & Fil', 'Marc T.', 'Nantes', '40'], ['Studio Sable', 'Eva L.', 'Bordeaux', '50']],
    },
    { id: 'a-file-press', kind: 'file', title: 'Press kit.zip', ownerId: 'sofia', updatedAt: dayAt(-1, 17), ext: 'zip', sizeKb: 48200, description: 'Photos, one-pager and embargo note for journalists.' },
  ]
}

function move(): Artifact[] {
  const audio: Overview = {
    id: 'mv-ov-audio', type: 'audio', title: 'The move in ten minutes', durationSec: 604,
    transcript: lines(
      [0, 'Host', 'A new office, passage des Lilas, and a move planned for a Saturday.'],
      [47, 'Guest', 'The surprise in these documents is the fiber: it arrives three weeks after the team does.'],
      [131, 'Host', 'So what is the plan for those three weeks?'],
      [146, 'Guest', 'A 4G box. Not glamorous, but it works.'],
      [302, 'Host', 'And the archive room?'],
      [318, 'Guest', 'Some of it legally has to stay. The rest should not make the trip.'],
    ),
  }
  return [
    {
      id: 'mv-nb-research', kind: 'notebook', title: 'New office research', ownerId: 'sofia', updatedAt: dayAt(-1, 12),
      summary: 'Lease, vendor quotes and the team survey in one place. The main open points are the gap before fiber arrives and who sits where on the new floor.',
      sources: [
        { id: 's1', type: 'pdf', title: 'Lease, passage des Lilas', note: 'The signed lease.' },
        { id: 's2', type: 'pdf', title: 'Fauvel moving quote', note: 'Packing included.' },
        { id: 's3', type: 'doc', title: 'Move plan', note: 'The working plan.' },
        { id: 's4', type: 'text', title: 'Team seating survey', note: 'Who wants to sit near whom.' },
      ],
      notes: ['Elevator is shared: warn the 3rd floor.', 'Accounts from 2019 stay for legal reasons.'],
      overviews: [audio],
    },
    asFile('mv-ov-audio-file', audio, 'sofia', dayAt(-1, 12), 9),
    image('mv-img-plan', 'Floor plan with seats', 'sofia', dayAt(-1, 16), 'move-floorplan.jpg', 900, 600, 76, 'Colored dots show each team.'),
    image('mv-img-office', 'Main room, site visit', 'karim', dayAt(-2, 11), 'move-office.jpg', 1000, 666, 77),
    image('mv-img-desk', 'Pont desk, light oak', 'karim', dayAt(-3, 9), 'move-desk.jpg', 1000, 666, 32, 'The desk we picked. 18 units.'),
    {
      id: 'mv-vid-visit', kind: 'video', title: 'Site visit walkthrough', ownerId: 'karim', updatedAt: dayAt(-2, 13), durationSec: 148, sizeMb: 52, poster: 'files/move-office.jpg',
      transcript: lines([0, 'Karim', 'Main room first. Two big windows on the courtyard.'], [52, 'Karim', 'This corner is where the fiber will come in, eventually.'], [103, 'Karim', 'Boxes go here on move day.'])
    },
    {
      id: 'mv-file-seats', kind: 'file', title: 'Seat list.csv', ownerId: 'sofia', updatedAt: dayAt(-1, 17), ext: 'csv', sizeKb: 4, description: 'One line per person, with team and desk.',
      preview: [['Name', 'Team', 'Desk'], ['Alex', 'Product', 'A1'], ['Karim', 'Operations', 'B2'], ['Léa', 'Finance', 'B3'], ['Sofia', 'Marketing', 'C1']],
    },
  ]
}

function hiring(): Artifact[] {
  const audio: Overview = {
    id: 'h-ov-audio', type: 'audio', title: 'What makes a good design lead here', durationSec: 381,
    transcript: lines(
      [0, 'Host', 'The team is hiring a design lead, and the sources are clear on one thing: hardware matters.'],
      [62, 'Guest', 'Yes. Brand work alone will not be enough. Someone has to have shipped a physical object.'],
      [148, 'Host', 'And the favorite so far?'],
      [161, 'Guest', 'Ben’s portfolio has real hardware in it, which is why the interview matters.'],
      [270, 'Host', 'What should the panel compare?'],
      [283, 'Guest', 'Five shared criteria, each scored out of four, so nobody just picks the nicest candidate.'],
    ),
  }
  return [
    {
      id: 'h-nb-guide', kind: 'notebook', title: 'Design lead hiring guide', ownerId: 'maya', updatedAt: dayAt(-1, 10),
      summary: 'The job description, candidate notes and reference calls in one place. The team wants someone who has shipped physical products and can work closely with product, and plans to compare candidates on the same five criteria.',
      sources: [
        { id: 's1', type: 'doc', title: 'Job description: Design lead', note: 'The published role.' },
        { id: 's2', type: 'pdf', title: 'Ben Okafor, portfolio', note: 'Includes the Marée case study.' },
        { id: 's3', type: 'text', title: 'Interview notes, first calls', note: 'Maya’s notes from each call.' },
      ],
      notes: ['Ask every candidate about a product that failed.', 'Salary band: check with Léa before any offer.'],
      overviews: [audio],
    },
    asFile('h-ov-audio-file', audio, 'maya', dayAt(-1, 10), 6),
    image('h-img-portfolio', 'Ben’s portfolio, hardware pages', 'tom', dayAt(-2, 15), 'hiring-portfolio.jpg', 900, 600, 62, 'Sketches and foam models.'),
    image('h-img-room', 'Interview room', 'maya', dayAt(-1, 9), 'hiring-room.jpg', 900, 600, 67),
    {
      id: 'h-file-score', kind: 'file', title: 'Scorecard template.csv', ownerId: 'maya', updatedAt: dayAt(-1, 16), ext: 'csv', sizeKb: 2, description: 'Five criteria, each scored out of four.',
      preview: [['Criterion', 'Ben', 'Hanna'], ['Hardware craft', '', ''], ['Works with product', '', ''], ['Team leadership', '', ''], ['Taste', '', ''], ['Communication', '', '']],
    },
  ]
}

function northwind(): Artifact[] {
  const audio: Overview = {
    id: 'n-ov-audio', type: 'audio', title: 'The Northwind deal, explained', durationSec: 295,
    transcript: lines(
      [0, 'Host', 'Four hundred engraved lamps for a Lyon hotel. What is really being negotiated?'],
      [41, 'Guest', 'Price per lamp, a two-year warranty, and Bordeaux written into the contract.'],
      [118, 'Host', 'And the catch?'],
      [127, 'Guest', 'They want delivery before launch, which would break the press embargo.'],
      [214, 'Host', 'So the proposal is a smaller first delivery?'],
      [226, 'Guest', 'Fifty units for the soft opening, and the rest after the launch.'],
    ),
  }
  return [
    {
      id: 'n-nb-account', kind: 'notebook', title: 'Northwind Hotels account research', ownerId: 'sofia', updatedAt: dayAt(-1, 14),
      summary: 'Emails, the pricing grid and meeting notes on the Northwind deal. Open points are the price per lamp, the warranty and how to handle delivery before the launch.',
      sources: [
        { id: 's1', type: 'text', title: 'Emails from Priya Nair', note: 'The thread so far.' },
        { id: 's2', type: 'doc', title: 'B2B pricing grid', note: 'Margin at each price.' },
        { id: 's3', type: 'slides', title: 'Northwind Hotels proposal', note: 'What we sent.' },
      ],
      notes: ['Bordeaux in the contract, not "considered".', 'Do not move the embargo for a soft opening.'],
      overviews: [audio],
    },
    asFile('n-ov-audio-file', audio, 'sofia', dayAt(-1, 14), 5),
    image('n-img-engraving', 'Engraving mockup on the base', 'sofia', dayAt(-1, 11), 'north-engraving.jpg', 1000, 666, 57, 'Monogram placement on the metal base.'),
    image('n-img-room', 'Room scene for the proposal', 'sofia', dayAt(-3, 15), 'north-room.jpg', 1000, 666, 76),
    {
      id: 'n-file-rooms', kind: 'file', title: 'Rooms by hotel.csv', ownerId: 'lea', updatedAt: dayAt(-2, 10), ext: 'csv', sizeKb: 1, description: 'Priya’s room counts per hotel.',
      preview: [['Hotel', 'City', 'Rooms'], ['Northwind Lyon', 'Lyon', '400'], ['Northwind Bordeaux', 'Bordeaux', '250'], ['Northwind Lille', 'Lille', '180'], ['Northwind Marseille', 'Marseille', '320']],
    },
  ]
}

function hired(): Artifact[] {
  const audio: Overview = {
    id: 'hd-ov-audio', type: 'audio', title: 'A tour of Google’s AI products', durationSec: 512,
    transcript: lines(
      [0, 'Host', 'There are a lot of Google AI products. Let’s sort them by what they are for.'],
      [54, 'Guest', 'Gemini is the assistant most people meet first, and the name of the models behind it.'],
      [127, 'Host', 'And NotebookLM?'],
      [136, 'Guest', 'A notebook that works from the sources you give it, and can turn them into overviews.'],
      [241, 'Host', 'Where do developers go?'],
      [252, 'Guest', 'Google AI Studio to try models, and Vertex AI on Google Cloud to build with them.'],
      [388, 'Host', 'And for teams at work?'],
      [397, 'Guest', 'Gemini shows up inside Google Workspace, in the apps they already use.'],
    ),
  }
  const video: Overview = {
    id: 'hd-ov-video', type: 'video', title: 'One Place in ninety seconds', durationSec: 92, poster: 'files/hired-overview.jpg',
    transcript: lines(
      [0, 'Narrator', 'A project is one chat and one shared view.'],
      [21, 'Narrator', 'Mail, documents, calls and to-dos all happen in the same place.'],
      [52, 'Narrator', 'One AI, called with an at sign.'],
      [74, 'Narrator', 'A concept by Alex Cormeraie. Not a Google product.'],
    ),
  }
  return [
    {
      id: 'hd-nb-ai', kind: 'notebook', title: 'Everything about Google’s AI products', ownerId: 'alex', updatedAt: dayAt(-1, 20),
      summary: 'A personal map of Google’s AI products, sorted by what each is for: an assistant for everyone, tools for working from your own sources, places for developers to build, and AI inside the apps teams already use. These are short personal descriptions, to be checked against Google’s own pages.',
      sources: [
        { id: 's1', type: 'web', title: 'Gemini', note: 'Google’s AI assistant, and the family of models behind it.' },
        { id: 's2', type: 'web', title: 'NotebookLM', note: 'A research and note-taking tool that works from the sources you add.' },
        { id: 's3', type: 'web', title: 'Google Workspace', note: 'Gmail, Docs, Sheets, Slides, Meet and Chat, for teams.' },
        { id: 's4', type: 'web', title: 'Google AI Studio', note: 'A place to try Gemini models in the browser.' },
        { id: 's5', type: 'web', title: 'Vertex AI', note: 'Google Cloud’s platform for building with AI models.' },
      ],
      notes: ['Start from what each product is for, not its name.', 'Check every description on the product’s own page before quoting it.'],
      overviews: [audio, video],
    },
    asFile('hd-ov-audio-file', audio, 'alex', dayAt(-1, 20), 8),
    asFile('hd-ov-video-file', video, 'alex', dayAt(-1, 21), 14),
    image('hd-img-overview', 'Screenshot, Overview.jpg', 'alex', dayAt(-1, 19), 'hired-overview.jpg', 907, 569, 71),
    image('hd-img-roadmap', 'Screenshot, Roadmap.jpg', 'alex', dayAt(-1, 19), 'hired-roadmap.jpg', 907, 569, 71),
    image('hd-img-calendar', 'Screenshot, Calendar.png', 'damien', dayAt(0, 8), 'hired-calendar.png', 520, 327, 77),
    {
      id: 'hd-vid-demo', kind: 'video', title: 'Demo walkthrough, phone', ownerId: 'alex', updatedAt: dayAt(0, 8), durationSec: 121, sizeMb: 38, poster: 'files/hired-roadmap.jpg',
      transcript: lines([0, 'Alex', 'This is the same project on a phone.'], [40, 'Alex', 'Chat and board, one swipe apart.'], [88, 'Alex', 'And the call opens right here.']),
    },
    { id: 'hd-file-notes', kind: 'file', title: 'Pitch notes.txt', ownerId: 'alex', updatedAt: dayAt(-1, 22), ext: 'txt', sizeKb: 3, description: 'What to say in two minutes, and what to leave out.' },
  ]
}

const BY_PROJECT: Record<string, () => Artifact[]> = { aurora, move, hiring, northwind, hired }
export const filesFor = (project: keyof typeof BY_PROJECT): Artifact[] => BY_PROJECT[project]()
