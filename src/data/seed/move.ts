import type { Artifact, Block, L, Message, Project, ProjectScript, Todo, Visibility } from '../types'
import { DAY, dayAt, fmtDay, week } from './time'

const all: Visibility = { type: 'all' }
const priv = (...ids: string[]): Visibility => ({ type: 'private', with: ids })

export function move(): Project {
  const keys = week(1) + 2 * DAY // wednesday next week
  const moveDay = week(3) + 5 * DAY // a saturday
  const firstDay = week(4)
  const furniture = week(2) + 3 * DAY
  const t = (id: string, authorId: string, at: number, text: L, extra: Partial<Message> = {}): Message => ({ id, kind: 'text', authorId, at, visibility: all, text, ...extra } as Message)

  const todos: Todo[] = [
    { id: 'mv-t1', text: { fr: 'Envoyer l’attestation d’assurance au propriétaire', en: 'Send the insurance certificate to the landlord' }, assigneeId: 'lea', due: dayAt(-2, 18), done: true, source: { fr: 'Bail', en: 'Lease' } },
    { id: 'mv-t2', text: { fr: 'Signer le devis Fauvel (emballage inclus)', en: 'Sign the Fauvel quote (packing included)' }, assigneeId: 'karim', due: dayAt(-1, 18), done: true, source: { fr: 'Décision d’Alex', en: 'Alex’s decision' } },
    { id: 'mv-t3', text: { fr: 'Commander la box 4G en attendant la fibre', en: 'Order the 4G box while we wait for fiber' }, assigneeId: 'karim', due: dayAt(2, 18), done: false, source: { fr: 'Retard opérateur', en: 'Carrier delay' } },
    { id: 'mv-t4', text: { fr: 'Prévenir les voisins du 3e pour l’ascenseur samedi', en: 'Warn the 3rd-floor neighbours about the lift on Saturday' }, assigneeId: 'sofia', due: dayAt(5, 18), done: false },
    { id: 'mv-t5', text: { fr: 'Changer l’adresse du siège (greffe, banque, assurance)', en: 'Update the registered address (registry, bank, insurance)' }, assigneeId: 'lea', due: firstDay, done: false },
    { id: 'mv-t6', text: { fr: 'Trier la salle d’archives : on ne déménage pas 14 cartons de 2019', en: 'Sort the archive room: we are not moving 14 boxes from 2019' }, assigneeId: 'alex', due: week(2), done: false },
    { id: 'mv-t8', text: { fr: 'Confirmer le créneau de livraison du mobilier avec Delta', en: 'Confirm the furniture delivery slot with Delta' }, assigneeId: 'alex', due: dayAt(-1, 18), done: false, source: { fr: 'Plan de déménagement', en: 'Move plan' } },
    { id: 'mv-t7', text: { fr: 'Étiquettes couleur par équipe pour les cartons', en: 'Colour labels per team for the boxes' }, assigneeId: 'sofia', due: week(2) + 2 * DAY, done: false },
  ]

  const artifacts: Artifact[] = [{
    id: 'mv-doc-plan', kind: 'doc', title: { fr: 'Plan de déménagement', en: 'Move plan' }, ownerId: 'karim', updatedAt: dayAt(-5, 10, 30),
    sections: [
      { heading: { fr: 'Le nouveau bureau', en: 'The new office' }, body: { fr: '310 m² au 3e étage, passage des Lilas, Paris 11e. Un plateau ouvert, deux salles de réunion, une cabine téléphonique, une vraie cuisine. Un mur de 9 mètres sans fenêtre pour Sofia. Bail de 6 ans, loyer 7 200 € HT par mois, 3 mois de dépôt.', en: '310 sq m on the 3rd floor, passage des Lilas, Paris 11th. One open floor, two meeting rooms, a phone booth, a real kitchen. A 9-metre windowless wall for Sofia. 6-year lease, 7,200 € per month before tax, 3 months’ deposit.' } },
      { heading: { fr: 'Calendrier', en: 'Schedule' }, body: { fr: `Clés le ${fmtDay(keys, 'fr')}. Peinture et câblage la semaine suivante. Mobilier livré le ${fmtDay(furniture, 'fr')}. Déménagement le samedi ${fmtDay(moveDay, 'fr')} avec Fauvel. Premier jour sur place le lundi ${fmtDay(firstDay, 'fr')}. Fibre : trois semaines après, d’où la box 4G.`, en: `Keys on ${fmtDay(keys, 'en')}. Painting and cabling the following week. Furniture delivered ${fmtDay(furniture, 'en')}. Move on Saturday ${fmtDay(moveDay, 'en')} with Fauvel. First day on site Monday ${fmtDay(firstDay, 'en')}. Fiber: three weeks later, hence the 4G box.` } },
      { heading: { fr: 'Mobilier', en: 'Furniture' }, body: { fr: '18 bureaux assis-debout Mobilier Delta (modèle Pont, chêne clair), 18 fauteuils, 2 tables de réunion, 6 casiers. On garde les lampes et les plantes. On abandonne la table de ping-pong, personne n’y joue depuis 2023.', en: '18 Mobilier Delta sit-stand desks (Pont model, light oak), 18 chairs, 2 meeting tables, 6 lockers. We keep the lamps and the plants. We leave the ping-pong table behind, nobody has played since 2023.' } },
      { heading: { fr: 'Ce qui peut mal tourner', en: 'What can go wrong' }, body: { fr: 'L’ascenseur du passage des Lilas est petit : les tables de réunion montent par l’escalier. Pas de fibre pendant trois semaines. Le déménagement tombe pendant la pré-série Aurora : Karim sera à moitié chez Lumen Works.', en: 'The lift at passage des Lilas is small: the meeting tables go up the stairs. No fiber for three weeks. The move lands during the Aurora pilot run: Karim will be half at Lumen Works.' } },
    ],
  }]

  const blocks: Block[] = [
    {
      id: 'move-summary', type: 'summary', span: 3, title: { fr: 'Où on en est', en: 'Where things stand' }, updatedAt: dayAt(0, 8, 30),
      text: { fr: `Bail signé, clés le ${fmtDay(keys, 'fr')}, déménagement le samedi ${fmtDay(moveDay, 'fr')} avec Fauvel. Seule mauvaise surprise : la fibre arrive trois semaines après l’emménagement, Karim commande une box 4G.`, en: `Lease signed, keys on ${fmtDay(keys, 'en')}, move on Saturday ${fmtDay(moveDay, 'en')} with Fauvel. Only bad surprise: fiber lands three weeks after we do, Karim is ordering a 4G box.` },
      bullets: [
        { fr: 'Visite du site dans 2 jours pour choisir les postes', en: 'Site visit in 2 days to pick seats' },
        { fr: 'Dépôt de garantie viré (21 600 €)', en: 'Deposit wired (21,600 €)' },
        { fr: 'Sofia prend le mur de 9 mètres pour Aurora', en: 'Sofia takes the 9-metre wall for Aurora' },
      ],
    },
    {
      id: 'move-timeline', type: 'timeline', span: 3, title: { fr: 'Calendrier', en: 'Timeline' },
      items: [
        { id: 'mv-tl1', label: { fr: 'Signature du bail', en: 'Lease signed' }, start: dayAt(-5, 9), end: dayAt(-5, 9), ownerId: 'alex', lane: { fr: 'Admin', en: 'Admin' }, color: '#0b57d0', milestone: true },
        { id: 'mv-tl2', label: { fr: 'Remise des clés', en: 'Keys handed over' }, start: keys, end: keys, ownerId: 'karim', lane: { fr: 'Admin', en: 'Admin' }, color: '#0b57d0', milestone: true },
        { id: 'mv-tl3', label: { fr: 'Peinture et câblage', en: 'Painting & cabling' }, start: keys + DAY, end: week(2) + 2 * DAY, ownerId: 'karim', lane: { fr: 'Travaux', en: 'Works' }, color: '#188038', progress: 0 },
        { id: 'mv-tl4', label: { fr: 'Fibre (opérateur)', en: 'Fiber (carrier)' }, start: week(1), end: week(7), ownerId: 'karim', lane: { fr: 'Travaux', en: 'Works' }, color: '#e37400', progress: 10 },
        { id: 'mv-tl5', label: { fr: 'Livraison mobilier', en: 'Furniture delivery' }, start: furniture, end: furniture, ownerId: 'karim', lane: { fr: 'Mobilier', en: 'Furniture' }, color: '#8430ce', milestone: true },
        { id: 'mv-tl6', label: { fr: 'Cartons et tri', en: 'Packing & sorting' }, start: week(2), end: moveDay - DAY, ownerId: 'sofia', lane: { fr: 'Équipe', en: 'Team' }, color: '#d01884', progress: 0 },
        { id: 'mv-tl7', label: { fr: 'Déménagement (Fauvel)', en: 'Move day (Fauvel)' }, start: moveDay, end: moveDay, ownerId: 'karim', lane: { fr: 'Équipe', en: 'Team' }, color: '#b3261e', milestone: true },
        { id: 'mv-tl8', label: { fr: 'Premier jour passage des Lilas', en: 'First day at passage des Lilas' }, start: firstDay, end: firstDay, ownerId: 'alex', lane: { fr: 'Équipe', en: 'Team' }, color: '#0b57d0', milestone: true },
      ],
    },
    { id: 'move-todo', type: 'todo', span: 1, title: { fr: 'À faire', en: 'To do' }, todos },
    { id: 'move-model', type: 'model3d', span: 1, title: { fr: 'Bureau Pont, chêne clair', en: 'Pont desk, light oak' }, model: 'desk', caption: { fr: '18 exemplaires, assis-debout. Le modèle choisi lors de la visite du showroom.', en: '18 units, sit-stand. The model picked at the showroom visit.' } },
    { id: 'move-files', type: 'files', span: 1, title: { fr: 'Fichiers', en: 'Files' }, artifactIds: ['mv-doc-plan'] },
    { id: 'move-people', type: 'people', span: 1, title: { fr: 'Équipe', en: 'Team' } },
  ]

  const messages: Message[] = [
    t('mv-m01', 'karim', dayAt(-5, 10, 12), { fr: `Bail signé ce matin. Clés le ${fmtDay(keys, 'fr')}. Le plan est dans les fichiers, avec les photos du plateau vide.`, en: `Lease signed this morning. Keys on ${fmtDay(keys, 'en')}. The plan is in files, with photos of the empty floor.` }, { reactions: [{ emoji: '🎉', by: ['alex', 'sofia', 'lea'] }] }),
    { id: 'mv-m02', kind: 'file', authorId: 'karim', at: dayAt(-5, 10, 30), visibility: all, artifactId: 'mv-doc-plan', text: { fr: 'Le plan, 4 sections. La dernière s’appelle « ce qui peut mal tourner », lisez-la.', en: 'The plan, 4 sections. The last one is called "what can go wrong", read it.' } },
    t('mv-m03', 'lea', dayAt(-4, 9, 5), { fr: 'Dépôt de garantie viré : 3 mois, 21 600 €. Le propriétaire veut une attestation d’assurance avant de donner les clés, je m’en occupe.', en: 'Deposit wired: 3 months, 21,600 €. The landlord wants an insurance certificate before handing over the keys, I’m on it.' }),
    {
      id: 'mv-m04', kind: 'text', authorId: 'karim', at: dayAt(-3, 11, 40), visibility: all,
      text: { fr: 'Deux devis déménageurs. Fauvel : 6 800 €, ils emballent tout. Transbox : 5 200 €, on emballe nous-mêmes. @[Alex Cormeraie](alex) à toi.', en: 'Two mover quotes. Fauvel: 6,800 €, they pack everything. Transbox: 5,200 €, we pack ourselves. @[Alex Cormeraie](alex) your call.' },
      replies: [
        t('mv-m04-r1', 'sofia', dayAt(-3, 11, 48), { fr: '« On emballe nous-mêmes » : je connais la fin de l’histoire, c’est moi qui emballe.', en: '"We pack ourselves": I know how that story ends, I pack.' }),
        t('mv-m04-r2', 'lea', dayAt(-3, 11, 52), { fr: 'Je vote Fauvel. 1 600 € pour ne pas avoir Sofia en colère, c’est donné.', en: 'I vote Fauvel. 1,600 € to not have an angry Sofia is a bargain.' }, { reactions: [{ emoji: '😂', by: ['karim', 'alex'] }] }),
      ],
    },
    t('mv-m05', 'alex', dayAt(-3, 14, 2), { fr: 'Fauvel. Karim, tu signes.', en: 'Fauvel. Karim, sign it.' }, { reactions: [{ emoji: '👍', by: ['karim', 'sofia'] }] }),
    t('mv-m06', 'sofia', dayAt(-2, 16, 15), { fr: 'Il me faut un vrai mur pour la timeline Aurora et les prototypes. Pas un couloir. Je prends celui de 9 mètres en face de la cuisine, sauf objection avant vendredi.', en: 'I need a real wall for the Aurora timeline and the prototypes. Not a corridor. I’m taking the 9-metre one opposite the kitchen unless someone objects before Friday.' }, { reactions: [{ emoji: '🙌', by: ['alex'] }] }),
    {
      id: 'mv-m07', kind: 'text', authorId: 'karim', at: dayAt(-1, 9, 30), visibility: all,
      text: { fr: 'Mauvaise nouvelle fibre : l’opérateur annonce 3 semaines après l’emménagement. Je commande une box 4G en attendant, 89 € par mois.', en: 'Bad news on fiber: the carrier says 3 weeks after we move in. I’m ordering a 4G box in the meantime, 89 € a month.' },
      replies: [
        t('mv-m07-r1', 'lea', dayAt(-1, 9, 41), { fr: 'Sans engagement ?', en: 'No contract?' }),
        t('mv-m07-r2', 'karim', dayAt(-1, 9, 42), { fr: 'Sans engagement.', en: 'No contract.' }),
      ],
    },
    t('mv-m08', 'gemini', dayAt(-1, 9, 45), { fr: 'J’ai ajouté la fibre au calendrier (livraison estimée 3 semaines après l’emménagement) et une tâche « box 4G » pour Karim.', en: 'I added fiber to the timeline (estimated 3 weeks after move-in) and a "4G box" task for Karim.' }),
    { id: 'mv-m09', kind: 'meeting', authorId: 'alex', at: dayAt(-1, 15, 10), visibility: all, title: { fr: 'Visite du site : qui s’assoit où', en: 'Site visit: who sits where' }, start: dayAt(2, 11), durationMin: 60, attendeeIds: ['alex', 'karim', 'sofia', 'lea'] },
    t('mv-m10', 'karim', dayAt(0, 8, 20), { fr: `Le bureau qu’on a choisi est sur le tableau, en 3D. 18 pièces, livrées le ${fmtDay(furniture, 'fr')}. Le chêne clair, pas le blanc, on avait voté.`, en: `The desk we picked is on the board, in 3D. 18 units, delivered ${fmtDay(furniture, 'en')}. Light oak, not white, we voted.` }),
    t('mv-m11', 'alex', dayAt(0, 9, 50), { fr: 'Karim, la salle d’archives : je m’en occupe ce week-end. Si quelqu’un tient à ses cartons de 2019, qu’il parle maintenant.', en: 'Karim, the archive room: I’ll do it this weekend. If anyone is attached to their 2019 boxes, speak now.' }, { reactions: [{ emoji: '🫡', by: ['karim', 'lea'] }] }),
    t('mv-m12', 'lea', dayAt(0, 10, 5), { fr: 'Les cartons « compta 2019 » restent. Légalement, 10 ans. Désolée.', en: 'The "accounts 2019" boxes stay. Legally, 10 years. Sorry.' }, { visibility: priv('lea', 'alex') }),
  ]

  const script: ProjectScript = {
    callTitle: { fr: 'Visite du site : qui s’assoit où', en: 'Site visit: who sits where' },
    captions: [
      { who: 'karim', text: { fr: 'Bon, on est sur le plateau. Les fenêtres sont au nord, donc pas de soleil sur les écrans, c’est bien.', en: 'Right, we’re on the floor. Windows face north, so no sun on the screens, good.' } },
      { who: 'sofia', text: { fr: 'Mon mur est là. Neuf mètres. Ne mettez pas de casiers devant.', en: 'My wall is here. Nine metres. Do not put lockers in front of it.' } },
      { who: 'alex', text: { fr: 'Les casiers vont près de l’entrée. Léa, la finance près de la cabine téléphonique, c’est ce que tu voulais ?', en: 'Lockers go by the entrance. Léa, finance next to the phone booth, is that what you wanted?' } },
      { who: 'lea', text: { fr: 'Oui. J’ai des appels avec la banque, je ne veux pas que tout le monde connaisse notre trésorerie.', en: 'Yes. I have calls with the bank, I don’t want the whole floor knowing our cash position.' } },
      { who: 'karim', text: { fr: 'Problème : l’ascenseur fait 1,10 m de profondeur. Les tables de réunion ne rentrent pas. Elles montent par l’escalier.', en: 'Problem: the lift is 1.10 m deep. The meeting tables don’t fit. They go up the stairs.' } },
      { who: 'sofia', text: { fr: 'Fauvel est prévenu ? Parce que « emballage inclus » ne veut pas dire « escalier inclus ».', en: 'Does Fauvel know? Because "packing included" does not mean "stairs included".' } },
      { who: 'karim', text: { fr: 'Je les appelle en sortant. Ça peut faire 300 € de plus.', en: 'I’ll call them after this. Could be 300 € more.' } },
      { who: 'alex', text: { fr: 'Ok pour 300. Autre chose : la cuisine. Qui prend la machine à café ? Pas moi.', en: 'Fine for 300. One more thing: the kitchen. Who takes the coffee machine? Not me.' } },
      { who: 'lea', text: { fr: 'Elle vient avec Fauvel, dans un carton à part, étiquette rouge. Je l’ai déjà écrit sur le plan.', en: 'It goes with Fauvel, in its own box, red label. I already wrote that in the plan.' } },
      { who: 'alex', text: { fr: 'Parfait. Gemini, tu notes : tables par l’escalier, +300 € Fauvel, casiers à l’entrée. On y va.', en: 'Perfect. Gemini, note it down: tables by the stairs, +300 € Fauvel, lockers at the entrance. Let’s go.' } },
    ],
    callSummary: {
      summary: { fr: 'Visite du plateau. Plan des postes validé : marketing côté mur de 9 mètres, finance près de la cabine, casiers à l’entrée. Les tables de réunion monteront par l’escalier (ascenseur trop petit), Karim renégocie avec Fauvel. La machine à café voyage dans un carton à part.', en: 'Floor visit. Seating plan approved: marketing by the 9-metre wall, finance next to the phone booth, lockers at the entrance. Meeting tables go up the stairs (lift too small), Karim renegotiates with Fauvel. The coffee machine travels in its own box.' },
      decisions: [
        { fr: 'Plan des postes validé tel que visité', en: 'Seating plan approved as walked through' },
        { fr: 'Jusqu’à 300 € de plus pour Fauvel (escalier)', en: 'Up to 300 € more for Fauvel (stairs)' },
      ],
      todos: [
        { text: { fr: 'Prévenir Fauvel pour les tables par l’escalier', en: 'Tell Fauvel about the tables going up the stairs' }, assigneeId: 'karim' },
        { text: { fr: 'Dessiner le plan des postes dans le doc', en: 'Draw the seating plan in the doc' }, assigneeId: 'sofia' },
        { text: { fr: 'Commander les étiquettes couleur', en: 'Order the colour labels' }, assigneeId: 'sofia' },
      ],
    },
    catchUp: {
      text: { fr: 'Depuis votre dernier passage : le devis Fauvel est signé, la fibre arrivera trois semaines après l’emménagement (box 4G commandée) et Karim a mis le bureau choisi sur le tableau.', en: 'Since you were last here: the Fauvel quote is signed, fiber lands three weeks after move-in (4G box ordered) and Karim put the chosen desk on the board.' },
      bullets: [
        { fr: 'Visite du site dans 2 jours, 11 h', en: 'Site visit in 2 days, 11 am' },
        { fr: 'Sofia réserve le mur de 9 mètres', en: 'Sofia is claiming the 9-metre wall' },
        { fr: 'Salle d’archives à trier avant le déménagement', en: 'Archive room to sort before the move' },
      ],
    },
    privateReplies: {
      karim: [
        { fr: 'Fauvel est ok pour l’escalier, 280 € de plus. Je signe l’avenant demain.', en: 'Fauvel is fine with the stairs, 280 € extra. I’ll sign the addendum tomorrow.' },
        { fr: 'La box 4G arrive jeudi. Je la teste chez moi avant.', en: 'The 4G box arrives Thursday. I’ll test it at home first.' },
        { fr: 'Pour la pré-série Aurora, je serai chez Lumen le matin et au bureau l’après-midi. Ça passe.', en: 'For the Aurora pilot run I’ll be at Lumen in the morning and at the office in the afternoon. Works.' },
      ],
      lea: [
        { fr: 'Attestation envoyée au propriétaire ce matin, il a accusé réception.', en: 'Certificate sent to the landlord this morning, he confirmed receipt.' },
        { fr: 'Le changement d’adresse au greffe prend 10 jours. Je lance dès les clés.', en: 'The registry address change takes 10 days. I’ll file as soon as we have the keys.' },
      ],
      sofia: [
        { fr: 'Le mail aux voisins est prêt, je l’envoie lundi pour ne pas qu’ils oublient.', en: 'The neighbours’ email is ready, I’ll send it Monday so they don’t forget.' },
        { fr: 'Les étiquettes : bleu produit, vert ops, rose marketing, gris finance. Léa a demandé gris.', en: 'Labels: blue product, green ops, pink marketing, grey finance. Léa asked for grey.' },
      ],
      gemini: [
        { fr: 'Je peux générer la liste des cartons par équipe à partir du plan, si ça aide Sofia.', en: 'I can generate the box list per team from the plan, if that helps Sofia.' },
        { fr: 'Rappel : le déménagement tombe la même semaine que la pré-série Aurora. Je le signale sur les deux projets ?', en: 'Reminder: the move lands the same week as the Aurora pilot run. Shall I flag it on both projects?' },
      ],
    },
  }

  return {
    id: 'move', name: { fr: 'Déménagement Paris', en: 'Paris office move' }, icon: 'apartment', color: '#1e8e3e',
    description: { fr: `Nouveau bureau passage des Lilas. Déménagement le ${fmtDay(moveDay, 'fr')}.`, en: `New office at passage des Lilas. Move on ${fmtDay(moveDay, 'en')}.` },
    ownerId: 'alex', memberIds: ['alex', 'karim', 'lea', 'sofia'], externalIds: [],
    unread: 3, mentions: 1, messages: [...messages].sort((a, b) => a.at - b.at), blocks, artifacts, script, address: 'demenagement@oneplace.example',
  }
}
