/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// How a call really starts: people trickle in or all land at once, someone is late, somebody can't
// be heard, then Gemini's first note lights up and everyone reacts at the same moment.
// The whole call is one timeline: joins, silences, lines, choruses, notes. The project's script follows on.
import type { Project, ProjectScript, Txt } from '../data/types'

export type Beat =
  | { kind: 'wait'; ms: number }
  | { kind: 'join'; ids: string[]; ms?: number }
  | { kind: 'say'; who: string; text: Txt; key?: string; gap?: number; scripted?: boolean }
  | { kind: 'chorus'; parts: ChorusPart[]; caption: string; gap?: number }
  | { kind: 'note'; text: string; ms?: number }
  /** a camera goes on: a dark moment, then the picture settles */
  | { kind: 'cam'; ids: string[]; ms?: number }
  /** talking with the mic off: the mouth moves, no sound. The classic */
  | { kind: 'mimic'; who: string; ms: number }
  | { kind: 'leave'; ids: string[]; ms?: number }
export interface ChorusPart { who: string; text: string; key?: string; at?: number }

type Raw =
  | { kind: 'wait'; ms: number }
  | { kind: 'join'; ids: string[]; ms?: number }
  | { kind: 'say'; who: string; text: string; gap?: number }
  | { kind: 'chorus'; parts: { who: string; text: string; at?: number; key?: string }[]; caption: string; gap?: number }
  | { kind: 'note'; text: string; ms?: number }
  | { kind: 'cam'; ids: string[]; ms?: number }
  | { kind: 'mimic'; who: string; ms: number }

const wait = (ms: number): Raw => ({ kind: 'wait', ms })
const join = (ids: string | string[], ms = 120): Raw => ({ kind: 'join', ids: typeof ids === 'string' ? [ids] : ids, ms })
const say = (who: string, text: string, gap = 150): Raw => ({ kind: 'say', who, text, gap })
const cam = (id: string, ms = 500): Raw => ({ kind: 'cam', ids: [id], ms })
const mimic = (who: string, ms = 1900): Raw => ({ kind: 'mimic', who, ms })
const note = (text: string): Raw => ({ kind: 'note', text, ms: 500 })
const chorus = (caption: string, parts: [string, string, number?][], gap = 300): Raw => ({ kind: 'chorus', caption, gap, parts: parts.map(([who, text, at]) => ({ who, text, at })) })

/**
 * Two of each style: people trickling in with someone late, and everyone landing at once.
 * People arrive with their camera off and turn it on one at a time. One stays off and says why.
 */
