import type { Artifact, Block, L, Message, Project, ProjectScript, Todo, Visibility } from '../types'
import { DAY, dayAt, fmtDay, week, weekday } from './time'

const all: Visibility = { type: 'all' }
const priv = (...ids: string[]): Visibility => ({ type: 'private', with: ids })

export function aurora(): Project {
  // Key dates of the story, relative to now
  const diffusersPlanned = week(1) // original delivery of batch 2
  const diffusersNew = week(2) // after Jun's 7-day slip
  const pilotRun = week(2) + DAY // tuesday
  const keynote = week(6) + 2 * DAY
  const launch = week(6) + 3 * DAY
  const d = (t: number): L => ({ fr: fmtDay(t, 'fr'), en: fmtDay(t, 'en') })
  const wd = (t: number): L => ({ fr: weekday(t, 'fr'), en: weekday(t, 'en') })

  /* ---------------- todos (ids referenced by the call summary) ---------------- */
  const todos: Todo[] = [
    { id: 'a-t1', text: { fr: 'Obtenir de Jun une date ferme pour le lot 2 de diffuseurs', en: 'Get a firm date from Jun for diffuser batch 2' }, assigneeId: 'karim', due: dayAt(1, 18), done: true, source: { fr: 'Mail de Jun Park', en: 'Mail from Jun Park' } },
    { id: 'a-t2', text: { fr: 'Chiffrer le fret aérien pour les 300 premières unités', en: 'Price air freight for the first 300 units' }, assigneeId: 'lea', due: dayAt(0, 18), done: true, source: { fr: 'Appel Retard Lumen', en: 'Call Lumen delay' } },
    { id: 'a-t3', text: { fr: 'Reconfirmer le créneau de pré-série avec Lumen Works', en: 'Reconfirm the pilot run slot with Lumen Works' }, assigneeId: 'karim', due: dayAt(2, 12), done: false, source: { fr: 'Appel Retard Lumen', en: 'Call Lumen delay' } },
    { id: 'a-t4', text: { fr: 'Prévenir Nora que la date peut glisser d’une semaine', en: 'Tell Nora the date may slip by a week' }, assigneeId: 'sofia', due: dayAt(3, 12), done: false, source: { fr: 'Appel Retard Lumen', en: 'Call Lumen delay' } },
    { id: 'a-t5', text: { fr: 'Trancher le coloris du visuel keynote : Sable ou Ardoise', en: 'Decide the keynote hero colorway: Sand or Slate' }, assigneeId: 'tom', due: dayAt(5, 18), done: false, source: { fr: 'Appel Retard Lumen', en: 'Call Lumen delay' } },
    { id: 'a-t6', text: { fr: 'Mettre à jour le brief de lancement avec les deux scénarios', en: 'Update the launch brief with both scenarios' }, assigneeId: 'maya', due: dayAt(-1, 18), done: true, source: { fr: 'Appel Retard Lumen', en: 'Call Lumen delay' } },
    { id: 'a-t7', text: { fr: 'Déposer le rapport d’essais CE dans les fichiers', en: 'Upload the CE test report to files' }, assigneeId: 'maya', due: dayAt(-2, 18), done: true },
    { id: 'a-t8', text: { fr: 'Valider la v2 des slides keynote', en: 'Sign off keynote slides v2' }, assigneeId: 'alex', due: dayAt(6, 18), done: false },
    { id: 'a-t9', text: { fr: 'Shooting photo coloris Sable (studio)', en: 'Product shoot, Sand colorway (studio)' }, assigneeId: 'tom', due: dayAt(-6, 18), done: true },
    { id: 'a-t10', text: { fr: 'Briefer le support client sur la FAQ précommande', en: 'Brief customer support on the preorder FAQ' }, assigneeId: 'sofia', due: dayAt(9, 18), done: false },
  ]

  /* ---------------- artifacts ---------------- */
  const artifacts: Artifact[] = [
    {
      id: 'a-doc-brief', kind: 'doc', title: { fr: 'Brief de lancement', en: 'Launch brief' }, ownerId: 'maya', updatedAt: dayAt(-1, 14, 12),
      sections: [
        { heading: { fr: '1. Pourquoi Aurora', en: '1. Why Aurora' }, body: { fr: 'Aurora est une lampe de chevet qui réveille par la lumière. Vingt minutes avant l’heure, elle simule un lever de soleil, du rouge sombre au blanc chaud. Le réveil sonore ne sert plus que de filet de sécurité. On vise les gens qui détestent leur réveil mais ne veulent pas d’un gadget de plus sur la table de nuit : un objet simple, beau, qui fait une chose très bien.', en: 'Aurora is a bedside lamp that wakes you with light. Twenty minutes before the alarm it simulates a sunrise, from deep red to warm white. The sound alarm is only a safety net. We are aiming at people who hate their alarm clock but do not want one more gadget on the nightstand: one simple, beautiful object that does one thing very well.' } },
        { heading: { fr: '2. Pour qui', en: '2. Who it is for' }, body: { fr: 'Cœur de cible : 28 à 45 ans, urbains, lève-tôt contraints (enfants, trajets, horaires décalés). Ils ont déjà essayé une appli de sommeil et l’ont abandonnée. Le prix de 149 € les place au-dessus des lampes connectées d’entrée de gamme et sous les objets « bien-être » premium. Second cercle : cadeaux (fêtes de fin d’année), d’où l’importance de la date.', en: 'Core target: 28 to 45, urban, forced early risers (kids, commutes, shift work). They have tried a sleep app and dropped it. At 149 € we sit above entry-level smart lamps and below premium wellness objects. Second circle: gifts (year-end season), which is why the date matters so much.' } },
        { heading: { fr: '3. Dates clés', en: '3. Key dates' }, body: { fr: `Gel du design : fait. Certification CE : rapport reçu, dossier en cours. Pré-série de 500 unités chez Lumen Works : ${fmtDay(pilotRun, 'fr')}. Ouverture des précommandes : ${fmtDay(week(4), 'fr')}. Keynote : ${fmtDay(keynote, 'fr')}. Lancement et levée de l’embargo presse : ${fmtDay(launch, 'fr')} à 8 h.`, en: `Design freeze: done. CE certification: report received, file in progress. Pilot run of 500 units at Lumen Works: ${fmtDay(pilotRun, 'en')}. Preorders open: ${fmtDay(week(4), 'en')}. Keynote: ${fmtDay(keynote, 'en')}. Launch and press embargo lift: ${fmtDay(launch, 'en')} at 8 am.` } },
        { heading: { fr: '4. Deux scénarios face au retard Lumen', en: '4. Two scenarios after the Lumen delay' }, body: { fr: `Scénario A, on tient la date : la pré-série se fait avec les 300 diffuseurs conformes du lot 1, expédiés par avion (environ 2 400 €). Le lot 2 arrive le ${fmtDay(diffusersNew, 'fr')} et rattrape la production de série. Risque : zéro marge si Lumen glisse encore. Scénario B, on décale de 7 jours : tout respire, mais il faut prévenir Nora, les revendeurs et déplacer la salle de la keynote. Léa estime le surcoût à 3 500 €. Décision attendue d’Alex avant vendredi.`, en: `Scenario A, hold the date: the pilot run uses the 300 compliant diffusers from batch 1, shipped by air (about 2,400 €). Batch 2 lands on ${fmtDay(diffusersNew, 'en')} and catches up with mass production. Risk: zero buffer if Lumen slips again. Scenario B, move by 7 days: everything breathes, but we have to tell Nora and the retailers and rebook the keynote venue. Léa puts the extra cost at 3,500 €. Decision expected from Alex before Friday.` } },
        { heading: { fr: '5. Message', en: '5. Messaging' }, body: { fr: 'Deux accroches en lice. « Aurora vous réveille en douceur » (Sofia) et « Réveillez-vous à vos conditions » (Tom). La première est plus chaude, la seconde plus affirmée. Dans tous les cas : pas de jargon technique sur la page, pas de « lumens », pas de « connecté ». On parle de matins.', en: 'Two taglines in the running. "Aurora wakes you gently" (Sofia) and "Wake up on your terms" (Tom). The first is warmer, the second more assertive. Either way: no technical jargon on the page, no "lumens", no "smart". We talk about mornings.' } },
        { heading: { fr: '6. Presse', en: '6. Press' }, body: { fr: 'Nora Weiss prépare un long papier sous embargo jusqu’au matin du lancement. Elle a une unité de test depuis trois semaines (coloris Sable). Elle veut 20 minutes avec Tom sur l’histoire du design. Si la date bouge, elle peut suivre à condition d’être prévenue avant lundi.', en: 'Nora Weiss is writing a long piece under embargo until launch morning. She has had a test unit for three weeks (Sand). She wants 20 minutes with Tom about the design story. If the date moves she can follow, provided we tell her before Monday.' } },
        { heading: { fr: '7. Risques', en: '7. Risks' }, body: { fr: 'Lumen Works (deuxième glissement en deux mois). Firmware : l’alarme sonne encore avec une minute de retard en 0.9.3. Budget : 412 k€ engagés pour 400 k€ visés, principalement à cause du shooting. Un seul coloris au lancement, le second suit en janvier.', en: 'Lumen Works (second slip in two months). Firmware: the alarm still fires one minute late in 0.9.3. Budget: 412k € committed against a 400k € target, mostly the shoot. One colorway at launch, the second follows in January.' } },
      ],
    },
    {
      id: 'a-sheet-budget', kind: 'sheet', title: { fr: 'Budget', en: 'Budget' }, ownerId: 'lea', updatedAt: dayAt(-1, 11, 30),
      columns: [
        { fr: 'Poste', en: 'Item' }, { fr: 'Fournisseur', en: 'Supplier' }, { fr: 'Prévu (€)', en: 'Planned (€)' }, { fr: 'Engagé (€)', en: 'Committed (€)' }, { fr: 'Payé (€)', en: 'Paid (€)' }, { fr: 'Écart (€)', en: 'Variance (€)' }, { fr: 'Statut', en: 'Status' },
      ],
      rows: [
        ['Outillage et moules / Tooling & molds', 'Lumen Works', 110000, 118500, 118500, 8500, 'OK'],
        ['Diffuseurs lot 1 / Diffusers batch 1', 'Lumen Works', 22000, 22000, 22000, 0, 'OK'],
        ['Diffuseurs lot 2 / Diffusers batch 2', 'Lumen Works', 23000, 23000, 0, 0, 'En attente / Pending'],
        ['Électronique / Electronics', 'Kestrel Components', 64000, 61200, 61200, -2800, 'OK'],
        ['Firmware', 'Ondine Labs', 30000, 30000, 30000, 0, 'OK'],
        ['Packaging', 'Papier Nord', 30000, 31000, 31000, 1000, 'OK'],
        ['Shooting produit / Product shoot', 'Studio Marée', 25000, 38200, 38200, 13200, 'Dépassé / Over'],
        ['Keynote (salle, AV) / Keynote (venue, AV)', 'La Halle Verte', 20000, 21500, 0, 1500, 'Engagé / Committed'],
        ['Kit presse et échantillons / Press kit & samples', 'Interne / In-house', 8000, 7400, 7400, -600, 'OK'],
        ['Site précommande / Preorder site', 'Atelier Vingt', 15000, 15000, 9000, 0, 'En cours / In progress'],
        ['Certification CE', 'Normatis', 12000, 12000, 12000, 0, 'OK'],
        ['Fret aérien 300 unités / Air freight 300 units', 'Skyline Cargo', 0, 2400, 0, 2400, 'Nouveau / New'],
        ['Réserve / Contingency', '', 41000, 30000, 0, -11000, ''],
        ['TOTAL', '', 400000, 412200, 329300, 12200, ''],
      ],
    },
    {
      id: 'a-slides-keynote', kind: 'slides', title: { fr: 'Keynote', en: 'Keynote' }, ownerId: 'tom', updatedAt: dayAt(-3, 10, 5),
      slides: [
        { title: { fr: 'Aurora', en: 'Aurora' }, subtitle: { fr: 'Le matin, en mieux', en: 'Mornings, done right' }, accent: '#f29900' },
        { title: { fr: 'Les réveils sont violents', en: 'Alarm clocks are violent' }, bullets: [{ fr: 'Un bip à 6 h 30, dans le noir', en: 'A beep at 6:30, in the dark' }, { fr: '63 % des gens snoozent au moins une fois', en: '63% of people snooze at least once' }, { fr: 'Les applis de sommeil : abandonnées en 3 semaines', en: 'Sleep apps: dropped within 3 weeks' }] },
        { title: { fr: 'Un lever de soleil en 20 minutes', en: 'A sunrise in 20 minutes' }, bullets: [{ fr: 'Du rouge sombre au blanc chaud, sans à-coup', en: 'From deep red to warm white, no steps' }, { fr: 'Diffuseur opalin : aucune LED visible', en: 'Opal diffuser: no visible LED' }, { fr: 'Un seul geste : on tourne la base', en: 'One gesture: turn the base' }] },
        { title: { fr: 'Visuel héros', en: 'Hero shot' }, subtitle: { fr: 'Sable ou Ardoise ? (cadre rouge temporaire, Tom)', en: 'Sand or Slate? (temporary red box, Tom)' }, accent: '#d93025' },
        { title: { fr: 'Prix et disponibilité', en: 'Price and availability' }, bullets: [{ fr: '149 €, un coloris au lancement', en: '149 €, one colorway at launch' }, { fr: `Précommandes dès le ${fmtDay(week(4), 'fr')}`, en: `Preorders from ${fmtDay(week(4), 'en')}` }, { fr: 'Livraison sous 15 jours', en: 'Ships within 15 days' }] },
        { title: { fr: 'Bonne nuit.', en: 'Good night.' }, subtitle: { fr: 'aurora.example', en: 'aurora.example' }, accent: '#1e3a5f' },
      ],
    },
    {
      id: 'a-pdf-diffuser', kind: 'pdf', title: { fr: 'Spécification diffuseur, Lumen Works', en: 'Diffuser spec from Lumen Works' }, ownerId: 'jun', updatedAt: dayAt(-2, 11, 48), pages: 6,
      excerpt: { fr: 'Diffuseur opalin AUR-D2, polycarbonate, épaisseur 2,2 mm. Transmission lumineuse cible : 58 % ± 3. Voile (haze) : minimum 92 %. Lot 2 : 2 000 pièces, 14 % hors tolérance sur le voile (89 à 91 %). Cause probable : température de moule insuffisante sur la presse 3. Action : nouvelle série complète, contrôle 100 % en sortie de presse.', en: 'Opal diffuser AUR-D2, polycarbonate, 2.2 mm. Target light transmission: 58% ± 3. Haze: 92% minimum. Batch 2: 2,000 parts, 14% out of tolerance on haze (89 to 91%). Probable cause: mold temperature too low on press 3. Action: full rerun, 100% inspection at press exit.' },
    },
  ]

  /* ---------------- blocks ---------------- */
  const blocks: Block[] = [
    {
      id: 'aurora-summary', type: 'summary', span: 3, title: { fr: 'Où on en est', en: 'Where things stand' }, updatedAt: dayAt(0, 9, 45),
      text: { fr: `Le lot 2 de diffuseurs glisse de 7 jours chez Lumen Works. Les 300 pièces conformes partent par avion ce matin, la pré-série du ${fmtDay(pilotRun, 'fr')} tient. Reste une décision : garder la date de lancement ou la décaler d’une semaine. Nora peut suivre si elle est prévenue avant lundi.`, en: `Diffuser batch 2 slips by 7 days at Lumen Works. The 300 compliant parts left by air this morning, so the ${fmtDay(pilotRun, 'en')} pilot run holds. One decision left: keep the launch date or move it by a week. Nora can follow if told before Monday.` },
      bullets: [
        { fr: 'Décision date de lancement attendue aujourd’hui (Alex)', en: 'Launch date decision expected today (Alex)' },
        { fr: 'Budget : 412 k€ engagés pour 400 k€, le shooting explique l’écart', en: 'Budget: 412k € committed against 400k €, the shoot explains the gap' },
        { fr: 'Firmware 0.9.3 : rampe validée, alarme encore 1 min en retard', en: 'Firmware 0.9.3: ramp approved, alarm still 1 min late' },
        { fr: 'Coloris keynote à trancher : Sable ou Ardoise (sondage de Tom en attente)', en: 'Keynote colorway to decide: Sand or Slate (Tom’s poll pending)' },
      ],
    },
    {
      id: 'aurora-timeline', type: 'timeline', span: 3, title: { fr: 'Calendrier de lancement', en: 'Launch timeline' },
      items: [
        { id: 'tl-tooling', label: { fr: 'Outillage et moules', en: 'Tooling & molds' }, start: week(-3), end: week(-1), ownerId: 'karim', lane: { fr: 'Usine', en: 'Factory' }, color: '#188038', progress: 100 },
        { id: 'tl-design-freeze', label: { fr: 'Gel du design', en: 'Design freeze' }, start: week(-2), end: week(-2), ownerId: 'tom', lane: { fr: 'Produit', en: 'Product' }, color: '#e37400', milestone: true },
        { id: 'tl-cert', label: { fr: 'Certification CE', en: 'CE certification' }, start: week(-2), end: week(1) + 2 * DAY, ownerId: 'maya', lane: { fr: 'Produit', en: 'Product' }, color: '#8430ce', progress: 70 },
        { id: 'tl-diffusers', label: { fr: 'Diffuseurs lot 2 (Lumen Works)', en: 'Diffusers batch 2 (Lumen Works)' }, start: week(-1), end: diffusersNew, ownerId: 'karim', lane: { fr: 'Usine', en: 'Factory' }, color: '#188038', progress: 40 },
        { id: 'tl-pilot', label: { fr: 'Pré-série 500 unités', en: 'Pilot run, 500 units' }, start: pilotRun, end: pilotRun + 6 * DAY, ownerId: 'karim', lane: { fr: 'Usine', en: 'Factory' }, color: '#188038', progress: 0 },
        { id: 'tl-firmware', label: { fr: 'Firmware 1.0', en: 'Firmware 1.0' }, start: week(0), end: week(3), ownerId: 'maya', lane: { fr: 'Produit', en: 'Product' }, color: '#8430ce', progress: 55 },
        { id: 'tl-preorders', label: { fr: 'Précommandes ouvertes', en: 'Preorders open' }, start: week(4), end: launch, ownerId: 'sofia', lane: { fr: 'Marketing', en: 'Marketing' }, color: '#d01884', progress: 0 },
        { id: 'tl-keynote', label: { fr: 'Keynote', en: 'Keynote' }, start: keynote, end: keynote, ownerId: 'sofia', lane: { fr: 'Marketing', en: 'Marketing' }, color: '#d01884', milestone: true },
        { id: 'tl-launch', label: { fr: 'Lancement et levée d’embargo', en: 'Launch & embargo lift' }, start: launch, end: launch, ownerId: 'alex', lane: { fr: 'Marketing', en: 'Marketing' }, color: '#0b57d0', milestone: true },
        { id: 'tl-shipping', label: { fr: 'Premières expéditions', en: 'First shipments' }, start: launch, end: week(8) + 4 * DAY, ownerId: 'karim', lane: { fr: 'Usine', en: 'Factory' }, color: '#188038', progress: 0 },
      ],
    },
    { id: 'aurora-todo', type: 'todo', span: 2, title: { fr: 'À faire', en: 'To do' }, todos },
    {
      id: 'aurora-chart', type: 'chart', span: 1, title: { fr: 'Budget engagé vs prévu', en: 'Committed vs planned' }, unit: 'k€',
      series: [
        { label: { fr: 'Outillage', en: 'Tooling' }, value: 118.5, target: 110 },
        { label: { fr: 'Électronique', en: 'Electronics' }, value: 61.2, target: 64 },
        { label: { fr: 'Diffuseurs', en: 'Diffusers' }, value: 45, target: 45 },
        { label: { fr: 'Shooting', en: 'Shoot' }, value: 38.2, target: 25 },
        { label: { fr: 'Packaging', en: 'Packaging' }, value: 31, target: 30 },
        { label: { fr: 'Keynote', en: 'Keynote' }, value: 21.5, target: 20 },
      ],
    },
    { id: 'aurora-files', type: 'files', span: 1, title: { fr: 'Fichiers', en: 'Files' }, artifactIds: ['a-doc-brief', 'a-sheet-budget', 'a-slides-keynote', 'a-pdf-diffuser'] },
    { id: 'aurora-people', type: 'people', span: 1, title: { fr: 'Équipe', en: 'Team' } },
    {
      id: 'aurora-calendar', type: 'calendar', span: 1, title: { fr: 'Prochains rendez-vous', en: 'Upcoming' },
      events: [
        { id: 'a-ev1', title: { fr: 'Histoire du design avec Nora', en: 'Design story with Nora' }, start: dayAt(1, 14), durationMin: 30, attendeeIds: ['tom', 'sofia', 'alex'] },
        { id: 'a-ev2', title: { fr: 'Point hebdo Aurora', en: 'Aurora weekly' }, start: dayAt(4, 16), durationMin: 45, attendeeIds: ['alex', 'maya', 'tom', 'sofia', 'karim', 'lea'] },
        { id: 'a-ev3', title: { fr: 'Lancement pré-série (Lumen Works)', en: 'Pilot run kickoff (Lumen Works)' }, start: pilotRun, durationMin: 60, attendeeIds: ['karim', 'maya'] },
      ],
    },
    { id: 'aurora-model', type: 'model3d', span: 1, title: { fr: 'Aurora, coloris Sable', en: 'Aurora, Sand colorway' }, model: 'lamp', caption: { fr: 'Rendu du gel de design. Base tournante, diffuseur opalin sans LED visible.', en: 'Design freeze render. Turning base, opal diffuser with no visible LED.' } },
    { id: 'aurora-notes', type: 'notes', span: 1, title: { fr: 'Questions ouvertes', en: 'Open questions' }, text: { fr: 'Un ou deux coloris au lancement ? (un, le second en janvier)\nQui parle à la keynote après Alex ? Tom pour le design, 4 minutes max.\nLe mode « nuit blanche » de Maya : pas pour la 1.0.', en: 'One or two colorways at launch? (one, the second in January)\nWho speaks at the keynote after Alex? Tom on design, 4 minutes max.\nMaya’s "all-nighter" mode: not for 1.0.' } },
  ]

  /* ---------------- messages (3 days, in order) ---------------- */
  const t = (id: string, authorId: string, at: number, text: L, extra: Partial<Message> = {}): Message => ({ id, kind: 'text', authorId, at, visibility: all, text, ...extra } as Message)

  const messages: Message[] = [
    // ---- three days ago
    t('a-m01', 'sofia', dayAt(-3, 9, 40), { fr: 'Première maquette de la page précommande sur le staging. @[Tom Laurent](tom) les photos Sable rendent vraiment bien en grand.', en: 'First cut of the preorder page is on staging. @[Tom Laurent](tom) the Sand photos look really good at full width.' }, { reactions: [{ emoji: '🔥', by: ['alex', 'maya', 'karim'] }] }),
    {
      id: 'a-m02', kind: 'file', authorId: 'tom', at: dayAt(-3, 10, 5), visibility: all, artifactId: 'a-slides-keynote',
      text: { fr: 'Keynote v1, 6 slides. La 4 est encore un cadre rouge, je sais.', en: 'Keynote v1, 6 slides. Slide 4 is still a red box, I know.' },
      replies: [
        t('a-m02-r1', 'maya', dayAt(-3, 10, 20), { fr: 'Les chiffres de la slide 2 viennent de l’ancienne étude. Je te passe les nouveaux demain.', en: 'The numbers on slide 2 come from the old study. I’ll send you the new ones tomorrow.' }),
        t('a-m02-r2', 'tom', dayAt(-3, 10, 22), { fr: 'Ok. Un deuxième cadre rouge alors.', en: 'Ok. A second red box then.' }),
      ],
    },
    {
      id: 'a-m03', kind: 'proposal', authorId: 'sofia', at: dayAt(-3, 11, 2), visibility: all, status: 'approved', decidedBy: 'alex',
      title: { fr: 'Ajouter un graphique budget', en: 'Add a budget chart' },
      description: { fr: 'Engagé vs prévu par poste, pour arrêter de rouvrir la feuille de Léa à chaque point.', en: 'Committed vs planned by item, so we stop reopening Léa’s sheet at every meeting.' },
      action: { type: 'add-block', block: blocks.find((b) => b.id === 'aurora-chart')! },
    },
    t('a-m04', 'karim', dayAt(-3, 14, 22), { fr: `Lumen Works confirme le créneau de pré-série : ${fmtDay(pilotRun, 'fr')}, 500 unités. Les diffuseurs du lot 2 doivent arriver le ${fmtDay(diffusersPlanned, 'fr')}, soit une semaine avant. Ça passe.`, en: `Lumen Works confirms the pilot run slot: ${fmtDay(pilotRun, 'en')}, 500 units. Batch 2 diffusers are due on ${fmtDay(diffusersPlanned, 'en')}, one week before. We’re fine.` }, { reactions: [{ emoji: '👍', by: ['alex', 'maya'] }] }),
    { id: 'a-m05', kind: 'meeting', authorId: 'alex', at: dayAt(-3, 15, 30), visibility: all, title: { fr: 'Point hebdo Aurora', en: 'Aurora weekly' }, start: dayAt(-3, 16), durationMin: 45, attendeeIds: ['alex', 'maya', 'tom', 'sofia', 'karim', 'lea'], ended: true },

    // ---- two days ago: the mail that changes everything
    t('a-m06', 'lea', dayAt(-2, 9, 15), { fr: 'Budget à jour. On est à 412 k€ engagés pour 400 k€ visés. Le shooting a coûté 13 k€ de plus que prévu, le reste tient.', en: 'Budget updated. We’re at 412k € committed against a 400k € target. The shoot came in 13k € over, everything else holds.' }, { reactions: [{ emoji: '👀', by: ['alex'] }] }),
    { id: 'a-m07', kind: 'file', authorId: 'lea', at: dayAt(-2, 9, 16), visibility: all, artifactId: 'a-sheet-budget', text: { fr: 'La feuille, avec un onglet par scénario.', en: 'The sheet, one tab per scenario.' } },
    {
      id: 'a-m08', kind: 'email', direction: 'in', authorId: 'jun', at: dayAt(-2, 11, 48), visibility: all,
      from: 'jun.park@lumenworks.example', to: 'aurora@oneplace.example', attachmentIds: ['a-pdf-diffuser'],
      subject: { fr: 'Diffuseurs lot 2 : nouvelle date de livraison', en: 'Diffuser batch 2: revised delivery date' },
      body: {
        fr: `Bonjour Alex, bonjour Karim,\n\nMauvaise nouvelle, je préfère vous l’écrire tout de suite. Le lot 2 de diffuseurs opalins (2 000 pièces) a échoué au contrôle de voile : 14 % des pièces sont entre 89 et 91 %, la spec demande 92 minimum. À l’œil ça ne se voit pas, mais sur la rampe de lever de soleil on devine les LED. On ne vous livrera pas ça.\n\nOn relance la série complète sur la presse 2 avec un contrôle à 100 %. Nouvelle date de livraison : ${fmtDay(diffusersNew, 'fr')} au lieu du ${fmtDay(diffusersPlanned, 'fr')}. Sept jours.\n\nLes 300 pièces conformes du lot 1 sont disponibles tout de suite si vous en avez besoin. Rapport et spec en pièce jointe.\n\nDésolé pour ce contretemps.\nJun`,
        en: `Hi Alex, hi Karim,\n\nBad news, and I’d rather write it straight away. Batch 2 of the opal diffusers (2,000 parts) failed the haze check: 14% of parts sit between 89 and 91%, the spec asks for 92 minimum. You cannot see it by eye, but on the sunrise ramp the LEDs show through. We won’t ship you that.\n\nWe are rerunning the full batch on press 2 with 100% inspection. New delivery date: ${fmtDay(diffusersNew, 'en')} instead of ${fmtDay(diffusersPlanned, 'en')}. Seven days.\n\nThe 300 compliant parts from batch 1 are available right now if you need them. Report and spec attached.\n\nSorry about this.\nJun`,
      },
      reactions: [{ emoji: '😬', by: ['karim', 'sofia', 'tom'] }],
      replies: [
        t('a-m08-r1', 'karim', dayAt(-2, 11, 55), { fr: 'Sept jours. C’est exactement la marge qu’on avait avant la pré-série.', en: 'Seven days. That is exactly the buffer we had before the pilot run.' }),
        t('a-m08-r2', 'maya', dayAt(-2, 11, 58), { fr: 'On peut faire la pré-série avec les 300 bonnes pièces du lot 1 ?', en: 'Can we run the pilot with the 300 good parts from batch 1?' }),
        t('a-m08-r3', 'karim', dayAt(-2, 12, 1), { fr: '300 ce n’est pas 500. Mais c’est une pré-série, pas une vente. Je regarde.', en: '300 is not 500. But it is a pilot, not a sale. Let me look.' }),
      ],
    },
    t('a-m09', 'gemini', dayAt(-2, 11, 52), { fr: `Pour info : le mail de Jun décale la livraison des diffuseurs au ${fmtDay(diffusersNew, 'fr')}. La pré-série démarre le lendemain. Il ne reste aucune marge. Je peux préparer les options avant l’appel si vous voulez.`, en: `Heads up: Jun’s mail moves the diffuser delivery to ${fmtDay(diffusersNew, 'en')}. The pilot run starts the next day. There is no buffer left. I can lay out the options before the call if you want.` }),
    t('a-m10', 'alex', dayAt(-2, 12, 3), { fr: 'Entre nous : c’est la deuxième fois que Lumen glisse en deux mois. On a un plan B sur les diffuseurs ?', en: 'Between us: that is the second time Lumen slips in two months. Do we have a plan B on diffusers?' }, { visibility: priv('alex', 'maya'), quoteId: 'a-m08' }),
    t('a-m11', 'maya', dayAt(-2, 12, 10), { fr: 'Pas vraiment. Orel Optics pourrait, mais avec 5 semaines de délai. Attendons l’appel de demain avant de paniquer. Et Jun a été honnête, ça compte.', en: 'Not really. Orel Optics could, but with a 5-week lead time. Let’s wait for tomorrow’s call before panicking. And Jun was honest about it, that counts.' }, { visibility: priv('alex', 'maya'), quoteId: 'a-m08' }),
    t('a-m12', 'alex', dayAt(-2, 12, 20), { fr: '@[Karim Haddad](karim) @[Maya Chen](maya) appel demain 10 h sur le retard Lumen, avec @[Léa Martin](lea) pour le budget. @[Sofia Reyes](sofia) j’ai besoin de savoir si l’embargo avec Nora peut bouger.', en: '@[Karim Haddad](karim) @[Maya Chen](maya) call tomorrow at 10 on the Lumen delay, with @[Léa Martin](lea) for the money side. @[Sofia Reyes](sofia) I need to know whether the embargo with Nora can move.' }),
    t('a-m13', 'sofia', dayAt(-2, 14, 30), { fr: 'Le papier de Nora est calé pour le matin du lancement. Si on bouge, je dois la prévenir cette semaine, elle a d’autres sujets derrière.', en: 'Nora’s piece is slotted for launch morning. If we move, I have to tell her this week, she has other pieces lined up.' }, { reactions: [{ emoji: '👍', by: ['alex'] }] }),
    // Tom and Maya, hidden from Alex (proves "view as Tom")
    t('a-m14', 'tom', dayAt(-2, 15, 40), { fr: 'Franchement, si le lancement décale d’une semaine, j’en profiterais pour refaire la notice dans la boîte. Ne le dis pas encore à Alex, il va dire que je rajoute du scope.', en: 'Honestly, if the launch moves a week I’d use it to redo the insert in the box. Don’t tell Alex yet, he’ll say I’m adding scope.' }, { visibility: priv('tom', 'maya') }),
    t('a-m15', 'maya', dayAt(-2, 15, 47), { fr: 'Ha. On verra ce que dit l’appel. Si ça bouge, je te soutiens sur la notice. La version actuelle ressemble à un mode d’emploi de micro-ondes.', en: 'Ha. Let’s see what the call says. If it moves, I’ll back you on the insert. The current one reads like a microwave manual.' }, { visibility: priv('tom', 'maya') }),
    {
      id: 'a-m16', kind: 'email', direction: 'out', authorId: 'alex', at: dayAt(-2, 17, 5), visibility: all,
      from: 'aurora@oneplace.example', to: 'jun.park@lumenworks.example',
      subject: { fr: 'Re : Diffuseurs lot 2 : nouvelle date de livraison', en: 'Re: Diffuser batch 2: revised delivery date' },
      body: {
        fr: `Bonjour Jun,\n\nMerci d’avoir prévenu tout de suite, et d’avoir refusé de livrer des pièces limites. On préfère ça.\n\nOui pour les 300 pièces du lot 1 : pouvez-vous les expédier par avion dès demain ? Karim vous envoie l’adresse et le compte transporteur.\n\nEt j’ai besoin que le ${fmtDay(diffusersNew, 'fr')} soit une date ferme. Si la presse 2 pose le moindre problème, dites-le nous le jour même, pas la semaine d’après.\n\nAlex`,
        en: `Hi Jun,\n\nThanks for telling us straight away, and for refusing to ship borderline parts. We’d rather have that.\n\nYes to the 300 parts from batch 1: can you ship them by air tomorrow? Karim will send the address and the carrier account.\n\nAnd I need ${fmtDay(diffusersNew, 'en')} to be a firm date. If press 2 gives you any trouble, tell us the same day, not the week after.\n\nAlex`,
      },
    },

    // ---- yesterday: the call and its consequences
    {
      id: 'a-m17', kind: 'call-summary', authorId: 'gemini', at: dayAt(-1, 10, 47), visibility: all,
      title: { fr: 'Retard Lumen : les options', en: 'Lumen delay: the options' }, durationMin: 42, attendeeIds: ['alex', 'maya', 'karim', 'lea'],
      summary: { fr: 'Karim a présenté les deux scénarios : tenir la date avec les 300 diffuseurs du lot 1 expédiés par avion, ou décaler le lancement de 7 jours. Léa chiffre le fret à environ 2 400 € et un décalage à 3 500 € (salle, revendeurs). Maya rappelle que le firmware 1.0 a besoin de la pré-série pour valider la rampe. Alex veut la confirmation ferme de Jun avant de trancher.', en: 'Karim walked through both scenarios: hold the date with the 300 batch 1 diffusers flown in, or move the launch by 7 days. Léa puts the air freight at about 2,400 € and a shift at 3,500 € (venue, retailers). Maya reminded everyone that firmware 1.0 needs the pilot run to validate the ramp. Alex wants Jun’s firm confirmation before deciding.' },
      decisions: [
        { fr: 'Les 300 diffuseurs conformes partent par avion, la pré-série tient sa date', en: 'The 300 compliant diffusers ship by air, the pilot run keeps its date' },
        { fr: 'Décision sur la date de lancement avant vendredi, une fois Jun confirmé', en: 'Launch date decision before Friday, once Jun confirms' },
        { fr: 'Sofia prévient Nora qu’un décalage d’une semaine est possible', en: 'Sofia tells Nora that a one-week shift is possible' },
      ],
      todoIds: ['a-t1', 'a-t2', 'a-t3', 'a-t4', 'a-t5', 'a-t6'],
    },
    {
      id: 'a-m18', kind: 'proposal', authorId: 'gemini', at: dayAt(-1, 10, 49), visibility: all, status: 'pending',
      title: { fr: 'Décaler le lancement de 7 jours', en: 'Move the launch by 7 days' },
      description: { fr: `D’après le mail de Jun et l’appel de ce matin, le lot 2 arrive le ${fmtDay(diffusersNew, 'fr')}. Le lancement du ${fmtDay(launch, 'fr')} garde une marge nulle. Je propose de déplacer le jalon « Lancement et levée d’embargo » au ${fmtDay(launch + 7 * DAY, 'fr')}. Rien d’autre ne bouge tant que vous ne validez pas.`, en: `Based on Jun’s mail and this morning’s call, batch 2 lands on ${fmtDay(diffusersNew, 'en')}. The ${fmtDay(launch, 'en')} launch keeps zero buffer. I suggest moving the "Launch & embargo lift" milestone to ${fmtDay(launch + 7 * DAY, 'en')}. Nothing else moves until you approve.` },
      action: { type: 'move-milestone', blockId: 'aurora-timeline', itemId: 'tl-launch', deltaDays: 7 },
    },
    {
      id: 'a-m19', kind: 'text', authorId: 'lea', at: dayAt(-1, 11, 30), visibility: all,
      text: { fr: 'Fret aérien pour les 300 pièces : 2 400 € environ. Ça pique, mais ça ne tue pas. Ligne ajoutée dans le budget.', en: 'Air freight for the 300 parts: about 2,400 €. It stings, but it won’t kill us. Line added to the budget.' },
      reactions: [{ emoji: '🙏', by: ['karim', 'alex'] }],
      replies: [
        t('a-m19-r1', 'karim', dayAt(-1, 11, 34), { fr: 'Le bateau c’était 380 €. Je dis ça, je dis rien.', en: 'Sea freight was 380 €. Just saying.' }),
        t('a-m19-r2', 'lea', dayAt(-1, 11, 35), { fr: 'Je sais, Karim.', en: 'I know, Karim.' }, { reactions: [{ emoji: '😂', by: ['maya', 'sofia', 'tom'] }] }),
      ],
    },
    { id: 'a-m20', kind: 'file', authorId: 'maya', at: dayAt(-1, 14, 12), visibility: all, artifactId: 'a-doc-brief', text: { fr: 'Brief de lancement mis à jour avec les deux scénarios. La section 4 est celle à lire.', en: 'Launch brief updated with both scenarios. Section 4 is the one to read.' }, reactions: [{ emoji: '👍', by: ['alex', 'sofia'] }] },
    t('a-m21', 'tom', dayAt(-1, 15, 30), { fr: 'Petite chose : il me faut toujours une décision sur le coloris du visuel héros. Sable ou Ardoise. Je ne peux pas continuer à rendre les deux.', en: 'Quick one: I still need a decision on the hero colorway. Sand or Slate. I can’t keep rendering both.' }, { reactions: [{ emoji: '😅', by: ['sofia'] }] }),
    {
      id: 'a-m22', kind: 'proposal', authorId: 'tom', at: dayAt(-1, 15, 34), visibility: all, status: 'pending',
      title: { fr: 'Ajouter un sondage sur le coloris', en: 'Add a poll on the colorway' },
      description: { fr: 'Un vote rapide sur le tableau pour trancher le visuel de la keynote. Je promets de respecter le résultat.', en: 'A quick vote on the board to settle the keynote hero. I promise to abide by the result.' },
      action: {
        type: 'add-block',
        block: {
          id: 'aurora-poll', type: 'poll', span: 1, title: { fr: 'Coloris du visuel keynote', en: 'Keynote hero colorway' },
          question: { fr: 'Quel coloris en grand sur scène ?', en: 'Which colorway goes big on stage?' },
          options: [
            { id: 'sand', label: { fr: 'Sable', en: 'Sand' }, votes: ['sofia', 'maya'] },
            { id: 'slate', label: { fr: 'Ardoise', en: 'Slate' }, votes: ['tom'] },
            { id: 'both', label: { fr: 'Les deux, côte à côte', en: 'Both, side by side' }, votes: [] },
          ],
        },
      },
    },
    {
      id: 'a-m23', kind: 'text', authorId: 'alex', at: dayAt(-1, 16, 2), visibility: priv('alex', 'gemini'),
      text: { fr: 'Entre nous : si on décale d’une semaine, qu’est-ce qu’on perd côté précommandes ?', en: 'Between us: if we move by a week, what do we lose on preorders?' },
      replies: [
        t('a-m23-r1', 'gemini', dayAt(-1, 16, 2, ) + 20_000, { fr: 'Pas grand-chose de définitif. Les précommandes n’ouvrent que dans 4 semaines, donc un décalage les déplace, il ne les supprime pas. Le vrai risque est l’embargo avec Nora : si son papier sort avant la date, l’effet de surprise est perdu. Sofia a noté qu’elle peut suivre si elle est prévenue avant lundi.', en: 'Not much that is permanent. Preorders only open in 4 weeks, so a shift moves them, it does not lose them. The real risk is the embargo with Nora: if her piece runs before the date, the surprise is gone. Sofia noted she can follow if told before Monday.' }, { visibility: priv('alex', 'gemini') }),
      ],
    },
    t('a-m24', 'sofia', dayAt(-1, 17, 20), { fr: 'J’ai eu Nora. Elle peut décaler son papier d’une semaine si on confirme avant lundi. Elle veut 20 minutes avec Tom sur l’histoire du design, je cale ça demain.', en: 'Spoke with Nora. She can move her piece by a week if we confirm before Monday. She wants 20 minutes with Tom about the design story, I’ll set it up for tomorrow.' }, { reactions: [{ emoji: '🙏', by: ['alex', 'tom'] }] }),

    // ---- today
    {
      id: 'a-m25', kind: 'email', direction: 'in', authorId: 'jun', at: dayAt(0, 8, 41), visibility: all,
      from: 'jun.park@lumenworks.example', to: 'aurora@oneplace.example',
      subject: { fr: 'Re : Diffuseurs lot 2 : nouvelle date de livraison', en: 'Re: Diffuser batch 2: revised delivery date' },
      body: { fr: `Bonjour Alex,\n\nLes 300 pièces du lot 1 sont parties ce matin par avion, lettre de transport envoyée à Karim. Livraison chez vous après-demain.\n\nLa presse 2 tourne depuis hier soir, les 200 premières pièces passent le voile à 93 et 94 %. Le ${fmtDay(diffusersNew, 'fr')} est ferme. S’il y a un souci, vous le saurez le jour même, promis.\n\nJun`, en: `Hi Alex,\n\nThe 300 batch 1 parts left this morning by air, airway bill sent to Karim. With you the day after tomorrow.\n\nPress 2 has been running since last night, the first 200 parts pass haze at 93 and 94%. ${fmtDay(diffusersNew, 'en')} is firm. If anything goes wrong you will know the same day, promise.\n\nJun` },
      reactions: [{ emoji: '🎉', by: ['karim', 'alex', 'maya'] }],
    },
    t('a-m26', 'karim', dayAt(0, 8, 55), { fr: 'Confirmé, les 300 sont dans l’avion. La pré-série garde son créneau. @[Alex Cormeraie](alex) la date de lancement est maintenant le seul sujet ouvert.', en: 'Confirmed, the 300 are in the air. The pilot run keeps its slot. @[Alex Cormeraie](alex) the launch date is now the only open item.' }),
    {
      id: 'a-m27', kind: 'text', authorId: 'alex', at: dayAt(0, 9, 12), visibility: all,
      text: { fr: 'Merci tout le monde. Je tranche sur la date avant ce soir. @[Léa Martin](lea) tu peux confirmer que le scénario +7 ne casse pas le plan de trésorerie du trimestre ?', en: 'Thanks everyone. I’ll decide on the date before tonight. @[Léa Martin](lea) can you confirm the +7 scenario doesn’t break the quarter’s cash plan?' },
      replies: [t('a-m27-r1', 'lea', dayAt(0, 9, 18), { fr: 'Je regarde. Donne-moi une heure.', en: 'Looking. Give me an hour.' })],
    },
    { id: 'a-m28', kind: 'meeting', authorId: 'sofia', at: dayAt(0, 9, 30), visibility: all, title: { fr: 'Histoire du design avec Nora', en: 'Design story with Nora' }, start: dayAt(1, 14), durationMin: 30, attendeeIds: ['tom', 'sofia', 'alex'], guestEmails: ['nora@weiss-writes.example'] },
    {
      id: 'a-m29', kind: 'text', authorId: 'maya', at: dayAt(0, 9, 40), visibility: all,
      text: { fr: 'J’ai testé le firmware 0.9.3 toute la nuit sur mon unité. La rampe de lever de soleil est enfin douce. L’alarme sonne encore avec 1 minute de retard par contre.', en: 'Ran firmware 0.9.3 on my unit all night. The sunrise ramp is finally smooth. The alarm still fires 1 minute late though.' },
      reactions: [{ emoji: '☀️', by: ['tom', 'sofia', 'karim'] }],
      replies: [
        t('a-m29-r1', 'tom', dayAt(0, 9, 44), { fr: 'C’est une fonctionnalité, non ? Un snooze avant le snooze.', en: 'Is that a feature? A snooze before the snooze.' }),
        t('a-m29-r2', 'maya', dayAt(0, 9, 45), { fr: 'Non, Tom.', en: 'No, Tom.' }),
      ],
    },
    { id: 'a-m30', kind: 'system', authorId: 'gemini', at: dayAt(0, 9, 46), visibility: all, icon: 'auto_awesome', text: { fr: 'Gemini a mis à jour « Où on en est » à partir des 12 derniers messages.', en: 'Gemini updated "Where things stand" from the last 12 messages.' } },
    t('a-m31', 'sofia', dayAt(0, 10, 20), { fr: 'Le texte de la page précommande est dans le brief, section 5. Toujours « Aurora vous réveille en douceur » contre « Réveillez-vous à vos conditions ». Je préfère la première. Avis ?', en: 'The preorder page copy is in the brief, section 5. Still "Aurora wakes you gently" vs "Wake up on your terms". I prefer the first. Thoughts?' }, { reactions: [{ emoji: '✨', by: ['maya', 'lea'] }, { emoji: '🤔', by: ['tom'] }] }),
    t('a-m32', 'alex', dayAt(0, 10, 35), { fr: 'Le sondage de Tom : si je l’approuve, on va finir avec « les deux », non ? On ne peut pas sortir deux références le premier jour.', en: 'Tom’s poll: if I approve it, we end up with "both", don’t we? We can’t ship two SKUs on day one.' }, { visibility: priv('alex', 'maya'), quoteId: 'a-m22' }),
    t('a-m33', 'maya', dayAt(0, 10, 41), { fr: 'On finira avec Sable. Tom le sait déjà. Laisse-lui son sondage, ça ne coûte rien et ça lui fera plaisir.', en: 'We’ll end up with Sand. Tom already knows. Let him have his poll, it costs nothing and it will make him happy.' }, { visibility: priv('alex', 'maya'), quoteId: 'a-m22' }),
  ]

  /* ---------------- script ---------------- */
  const script: ProjectScript = {
    callTitle: { fr: 'Date de lancement : on tranche', en: 'Launch date: let’s decide' },
    captions: [
      { who: 'alex', text: { fr: 'Bon, tout le monde est là ? Karim, tu nous refais le point en une minute.', en: 'Right, everyone here? Karim, give us the picture in one minute.' } },
      { who: 'karim', text: { fr: `Les 300 diffuseurs du lot 1 arrivent après-demain. La pré-série du ${fmtDay(pilotRun, 'fr')} tient. Le lot 2 est ferme au ${fmtDay(diffusersNew, 'fr')}, Jun l’a écrit ce matin.`, en: `The 300 batch 1 diffusers land the day after tomorrow. The ${fmtDay(pilotRun, 'en')} pilot run holds. Batch 2 is firm for ${fmtDay(diffusersNew, 'en')}, Jun wrote it this morning.` } },
      { who: 'maya', text: { fr: 'Donc techniquement on peut tenir la date. Avec zéro marge. Si une seule pièce foire sur la presse 2, on est à sec.', en: 'So technically we can hold the date. With zero buffer. If one thing goes wrong on press 2, we’re dry.' } },
      { who: 'lea', text: { fr: 'Le décalage coûte 3 500 €. La salle de la keynote est flexible, c’est surtout les revendeurs qu’il faut rappeler.', en: 'The shift costs 3,500 €. The keynote venue is flexible, it’s mostly the retailers we need to call back.' } },
      { who: 'sofia', text: { fr: 'Nora suit si on lui dit avant lundi. Après lundi, son papier part sur un autre sujet et on la perd pour deux mois.', en: 'Nora follows if we tell her before Monday. After Monday her piece goes to another topic and we lose her for two months.' } },
      { who: 'tom', text: { fr: 'Moi je prends la semaine. Je refais la notice dans la boîte, celle d’aujourd’hui ressemble à un mode d’emploi de micro-ondes.', en: 'I’ll take the week. I’ll redo the insert in the box, the current one reads like a microwave manual.' } },
      { who: 'alex', text: { fr: 'Tom, c’est noté, on en reparle. Karim, ton avis franc : on tient ou on décale ?', en: 'Tom, noted, we’ll come back to that. Karim, your honest take: hold or move?' } },
      { who: 'karim', text: { fr: 'On décale. Je préfère livrer une semaine plus tard que livrer des lampes où on voit les LED.', en: 'We move. I’d rather ship a week late than ship lamps where you can see the LEDs.' } },
      { who: 'maya', text: { fr: 'Pareil. Et ça me donne la pré-série complète pour valider le firmware.', en: 'Same. And it gives me the full pilot run to validate the firmware.' } },
      { who: 'alex', text: { fr: `Ok. On décale de sept jours. Lancement le ${fmtDay(launch + 7 * DAY, 'fr')}. Sofia, tu appelles Nora aujourd’hui. Léa, tu passes le scénario B en budget de référence.`, en: `Ok. We move by seven days. Launch on ${fmtDay(launch + 7 * DAY, 'en')}. Sofia, you call Nora today. Léa, scenario B becomes the reference budget.` } },
      { who: 'sofia', text: { fr: 'Je l’appelle en sortant. Et je demande à Tom de lui garder ses 20 minutes demain.', en: 'Calling her right after this. And Tom keeps his 20 minutes with her tomorrow.' } },
      { who: 'alex', text: { fr: 'Parfait. Gemini, tu résumes et tu mets les actions sur le tableau. Merci tout le monde.', en: 'Perfect. Gemini, summarize and put the actions on the board. Thanks everyone.' } },
    ],
    callSummary: {
      summary: { fr: `Après le point de Karim (300 diffuseurs en route, lot 2 ferme au ${fmtDay(diffusersNew, 'fr')}), l’équipe a choisi de décaler le lancement de sept jours plutôt que de tenir une date sans marge. Léa confirme un surcoût de 3 500 €. Sofia prévient Nora aujourd’hui pour garder l’embargo. Tom utilisera la semaine pour refaire la notice.`, en: `After Karim’s update (300 diffusers on the way, batch 2 firm for ${fmtDay(diffusersNew, 'en')}), the team chose to move the launch by seven days rather than hold a date with no buffer. Léa confirms a 3,500 € extra cost. Sofia tells Nora today to keep the embargo. Tom will use the week to redo the box insert.` },
      decisions: [
        { fr: `Lancement décalé de 7 jours, au ${fmtDay(launch + 7 * DAY, 'fr')}`, en: `Launch moved by 7 days, to ${fmtDay(launch + 7 * DAY, 'en')}` },
        { fr: 'Le scénario B devient le budget de référence (+3 500 €)', en: 'Scenario B becomes the reference budget (+3,500 €)' },
        { fr: 'Un seul coloris au lancement : Sable', en: 'One colorway at launch: Sand' },
      ],
      todos: [
        { text: { fr: 'Appeler Nora et confirmer la nouvelle date d’embargo', en: 'Call Nora and confirm the new embargo date' }, assigneeId: 'sofia' },
        { text: { fr: 'Déplacer la salle de la keynote d’une semaine', en: 'Rebook the keynote venue one week later' }, assigneeId: 'sofia' },
        { text: { fr: 'Prévenir les revendeurs de la nouvelle date', en: 'Tell the retailers about the new date' }, assigneeId: 'karim' },
        { text: { fr: 'Passer le scénario B en budget de référence', en: 'Make scenario B the reference budget' }, assigneeId: 'lea' },
        { text: { fr: 'Nouvelle notice pour la boîte, 2 pages max', en: 'New box insert, 2 pages max' }, assigneeId: 'tom' },
      ],
    },
    catchUp: {
      text: { fr: 'Depuis votre dernier passage : Jun a confirmé par mail que les 300 diffuseurs sont partis par avion et que le lot 2 est ferme. La pré-série tient. Deux propositions attendent votre décision sur le tableau.', en: 'Since you were last here: Jun confirmed by mail that the 300 diffusers left by air and that batch 2 is firm. The pilot run holds. Two proposals are waiting for your decision.' },
      bullets: [
        { fr: 'Proposition de Gemini : décaler le jalon de lancement de 7 jours', en: 'Gemini’s proposal: move the launch milestone by 7 days' },
        { fr: 'Proposition de Tom : un sondage sur le coloris du visuel keynote', en: 'Tom’s proposal: a poll on the keynote hero colorway' },
        { fr: 'Léa vérifie que le scénario +7 passe en trésorerie (réponse dans l’heure)', en: 'Léa is checking that the +7 scenario fits the cash plan (answer within the hour)' },
        { fr: 'Demain 14 h : Nora rencontre Tom pour l’histoire du design', en: 'Tomorrow 2 pm: Nora meets Tom for the design story' },
      ],
    },
    privateReplies: {
      maya: [
        { fr: 'Oui, je suis d’accord. Je te prépare un paragraphe pour l’annonce de la nouvelle date.', en: 'Yes, agreed. I’ll draft you a paragraph for the new-date announcement.' },
        { fr: 'Entre nous, Tom a raison sur la notice. Mais pas un mot avant la décision.', en: 'Between us, Tom is right about the insert. But not a word before the decision.' },
        { fr: 'Je peux prendre l’appel avec Jun si tu veux rester sur la keynote.', en: 'I can take the call with Jun if you want to stay on the keynote.' },
      ],
      tom: [
        { fr: 'Ha, je savais que tu verrais le sondage. Promis, je respecte le vote.', en: 'Ha, I knew you’d see the poll. Promise, I’ll respect the vote.' },
        { fr: 'Sable. Si tu me demandes, c’est Sable. L’Ardoise rend mal sous les projecteurs.', en: 'Sand. If you ask me, it’s Sand. Slate looks muddy under stage lights.' },
        { fr: 'Je t’envoie le rendu de la notice ce soir, tu me diras si c’est trop.', en: 'I’ll send you the insert render tonight, tell me if it’s too much.' },
      ],
      sofia: [
        { fr: 'Nora est ok, je viens de raccrocher. Elle garde l’embargo.', en: 'Nora is fine with it, just hung up. She keeps the embargo.' },
        { fr: 'Pour la salle, La Halle Verte a le créneau une semaine plus tard. Je confirme ?', en: 'For the venue, La Halle Verte has the slot one week later. Shall I confirm?' },
        { fr: 'Je garde « en douceur ». Tom boudera deux jours, ça lui passera.', en: 'I’m keeping "gently". Tom will sulk for two days, he’ll get over it.' },
      ],
      karim: [
        { fr: 'Lettre de transport reçue, les 300 pièces arrivent après-demain à 11 h.', en: 'Airway bill received, the 300 parts land the day after tomorrow at 11.' },
        { fr: 'Je rappelle les revendeurs demain matin, les trois gros d’abord.', en: 'I’ll call the retailers tomorrow morning, the three big ones first.' },
        { fr: 'Pour la prochaine fois, je demande à Lumen un rapport de contrôle à chaque lot. On aurait vu venir.', en: 'Next time I’m asking Lumen for an inspection report on every batch. We would have seen it coming.' },
      ],
      lea: [
        { fr: 'Trésorerie ok pour +7. On passe de 412 à 415,7 k€, la réserve absorbe.', en: 'Cash plan is fine for +7. We go from 412 to 415.7k €, contingency absorbs it.' },
        { fr: 'Je mets à jour la feuille dans l’heure et je ferme l’onglet scénario A.', en: 'I’ll update the sheet within the hour and close the scenario A tab.' },
        { fr: 'Le shooting, on en reparle au prochain projet. Pas de 13 k€ surprise deux fois.', en: 'The shoot, we talk about it on the next project. No 13k € surprise twice.' },
      ],
      gemini: [
        { fr: 'Je peux rédiger l’annonce de la nouvelle date pour l’équipe, en deux lignes. Vous voulez que je m’en occupe ?', en: 'I can draft the new-date announcement for the team, two lines. Want me to take it?' },
        { fr: 'Le scénario +7 touche trois jalons : lancement, levée d’embargo, premières expéditions. Je les décale ensemble si vous approuvez.', en: 'The +7 scenario touches three milestones: launch, embargo lift, first shipments. I’ll move them together if you approve.' },
      ],
    },
  }

  const sorted = [...messages].sort((a, b) => a.at - b.at)
  return {
    id: 'aurora', name: { fr: 'Lancement Aurora', en: 'Aurora launch' }, icon: 'lightbulb', color: '#f29900',
    description: { fr: `Lampe de chevet qui réveille par la lumière. Lancement ${wd(launch).fr} ${d(launch).fr}.`, en: `Bedside lamp that wakes you with light. Launch ${wd(launch).en} ${d(launch).en}.` },
    ownerId: 'alex', memberIds: ['alex', 'maya', 'tom', 'sofia', 'karim', 'lea'], externalIds: ['jun', 'nora'],
    unread: 0, mentions: 0, messages: sorted, blocks, artifacts, script, address: 'aurora@oneplace.example',
  }
}
