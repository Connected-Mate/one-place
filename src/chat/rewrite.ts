/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// Gemini's writing tools, scripted. Pure functions: text in, text out, no network, nothing from the store.
// Rule of the file: a real improvement or an honest line, never a fake result.

export type RewriteAction = 'fix' | 'improve' | 'shorter' | 'longer' | 'formal' | 'friendly' | 'translate'
export type TargetLang = 'en' | 'fr' | 'es' | 'de'
export interface RewriteContext {
  /** names written as @Name in the input: they come back untouched */
  mentions?: string[]
  /** proper nouns to capitalize */
  names?: string[]
  projectName?: string
  nextStep?: string
  /** the selection starts the message: first letter takes a capital */
  atStart?: boolean
  /** a mention opens the message: "@Maya can we" takes no capital, yet it's still a whole sentence */
  noCap?: boolean
  /** the selection ends the message: the sentence takes its final punctuation */
  atEnd?: boolean
  lang?: TargetLang
  variant?: number
}
export type RewriteResult =
  | { status: 'ok'; text: string; variants: number }
  | { status: 'none'; message: string }

export const NOTHING_TO_FIX = 'Nothing to fix here. Try a full sentence.'
export const CANNOT_TRANSLATE = 'I can\'t translate this one in the demo.'
export const CANNOT_INSTRUCT = 'I can\'t rewrite it that way in the demo. Try Improve or Shorter.'

/* ---------------- common typos ---------------- */
const TYPOS: Record<string, string> = {
  // contractions written without the apostrophe
  dont: 'don\'t', cant: 'can\'t', wont: 'won\'t', didnt: 'didn\'t', doesnt: 'doesn\'t', isnt: 'isn\'t', arent: 'aren\'t', wasnt: 'wasn\'t', werent: 'weren\'t',
  shouldnt: 'shouldn\'t', couldnt: 'couldn\'t', wouldnt: 'wouldn\'t', hasnt: 'hasn\'t', havent: 'haven\'t', hadnt: 'hadn\'t', aint: 'isn\'t',
  im: 'I\'m', ive: 'I\'ve', youre: 'you\'re', youve: 'you\'ve', youll: 'you\'ll', theyre: 'they\'re', theyve: 'they\'ve', theyll: 'they\'ll', weve: 'we\'ve',
  thats: 'that\'s', whats: 'what\'s', theres: 'there\'s', heres: 'here\'s', hes: 'he\'s', shes: 'she\'s', lets: 'let\'s', whos: 'who\'s', itll: 'it\'ll', wheres: 'where\'s',
  // texting shorthand
  u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks', thnx: 'thanks', tks: 'thanks', ty: 'thank you', tmrw: 'tomorrow', tmr: 'tomorrow', tomo: 'tomorrow',
  btw: 'by the way', idk: 'I don\'t know', imo: 'in my opinion', asap: 'ASAP', cuz: 'because', bc: 'because', b4: 'before', msg: 'message', mtg: 'meeting', ppl: 'people', w8: 'wait', rn: 'right now', ok: 'OK', okay: 'OK',
  // transposed and missing letters
  agre: 'agree', agreee: 'agree', teh: 'the', thta: 'that', taht: 'that', adn: 'and', nad: 'and', hte: 'the', fo: 'of', ot: 'to', wiht: 'with', whit: 'with', wtih: 'with', waht: 'what', wnat: 'want', jsut: 'just', yuo: 'you', yoru: 'your', thier: 'their', thsi: 'this', tihs: 'this', hwo: 'how', woudl: 'would', shoudl: 'should', coudl: 'could', knwo: 'know', konw: 'know', dose: 'does', form: 'form', frist: 'first', firt: 'first', sned: 'send', sedn: 'send', recieve: 'receive', recieved: 'received', beleive: 'believe', acheive: 'achieve', wierd: 'weird', freind: 'friend', peice: 'piece', thier1: 'their',
  // common misspellings
  definately: 'definitely', definitly: 'definitely', seperate: 'separate', occured: 'occurred', occuring: 'occurring', untill: 'until', tommorow: 'tomorrow', tomorow: 'tomorrow', tommorrow: 'tomorrow', accross: 'across', adress: 'address', begining: 'beginning', beleif: 'belief', calender: 'calendar', collegue: 'colleague', comming: 'coming', commited: 'committed', concious: 'conscious', embarass: 'embarrass', enviroment: 'environment', existance: 'existence', foward: 'forward', goverment: 'government', grammer: 'grammar', happend: 'happened', immediatly: 'immediately', independant: 'independent', knowlege: 'knowledge', neccessary: 'necessary', necesary: 'necessary', noticable: 'noticeable', occasionaly: 'occasionally', persue: 'pursue', posible: 'possible', possibile: 'possible', prefered: 'preferred', probaly: 'probably', probly: 'probably', realy: 'really', reccomend: 'recommend', recomend: 'recommend', refered: 'referred', relevent: 'relevant', responsability: 'responsibility', resturant: 'restaurant', scedule: 'schedule', shedule: 'schedule', schedual: 'schedule', sucess: 'success', succes: 'success', sucessful: 'successful', suprise: 'surprise', tounge: 'tongue', truely: 'truly', wich: 'which', wether: 'whether', writting: 'writing', alot: 'a lot', aswell: 'as well', infact: 'in fact', atleast: 'at least', noone: 'no one', everytime: 'every time', eachother: 'each other', togther: 'together', tomrrow: 'tomorrow', meeeting: 'meeting', meting: 'meeting', metting: 'meeting', buisness: 'business', bussiness: 'business', busness: 'business', finsh: 'finish', finnish: 'finish', finaly: 'finally', basicly: 'basically', actualy: 'actually', usualy: 'usually', generaly: 'generally', propably: 'probably', remeber: 'remember', rember: 'remember', ammount: 'amount', arguement: 'argument', apparantly: 'apparently', becuase: 'because', becasue: 'because', beacuse: 'because', decison: 'decision', dicussion: 'discussion', discusion: 'discussion', documnet: 'document', importnat: 'important', imporant: 'important', langauge: 'language', mesage: 'message', messsage: 'message', proejct: 'project', projcet: 'project', priject: 'project', probelm: 'problem', problme: 'problem', questoin: 'question', reveiw: 'review', reivew: 'review', udpate: 'update', updtae: 'update', budgte: 'budget', launhc: 'launch', lanuch: 'launch', thakns: 'thanks', thansk: 'thanks', plase: 'please', pleae: 'please', sory: 'sorry', soory: 'sorry', agian: 'again', aslo: 'also', abotu: 'about', baout: 'about', beign: 'being', cna: 'can', dont1: 'don\'t', ahve: 'have', hvae: 'have', mkae: 'make', nto: 'not', onyl: 'only', wnet: 'went', wrok: 'work', yse: 'yes', tiem: 'time', tihng: 'thing', thigns: 'things', soem: 'some', smae: 'same', liek: 'like', littel: 'little', mroe: 'more', moer: 'more', ohter: 'other', otehr: 'other', peopel: 'people', poeple: 'people', sayign: 'saying', shoud: 'should', woud: 'would', coud: 'could', wil: 'will',
}
delete TYPOS.form; delete TYPOS.thier1; delete TYPOS.dont1; delete TYPOS.finnish