const OPENINGS: Record<string, Raw[]> = {
  aurora: [ // trickle, Karim late, Tom on mute, Léa stays off
    wait(2200),
    join('maya'),
    say('maya', 'Oh, hey. Wait, I just clicked the card in the chat and I’m in? No link, no waiting room?'),
    say('maya', 'Hold on, let me turn my camera on.', 100),
    cam('maya', 900),
    join('tom', 500),
    mimic('tom'),
    say('maya', 'Tom, you’re on mute!', 200),
    say('tom', 'Sorry, sorry. I said, same. I didn’t have to dig an invite out of my inbox. I don’t even know where my inbox is anymore.', 200),
    cam('tom', 300),
    say('tom', 'Why does it look like that? Oh, it’s the wrong camera.', 200),
    join(['sofia', 'lea'], 200),
    say('sofia', 'Hi! Are we waiting for Karim?', 100),
    cam('sofia', 200),
    say('lea', 'Yeah, he’s coming. I’m staying off camera, by the way. I’m eating a sandwich.', 1300),
    join('karim', 150),
    say('karim', 'Sorry, sorry. I was reading what Gemini wrote on the board. I actually know what this call is about, for once.', 150),
    cam('karim', 300),
    note('Everyone’s in. Today: the launch date, hold or move.'),
    chorus('Wow!', [['maya', 'Wow.', 0], ['tom', 'Whoa.', 90], ['sofia', 'Oh, that’s so good.', 180]]),
    say('lea', 'Okay, it’s the first time I’ve wanted to come to a meeting.', 150),
    say('maya', 'Okay, okay, let’s start.', 500),
  ],
  move: [ // everyone at once, Léa on mute, Sofia stays off
    wait(2200),
    join(['sofia', 'karim', 'lea'], 350),
    chorus('Hey! Hi! Oh, hi!', [['sofia', 'Hey!', 0], ['karim', 'Hi!', 120], ['lea', 'Oh, hi!', 240]]),
    say('karim', 'Wait, is my camera on?', 100),
    say('sofia', 'No.', 400),
    cam('karim', 700),
    say('karim', 'Okay, nobody asked for the link. Has that ever happened?', 150),
    say('sofia', 'I’m keeping my camera off, the signal’s terrible up here. But the move plan is just there, on the board.', 150),
    cam('lea', 800),
    say('lea', 'It’s weird, I look green.', 300),
    mimic('lea'),
    say('karim', 'Léa, you’re on mute.', 200),
    say('lea', 'Wait, can you hear me? Sorry, I was on mute. I said, the movers’ quote is already on the to-do list.', 200),
    note('All here. On the board: the move plan and the quote to sign.'),
    chorus('Oh wow!', [['sofia', 'Oh, wow.', 0], ['karim', 'Ha, look at that.', 110], ['lea', 'Oh, that’s nice.', 200]]),
    say('sofia', 'I think this is the first meeting where nobody said, can you see my screen?', 150),
    say('karim', 'Okay, okay. Let’s walk the floor.', 500),
  ],
  hiring: [ // trickle, Léa late, Maya stays off
    wait(2400),
    join('tom'),
    say('tom', 'Hey. Is it just me? Hello?', 700),
    join('maya'),
    say('maya', 'No, no, I’m here. Sorry, I was on mute.'),
    cam('tom', 300),
    say('tom', 'Hold on, camera. Why am I so dark? Okay. There.'),
    say('tom', 'I clicked the card and the job description is right there, next to the call.'),
    say('maya', 'I know. Nobody has to ask, can you share the link? And I’m staying off camera, I just got back from the gym.'),
    say('tom', 'Are we waiting for Léa?', 100),
    say('maya', 'She’s coming.', 1500),
    join('lea', 150),
    say('lea', 'Sorry, sorry. Gemini made my to-dos from the last call. I was just, you know, doing them.', 150),
    cam('lea', 300),
    note('Everyone’s in. Today: how to run Ben’s interview.'),
    chorus('Wow!', [['tom', 'Whoa.', 0], ['maya', 'Wow.', 100], ['lea', 'Oh, that’s so good.', 170]]),
    say('tom', 'I’ve never said this about a meeting, but I like this one already.', 150),
    say('maya', 'Okay, okay. Let’s do this.', 500),
  ],
  northwind: [ // everyone at once, with a guest who needs no account, Léa stays off
    wait(2200),
    join(['sofia', 'lea', 'priya'], 350),
    chorus('Hi! Hello! Oh, hi!', [['sofia', 'Hi!', 0], ['priya', 'Hello!', 110], ['lea', 'Oh, hi!', 230]]),
    say('priya', 'Okay, that was easy. I just clicked and I’m in. I don’t have an account, do I?', 150),
    cam('sofia', 200),
    say('sofia', 'You don’t. It’s just this call.', 150),
    say('priya', 'Let me find my camera. My IT locks everything. Oh, there.', 100),
    cam('priya', 500),
    say('lea', 'Sorry, I’ll stay off camera, I’m in a taxi. But I don’t have to take notes, so I can actually listen to you.', 200),
    note('Priya joined with no account. Today: the final terms.'),
    chorus('Wow!', [['priya', 'Wow, it’s already writing?', 0], ['sofia', 'Whoa.', 100], ['lea', 'Oh, that’s so good.', 180]]),
    say('priya', 'Okay. Can I get one of these for my board?', 150),
    say('sofia', 'Okay, okay. Let’s start.', 500),
  ],
}

const GENERIC_VOICES = ['maya', 'tom', 'sofia', 'karim', 'lea']
const GENERIC_TEXT = {
  hi: 'Hi!',
  in: 'Oh, nice. I just clicked and I’m in.',
  same: 'Same. No link, no waiting room.',
}
const genericKey = (who: string, line: keyof typeof GENERIC_TEXT) => (GENERIC_VOICES.includes(who) ? `gen-${who}-${line}` : undefined)

function keyed(projectId: string, raw: Raw[]): Beat[] {
  let n = 0
  return raw.map((b): Beat => {
    if (b.kind === 'say') return { ...b, key: `open-${projectId}-${n++}` }
    if (b.kind === 'chorus') return { ...b, parts: b.parts.map((p) => ({ ...p, key: `open-${projectId}-${n++}` })) }
    return b
  })
}

/** For a project with no opening of its own: a quick hello from its own people. */
function genericOpening(others: string[]): Beat[] {
  if (!others.length) return []
  const [a, b] = others
  const beats: Beat[] = [{ kind: 'wait', ms: 1800 }, { kind: 'join', ids: others, ms: 350 }]
  beats.push({
    kind: 'chorus', caption: 'Hi!', gap: 300,
    parts: others.slice(0, 4).map((who, i) => ({ who, text: GENERIC_TEXT.hi, key: genericKey(who, 'hi'), at: i * 110 })),
  })
  beats.push({ kind: 'say', who: a, text: GENERIC_TEXT.in, key: genericKey(a, 'in'), gap: 200 })
  if (b) beats.push({ kind: 'say', who: b, text: GENERIC_TEXT.same, key: genericKey(b, 'same'), gap: 200 })
  // Not all at once, and the last one stays off: as in any real call.
  beats.splice(2, 0, { kind: 'cam', ids: [a], ms: 900 })
  if (b && others.length > 2) beats.push({ kind: 'cam', ids: [b], ms: 600 })
  beats.push({ kind: 'note', text: 'Everyone’s in.', ms: 800 })
  return beats
}

