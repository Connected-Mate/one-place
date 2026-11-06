/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
import type { Artifact, Block, L, Message, Project, ProjectScript, Todo, Visibility } from '../types'
import { dayAt, fmtDay, rel, weekday } from './time'
import { filesFor } from './files'

const all: Visibility = { type: 'all' }
const priv = (...ids: string[]): Visibility => ({ type: 'private', with: ids })

export function hiring(): Project {
  const interview = dayAt(1, 15)
  const claraCall = dayAt(2, 10)
  const t = (id: string, authorId: string, at: number, text: L, extra: Partial<Message> = {}): Message => ({ id, kind: 'text', authorId, at, visibility: all, text, ...extra } as Message)

  const todos: Todo[] = [
    { id: 'h-t1', text: { fr: 'Publier la fiche de poste', en: 'Publish the job description' }, assigneeId: 'maya', due: dayAt(-6, 12), done: true, mission: 'Sourcing' },
    { id: 'h-t2', text: { fr: 'Valider la fourchette avec Léa', en: 'Confirm the salary range with Léa' }, assigneeId: 'maya', due: dayAt(-5, 18), done: true, source: { fr: 'Finance', en: 'Finance' }, mission: 'Sourcing', subtasks: [{ id: 'h-t2-s1', text: 'Check the band with Léa', done: true }, { id: 'h-t2-s2', text: 'Write it in the job description', done: true }] },
    { id: 'h-t3', text: { fr: 'Relire le portfolio de Ben avant l’entretien', en: 'Review Ben’s portfolio before the interview' }, assigneeId: 'tom', due: dayAt(1, 12), done: false, source: { fr: 'Mail de Ben', en: 'Email from Ben' }, mission: 'Ben Okafor interview', priority: 'high', subtasks: [{ id: 'h-t3-s1', text: 'Read the Marée case study', done: true }, { id: 'h-t3-s2', text: 'Note three questions on hardware', done: false }] },
    { id: 'h-t4', text: { fr: 'Préparer 5 questions sur le travail en équipe produit', en: 'Prepare 5 questions on working with product' }, assigneeId: 'alex', due: dayAt(1, 12), done: false, mission: 'Ben Okafor interview', priority: 'high', subtasks: [{ id: 'h-t4-s1', text: 'Draft the questions', done: true }, { id: 'h-t4-s2', text: 'Share them with Tom', done: false }] },
    { id: 'h-t5', text: { fr: 'Répondre aux 3 candidats « sourcés » qui attendent', en: 'Reply to the 3 waiting "sourced" candidates' }, assigneeId: 'maya', due: dayAt(2, 18), done: false, source: { fr: 'Rappel Gemini', en: 'Gemini reminder' }, mission: 'Sourcing', priority: 'medium', subtasks: [{ id: 'h-t5-s1', text: 'Inès Bouvier', done: true }, { id: 'h-t5-s2', text: 'Marco Delfini', done: false }, { id: 'h-t5-s3', text: 'Youssef Amrani', done: false }] },
    { id: 'h-t6', text: { fr: 'Appel de référence : Hanna (ex-manager chez Marée)', en: 'Reference call: Hanna (former manager at Marée)' }, assigneeId: 'maya', due: dayAt(4, 18), done: false, mission: 'References', priority: 'medium', subtasks: [{ id: 'h-t6-s1', text: 'Book 20 minutes with Hanna', done: true }, { id: 'h-t6-s2', text: 'Write up the notes', done: false }] },
    { id: 'h-t8', text: 'Prepare the offer range for the favorite', assigneeId: 'lea', due: dayAt(3, 18), done: false, mission: 'Offer', priority: 'medium', subtasks: [{ id: 'h-t8-s1', text: 'Compare with the current design band', done: true }, { id: 'h-t8-s2', text: 'Agree the ceiling with Maya', done: false }] },
    { id: 'h-t9', text: 'Book the design interview room for Ben', assigneeId: 'tom', due: dayAt(1, 10), done: false, mission: 'Ben Okafor interview', priority: 'low' },
  ]

  const artifacts: Artifact[] = [{
    id: 'h-doc-role', kind: 'doc', title: { fr: 'Fiche de poste : Design lead', en: 'Job description: Design lead' }, ownerId: 'maya', updatedAt: dayAt(-6, 9, 40),
    sections: [
      { heading: { fr: 'La mission', en: 'The role' }, body: { fr: 'Vous prenez la direction du design produit et marque : Aurora aujourd’hui, deux objets de plus l’an prochain. Vous travaillez avec Tom (design, 3 ans ici) et vous recrutez une deuxième personne au printemps. Vous rendez compte à Maya (produit) et vous avez une voix directe auprès d’Alex sur les choix de gamme.', en: 'You lead product and brand design: Aurora today, two more objects next year. You work with Tom (design, 3 years here) and hire a second person in the spring. You report to Maya (product) and have a direct line to Alex on range decisions.' } },
      { heading: { fr: 'Ce qu’on cherche', en: 'What we are looking for' }, body: { fr: 'Au moins une mise en production d’un objet physique, de la maquette à l’usine. Un œil pour le détail (nos clients regardent la lampe tous les soirs). Le goût de dire non. Pas besoin d’avoir managé 20 personnes : deux suffisent, bien.', en: 'At least one physical object shipped, from mockup to factory. An eye for detail (our customers look at the lamp every night). A taste for saying no. No need to have managed 20 people: two is enough, done well.' } },
      { heading: { fr: 'Le processus', en: 'The process' }, body: { fr: 'Un appel de 30 minutes avec Maya. Un entretien design d’une heure avec Tom et Alex, où vous présentez un projet passé en détail. Un déjeuner avec l’équipe. Une offre dans la semaine qui suit. Pas d’exercice maison pour les profils confirmés (décision de cette semaine).', en: 'A 30-minute call with Maya. A one-hour design interview with Tom and Alex where you present one past project in depth. Lunch with the team. An offer within the following week. No take-home exercise for senior profiles (decided this week).' } },
      { heading: { fr: 'Conditions', en: 'Terms' }, body: { fr: 'CDI, Paris 11e à partir du mois prochain, 2 jours de télétravail. Fourchette 68 à 78 k€ selon profil, validée par Léa. Au-delà : discussion.', en: 'Full-time, in our new office in the 11th arrondissement from next month, 2 remote days a week. Range €68K to €78K depending on profile, approved by Léa. Above that: a conversation.' } },
    ],
  }]

  const blocks: Block[] = [
    {
      id: 'hiring-summary', type: 'summary', span: 3, title: { fr: 'Où on en est', en: 'Where things stand' }, updatedAt: dayAt(0, 8, 0),
      text: { fr: `Sept candidats dans le pipeline, un favori : Ben Okafor, entretien design ${rel(interview).fr} à 15 h avec Tom et Alex. Trois candidats « sourcés » attendent encore une réponse. L’exercice maison est abandonné pour les profils confirmés.`, en: `Seven candidates in the pipeline, one favorite: Ben Okafor, design interview ${rel(interview).en} at 3 PM with Tom and Alex. Three "sourced" candidates are still waiting for a reply. The take-home exercise is dropped for senior profiles.` },
      bullets: [
        { fr: `Entretien Ben : ${weekday(interview, 'fr')} ${fmtDay(interview, 'fr')}, 15 h`, en: `Ben’s interview: ${weekday(interview, 'en')}, ${fmtDay(interview, 'en')}, 3 PM` },
        { fr: 'Fourchette validée : 68 à 78 k€', en: 'Range approved: €68K to €78K' },
        { fr: 'Hanna Sørensen en second choix (veut 100 % télétravail)', en: 'Hanna Sørensen as second choice (wants 100% remote)' },
      ],
    },
    {
      id: 'hiring-kanban', type: 'kanban', span: 3, title: { fr: 'Candidats', en: 'Candidates' },
      columns: [
        { id: 'sourced', title: { fr: 'Sourcés', en: 'Sourced' }, cards: [
          { id: 'c-ines', title: 'Inès Bouvier', tag: { fr: 'Agence', en: 'Agency' }, note: { fr: 'Belle marque, jamais d’objet physique', en: 'Strong brand work, never shipped a physical object' } },
          { id: 'c-marco', title: 'Marco Delfini', tag: { fr: 'Cooptation', en: 'Referral' }, note: { fr: 'Recommandé par Karim. Milan, prêt à bouger.', en: 'Referred by Karim. Milan, willing to relocate.' } },
          { id: 'c-youssef', title: 'Youssef Amrani', tag: { fr: 'Candidature', en: 'Applied' }, note: { fr: 'Portfolio très mobile, peu de hardware', en: 'Very mobile-heavy portfolio, little hardware' } },
        ] },
        { id: 'screening', title: { fr: 'Appel Maya', en: 'Call with Maya' }, cards: [
          { id: 'c-clara', title: 'Clara Petit', assigneeId: 'maya', tag: { fr: `Appel ${weekday(claraCall, 'fr')}`, en: `Call ${weekday(claraCall, 'en')}` }, note: { fr: 'Studio en propre depuis 4 ans', en: 'Runs her own studio, 4 years' } },
          { id: 'c-lucie', title: 'Lucie Fontaine', assigneeId: 'maya', tag: { fr: 'À planifier', en: 'To schedule' } },
        ] },
        { id: 'interview', title: { fr: 'Entretien design', en: 'Design interview' }, cards: [
          { id: 'c-ben', title: 'Ben Okafor', assigneeId: 'ben', tag: { fr: `${weekday(interview, 'fr')} 15 h`, en: `${weekday(interview, 'en')} 3 PM` }, note: { fr: 'Appli Marée, lampe Ondine. Favori de Tom.', en: 'Marée app, Ondine lamp. Tom’s favorite.' } },
          { id: 'c-hanna', title: 'Hanna Sørensen', tag: { fr: 'Références en cours', en: 'References ongoing' }, note: { fr: 'Très bonne, mais veut 100 % télétravail', en: 'Very good, but wants 100% remote' } },
        ] },
        { id: 'offer', title: { fr: 'Offre', en: 'Offer' }, cards: [] },
      ],
    },
    { id: 'hiring-todo', type: 'todo', span: 1, title: { fr: 'À faire', en: 'To do' }, todos },
    { id: 'hiring-files', type: 'files', span: 1, title: { fr: 'Fichiers', en: 'Files' }, artifactIds: ['h-doc-role'] },
    { id: 'hiring-people', type: 'people', span: 1, title: { fr: 'Équipe', en: 'Team' } },
  ]

  const messages: Message[] = [
    t('h-m01', 'maya', dayAt(-6, 9, 45), { fr: 'Fiche de poste en ligne depuis ce matin. 12 candidatures en 48 h, dont 3 sérieuses. Le reste veut « faire du design de lampes » sans avoir jamais dessiné une vis.', en: 'Job description went live this morning. 12 applications in 48 hours, 3 serious. The rest want to "design lamps" without ever having drawn a screw.' }, { reactions: [{ emoji: '😄', by: ['tom', 'alex'] }] }),
    { id: 'h-m02', kind: 'file', authorId: 'maya', at: dayAt(-6, 9, 46), visibility: all, artifactId: 'h-doc-role', text: { fr: 'La fiche, pour référence.', en: 'The job description, for reference.' } },
    t('h-m03', 'lea', dayAt(-5, 10, 20), { fr: 'Fourchette validée : 68 à 78 k€ selon profil. Pas au-dessus sans repasser par moi.', en: 'Range approved: €68K to €78K depending on profile. Not above without coming back to me.' }),
    {
      id: 'h-m04', kind: 'email', direction: 'in', authorId: 'ben', at: dayAt(-3, 18, 32), visibility: all,
      from: 'ben.okafor@mail.example', to: 'hiring@oneplace.example',
      subject: { fr: 'Design lead : portfolio et disponibilités', en: 'Design lead: portfolio and availability' },
      body: { fr: 'Bonjour Maya,\n\nMerci pour notre appel, ça m’a donné envie. Mon portfolio est sur okafor-design.example (mot de passe : marée). Les deux projets dont je parlerais volontiers en entretien : l’appli Marée (de zéro à 200 000 utilisateurs en 18 mois) et la lampe Ondine, mon seul objet physique produit en série, 4 000 pièces.\n\nJe suis disponible dans deux mois, le temps de mon préavis. Je préfère présenter du travail réel plutôt que faire un exercice maison, mais je m’adapte.\n\nÀ bientôt,\nBen', en: 'Hi Maya,\n\nThanks for our call, it made me want this. My portfolio is at okafor-design.example (password: maree). The two projects I’d gladly discuss in an interview: the Marée app (zero to 200,000 users in 18 months) and the Ondine lamp, my only physical object made at scale, 4,000 units.\n\nI can start in two months, once my notice period is done. I’d rather present real work than do a take-home exercise, but I can adapt.\n\nBest,\nBen' },
      replies: [
        t('h-m04-r1', 'tom', dayAt(-3, 19, 10), { fr: 'Son travail sur Marée est vraiment bien. La lampe Ondine est plus classique, mais 4 000 pièces, c’est quelqu’un qui a connu l’usine.', en: 'His work on Marée is really good. The Ondine lamp is more conventional, but 4,000 units means someone who has been through a factory.' }),
        t('h-m04-r2', 'maya', dayAt(-3, 19, 15), { fr: 'C’est exactement le point. On n’a pas besoin d’un artiste, on a besoin de quelqu’un qui parle à Jun.', en: 'That is exactly the point. We don’t need an artist, we need someone who can talk to Jun.' }),
      ],
    },
    t('h-m05', 'maya', dayAt(-3, 19, 30), { fr: `@[Tom Laurent](tom) @[Alex Cormeraie](alex) entretien design avec Ben ${rel(interview, dayAt(-3, 19)).fr} à 15 h. Tom, tu mènes. Alex, tu écoutes et tu poses la question qui fâche à la fin.`, en: `@[Tom Laurent](tom) @[Alex Cormeraie](alex) design interview with Ben ${rel(interview, dayAt(-3, 19)).en} at 3 PM. Tom, you lead. Alex, you listen and ask the awkward question at the end.` }),
    { id: 'h-m06', kind: 'meeting', authorId: 'maya', at: dayAt(-3, 19, 32), visibility: all, title: { fr: 'Entretien design : Ben Okafor', en: 'Design interview: Ben Okafor' }, start: interview, durationMin: 60, attendeeIds: ['maya', 'tom', 'alex'], guestEmails: ['ben.okafor@mail.example'] },
    {
      id: 'h-m07', kind: 'text', authorId: 'tom', at: dayAt(-2, 10, 5), visibility: all,
      text: { fr: 'Je propose qu’on arrête l’exercice maison pour les profils confirmés. Ça fait fuir les bons, et les mauvais le font quand même.', en: 'I suggest we drop the take-home exercise for senior profiles. It scares off the good ones, and the bad ones do it anyway.' },
      replies: [
        t('h-m07-r1', 'maya', dayAt(-2, 10, 30), { fr: 'D’accord pour Ben et Hanna. On garde l’exercice pour les juniors. Je mets à jour la fiche.', en: 'Agreed for Ben and Hanna. We keep the exercise for juniors. I’ll update the job description.' }),
        t('h-m07-r2', 'lea', dayAt(-2, 10, 41), { fr: 'Tant que ça ne devient pas « on recrute au feeling ».', en: 'As long as it doesn’t turn into "we hire on gut feeling".' }),
        t('h-m07-r3', 'tom', dayAt(-2, 10, 43), { fr: 'Le feeling, c’est une heure de présentation d’un vrai projet. Ça vaut un exercice.', en: 'The gut feeling is one hour of someone presenting a real project. That beats an exercise.' }),
      ],
    },
    t('h-m08', 'maya', dayAt(-1, 14, 20), { fr: 'Entre nous : Ben est au-dessus de la fourchette de Léa. Il est à 82 k€ aujourd’hui. Il faudra un argument autre que le salaire.', en: 'Between us: Ben is above Léa’s range. He is at €82K today. We’ll need an argument other than salary.' }, { visibility: priv('maya', 'alex'), quoteId: 'h-m04' }),
    t('h-m09', 'alex', dayAt(-1, 14, 35), { fr: 'Aurora est l’argument. Et le titre, et la deuxième embauche au printemps. On en parle après l’entretien, pas avant.', en: 'Aurora is the argument. And the title, and the second hire in the spring. Let’s talk after the interview, not before.' }, { visibility: priv('maya', 'alex'), quoteId: 'h-m04' }),
    {
      id: 'h-m10', kind: 'proposal', authorId: 'alex', at: dayAt(-1, 16, 50), visibility: all, status: 'pending',
      title: { fr: 'Ajouter une tâche : grille d’entretien commune', en: 'Add a task: shared interview grid' },
      description: { fr: 'Pour comparer Ben et Hanna sur les mêmes critères, et pas sur qui a été le plus sympa. Cinq critères, une note sur 4.', en: 'So we compare Ben and Hanna on the same criteria, not on who was nicest. Five criteria, a score out of 4.' },
      action: { type: 'add-todo', blockId: 'hiring-todo', todo: { id: 'h-t7', text: { fr: 'Rédiger la grille d’entretien commune (5 critères)', en: 'Write the shared interview grid (5 criteria)' }, assigneeId: 'alex', due: dayAt(1, 12), done: false, source: { fr: 'Proposition d’Alex', en: 'Alex’s proposal' } } },
    },
    t('h-m11', 'gemini', dayAt(0, 8, 5), { fr: `Rappel : entretien ${rel(interview, dayAt(0, 8)).fr} à 15 h avec Ben. Les trois cartes « Sourcés » n’ont pas bougé depuis leur arrivée. Je prépare les réponses pour Maya ?`, en: `Reminder: interview ${rel(interview, dayAt(0, 8)).en} at 3 PM with Ben. The three "Sourced" cards have not moved since they came in. Shall I draft the replies for Maya?` }),
    t('h-m12', 'lea', dayAt(0, 9, 22), { fr: '@[Alex Cormeraie](alex) si on monte au-dessus de 78 pour quelqu’un, préviens-moi avant l’offre, pas après.', en: '@[Alex Cormeraie](alex) if we go above 78 for anyone, tell me before the offer, not after.' }),
  ]

  /* The live call happens before the interview: a prep call, so nothing it decides contradicts the kanban. */
  const script: ProjectScript = {
    callTitle: { fr: 'Préparation : entretien de Ben', en: 'Prep: Ben’s interview' },
    captions: [
      { who: 'maya', text: { fr: `Dix minutes pour caler l’entretien de ${rel(interview).fr}. Tom, tu mènes. Comment tu l’ouvres ?`, en: `Ten minutes to set up the interview ${rel(interview).en}. Tom, you lead. How do you open?` } },
      { who: 'tom', text: { fr: 'Je commence par Ondine, pas par Marée. Et je le pousse sur ce qui a raté : le moule, les délais, l’usine. C’est là qu’on voit.', en: 'I start with Ondine, not Marée. And I push him on what went wrong: the mold, the delays, the factory. That’s where you see it.' } },
      { who: 'alex', text: { fr: 'Je garde la question qui fâche pour la fin : pourquoi il a quitté Marée. Et je veux l’entendre sur comment il dit non à un ingénieur.', en: 'I keep the awkward question for the end: why he left Marée. And I want to hear how he says no to an engineer.' } },
      { who: 'maya', text: { fr: 'Pas un mot sur le salaire pendant l’entretien. Si Ben en parle, c’est moi qui réponds, après.', en: 'Not a word about salary during the interview. If Ben brings it up, I answer, afterwards.' } },
      { who: 'lea', text: { fr: 'Et je vous vois venir tous les trois. La fourchette c’est 78. Si ça doit monter, je veux un chiffre avant l’offre, pas une surprise.', en: 'And I can see the three of you coming. The range tops out at 78. If it has to go up, I want a number before the offer, not a surprise.' } },
      { who: 'maya', text: { fr: 'Promis. Je te donne un chiffre après l’entretien, avec la deuxième embauche au printemps dans l’équation.', en: 'Promise. I give you a number after the interview, with the spring hire in the equation.' } },
      { who: 'tom', text: { fr: 'Et Hanna ? Elle est très bonne aussi. Mais 100 % télétravail avec une usine, je n’y crois pas.', en: 'And Hanna? She is very good too. But 100% remote with a factory, I don’t buy it.' } },
      { who: 'alex', text: { fr: 'On la garde dans la course tant que ses références ne sont pas revenues. On compare les deux sur les mêmes critères.', en: 'She stays in the running until her references come back. We compare both on the same criteria.' } },
      { who: 'maya', text: { fr: 'Et je réponds aux trois sourcés aujourd’hui, ils attendent depuis trop longtemps. Gemini, tu résumes ?', en: 'And I reply to the three sourced candidates today, they have waited too long. Gemini, summarize?' } },
    ],
    callSummary: {
      summary: { fr: `Appel de préparation avant l’entretien design de Ben Okafor (${rel(interview).fr}, 15 h). Tom ouvre sur Ondine et creuse ce qui a raté en usine. Alex garde la question du départ de Marée pour la fin. Pas de discussion salaire pendant l’entretien : Maya donne un chiffre à Léa après. Hanna reste dans la course jusqu’au retour de ses références.`, en: `Prep call before Ben Okafor’s design interview (${rel(interview).en}, 3 PM). Tom opens with Ondine and digs into what went wrong at the factory. Alex keeps the question about leaving Marée for the end. No salary talk during the interview: Maya gives Léa a number afterwards. Hanna stays in the running until her references come back.` },
      decisions: [
        { fr: 'Tom mène l’entretien, Alex pose la dernière question', en: 'Tom leads the interview, Alex asks the last question' },
        { fr: 'Pas de discussion salaire pendant l’entretien', en: 'No salary talk during the interview' },
        { fr: 'Ben et Hanna sont comparés sur les mêmes critères', en: 'Ben and Hanna are compared on the same criteria' },
      ],
      todos: [
        { text: { fr: 'Relire le portfolio de Ben, surtout Ondine', en: 'Review Ben’s portfolio, especially Ondine' }, assigneeId: 'tom' },
        { text: { fr: 'Cinq questions sur le travail avec l’équipe produit', en: 'Five questions on working with the product team' }, assigneeId: 'alex' },
        { text: { fr: 'Répondre aux trois candidats sourcés', en: 'Reply to the three sourced candidates' }, assigneeId: 'maya' },
        { text: { fr: 'Chiffrer un scénario à 80 k€ avec la deuxième embauche', en: 'Cost out an €80K scenario with the second hire' }, assigneeId: 'lea' },
      ],
    },
    catchUp: {
      text: { fr: `Depuis votre dernier passage : Ben a envoyé son portfolio, l’entretien design est ${rel(interview).fr} à 15 h, et l’exercice maison est abandonné pour les profils confirmés.`, en: `Since you were last here: Ben sent his portfolio, the design interview is ${rel(interview).en} at 3 PM, and the take-home exercise is dropped for senior profiles.` },
      bullets: [
        { fr: 'Tom mène l’entretien, vous posez la question qui fâche à la fin', en: 'Tom leads the interview, you ask the awkward question at the end' },
        { fr: 'Léa : pas d’offre au-dessus de 78 k€ sans la prévenir', en: 'Léa: no offer above €78K without telling her' },
        { fr: 'Trois candidats sourcés attendent une réponse de Maya', en: 'Three sourced candidates are waiting for a reply from Maya' },
      ],
    },
    privateReplies: {
      maya: [
        { fr: 'Ta grille est une bonne idée, je la regarde ce soir.', en: 'Your grid is a good idea, I’ll look at it tonight.' },
        { fr: 'Pour le salaire, laisse-moi mener. Léa dira oui à 80 si c’est moi qui demande.', en: 'On salary, let me lead. Léa will say yes to 80 if I’m the one asking.' },
        { fr: 'Ben a demandé qui serait son manager. J’ai dit moi, avec toi sur la gamme. Ça lui va.', en: 'Ben asked who his manager would be. I said me, with you on the range. He is fine with that.' },
      ],
      tom: [
        { fr: 'Je ne suis pas vexé qu’on recrute au-dessus de moi, si c’est ta question. Je veux apprendre de quelqu’un.', en: 'I’m not upset we’re hiring above me, if that’s your question. I want to learn from someone.' },
        { fr: 'Pour l’entretien, je commence par Ondine et je le pousse sur ce qui a raté. C’est là qu’on voit.', en: 'For the interview I’ll start with Ondine and push him on what went wrong. That’s where you see it.' },
      ],
      lea: [
        { fr: '80 passe si on décale l’embauche du printemps à mai. Je t’envoie le calcul.', en: '80 works if we push the spring hire to May. I’ll send you the math.' },
        { fr: 'Pas de prime à la signature. On n’a jamais fait ça et ça se saura.', en: 'No signing bonus. We have never done that and word would get around.' },
      ],
      gemini: [
        { fr: 'Je peux préparer une fiche d’une page sur Ben à partir de son mail et des notes de Maya, avant l’entretien.', en: 'I can prepare a one-page brief on Ben from his email and Maya’s notes, before the interview.' },
        { fr: 'Les trois réponses aux candidats sourcés sont prêtes en brouillon. Maya n’a qu’à relire.', en: 'The three replies to sourced candidates are drafted. Maya only needs to review.' },
      ],
    },
  }

  return {
    id: 'hiring', name: { fr: 'Recrutement Design lead', en: 'Hiring: Design lead' }, icon: 'person_search', color: '#8430ce',
    description: { fr: `Un ou une Design lead pour Aurora et la suite. Entretien ${rel(interview).fr}.`, en: `A Design lead for Aurora and what comes next. Interview ${rel(interview).en}.` },
    ownerId: 'maya', memberIds: ['maya', 'alex', 'tom', 'lea'], externalIds: ['ben'],
    unread: 5, mentions: 2, messages: [...messages].sort((a, b) => a.at - b.at), blocks, artifacts: [...artifacts, ...filesFor('hiring')], script, address: 'hiring@oneplace.example',
  }
}
