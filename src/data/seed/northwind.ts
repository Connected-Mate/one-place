import type { Artifact, Block, L, Message, Project, ProjectScript, Todo, Visibility } from '../types'
import { DAY, dayAt, fmtDay, week } from './time'

const all: Visibility = { type: 'all' }
const priv = (...ids: string[]): Visibility => ({ type: 'private', with: ids })

export function northwind(): Project {
  const board = dayAt(5, 9) // Northwind's board meets
  const launch = week(6) + 3 * DAY
  const t = (id: string, authorId: string, at: number, text: L, extra: Partial<Message> = {}): Message => ({ id, kind: 'text', authorId, at, visibility: all, text, ...extra } as Message)

  const todos: Todo[] = [
    { id: 'n-t1', text: { fr: 'Envoyer le devis à 119 € avec la proposition', en: 'Send the 119 € quote with the proposal' }, assigneeId: 'alex', due: dayAt(-6, 18), done: true, source: { fr: 'Mail de Priya', en: 'Mail from Priya' } },
    { id: 'n-t2', text: { fr: 'Vérifier la marge à 105 € et à 112 €', en: 'Check the margin at 105 € and 112 €' }, assigneeId: 'lea', due: dayAt(-1, 18), done: true, source: { fr: 'Contre-proposition Priya', en: 'Priya’s counter' } },
    { id: 'n-t3', text: { fr: 'Répondre à Priya : 112 €, garantie 2 ans, Bordeaux au contrat', en: 'Reply to Priya: 112 €, 2-year warranty, Bordeaux in the contract' }, assigneeId: 'alex', due: dayAt(0, 18), done: false, source: { fr: 'Brouillon Gemini', en: 'Gemini draft' } },
    { id: 'n-t4', text: { fr: 'Maquette de la gravure logo Northwind sur la base', en: 'Mockup of the Northwind logo engraving on the base' }, assigneeId: 'sofia', due: dayAt(3, 18), done: false },
    { id: 'n-t5', text: { fr: 'Caler 50 unités « soft opening » dans la pré-série', en: 'Fit 50 "soft opening" units into the pilot run' }, assigneeId: 'alex', due: dayAt(4, 18), done: false },
    { id: 'n-t6', text: { fr: 'Préparer l’appel conditions finales avec Priya', en: 'Prepare the final-terms call with Priya' }, assigneeId: 'sofia', due: dayAt(2, 18), done: false },
  ]

  const artifacts: Artifact[] = [
    {
      id: 'n-sheet-pricing', kind: 'sheet', title: { fr: 'Grille tarifaire B2B', en: 'B2B pricing grid' }, ownerId: 'lea', updatedAt: dayAt(-1, 10, 15),
      columns: [{ fr: 'Volume', en: 'Volume' }, { fr: 'Prix unitaire (€)', en: 'Unit price (€)' }, { fr: 'Remise vs 149 €', en: 'Discount vs 149 €' }, { fr: 'CA (€)', en: 'Revenue (€)' }, { fr: 'Marge unitaire (€)', en: 'Unit margin (€)' }, { fr: 'Marge', en: 'Margin' }],
      rows: [
        [50, 139, '7 %', 6950, 78, '56 %'],
        [100, 134, '10 %', 13400, 73, '54 %'],
        [200, 127, '15 %', 25400, 66, '52 %'],
        [400, 119, '20 %', 47600, 58, '49 %'],
        ['400 (contre-prop. Priya / Priya counter)', 105, '30 %', 42000, 44, '42 %'],
        ['400 (réponse / reply)', 112, '25 %', 44800, 51, '46 %'],
        [800, 112, '25 %', 89600, 51, '46 %'],
        ['Option gravure / Engraving', 4, '', '', 1, '25 %'],
        ['Option garantie 2 ans / 2-year warranty', 3, '', '', -3, ''],
        ['Coût unitaire / Unit cost', 61, '', '', '', ''],
      ],
    },
    {
      id: 'n-slides-proposal', kind: 'slides', title: { fr: 'Proposition Northwind Hotels', en: 'Northwind Hotels proposal' }, ownerId: 'sofia', updatedAt: dayAt(-6, 15, 40),
      slides: [
        { title: { fr: 'Aurora dans vos chambres', en: 'Aurora in your rooms' }, subtitle: { fr: 'Northwind Hotels, Lyon', en: 'Northwind Hotels, Lyon' }, accent: '#b3261e' },
        { title: { fr: 'Ce que vos clients vivent', en: 'What your guests get' }, bullets: [{ fr: 'Un réveil par la lumière, pas par un bip', en: 'A wake-up by light, not by a beep' }, { fr: 'Zéro réglage : l’heure vient de votre système', en: 'Zero setup: the time comes from your system' }, { fr: 'Un objet qu’ils voudront acheter en partant', en: 'An object they will want to buy on the way out' }] },
        { title: { fr: '400 chambres, un geste', en: '400 rooms, one gesture' }, bullets: [{ fr: 'Base gravée au logo Northwind', en: 'Base engraved with the Northwind logo' }, { fr: 'Coloris Sable, assorti au bois clair des chambres', en: 'Sand colorway, matching the rooms’ light wood' }, { fr: 'Livraison en deux vagues', en: 'Delivery in two waves' }] },
        { title: { fr: 'Conditions', en: 'Terms' }, bullets: [{ fr: '119 € l’unité pour 400 (remise de 20 %)', en: '119 € per unit for 400 (20% discount)' }, { fr: 'Gravure : 4 € l’unité', en: 'Engraving: 4 € per unit' }, { fr: 'Garantie 1 an, remplacement sous 10 jours', en: '1-year warranty, replacement within 10 days' }] },
        { title: { fr: 'Et après Lyon', en: 'And after Lyon' }, bullets: [{ fr: 'Bordeaux (250 chambres) au printemps', en: 'Bordeaux (250 rooms) in the spring' }, { fr: 'Lille (180) à l’été', en: 'Lille (180) in the summer' }, { fr: 'Un prix par volume cumulé', en: 'One price on cumulative volume' }], accent: '#1e3a5f' },
      ],
    },
  ]

  const blocks: Block[] = [
    {
      id: 'northwind-summary', type: 'summary', span: 3, title: { fr: 'Où on en est', en: 'Where things stand' }, updatedAt: dayAt(0, 9, 10),
      text: { fr: `Northwind veut 400 lampes gravées pour son hôtel de Lyon. Priya contre-propose 105 € (nous : 119 €) avec une garantie de 2 ans et une livraison avant notre lancement. La réponse préparée : 112 €, garantie 2 ans, Bordeaux écrit au contrat, 50 unités pour l’ouverture et le reste après le lancement. Leur conseil se réunit le ${fmtDay(board, 'fr')}.`, en: `Northwind wants 400 engraved lamps for its Lyon hotel. Priya counters at 105 € (we asked 119 €) with a 2-year warranty and delivery before our launch. The prepared reply: 112 €, 2-year warranty, Bordeaux written into the contract, 50 units for the opening and the rest after launch. Their board meets on ${fmtDay(board, 'en')}.` },
      bullets: [
        { fr: 'Marge : 49 % à 119 €, 46 % à 112 €, 42 % à 105 € (seuil de Léa : 110 €)', en: 'Margin: 49% at 119 €, 46% at 112 €, 42% at 105 € (Léa’s floor: 110 €)' },
        { fr: 'Pas de livraison complète avant la levée d’embargo', en: 'No full delivery before the embargo lifts' },
        { fr: 'Réponse à Priya à envoyer aujourd’hui', en: 'Reply to Priya to send today' },
      ],
    },
    {
      id: 'northwind-chart', type: 'chart', span: 2, title: { fr: 'Chiffre d’affaires par hôtel', en: 'Revenue by hotel' }, unit: 'k€',
      series: [
        { label: { fr: 'Lyon (400)', en: 'Lyon (400)' }, value: 44.8, target: 47.6 },
        { label: { fr: 'Bordeaux (250)', en: 'Bordeaux (250)' }, value: 0, target: 28 },
        { label: { fr: 'Lille (180)', en: 'Lille (180)' }, value: 0, target: 20.2 },
        { label: { fr: 'Marseille (320)', en: 'Marseille (320)' }, value: 0, target: 35.8 },
      ],
    },
    { id: 'northwind-todo', type: 'todo', span: 1, title: { fr: 'À faire', en: 'To do' }, todos },
    { id: 'northwind-files', type: 'files', span: 1, title: { fr: 'Fichiers', en: 'Files' }, artifactIds: ['n-sheet-pricing', 'n-slides-proposal'] },
    { id: 'northwind-people', type: 'people', span: 1, title: { fr: 'Équipe', en: 'Team' } },
    { id: 'northwind-calendar', type: 'calendar', span: 1, title: { fr: 'Prochains rendez-vous', en: 'Upcoming' }, events: [
      { id: 'n-ev1', title: { fr: 'Appel Priya : conditions finales', en: 'Call with Priya: final terms' }, start: dayAt(3, 11), durationMin: 30, attendeeIds: ['alex', 'sofia', 'lea'] },
      { id: 'n-ev2', title: { fr: 'Conseil Northwind (leur décision)', en: 'Northwind board (their decision)' }, start: board, durationMin: 120, attendeeIds: [] },
    ] },
  ]

  const messages: Message[] = [
    {
      id: 'n-m01', kind: 'email', direction: 'in', authorId: 'priya', at: dayAt(-7, 10, 24), visibility: all,
      from: 'priya.nair@northwind-hotels.example', to: 'northwind@oneplace.example',
      subject: { fr: 'Aurora pour notre hôtel de Lyon : 400 chambres', en: 'Aurora for our Lyon hotel: 400 rooms' },
      body: { fr: 'Bonjour Alex,\n\nNous ouvrons notre hôtel de Lyon en février, 400 chambres. J’ai vu l’unité de test que Sofia a laissée à notre directrice artistique et elle ne veut plus la rendre, ce qui est bon signe.\n\nPourriez-vous me faire une proposition pour 400 lampes, base gravée à notre logo, coloris clair ? J’aurais besoin du prix, du délai et des conditions de garantie. Si Lyon fonctionne, Bordeaux et Lille suivent.\n\nMerci,\nPriya Nair\nAchats, Northwind Hotels', en: 'Hi Alex,\n\nWe are opening our Lyon hotel in February, 400 rooms. I saw the test unit Sofia left with our art director and she refuses to give it back, which is a good sign.\n\nCould you send me a proposal for 400 lamps, base engraved with our logo, light colorway? I need price, lead time and warranty terms. If Lyon works, Bordeaux and Lille follow.\n\nThanks,\nPriya Nair\nProcurement, Northwind Hotels' },
      reactions: [{ emoji: '🤩', by: ['sofia', 'alex'] }],
    },
    t('n-m02', 'sofia', dayAt(-7, 10, 40), { fr: 'Un hôtel, 400 chambres, nos lampes sur chaque table de nuit. C’est le meilleur placement produit qu’on aura jamais.', en: 'One hotel, 400 rooms, our lamps on every nightstand. That is the best product placement we will ever get.' }),
    t('n-m03', 'lea', dayAt(-7, 11, 2), { fr: 'Le meilleur placement produit à condition de ne pas le payer. 400 à 119 € c’est 49 % de marge, ça passe. En dessous de 110 € je ne signe pas.', en: 'The best product placement as long as we don’t pay for it. 400 at 119 € is 49% margin, fine. Below 110 € I don’t sign.' }, { reactions: [{ emoji: '👍', by: ['alex'] }] }),
    { id: 'n-m04', kind: 'file', authorId: 'lea', at: dayAt(-6, 9, 30), visibility: all, artifactId: 'n-sheet-pricing', text: { fr: 'La grille B2B, avec le coût unitaire réel (61 €). Ne la partagez pas, elle contient la marge.', en: 'The B2B grid, with the real unit cost (61 €). Don’t share it, it has the margin in it.' } },
    {
      id: 'n-m05', kind: 'email', direction: 'out', authorId: 'alex', at: dayAt(-6, 16, 10), visibility: all,
      from: 'northwind@oneplace.example', to: 'priya.nair@northwind-hotels.example',
      subject: { fr: 'Re : Aurora pour notre hôtel de Lyon : 400 chambres', en: 'Re: Aurora for our Lyon hotel: 400 rooms' },
      body: { fr: `Bonjour Priya,\n\nMerci, et dites à votre directrice artistique qu’elle peut garder la lampe.\n\nPour 400 unités : 119 € l’unité (20 % de remise), gravure 4 € l’unité, garantie 1 an avec remplacement sous 10 jours. Livraison en deux vagues, la première quatre semaines après notre lancement du ${fmtDay(launch, 'fr')}. La proposition détaillée est jointe.\n\nSi Bordeaux et Lille suivent, on parle d’un prix sur le volume cumulé.\n\nBien à vous,\nAlex`, en: `Hi Priya,\n\nThank you, and tell your art director she can keep the lamp.\n\nFor 400 units: 119 € per unit (20% discount), engraving 4 € per unit, 1-year warranty with replacement within 10 days. Delivery in two waves, the first four weeks after our ${fmtDay(launch, 'en')} launch. The detailed proposal is attached.\n\nIf Bordeaux and Lille follow, we talk about a price on cumulative volume.\n\nBest,\nAlex` },
      attachmentIds: ['n-slides-proposal'],
    },
    { id: 'n-m06', kind: 'file', authorId: 'sofia', at: dayAt(-6, 16, 14), visibility: all, artifactId: 'n-slides-proposal', text: { fr: 'La proposition, 5 slides, celle jointe au mail d’Alex. Slide 5 est volontairement vague sur Marseille.', en: 'The proposal, 5 slides, the one attached to Alex’s mail. Slide 5 is deliberately vague about Marseille.' } },
    {
      id: 'n-m07', kind: 'email', direction: 'in', authorId: 'priya', at: dayAt(-2, 9, 18), visibility: all,
      from: 'priya.nair@northwind-hotels.example', to: 'northwind@oneplace.example',
      subject: { fr: 'Re : Aurora pour notre hôtel de Lyon : 400 chambres', en: 'Re: Aurora for our Lyon hotel: 400 rooms' },
      body: { fr: `Bonjour Alex,\n\nLa proposition a plu. Trois points avant notre conseil du ${fmtDay(board, 'fr')} :\n\n1. Prix : notre budget équipement est à 105 € par chambre. Je sais que c’est en dessous de votre offre.\n2. Garantie : 2 ans, c’est notre standard pour tout ce qui est dans une chambre.\n3. Livraison : nous faisons une ouverture en douceur avant Noël. Pourriez-vous livrer avant votre lancement ?\n\nSi nous trouvons un accord, je peux faire inscrire Bordeaux au même conseil.\n\nPriya`, en: `Hi Alex,\n\nThe proposal went down well. Three points before our board on ${fmtDay(board, 'en')}:\n\n1. Price: our equipment budget is 105 € per room. I know that is below your offer.\n2. Warranty: 2 years, our standard for anything in a room.\n3. Delivery: we are doing a soft opening before Christmas. Could you deliver before your launch?\n\nIf we agree, I can get Bordeaux on the same board agenda.\n\nPriya` },
      reactions: [{ emoji: '😮', by: ['sofia'] }, { emoji: '🧮', by: ['lea'] }],
    },
    {
      id: 'n-m08', kind: 'text', authorId: 'gemini', at: dayAt(-2, 9, 25), visibility: all,
      text: { fr: 'Priya demande 105 € et une livraison avant votre lancement. À 105 € la marge tombe à 42 %, sous le seuil de Léa (110 €). Je peux préparer une réponse à 112 € avec la garantie 2 ans, en échange de Bordeaux écrit au contrat. Je rédige ?', en: 'Priya asks for 105 € and delivery before your launch. At 105 € the margin drops to 42%, below Léa’s 110 € floor. I can prepare a reply at 112 € with the 2-year warranty, in exchange for Bordeaux written into the contract. Shall I draft it?' },
      replies: [t('n-m08-r1', 'alex', dayAt(-2, 9, 31), { fr: 'Oui, prépare. Sans l’envoyer.', en: 'Yes, draft it. Don’t send.' })],
    },
    t('n-m09', 'lea', dayAt(-1, 10, 20), { fr: '112 € avec la garantie 2 ans, ça fait 48 € de marge réelle par lampe (la garantie coûte 3 €). Ok si Bordeaux est écrit dans le contrat, pas « envisagé ».', en: '112 € with the 2-year warranty is 48 € of real margin per lamp (the warranty costs 3 €). Fine if Bordeaux is written into the contract, not "considered".' }, { reactions: [{ emoji: '👍', by: ['alex', 'sofia'] }] }),
    t('n-m10', 'sofia', dayAt(-1, 11, 5), { fr: 'Sur la livraison avant le lancement : non. Un hôtel qui a nos lampes avant la presse, c’est l’embargo de Nora qui saute. On propose 50 unités de la pré-série pour l’ouverture en douceur, le reste deux semaines après le lancement.', en: 'On delivery before launch: no. A hotel with our lamps before the press means Nora’s embargo is blown. We offer 50 units from the pilot run for the soft opening, the rest two weeks after launch.' }, { reactions: [{ emoji: '💯', by: ['alex', 'lea'] }] }),
    t('n-m11', 'alex', dayAt(0, 9, 5), { fr: 'D’accord sur les deux. J’envoie la réponse à Priya ce matin depuis le brouillon de Gemini. Sofia, tu relis avant ?', en: 'Agreed on both. I’ll send the reply to Priya this morning from Gemini’s draft. Sofia, will you read it first?' }),
    t('n-m12', 'sofia', dayAt(0, 9, 20), { fr: 'Relu. J’ai enlevé « malheureusement » deux fois. On ne s’excuse pas de protéger un lancement.', en: 'Read it. I removed "unfortunately" twice. We don’t apologise for protecting a launch.' }, { reactions: [{ emoji: '😂', by: ['alex'] }] }),
    t('n-m13', 'lea', dayAt(0, 9, 32), { fr: 'Si Priya revient à 108, dis oui. Je préfère ça que de perdre Bordeaux pour 4 €.', en: 'If Priya comes back at 108, say yes. I’d rather that than lose Bordeaux over 4 €.' }, { visibility: priv('lea', 'alex') }),
  ]

  const script: ProjectScript = {
    callTitle: { fr: 'Appel Priya : conditions finales', en: 'Call with Priya: final terms' },
    captions: [
      { who: 'alex', text: { fr: 'Priya, merci de prendre le temps. On a travaillé vos trois points.', en: 'Priya, thanks for making time. We worked through your three points.' } },
      { who: 'priya', text: { fr: 'Je vous écoute. Mon conseil est dans deux jours, j’ai besoin d’un chiffre que je peux défendre.', en: 'Go ahead. My board is in two days, I need a number I can defend.' } },
      { who: 'alex', text: { fr: '112 € l’unité, garantie 2 ans incluse. Et on écrit Bordeaux dans le contrat, au même prix, avec un calendrier.', en: '112 € per unit, 2-year warranty included. And we write Bordeaux into the contract, same price, with a schedule.' } },
      { who: 'priya', text: { fr: '112, c’est 7 de plus que mon budget. La garantie aide. Bordeaux, je peux le faire passer si le prix ne bouge pas.', en: '112 is 7 over my budget. The warranty helps. Bordeaux I can push through if the price doesn’t move.' } },
      { who: 'lea', text: { fr: 'Le prix ne bouge pas. Il est déjà sous notre grille pour ce volume. Je ne peux pas descendre plus.', en: 'The price doesn’t move. It is already below our grid for this volume. I can’t go lower.' } },
      { who: 'priya', text: { fr: 'Et la livraison avant Noël ? C’est ce que ma direction retient le plus.', en: 'And delivery before Christmas? That is what my management cares about most.' } },
      { who: 'sofia', text: { fr: '50 unités gravées pour votre ouverture en douceur, prises sur notre pré-série. Le reste deux semaines après notre lancement. Avant, on ne peut pas, la presse est sous embargo.', en: '50 engraved units for your soft opening, taken from our pilot run. The rest two weeks after our launch. Before that we can’t, the press is under embargo.' } },
      { who: 'priya', text: { fr: '50 pour l’ouverture, c’est les suites et le lobby. Ça peut marcher. Vous me confirmez tout ça par écrit aujourd’hui ?', en: '50 for the opening covers the suites and the lobby. That can work. Can you confirm all of this in writing today?' } },
      { who: 'alex', text: { fr: 'Ce soir. Et le logo gravé, Sofia vous envoie la maquette demain.', en: 'Tonight. And the engraved logo, Sofia sends you the mockup tomorrow.' } },
      { who: 'priya', text: { fr: 'Parfait. Je présente 112 avec Bordeaux. Je vous dis vendredi.', en: 'Perfect. I’ll present 112 with Bordeaux. I’ll tell you Friday.' } },
    ],
    callSummary: {
      summary: { fr: 'Appel avec Priya Nair sur les conditions finales. Elle accepte de présenter 112 € avec la garantie 2 ans et Bordeaux inscrit au contrat. La livraison avant le lancement est remplacée par 50 unités gravées pour l’ouverture en douceur, le reste deux semaines après. Elle veut une confirmation écrite ce soir et la maquette de gravure demain.', en: 'Call with Priya Nair on final terms. She agrees to present 112 € with the 2-year warranty and Bordeaux written into the contract. Delivery before launch is replaced by 50 engraved units for the soft opening, the rest two weeks later. She wants written confirmation tonight and the engraving mockup tomorrow.' },
      decisions: [
        { fr: '112 € l’unité, garantie 2 ans, Bordeaux au contrat', en: '112 € per unit, 2-year warranty, Bordeaux in the contract' },
        { fr: '50 unités de la pré-série pour l’ouverture en douceur, le reste après le lancement', en: '50 pilot-run units for the soft opening, the rest after launch' },
      ],
      todos: [
        { text: { fr: 'Envoyer la confirmation écrite à Priya ce soir', en: 'Send the written confirmation to Priya tonight' }, assigneeId: 'alex' },
        { text: { fr: 'Maquette de gravure du logo', en: 'Logo engraving mockup' }, assigneeId: 'sofia' },
        { text: { fr: 'Bloquer 50 unités gravées dans la pré-série', en: 'Reserve 50 engraved units in the pilot run' }, assigneeId: 'alex' },
        { text: { fr: 'Contrat avec Bordeaux en annexe', en: 'Contract with Bordeaux as an appendix' }, assigneeId: 'lea' },
      ],
    },
    catchUp: {
      text: { fr: 'Depuis votre dernier passage : Priya a contre-proposé 105 € avec une livraison avant le lancement. Gemini a préparé une réponse à 112 €, Léa et Sofia l’ont validée. Elle est à envoyer aujourd’hui.', en: 'Since you were last here: Priya countered at 105 € with delivery before launch. Gemini drafted a reply at 112 €, Léa and Sofia approved it. It is due to go out today.' },
      bullets: [
        { fr: `Conseil Northwind le ${fmtDay(board, 'fr')}`, en: `Northwind board on ${fmtDay(board, 'en')}` },
        { fr: 'Pas de livraison complète avant la levée d’embargo (Sofia)', en: 'No full delivery before the embargo lifts (Sofia)' },
        { fr: 'Léa accepterait 108 € en dernier recours', en: 'Léa would accept 108 € as a last resort' },
      ],
    },
    privateReplies: {
      sofia: [
        { fr: 'La maquette de gravure est presque prête. Le logo Northwind est fin, ça rend bien sur la base.', en: 'The engraving mockup is almost ready. The Northwind logo is thin, it looks good on the base.' },
        { fr: 'Si Priya reparle de livraison avant le lancement, je prends l’appel. Je sais dire non gentiment.', en: 'If Priya brings up delivery before launch again, I’ll take the call. I know how to say no nicely.' },
      ],
      lea: [
        { fr: '108 en dernier recours, pas avant. Et seulement si Bordeaux est signé en même temps.', en: '108 as a last resort, not before. And only if Bordeaux is signed at the same time.' },
        { fr: 'Le contrat type est prêt, j’ajoute l’annexe Bordeaux dès qu’elle confirme.', en: 'The standard contract is ready, I’ll add the Bordeaux appendix as soon as she confirms.' },
      ],
      gemini: [
        { fr: 'Le brouillon de réponse à Priya est prêt, 9 lignes. Je l’affiche ici pour relecture ?', en: 'The draft reply to Priya is ready, 9 lines. Shall I show it here for review?' },
        { fr: 'À 112 € sur Lyon, Bordeaux et Lille, le chiffre d’affaires cumulé serait de 93 k€. Je peux l’ajouter au graphique.', en: 'At 112 € across Lyon, Bordeaux and Lille, cumulative revenue would be 93k €. I can add it to the chart.' },
      ],
    },
  }

  return {
    id: 'northwind', name: { fr: 'Compte Northwind', en: 'Northwind account' }, icon: 'handshake', color: '#b3261e',
    description: { fr: '400 lampes gravées pour l’hôtel de Lyon, puis Bordeaux et Lille.', en: '400 engraved lamps for the Lyon hotel, then Bordeaux and Lille.' },
    ownerId: 'alex', memberIds: ['alex', 'sofia', 'lea'], externalIds: ['priya'],
    unread: 2, mentions: 0, messages: [...messages].sort((a, b) => a.at - b.at), blocks, artifacts, script, address: 'northwind@oneplace.example',
  }
}