const whoOf = (b: Beat) => (b.kind === 'say' ? [b.who] : b.kind === 'chorus' ? b.parts.map((p) => p.who) : [])

/** The whole call for this viewer: the opening, then the project's own script. */
export function buildTimeline(project: Project, viewerId: string, script: Pick<ProjectScript, 'captions'>, expected: string[]): Beat[] {
  const raw = OPENINGS[project.id]
  const allowed = new Set([...expected, viewerId])
  let opening: Beat[]
  if (raw) {
    // People who left the project drop out of the opening; the viewer never "arrives".
    opening = keyed(project.id, raw).flatMap((b): Beat[] => {
      if (b.kind === 'join' || b.kind === 'cam') {
        const ids = b.ids.filter((id) => allowed.has(id) && id !== viewerId)
        return ids.length ? [{ ...b, ids }] : []
      }
      if (b.kind === 'say') return allowed.has(b.who) ? [b] : []
      if (b.kind === 'mimic') return allowed.has(b.who) && b.who !== viewerId ? [b] : []
      if (b.kind === 'chorus') {
        const parts = b.parts.filter((p) => allowed.has(p.who))
        return parts.length ? [{ ...b, parts }] : []
      }
      return [b]
    })
    // Anyone the opening doesn't mention comes in before Gemini's first note, so nobody pops up in mid-sentence.
    const named = new Set(opening.flatMap((b) => (b.kind === 'join' ? b.ids : [])))
    const rest = expected.filter((id) => !named.has(id))
    if (rest.length) {
      const at = opening.findIndex((b) => b.kind === 'note')
      opening.splice(at < 0 ? opening.length : at, 0, { kind: 'join', ids: rest, ms: 250 })
    }
  } else {
    opening = genericOpening(expected)
  }
  const lines = script.captions.map((c, i): Beat => ({ kind: 'say', who: c.who, text: c.text, key: `${project.id}-${i}`, scripted: true }))
  // When the meeting is over, people drop off one by one. You hang up last.
  const goodbyes: Beat[] = lines.length && expected.length
    ? [{ kind: 'wait', ms: 2600 }, ...expected.slice().reverse().map((id, i): Beat => ({ kind: 'leave', ids: [id], ms: 500 + (i % 2) * 450 }))]
    : []
  return [...opening, ...lines, ...goodbyes]
}

/** Nora's call. She sees and hears nothing about the project: only people happy she got in so easily. */
export function buildGuestTimeline(hostId: string, others: string[], viewerId: string, guestName: string): Beat[] {
  const other = others.find((id) => id !== hostId)
  const faces = others.slice(0, 4)
  const hiParts = faces.map((who, i) => ({ who, text: GENERIC_TEXT.hi, key: genericKey(who, 'hi'), at: i * 120 }))
  const beats: Beat[] = [
    { kind: 'wait', ms: 1600 },
    { kind: 'join', ids: others, ms: 400 },
    { kind: 'chorus', caption: 'Hi!', parts: hiParts, gap: 300 },
    { kind: 'cam', ids: [hostId], ms: 700 },
    { kind: 'say', who: viewerId, text: 'Oh wow, I just clicked and I’m in. No account?', gap: 200 },
  ]
  if (other) {
    beats.push({ kind: 'say', who: other, text: 'No account.', key: 'guest-o0', gap: 200 })
    beats.push({ kind: 'say', who: other, text: 'Hold on, let me turn my camera on.', key: 'guest-o1', gap: 100 })
    beats.push({ kind: 'cam', ids: [other], ms: 700 })
  }
  beats.push({ kind: 'say', who: hostId, text: `Hi ${guestName}, thanks for joining us.`, key: 'guest-0' })
  if (other) beats.push({ kind: 'say', who: other, text: 'Hello! We can hear you really well.', key: 'guest-1' })
  beats.push({ kind: 'say', who: hostId, text: 'We can start whenever you like. Do you have about twenty minutes?', key: 'guest-2' })
  return beats
}

/** Who speaks at some point: the others show as muted. */
export const talkersOf = (timeline: Beat[]) => new Set(timeline.flatMap(whoOf))

/** Every line that needs a clip. Used to produce the clips and the manifest. */
export function allOpeningClips() {
  const out: { key: string; who: string; text: string }[] = []
  for (const [id, raw] of Object.entries(OPENINGS)) {
    for (const b of keyed(id, raw)) {
      if (b.kind === 'say') out.push({ key: b.key!, who: b.who, text: b.text as string })
      if (b.kind === 'chorus') for (const p of b.parts) out.push({ key: p.key!, who: p.who, text: p.text })
    }
  }
  for (const who of GENERIC_VOICES) for (const line of Object.keys(GENERIC_TEXT) as (keyof typeof GENERIC_TEXT)[]) out.push({ key: `gen-${who}-${line}`, who, text: GENERIC_TEXT[line] })
  out.push({ key: 'guest-o0', who: 'tom', text: 'No account.' })
  out.push({ key: 'guest-o1', who: 'tom', text: 'Hold on, let me turn my camera on.' })
  return out
}