/** Fixed phrases a spell checker misses. Applied after the typos, on lower-cased matches. */
const GRAMMAR: [RegExp, string][] = [
  [/\bif that (a|an|the)\b/gi, 'if that\'s $1'],
  [/\bthink that (a|an) /gi, 'think that\'s $1 '],
  [/\byour (welcome|right|wrong|late|going)\b/gi, 'you\'re $1'],
  [/\b(could|should|would|must) of\b/gi, '$1 have'],
  [/\btheir (is|are|was|were)\b/gi, 'there $1'],
  [/\bthere (going|coming|ready)\b/gi, 'they\'re $1'],
  [/\bto (much|many|late|early|soon)\b/gi, 'too $1'],
  [/\bits (a|an|the|not|been|going|late|ok|okay|OK|good|fine|done|ready)\b/gi, 'it\'s $1'],
  [/\bthen (we|i|you) (should|can|will)\b/gi, 'then $1 $2'],
  [/\bmore (better|faster|easier)\b/gi, '$1'],
  [/\bloose (the|our|my|a)\b/gi, 'lose $1'],
  [/\bwho's (idea|turn|call|decision)\b/gi, 'whose $1'],
]
const AN_WORDS = /\ba ([aeio][a-z]+)\b/gi
const NOT_AN = /^(one|once|european|unit|use|used)/i
const ALWAYS_CAPS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'english', 'french', 'spanish', 'german']
/** Words that really end in a doubled letter, so "soo" becomes "so" but "tooo" stays "too". */
const REAL_DOUBLE = new Set(['too', 'see', 'all', 'will', 'well', 'off', 'add', 'odd', 'egg', 'free', 'tree', 'three', 'agree', 'call', 'tell', 'sell', 'miss', 'pass', 'less', 'class', 'stuff', 'staff', 'good', 'feel', 'need', 'week', 'keep', 'seem', 'team', 'book', 'look', 'soon', 'room', 'cool', 'hello', 'still', 'small', 'bill', 'fill', 'kiss', 'cross', 'press', 'guess', 'mess', 'boss', 'loss', 'across', 'wee', 'fee', 'bee', 'zoo', 'boo', 'moo', 'goo'])

