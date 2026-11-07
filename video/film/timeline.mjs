/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The one edit list, in beats of the track, read by the capture, the picture, the sound and video/sync-check.mjs.
// "Product Launch" is exactly 100 BPM (audio/beat-grid.mjs): one beat = 0.6 s = 36 frames at 60 fps, a 16th = 9 frames.
// So every beat of the film falls exactly on a frame.
export const BEAT = .6, ORIGIN = .025 // track attacks measured at 38.425, 48.025, 115.225: origin + a whole number of bars
export const bar = (k) => ORIGIN + 4 * BEAT * k
// The music: edited at bar lines only. Three full bars, the bar that climbs to the drop, then the track untouched to its real end.
export const PIECES = [[bar(9), bar(12)], [bar(15), 117.9]]
export const DROP_TRACK = bar(16)

export const SEGMENTS = [ // name, beats. Bar lines are at multiples of 4.
  ['hello', 2], ['spent', 4], ['gmail', 2], ['chaos', 4], ['first', 4], // 16 beats: the hook
  ['merge', 8], // the drop, beat 16
  ['notagents', 6], ['notplace', 4], ['ppl', 6],
  ['tour', 76], // the laptop, one take
  ['matter', 4], ['noone', 8], ['only', 4], ['hey', 4], ['hire', 4],
  ['end', 8.3],
]
// The tour, in beats from its start. Each step: a caption, the zone that stays lit, the part of the app the camera goes to.
export const STEPS = [
  { h: 0, cap: ['Here are all your projects.'], capS: ['Here are all', 'your projects.'], zone: 'rail' },
  { h: 6, cap: ['In the middle, a normal chat.'], capS: ['In the middle,', 'a normal chat.'], zone: 'chat' },
  { h: 12, cap: ['Everything is linked to it.'], capS: ['Everything is', 'linked to it.'], zone: 'chat', cam: 'chatLow' },
  { h: 22, cap: ['On the right, your docs and your artifacts.'], capS: ['On the right, your', 'docs and artifacts.'], zone: 'pane', cam: 'pane' },
  { h: 28, cap: ['Invite anyone.'], capS: ['Invite anyone.'] },
  { h: 32, cap: ['One group address: aurora@oneplace.example'], capS: ['One group address:', 'aurora@oneplace.example'], zone: 'address' },
  { h: 36, cap: ['An email arrives. It lands in your chat.'], capS: ['An email arrives.', 'It lands in your chat.'], zone: 'chat', cam: 'chatLow' },
  { h: 41, cap: ['Gemini prepares the reply.'], capS: ['Gemini prepares', 'the reply.'], zone: 'chat', cam: 'chatLow' },
  { h: 49, cap: ['Calls too.'], capS: ['Calls too.'] },
  { h: 60, cap: ['AI handles what isn’t interesting.'], capS: ['AI handles what', 'isn’t interesting.'], zone: 'chat', cam: 'chatLow' },
  { h: 64, cap: ['Gemini keeps you focused where it matters.'], capS: ['Gemini keeps you', 'focused where it matters.'], zone: 'needs', cam: 'needs' },
  { h: 70, cap: ['Gemini does the rest.'], capS: ['Gemini does the rest.'], dimAll: true },
]
// A whole component, lifted out of the live take and shown large: nothing cut, and readable on a phone.
export const LENSES = [
  { from: 2, to: 6, mark: 'projects' }, { from: 9.5, to: 12, mark: 'thread' }, { from: 18.5, to: 22, mark: 'answer' }, { from: 24, to: 25.5, mark: 'sim' },
  { from: 30.5, to: 31.75, mark: 'invite' }, { from: 37.5, to: 39.75, mark: 'email' }, { from: 39.75, to: 41, mark: 'email2' }, { from: 42.5, to: 43.5, mark: 'triage' }, { from: 34.25, to: 36, mark: 'address' }, { from: 47, to: 49, mark: 'draft' }, { from: 60.5, to: 64, mark: 'summary' }, { from: 66, to: 70, mark: 'needs' },
]
export const CHIPS = [{ h: 71, t: 'Contact clients' }, { h: 72, t: 'Check specs' }, { h: 73, t: 'Draft replies' }, { h: 74, t: 'and more' }]

export function timeline() {
  const T = {}; let b = 0
  for (const [n, d] of SEGMENTS) { T[n] = [+(b * BEAT).toFixed(4), +((b + d) * BEAT).toFixed(4)]; b += d }
  return T
}
export const filmOfTrack = (t) => (16 * BEAT) + (t - DROP_TRACK)