const GIBBERISH_MASH = /(asdf|qwer|zxcv|hjkl|dfgh|sdfg|wert|lkjh|poiu|uiop)/i
const CONSONANT_OK = new Set(['pls', 'plz', 'thx', 'thnx', 'tks', 'btw', 'ppl', 'mtg', 'msg', 'tmrw', 'tmr', 'rn', 'bc', 'pm', 'am', 'q', 'kpi', 'crm', 'cto', 'ceo', 'sql', 'html', 'css', 'pdf', 'ty', 'by', 'my', 'try', 'why', 'fly', 'dry', 'cry', 'shy', 'sky', 'spy', 'gym', 'rhythm', 'lynx', 'sync', 'hr', 'qa', 'mvp'])
function looksLikeNoise(word: string) {
  const w = word.toLowerCase().replace(/'/g, '')
  if (GIBBERISH_MASH.test(w)) return true
  const collapsed = w.replace(/(.)\1+/g, '$1')
  if (CONSONANT_OK.has(w) || CONSONANT_OK.has(collapsed)) return false
  if (/(.)\1{3,}/.test(w) && collapsed.length <= 2) return true
  if (!/[aeiouy]/.test(w)) return w.length >= 3
  return /[bcdfghjklmnpqrstvwxz]{6,}/.test(w)
}
/** True when there's nothing a person would call a sentence: "ggggg", "asdf", "!!!". */
export function isGibberish(text: string) {
  const words = text.match(/\p{L}[\p{L}']*/gu) ?? []
  if (!words.length) return true
  if (words.length === 1 && words[0].length === 1 && !/^(a|i)$/i.test(words[0])) return true
  return words.filter(looksLikeNoise).length / words.length >= 0.6
}

/* ---------------- what must survive: mentions, links, addresses ---------------- */
const SLOT = (i: number) => String.fromCharCode(0xe000 + i)
const SLOT_RE = /[\ue000-\uf8ff]/g
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function mentionPattern(mentions: string[] = []) {
  const names = [...new Set(mentions)].filter(Boolean).sort((a, b) => b.length - a.length).map(esc)
  return `@\\[[^\\]]+\\]\\([^)]+\\)${names.length ? `|@(?:${names.join('|')})(?![\\p{L}\\p{N}_])` : ''}`
}
function protect(text: string, mentions?: string[]) {
  const kept: string[] = []
  const re = new RegExp(`${mentionPattern(mentions)}|https?://\\S+|[\\w.+-]+@[\\w-]+\\.[\\w.-]+`, 'giu')
  const out = text.replace(re, (m) => { kept.push(m); return SLOT(kept.length - 1) })
  return { text: out, kept }
}
function restore(text: string, kept: string[]) {
  return text.replace(SLOT_RE, (c) => kept[c.charCodeAt(0) - 0xe000] ?? '')
}
const slotsOf = (s: string) => (s.match(SLOT_RE) ?? []).sort().join('')
/** Only a mention, or nothing at all: the tools have nothing to work on. */
export function isRewritable(text: string, mentions?: string[]) {
  return protect(text, mentions).text.replace(SLOT_RE, '').trim().length > 0
}
/** Where the mentions sit in the input, so a selection never cuts one in half. */
export function mentionRanges(text: string, mentions?: string[]) {
  return [...text.matchAll(new RegExp(mentionPattern(mentions), 'giu'))].map((m) => [m.index, m.index + m[0].length] as [number, number])
}

/* ---------------- small helpers ---------------- */
const capitalize = (s: string) => s.replace(/^(\s*)(\p{Ll})/u, (_, a: string, b: string) => a + b.toUpperCase())
const lowerFirst = (s: string) => (/^(?!I\b|I'|OK\b|ASAP\b)\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const tidy = (s: string) => s.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/,(?=[^\s\d])/g, ', ').replace(/([!?.]){2,}/g, '$1').replace(/^[\s,;:]+/, '').trimEnd()
const QUESTION = /^(?:[\ue000-\uf8ff]\s*)?(?:(?:hey|hi|hello)[,\s]+)?(?!(?:could|should|would|might|must) have\b)(can|could|should|shall|would|will|what|what's|why|how|when|where|who|whose|which|is|are|am|do|does|did|has|have|had|isn't|aren't|don't|doesn't|didn't|won't|can't)\b/i
const sentencesOf = (s: string) => s.match(/[^.!?]+(?:[.!?]+|$)\s*/g)?.map((x) => x.trim()).filter(Boolean) ?? [s]
const stripEnd = (s: string) => s.replace(/[.!?]+$/, '').trim()
const finish = (s: string) => {
  const t = s.trim()
  if (!t || /[.!?:,;)"'…]$/.test(t) || !/[\p{L}\p{N}\ue000-\uf8ff]$/u.test(t)) return t
  return `${t}${QUESTION.test(t) ? '?' : '.'}`
}
const sameWords = (a: string, b: string) => a.replace(/\W+/g, ' ').trim().toLowerCase() === b.replace(/\W+/g, ' ').trim().toLowerCase()

function matchCase(from: string, to: string) {
  if (/[A-Z]/.test(to) || /^(ASAP|OK)$/.test(from)) return to // "I'm", "ASAP": the table knows
  if (from.length > 1 && from === from.toUpperCase() && !/^(ASAP|OK)$/.test(from)) return to.toUpperCase()
  if (/^\p{Lu}/u.test(from)) return to.charAt(0).toUpperCase() + to.slice(1)
  return to
}
function collapseRepeats(word: string) {
  if (!/(.)\1{2,}/i.test(word)) return word
  const two = word.replace(/(.)\1{2,}/gi, '$1$1')
  if (REAL_DOUBLE.has(two.toLowerCase()) || TYPOS[two.toLowerCase()]) return two
  return /(.)\1$/i.test(two) ? two.slice(0, -1) : two
}

/* ---------------- fix ---------------- */
function fixLine(line: string, names: string[], startCap: boolean, endPunct: boolean) {
  let s = line.replace(/’/g, '\'')
  s = s.replace(/\p{L}[\p{L}']*/gu, (w) => {
    const c = collapseRepeats(w)
    const typo = TYPOS[c.toLowerCase()]
    return typo ? matchCase(c, typo) : c
  })
  s = s.replace(/\b(\p{L}+)\s+\1\b/giu, (all, w: string) => (/^(that|had|very|so|bye|no)$/i.test(w) ? all : w)) // "the the"
  for (const [re, to] of GRAMMAR) s = s.replace(re, to)
  s = s.replace(AN_WORDS, (all, w: string) => (NOT_AN.test(w) ? all : `${all.charAt(0)}n ${w}`))
  s = s.replace(/\bi\b(?!\.)/g, 'I').replace(/\bi'(m|ve|ll|d)\b/gi, 'I\'$1')
  for (const n of [...ALWAYS_CAPS, ...names.map((x) => x.toLowerCase())]) {
    if (n.length > 1) s = s.replace(new RegExp(`(?<![\\p{L}@])${esc(n)}(?![\\p{L}])`, 'giu'), (w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
  }
  s = s.replace(/^(hey|hi|hello) (?=(?:can|could|would|do|did|is|are|what|when|where|how|why|we|i|the|thanks|please)\b)/i, '$1, ')
  s = s.replace(/(\b(?:can|could|would|will) you\b.*?) please\s*$/i, '$1, please')
  s = tidy(s)
  // a capital after each sentence end, and at the start when the selection starts the message
  s = s.replace(/([.!?]\s+)(\p{Ll})/gu, (_, a: string, b: string) => a + b.toUpperCase())
  if (startCap) s = capitalize(s)
  if (endPunct && (s.match(/\p{L}+/gu) ?? []).length >= 3) s = finish(s)
  return s
}
function fix(text: string, ctx: RewriteContext) {
  const lines = text.split('\n')
  const atStart = ctx.atStart !== false && !ctx.noCap
  const atEnd = ctx.atEnd !== false
  return lines.map((l, i) => (l.trim() ? fixLine(l, ctx.names ?? [], i > 0 || atStart, i < lines.length - 1 || (atEnd && ctx.atStart !== false)) : '')).join('\n')
}

/* ---------------- phrase tables ---------------- */
const GERUND: Record<string, string> = { get: 'getting', run: 'running', set: 'setting', cut: 'cutting', stop: 'stopping', plan: 'planning', ship: 'shipping', put: 'putting', drop: 'dropping', swap: 'swapping', split: 'splitting', look: 'looking', be: 'being' }
const gerund = (verb: string) => {
  const v = verb.toLowerCase()
  if (GERUND[v]) return GERUND[v]
  if (/[^aeiou]e$/.test(v)) return `${v.slice(0, -1)}ing`
  return `${v}ing`
}
/** "the launch" alone is vague in a message about moving it: it's the date that moves. */
const dateOf = (verb: string, what: string) => (/^(move|delay|push|change|shift|postpone)$/i.test(verb) && /^the (launch|keynote|pilot|shoot|review|deadline|event)$/i.test(what) ? `${what} date` : what)
type Rule = [RegExp, (m: RegExpMatchArray) => string[]]
const IMPROVE: Rule[] = [
  [/^not sure (?:if|whether) (?:that's|this is|it's) a good idea$/i, () => ['I\'m not sure that\'s the right call.', 'I have some doubts about this approach.', 'I\'m not convinced this is the best way forward.']],
  [/^not sure (?:if|whether) (.+)$/i, (m) => [`I'm not sure whether ${m[1]}.`, `I'm still unsure whether ${m[1]}.`, `I'd like to double-check whether ${m[1]}.`]],
  [/^(?:i'm |i am )?not sure$/i, () => ['I\'m not sure yet.', 'I need to think about this a little more.']],
  [/^(?:can|could) we (\w+) (.+)$/i, (m) => { const w = dateOf(m[1], m[2]); return [`Could we look at ${gerund(m[1])} ${w}?`, `Would it make sense to ${m[1].toLowerCase()} ${w}?`, `Is there room to ${m[1].toLowerCase()} ${w}?`] }],
  [/^(?:can|could) you (send|share|check|review|update|fix|confirm|look at|prepare|finish|sign) (.+)$/i, (m) => [`Could you ${m[1].toLowerCase()} ${m[2]} when you have a moment?`, `Would you mind ${gerund(m[1].split(' ')[0])}${m[1].includes(' ') ? ` ${m[1].split(' ')[1]}` : ''} ${m[2]}?`, `When you get a chance, could you ${m[1].toLowerCase()} ${m[2]}?`]],
  [/^please send (.+)$/i, (m) => (/\bASAP\b/.test(m[1]) ? [`Could you send ${m[1]}?`, `Would you mind sending ${m[1]}?`] : [`Could you send ${m[1]} when you have a moment?`, `When you get a chance, could you send ${m[1]}?`])],
  [/^i was wondering if we could (?:just )?(.+)$/i, (m) => [`Could we ${m[1]}?`, `Would it work to ${m[1]}?`]],
  [/^thanks for (.+)$/i, (m) => [`Thank you for ${m[1]}.`, `Many thanks for ${m[1]}.`, `I really appreciate ${m[1]}.`]],
  [/^(?:i )?(?:definitely |totally |fully )?agree with (.+)$/i, (m) => [`I completely agree with ${m[1]}.`, `${m[1]} makes a good point.`]],
  [/^it's (?:ok|fine|okay), don't worry(?: about it)?$/i, () => ['No need to worry about it.', 'It\'s all good, no need to worry.']],
  [/^should we (.+)$/i, (m) => [`Do you think we should ${m[1]}?`, `Would it make sense to ${m[1]}?`]],
  [/^we need to (.+)$/i, (m) => [`We should ${m[1]}.`, `It would help to ${m[1]}.`, `Our next step is to ${m[1]}.`]],
  [/^we (?:should|must) (.+)$/i, (m) => [`I'd suggest we ${m[1]}.`, `My recommendation is that we ${m[1]}.`]],
  [/^i need (.+)$/i, (m) => [`Could I get ${m[1]}?`, `It would really help to have ${m[1]}.`]],
  [/^i think (.+)$/i, (m) => [`I believe ${m[1]}.`, `In my view, ${m[1]}.`]],
  [/^i don't know$/i, () => ['I\'m not sure yet, but I\'ll find out.', 'I don\'t have an answer yet.']],
  [/^we have a (?:problem|issue) with (.+)$/i, (m) => [`We've run into an issue with ${m[1]}.`, `${capitalize(m[1])} ${/s$/.test(m[1]) ? 'need' : 'needs'} our attention.`]],
  [/^(the .+?|this|it) (?:is|are) (?:late|delayed)$/i, (m) => [`${capitalize(m[1])} is running behind schedule.`, `${capitalize(m[1])} is taking longer than planned.`]],
  [/^(the .+?) (?:is|are) (?:done|finished|ready)$/i, (m) => [`${capitalize(m[1])} is ready to go.`, `${capitalize(m[1])} is finished and ready for review.`]],
  [/^i(?:'ll| will) do (?:it|that|this)$/i, () => ['I\'ll take care of it.', 'Leave it with me.']],
  [/^(?:this|that|it)(?:'s| is| looks| seems) (?:bad|wrong)$/i, () => ['I think this needs another look.', 'This needs a little more work.']],
  [/^(?:this|that|it)(?:'s| is| looks| seems) good$/i, () => ['This looks great to me.', 'Looks good. Thank you.']],
  [/^let me know$/i, () => ['Let me know what you think.', 'Please let me know your thoughts.']],
  [/^i agree$/i, () => ['I\'m fully on board with this.', 'That works for me.']],
  [/^thanks?$|^thank you$/i, () => ['Thank you.', 'Thanks for your help.']],
  [/^(?:what|how) about (.+)$/i, (m) => [`Have we considered ${m[1]}?`, `Should we also look at ${m[1]}?`]],
]
const IMPROVE_WORDS: [RegExp, string[]][] = [
  [/\ba lot of\b/gi, ['many', 'plenty of']],
  [/\breally good\b/gi, ['excellent', 'very strong']],
  [/\bvery important\b/gi, ['critical', 'essential']],
  [/\bASAP\b/g, ['as soon as possible', 'as soon as you can']],
  [/\bkind of |\bsort of /gi, ['', '']],
  [/\bstuff\b/gi, ['items', 'details']],
  [/\bbig problem\b/gi, ['significant issue', 'serious issue']],
  [/\btalk about\b/gi, ['discuss', 'go over']],
  [/\blook at (?!\w+ing\b)/gi, ['review ', 'take a look at ']],
  [/\bfind out\b/gi, ['confirm', 'check']],
  [/\bmake sure\b/gi, ['ensure', 'confirm']],
  [/\bright now\b/gi, ['at the moment', 'for now']],
  [/\bi guess\b/gi, ['I think', 'I believe']],
  [/\bgonna\b/gi, ['going to', 'going to']],
  [/\bwanna\b/gi, ['want to', 'want to']],
]
const FORMAL_RULES: Rule[] = [
  [/^not sure (?:if|whether) (?:that's|this is|it's) a good idea$/i, () => ['I am not certain that this is advisable.', 'I have some reservations about this approach.']],
  [/^not sure (?:if|whether) (.+)$/i, (m) => [`I am not certain whether ${m[1]}.`]],
  [/^i'm not sure (.+)$/i, (m) => [`I am not certain ${m[1]}.`]],
  [/^(?:can|could) we (\w+) (.+)$/i, (m) => { const w = dateOf(m[1], m[2]); return [`May we consider ${gerund(m[1])} ${w}?`, `Would it be possible to ${m[1].toLowerCase()} ${w}?`] }],
  [/^we need to (.+)$/i, (m) => [`We should ${m[1]}.`, `It is necessary to ${m[1]}.`]],
  [/^i need to (.+)$/i, (m) => [`I must ${m[1]}.`]],
  [/^(?:i )?(?:definitely |totally |fully )?agree with (.+)$/i, (m) => [`I fully agree with ${m[1]}.`]],
  [/^it's (?:ok|fine|okay), don't worry(?: about it)?$/i, () => ['There is no cause for concern.']],
]
const FORMAL_WORDS: [RegExp, string][] = [
  [/^(?:[Hh]i|[Hh]ey|[Hh]iya)\s*,?\s+(?=\p{Ll})/u, 'Hello, '],
  [/^(?:hi|hey|hiya)\b/i, 'Hello'],
  [/\bthanks a lot\b|\bthanks\b/gi, 'thank you'],
  [/\bcan you\b/gi, 'could you please'],
  [/\bi think\b/gi, 'I believe'],
  [/\bASAP\b/g, 'as soon as possible'],
  [/\bi want\b/gi, 'I would like'],
  [/\bi need (?=the|a|an|your|our)\b/gi, 'I require '],
  [/\bget back to\b/gi, 'respond to'],
  [/\bcheck\b/gi, 'review'],
  [/\bhelp (?=me|us|you|them)\b/gi, 'assist '],
  [/\b(your|our|the) help\b/gi, '$1 assistance'],
  [/\bfix\b/gi, 'resolve'],
  [/\bgot\b/gi, 'received'],
  [/\bsorry\b/gi, 'I apologize'],
  [/\byeah\b|\byep\b/gi, 'yes'],
  [/\bnope\b/gi, 'no'],
  [/\bgonna\b/gi, 'going to'],
  [/\bwanna\b/gi, 'want to'],
  [/\ba lot of\b/gi, 'many'],
  [/\bstuff\b/gi, 'items'],
  [/\bis done\b/gi, 'is complete'],
  [/\bis late\b/gi, 'is delayed'],
  [/\bproblem\b/gi, 'issue'],
  [/\btalk about\b/gi, 'discuss'],
  [/\blooks good\b/gi, 'appears satisfactory'],
  [/\b(?:really|just) /gi, ''],
]
const EXPAND: [RegExp, string][] = [
  [/\bcan't\b/gi, 'cannot'], [/\bwon't\b/gi, 'will not'], [/\bdon't\b/gi, 'do not'], [/\bdoesn't\b/gi, 'does not'], [/\bdidn't\b/gi, 'did not'], [/\bisn't\b/gi, 'is not'], [/\baren't\b/gi, 'are not'], [/\bwasn't\b/gi, 'was not'], [/\bweren't\b/gi, 'were not'], [/\bshouldn't\b/gi, 'should not'], [/\bcouldn't\b/gi, 'could not'], [/\bwouldn't\b/gi, 'would not'], [/\bhaven't\b/gi, 'have not'], [/\bhasn't\b/gi, 'has not'],
  [/\bI'm\b/g, 'I am'], [/\bI've\b/g, 'I have'], [/\bI'll\b/g, 'I will'], [/\bI'd\b/g, 'I would'], [/\bwe're\b/gi, 'we are'], [/\bwe've\b/gi, 'we have'], [/\bwe'll\b/gi, 'we will'], [/\byou're\b/gi, 'you are'], [/\byou'll\b/gi, 'you will'], [/\bthey're\b/gi, 'they are'], [/\bthat's\b/gi, 'that is'], [/\bit's\b/gi, 'it is'], [/\bwhat's\b/gi, 'what is'], [/\bthere's\b/gi, 'there is'], [/\blet's\b/gi, 'let us'],
]
const CONTRACT: [RegExp, string][] = [
  [/\bcannot\b/gi, 'can\'t'], [/\bwill not\b/gi, 'won\'t'], [/\bdo not\b/gi, 'don\'t'], [/\bdoes not\b/gi, 'doesn\'t'], [/\bdid not\b/gi, 'didn\'t'], [/\bis not\b/gi, 'isn\'t'], [/\bare not\b/gi, 'aren\'t'],
  [/\bI am\b/g, 'I\'m'], [/\bI have\b(?= (been|done|got|seen|sent))/g, 'I\'ve'], [/\bI will\b/g, 'I\'ll'], [/\bI would\b/g, 'I\'d'], [/\bwe are\b/gi, 'we\'re'], [/\bwe will\b/gi, 'we\'ll'], [/\byou are\b/gi, 'you\'re'], [/\bthat is\b/gi, 'that\'s'], [/\bit is\b/gi, 'it\'s'],
]
const FRIENDLY_WORDS: [RegExp, string][] = [
  [/^(?:hello|dear)\b/i, 'Hi'],
  [/\bplease send\b/gi, 'could you send'],
  [/\bi require\b/gi, 'I\'d love'],
  [/\bi need\b/gi, 'I\'d love'],
  [/\byou must\b/gi, 'could you'],
  [/\bwe must\b/gi, 'let\'s'],
  [/\bwe need to\b/gi, 'let\'s'],
  [/\bi apologize\b/gi, 'sorry'],
  [/\bthank you\b/gi, 'thanks'],
  [/\bhowever\b/gi, 'but'],
  [/\bas soon as possible\b/gi, 'whenever you get a chance'],
  [/\bASAP\b/g, 'whenever you get a chance'],
]
const FILLERS: [RegExp, string][] = [
  [/\bi was wondering if we could\b/gi, 'could we'],
  [/\bdo you think we could\b/gi, 'could we'],
  [/\bwould it be possible to\b/gi, 'can we'],
  [/\bit would be great if you could\b/gi, 'please'],
  [/\bcould you please\b/gi, 'please'],
  [/\bi (?:just )?wanted to (?:let you know|say|tell you) that\b/gi, ''],
  [/\bi (?:just )?wanted to (?:let you know|say|tell you)\b/gi, ''],
  [/\bplease note that\b/gi, ''],
  [/\bas you know,?\b/gi, ''],
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bat the end of the day,?\b/gi, ''],
  [/\bin the event that\b/gi, 'if'],
  [/\ba large number of\b/gi, 'many'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bprior to\b/gi, 'before'],
  [/\bas soon as possible\b/gi, 'ASAP'],
  [/\bi would like to\b/gi, 'I\'d like to'],
  [/\bin my opinion,?\b/gi, ''],
  [/\bto be honest,?\b/gi, ''],
  [/\bfor what it's worth,?\b/gi, ''],
  [/\bit seems (?:like|that)\b/gi, ''],
  [/\b(?:just|really|actually|basically|literally|honestly|simply|quite|very|kind of|sort of|a little bit|pretty much)\b ?/gi, ''],
  [/\bthat being said,?\b/gi, ''],
]
const CLOSERS = /^(thanks|thank you|let me know( what you think)?|cheers|regards|please let me know)\b/i

function fragmentMessage(what: string) { return { status: 'none' as const, message: `Select a full sentence to ${what} it.` } }
const wordsIn = (s: string) => (s.match(/\p{L}[\p{L}']*/gu) ?? []).length

function improve(fixed: string, ctx: RewriteContext, variant: number): RewriteResult {
  let variants = 1
  const atEnd = ctx.atEnd !== false
  const applyWords = (text: string) => {
    let out = text
    for (const [re, list] of IMPROVE_WORDS) {
      re.lastIndex = 0
      if (re.test(out)) { variants = Math.max(variants, new Set(list).size); re.lastIndex = 0; out = out.replace(re, (w) => matchCase(w, list[variant % list.length])) }
      re.lastIndex = 0
    }
    return tidy(out)
  }
  const parts = fixed.split('\n').map((line) => {
    if (!line.trim()) return ''
    return sentencesOf(line).map((sentence, i) => {
      // "@Maya" or "Hey," in front doesn't change what the sentence asks
      const lead = i === 0 ? sentence.match(/^(?:[\ue000-\uf8ff]\s*)+|^(?:hey|hi|hello),?\s+/i)?.[0] ?? '' : ''
      const core = stripEnd(sentence.slice(lead.length)).replace(/,?\s+please$/i, '')
      for (const [re, make] of IMPROVE) {
        const m = core.match(re)
        if (m) {
          const list = make(m)
          variants = Math.max(variants, list.length)
          const made = applyWords(list[variant % list.length])
          return lead ? `${lead}${lowerFirst(made)}` : made
        }
      }
      return lead ? lead + applyWords(sentence.slice(lead.length)) : capitalize(applyWords(sentence))
    }).join(' ')
  }).join('\n')
  // a fragment in the middle of a sentence reads on: no capital or full stop of its own
  const text = ctx.atStart === false ? lowerFirst(parts) : parts
  return { status: 'ok', text: atEnd ? text : text.replace(/[.]$/, ''), variants }
}
function shorter(fixed: string, ctx: RewriteContext, variant: number): RewriteResult {
  let out = fixed
  for (const [re, to] of FILLERS) out = out.replace(re, to)
  out = out.split('\n').map((l) => { const t = capitalize(tidy(l)); return QUESTION.test(t) ? t.replace(/\.$/, '?') : t }).join('\n')
  const light = ctx.atStart === false ? lowerFirst(out) : out
  // the second try also drops the courtesy sentences and the "I think" in front of a claim
  const sentences = sentencesOf(out)
  const kept = sentences.filter((s) => !CLOSERS.test(s))
  const strong = capitalize(tidy((kept.length ? kept.join(' ') : out).replace(/\bi (?:think|believe|feel)(?: that)? /gi, '')))
  const list = [...new Set([light, ctx.atStart === false ? lowerFirst(strong) : strong])].filter((x) => x.trim())
  const usable = list.filter((x) => x.length < fixed.length - 1)
  if (!usable.length) return { status: 'none', message: 'This is already short.' }
  return { status: 'ok', text: usable[variant % usable.length], variants: usable.length }
}
/** What a sentence is doing, so the words added to it make sense. */
function kindOf(s: string): 'ask' | 'doubt' | 'done' | 'thanks' | 'plan' | 'other' {
  const n = s.replace(/[\ue000-\uf8ff]\s*/g, '').trim()
  if (/^(?:thanks|thank you|many thanks)\b/i.test(n)) return 'thanks'
  if (n.endsWith('?') || /^please\b/i.test(n) || QUESTION.test(n)) return 'ask'
  if (/\b(should|need to|must|let's|i think|i believe|suggest)\b/i.test(n)) return 'plan'
  if (/\b(not (totally )?sure|unsure|doubt|worried|late|delay\w*|behind|problem|issue|risk\w*|wrong|bad|can't|cannot|won't)\b/i.test(n)) return 'doubt'
  if (/\b(done|ready|finished|complete|sent|good|great)\b/i.test(n)) return 'done'
  return 'other'
}
/** Adds a sentence to the end of the message, before a sign-off if there is one. */
function addClosing(text: string, clause: string) {
  const paras = text.split(/\n\s*\n/)
  if (paras.length < 2) return `${text.trimEnd()} ${clause}`
  let i = paras.length - 1
  while (i > 0 && paras[i].trim().length < 40 && /^(best|regards|kind regards|thanks|cheers|sincerely|thank you)\b/i.test(paras[i].trim())) i--
  paras[i] = `${paras[i].trimEnd()} ${clause}`
  return paras.join('\n\n')
}
const lastSentence = (s: string) => { const body = s.split(/\n\s*\n/).filter((p) => !(p.trim().length < 40 && /^(best|regards|kind regards|cheers|sincerely|hi|hello|thanks|thank you)\b/i.test(p.trim()))).at(-1) ?? s; return sentencesOf(body).at(-1) ?? s }

function longer(fixed: string, ctx: RewriteContext, variant: number): RewriteResult {
  if (ctx.atEnd === false || ctx.atStart === false || wordsIn(fixed) < 2) return fragmentMessage('expand')
  const body = fixed.includes('\n') ? fixed : finish(fixed)
  const step = ctx.nextStep
  const project = ctx.projectName ? (/\b(launch|move|account|project)\b/i.test(ctx.projectName) ? `the ${ctx.projectName}` : ctx.projectName) : 'this'
  const options: Record<ReturnType<typeof kindOf>, string[]> = {
    ask: [`I'd like to settle this ${step ? `before ${step}` : 'this week'}.`, 'Happy to talk it through if that\'s easier.', 'Thanks in advance.'],
    doubt: ['I\'d like to talk it through before we decide.', 'Could we find a few minutes this week to go over it?', step ? `I want to make sure we stay on track for ${step}.` : 'I want to make sure we stay on track.'],
    done: ['Let me know if you\'d like any changes.', 'Happy to walk you through it.'],
    thanks: ['It made a real difference.', 'I appreciate the quick turnaround.'],
    plan: [`This should help keep ${project} on track.`, 'Happy to hear other ideas.', 'Let me know if you see it differently.'],
    other: ['Let me know what you think.', 'Happy to talk it through if useful.'],
  }
  const list = options[kindOf(lastSentence(body))]
  return { status: 'ok', text: addClosing(body, list[variant % list.length]), variants: list.length }
}
function formal(fixed: string, ctx: RewriteContext, variant: number): RewriteResult {
  let variants = 1
  const prefix = fixed.match(/^(?:[\ue000-\uf8ff]\s*)+/)?.[0] ?? ''
  let out = fixed.split('\n').map((line) => {
    const lead = line.startsWith(prefix) ? prefix : ''
    return lead + sentencesOf(line.slice(lead.length)).map((sentence) => {
      const core = stripEnd(sentence)
      for (const [re, make] of FORMAL_RULES) {
        const m = core.match(re)
        if (m) { const list = make(m); variants = Math.max(variants, list.length); return list[variant % list.length] }
      }
      return sentence
    }).join(' ')
  }).join('\n')
  for (const [re, to] of FORMAL_WORDS) out = out.replace(re, (w, g1) => (to.includes('$1') ? to.replace('$1', g1) : matchCase(w, to)))
  for (const [re, to] of EXPAND) out = out.replace(re, (w) => matchCase(w, to))
  out = out.replace(/\b(could you please .*?),? please([.?!])?$/i, '$1$2').replace(/!+/g, '.').replace(/\ba ([aeiou])/gi, (a, v: string) => `${a.charAt(0)}n ${v}`).split('\n').map((l) => { const t = capitalize(tidy(l)); return QUESTION.test(t) ? t.replace(/\.$/, '?') : t }).join('\n')
  const single = !out.includes('\n') && ctx.atEnd !== false && ctx.atStart !== false && wordsIn(out) >= 3
  const options = [out]
  if (single && variants === 1) {
    if (kindOf(out) === 'ask') options.push(`${out} Thank you in advance.`)
    else if (/^(The|This|We|It|There|Our)\b/.test(out)) options.push(`Please note that ${lowerFirst(out)}`)
  }
  const distinct = options[0] === fixed ? options.slice(1) : options
  if (!distinct.length || (distinct.length === 1 && sameWords(distinct[0], fixed))) return { status: 'none', message: 'This already reads formally.' }
  const count = Math.max(variants, distinct.length)
  const pick = distinct[variant % distinct.length]
  return { status: 'ok', text: ctx.atStart === false ? lowerFirst(pick) : pick, variants: count }
}
function friendly(fixed: string, ctx: RewriteContext, variant: number): RewriteResult {
  let out = fixed
  for (const [re, to] of FRIENDLY_WORDS) out = out.replace(re, (w) => matchCase(w, to))
  for (const [re, to] of CONTRACT) out = out.replace(re, (w) => matchCase(w, to))
  out = out.replace(/^not sure if\b/i, 'I\'m not totally sure if').replace(/^thanks for\b/i, 'Thanks so much for')
  out = out.split('\n').map((l) => { const t = capitalize(tidy(l)); return QUESTION.test(t) ? t.replace(/\.$/, '?') : t }).join('\n')
  if (out.includes('\n') || ctx.atEnd === false || ctx.atStart === false || wordsIn(out) < 3) {
    if (sameWords(out, fixed)) return { status: 'none', message: 'Select a full sentence to warm it up.' }
    return { status: 'ok', text: ctx.atStart === false ? lowerFirst(out) : out, variants: 1 }
  }
  const warm = out.replace(/[.!]$/, '')
  const options: Record<ReturnType<typeof kindOf>, string[]> = {
    ask: [`${out} Thanks so much!`, `${out} No rush at all.`],
    doubt: [`${out} Happy to talk it through!`, `${out} Let me know how I can help!`],
    done: [`${warm}!`, `${out} Let me know what you think!`],
    thanks: [`${warm}!`, `${warm}, I really appreciate it!`],
    plan: [`${out} What do you think?`, `${out} Happy to hear other ideas!`],
    other: [`${warm}!`, `${out} Hope that helps!`],
  }
  const list = options[kindOf(out)]
  return { status: 'ok', text: list[variant % list.length], variants: list.length }
}

/* ---------------- translate: only what the demo knows well ---------------- */
type Row = [string, string, string, string] // en, fr, es, de
const SENTENCES: Row[] = [
  ['Thanks', 'Merci', 'Gracias', 'Danke'],
  ['Thank you', 'Merci', 'Gracias', 'Vielen Dank'],
  ['Thanks for your help', 'Merci pour ton aide', 'Gracias por tu ayuda', 'Danke für deine Hilfe'],
  ['Thanks everyone', 'Merci à tous', 'Gracias a todos', 'Danke an alle'],
  ['Hello', 'Bonjour', 'Hola', 'Hallo'],
  ['Good morning', 'Bonjour', 'Buenos días', 'Guten Morgen'],
  ['Sounds good', 'Ça me va', 'Me parece bien', 'Klingt gut'],
  ['I agree', 'Je suis d\'accord', 'Estoy de acuerdo', 'Ich stimme zu'],
  ['I don\'t agree', 'Je ne suis pas d\'accord', 'No estoy de acuerdo', 'Ich stimme nicht zu'],
  ['Not sure if that\'s a good idea', 'Pas sûr que ce soit une bonne idée', 'No estoy seguro de que sea buena idea', 'Ich bin nicht sicher, ob das eine gute Idee ist'],
  ['That\'s a good idea', 'C\'est une bonne idée', 'Es una buena idea', 'Das ist eine gute Idee'],
  ['Can we move the launch', 'Peut-on décaler le lancement', '¿Podemos mover el lanzamiento', 'Können wir den Launch verschieben'],
  ['Can we talk tomorrow', 'Peut-on en parler demain', '¿Podemos hablar mañana', 'Können wir morgen sprechen'],
  ['Can we talk', 'Peut-on en parler', '¿Podemos hablar', 'Können wir sprechen'],
  ['Let\'s talk tomorrow', 'Parlons-en demain', 'Hablemos mañana', 'Sprechen wir morgen'],
  ['See you tomorrow', 'À demain', 'Hasta mañana', 'Bis morgen'],
  ['See you on Monday', 'À lundi', 'Hasta el lunes', 'Bis Montag'],
  ['See you soon', 'À bientôt', 'Hasta pronto', 'Bis bald'],
  ['Let me know', 'Dis-moi', 'Avísame', 'Sag mir Bescheid'],
  ['Let me know what you think', 'Dis-moi ce que tu en penses', 'Dime qué te parece', 'Sag mir, was du davon hältst'],
  ['I\'ll take care of it', 'Je m\'en occupe', 'Yo me encargo', 'Ich kümmere mich darum'],
  ['I\'ll get back to you', 'Je reviens vers toi', 'Te respondo pronto', 'Ich melde mich bei dir'],
  ['I\'ll check', 'Je vérifie', 'Lo compruebo', 'Ich prüfe das'],
  ['I\'m on it', 'Je m\'en occupe', 'Me pongo con ello', 'Ich kümmere mich darum'],
  ['I don\'t know', 'Je ne sais pas', 'No lo sé', 'Ich weiß es nicht'],
  ['Sorry for the delay', 'Désolé pour le retard', 'Perdón por el retraso', 'Entschuldigung für die Verzögerung'],
  ['We are late', 'Nous sommes en retard', 'Vamos con retraso', 'Wir sind spät dran'],
  ['We are on track', 'Nous sommes dans les temps', 'Vamos según lo previsto', 'Wir liegen im Zeitplan'],
  ['This is urgent', 'C\'est urgent', 'Es urgente', 'Das ist dringend'],
  ['It\'s done', 'C\'est fait', 'Está hecho', 'Es ist erledigt'],
  ['No problem', 'Pas de problème', 'Sin problema', 'Kein Problem'],
  ['Good job', 'Bien joué', 'Buen trabajo', 'Gut gemacht'],
  ['Great work everyone', 'Beau travail à tous', 'Buen trabajo a todos', 'Tolle Arbeit, alle zusammen'],
  ['What do you think', 'Qu\'en penses-tu', '¿Qué te parece', 'Was meinst du'],
  ['Are you available tomorrow', 'Es-tu disponible demain', '¿Estás disponible mañana', 'Hast du morgen Zeit'],
  ['The meeting is tomorrow', 'La réunion est demain', 'La reunión es mañana', 'Das Meeting ist morgen'],
  ['The meeting is cancelled', 'La réunion est annulée', 'La reunión está cancelada', 'Das Meeting ist abgesagt'],
  ['We need to decide today', 'Nous devons décider aujourd\'hui', 'Tenemos que decidir hoy', 'Wir müssen heute entscheiden'],
  ['I need your help', 'J\'ai besoin de ton aide', 'Necesito tu ayuda', 'Ich brauche deine Hilfe'],
  ['Please review', 'Merci de relire', 'Por favor, revisa', 'Bitte prüfen'],
  ['Have a good weekend', 'Bon week-end', 'Buen fin de semana', 'Schönes Wochenende'],
]
/** Objects for the two sentence patterns below, German in the accusative. */
const OBJECTS: Row[] = [
  ['the deck', 'la présentation', 'la presentación', 'die Präsentation'],
  ['the slides', 'les slides', 'las diapositivas', 'die Folien'],
  ['the brief', 'le brief', 'el brief', 'das Briefing'],
  ['the budget', 'le budget', 'el presupuesto', 'das Budget'],
  ['the contract', 'le contrat', 'el contrato', 'den Vertrag'],
  ['the report', 'le rapport', 'el informe', 'den Bericht'],
  ['the document', 'le document', 'el documento', 'das Dokument'],
  ['the invoice', 'la facture', 'la factura', 'die Rechnung'],
  ['the file', 'le fichier', 'el archivo', 'die Datei'],
  ['the quote', 'le devis', 'el presupuesto', 'das Angebot'],
  ['the plan', 'le plan', 'el plan', 'den Plan'],
]
const PATTERNS: { en: RegExp; out: Record<'fr' | 'es' | 'de', (o: string) => string> }[] = [
  { en: /^can you send me (the .+)$/i, out: { fr: (o) => `Peux-tu m'envoyer ${o} ?`, es: (o) => `¿Puedes enviarme ${o}?`, de: (o) => `Kannst du mir ${o} schicken?` } },
  { en: /^can you review (the .+)$/i, out: { fr: (o) => `Peux-tu relire ${o} ?`, es: (o) => `¿Puedes revisar ${o}?`, de: (o) => `Kannst du ${o} prüfen?` } },
]
const WORDS: Row[] = [
  ['yes', 'oui', 'sí', 'ja'], ['no', 'non', 'no', 'nein'], ['today', 'aujourd\'hui', 'hoy', 'heute'], ['tomorrow', 'demain', 'mañana', 'morgen'], ['yesterday', 'hier', 'ayer', 'gestern'],
  ['meeting', 'réunion', 'reunión', 'Meeting'], ['launch', 'lancement', 'lanzamiento', 'Launch'], ['budget', 'budget', 'presupuesto', 'Budget'], ['deadline', 'échéance', 'fecha límite', 'Frist'], ['team', 'équipe', 'equipo', 'Team'],
  ['project', 'projet', 'proyecto', 'Projekt'], ['idea', 'idée', 'idea', 'Idee'], ['problem', 'problème', 'problema', 'Problem'], ['question', 'question', 'pregunta', 'Frage'], ['answer', 'réponse', 'respuesta', 'Antwort'],
  ['please', 's\'il te plaît', 'por favor', 'bitte'], ['sorry', 'désolé', 'perdón', 'Entschuldigung'], ['urgent', 'urgent', 'urgente', 'dringend'], ['ready', 'prêt', 'listo', 'bereit'], ['done', 'fait', 'hecho', 'erledigt'],
  ['late', 'en retard', 'tarde', 'spät'], ['good', 'bon', 'bueno', 'gut'], ['week', 'semaine', 'semana', 'Woche'], ['month', 'mois', 'mes', 'Monat'], ['contract', 'contrat', 'contrato', 'Vertrag'],
  ['invoice', 'facture', 'factura', 'Rechnung'], ['review', 'relecture', 'revisión', 'Prüfung'], ['draft', 'brouillon', 'borrador', 'Entwurf'], ['risk', 'risque', 'riesgo', 'Risiko'], ['supplier', 'fournisseur', 'proveedor', 'Lieferant'],
]
const LANG_INDEX: Record<TargetLang, 0 | 1 | 2 | 3> = { en: 0, fr: 1, es: 2, de: 3 }
const LANG_NAME: Record<TargetLang, string> = { en: 'English', fr: 'French', es: 'Spanish', de: 'German' }
const keyOf = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, '\'').replace(/^[¿¡]/, '').replace(/[.!?\s]+$/, '').trim().toLowerCase()
/** One sentence, or null when the demo has no good translation for it. */
function translateSentence(sentence: string, lang: TargetLang): { text: string; sourceIs: number } | null {
  const key = keyOf(sentence)
  const ask = /\?\s*$/.test(sentence)
  for (const row of [...SENTENCES, ...WORDS]) {
    const from = row.findIndex((c) => keyOf(c) === key)
    if (from < 0) continue
    let out = row[LANG_INDEX[lang]]
    const isQuestion = ask || row[2].startsWith('¿') || (row[0].match(/^(can|are|what)\b/i) !== null)
    if (lang === 'fr' && isQuestion) out = `${out} ?`
    else if (isQuestion) out = `${out}?`
    else if (WORDS.includes(row)) { /* a lone word keeps no punctuation */ } else out = `${out}.`.replace(/^(Merci|Gracias|Danke|Vielen Dank|Hola|Hallo|Bonjour|Thanks|Thank you|Hello|Good morning|Buenos días|Guten Morgen)\.$/, '$1')
    return { text: out, sourceIs: from }
  }
  if (lang !== 'en') {
    for (const p of PATTERNS) {
      const m = stripEnd(sentence).match(p.en)
      const obj = m && OBJECTS.find((o) => o[0] === m[1].toLowerCase())
      if (obj) return { text: p.out[lang](obj[LANG_INDEX[lang]]), sourceIs: 0 }
    }
  }
  return null
}
function translate(fixed: string, ctx: RewriteContext): RewriteResult {
  const lang = ctx.lang ?? 'en'
  // a mention at the very start stays in front; anywhere else the demo would have to guess the grammar
  const lead = fixed.match(/^([\ue000-\uf8ff]\s*)+/)?.[0] ?? ''
  const body = fixed.slice(lead.length)
  if (SLOT_RE.test(body)) { SLOT_RE.lastIndex = 0; return { status: 'none', message: CANNOT_TRANSLATE } }
  SLOT_RE.lastIndex = 0
  if (lang === 'en' && /\b(the|is|are|to|of|we|you|can|my|and|this|that|for)\b/i.test(body) && !/\b(le|la|les|est|el|los|der|die|das|und|ist)\b/i.test(body)) return { status: 'none', message: 'This is already in English.' }
  const parts = sentencesOf(body)
  const done = parts.map((s) => translateSentence(s, lang))
  if (done.some((d) => !d)) return { status: 'none', message: CANNOT_TRANSLATE }
  const all = done as { text: string; sourceIs: number }[]
  if (all.every((d) => d.sourceIs === LANG_INDEX[lang])) return { status: 'none', message: `This is already in ${LANG_NAME[lang]}.` }
  const joined = all.map((d) => (all.length > 1 && !/[.!?]$/.test(d.text) ? `${d.text}.` : d.text)).join(' ')
  return { status: 'ok', text: lead + (lead ? lowerFirst(joined) : joined), variants: 1 }
}

/* ---------------- the one entry point ---------------- */
export function rewrite(input: string, action: RewriteAction, ctx: RewriteContext = {}): RewriteResult {
  const lead = input.match(/^\s*/)?.[0] ?? ''
  const tail = input.match(/\s*$/)?.[0] ?? ''
  const core = input.trim()
  const { text: masked, kept } = protect(core, ctx.mentions)
  const bare = masked.replace(SLOT_RE, ' ').trim()
  if (!bare || isGibberish(bare)) return { status: 'none', message: NOTHING_TO_FIX }
  const variant = ctx.variant ?? 0
  // a capital would be wrong right after a mention: "@Maya can we" reads fine as it is
  const startsWithMention = /^[\ue000-\uf8ff]/.test(masked)
  const context: RewriteContext = { ...ctx, noCap: startsWithMention }
  const fixed = fix(masked, context)
  let result: RewriteResult
  switch (action) {
    case 'fix': result = { status: 'ok', text: fixed, variants: 1 }; break
    case 'improve': result = improve(fixed, context, variant); break
    case 'shorter': result = shorter(fixed, context, variant); break
    case 'longer': result = longer(fixed, context, variant); break
    case 'formal': result = formal(fixed, context, variant); break
    case 'friendly': result = friendly(fixed, context, variant); break
    case 'translate': result = translate(fixed, context); break
  }
  if (result.status === 'none') return result
  // no rule may ever drop a mention: if one went missing, the corrected text is the honest answer
  let out = result.text
  if (slotsOf(out) !== slotsOf(masked)) out = fixed
  if (out === masked || out.replace(/\s+/g, ' ') === core.replace(/\s+/g, ' ')) {
    return { status: 'none', message: action === 'fix' ? 'This already looks right.' : action === 'improve' ? 'This already reads well.' : 'I don\'t have a better version of this one.' }
  }
  return { status: 'ok', text: lead + restore(out, kept) + tail, variants: result.variants }
}

/** The free-text box: maps what was typed to the nearest action, or null. */
export function instructionToAction(raw: string): { action: RewriteAction; lang?: TargetLang } | null {
  const n = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const lang: TargetLang | null = /\b(english|anglais)\b/.test(n) ? 'en' : /\b(french|francais)\b/.test(n) ? 'fr' : /\b(spanish|espagnol)\b/.test(n) ? 'es' : /\b(german|allemand)\b/.test(n) ? 'de' : null
  if (lang) return { action: 'translate', lang }
  if (/\b(fix|correct\w*|spell\w*|grammar|typos?|mistakes?|errors?|corrige\w*|orthographe)\b/.test(n)) return { action: 'fix' }
  if (/\b(short\w*|concise|brief\w*|trim|tighter|tl;?dr|fewer words|court\w*|raccourci\w*)\b/.test(n)) return { action: 'shorter' }
  if (/\b(long\w*|expand|elaborate|more detail\w*|develop|develope?r|add detail\w*)\b/.test(n)) return { action: 'longer' }
  if (/\b(formal\w*|professional\w*|polite\w*|serious|business|formel\w*|pro)\b/.test(n)) return { action: 'formal' }
  if (/\b(friend\w*|warm\w*|casual|nice\w*|kind\w*|soft\w*|relax\w*|amical\w*|sympa)\b/.test(n)) return { action: 'friendly' }
  if (/\b(improve\w*|better|clear\w*|rephrase\w*|reword\w*|rewrite|polish\w*|ameliore\w*|reformule\w*)\b/.test(n)) return { action: 'improve' }
  return null
}
