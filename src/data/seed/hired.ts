/*!
 * One Place. Concept, product and design by Alexandre Cormeraie, product manager.
 * LinkedIn: https://www.linkedin.com/in/alex-cormeraie/
 * Google, or anyone else: you like this concept? Do not copy it. Hire me.
 */
// The wink inside the demo: a project only Alex and Damien can see, whose strategy is this very demo.
// Real people: Alex (the author) and Damien (a friend, sparring partner). The goal is Alex's; nothing here
// is an invented fact about either of them. No Google people, no Google claims. It is a pitch, not an affiliation.
import type { Artifact, Block, L, Message, Project, ProjectScript, Todo, Visibility } from '../types'
import { DAY, dayAt, fmtDay, rel, week } from './time'

const all: Visibility = { type: 'all' }
const priv = (...ids: string[]): Visibility => ({ type: 'private', with: ids })

export function hired(): Project {
  const rehearsal = dayAt(2, 18, 30)
  const filmDone = dayAt(5, 18)
  const postDay = dayAt(6, 9)
  const coffee = week(4) + 2 * DAY
  const firstDay = week(10)
  const en = (t: number) => fmtDay(t, 'en')
  const t = (id: string, authorId: string, at: number, text: L, extra: Partial<Message> = {}): Message => ({ id, kind: 'text', authorId, at, visibility: all, text, ...extra } as Message)

  const todos: Todo[] = [
    { id: 'hd-t1', text: { fr: 'Construire la démo', en: 'Build the demo' }, assigneeId: 'alex', due: dayAt(-1, 18), done: true },
    { id: 'hd-t2', text: { fr: 'Écrire le paragraphe « pourquoi moi » sans le mot passionné', en: 'Write the "why me" paragraph without the word "passionate"' }, assigneeId: 'alex', due: dayAt(-2, 18), done: true, source: { fr: 'Damien', en: 'Damien' } },
    { id: 'hd-t3', text: { fr: 'Répéter un pitch de 2 minutes avec Damien', en: 'Rehearse a 2-minute pitch with Damien' }, assigneeId: 'alex', due: rehearsal, done: false, source: { fr: 'Damien', en: 'Damien' } },
    { id: 'hd-t4', text: { fr: 'Filmer la démo sur téléphone, tablette et ordinateur', en: 'Film the demo on phone, tablet and desktop' }, assigneeId: 'alex', due: filmDone, done: false },
    { id: 'hd-t5', text: { fr: 'Relire la démo comme un Googler : qu’est-ce qui fait grimacer ?', en: 'Read the demo as a Googler would: what makes them wince?' }, assigneeId: 'damien', due: dayAt(1, 18), done: false },
    { id: 'hd-t6', text: { fr: 'Publier sur X en taguant Google', en: 'Post on X, tagging Google' }, assigneeId: 'alex', due: postDay, done: false },
    { id: 'hd-t7', text: { fr: 'L’envoyer à cinq personnes que ça intéresserait vraiment', en: 'Send it to five people who would actually care' }, assigneeId: 'alex', due: dayAt(7, 18), done: false },
    { id: 'hd-t8', text: { fr: 'Arrêter d’ajouter des fonctionnalités', en: 'Stop adding features' }, assigneeId: 'alex', due: dayAt(0, 18), done: false, source: { fr: 'Damien, trois fois', en: 'Damien, three times' } },
  ]

  const artifacts: Artifact[] = [
    {
      id: 'hd-doc-strategy', kind: 'doc', title: { fr: 'La stratégie', en: 'The strategy' }, ownerId: 'alex', updatedAt: dayAt(-5, 18, 40),
      sections: [
        { heading: { fr: 'Le pari', en: 'The bet' }, body: { fr: 'Montrer plutôt que raconter. Une vision produit qui fonctionne vaut plus qu’un CV. Un CV dit ce que j’ai fait ; une démo montre ce que je ferais, et comment je pense. Personne n’a jamais transféré un CV à un ami en disant « il faut que tu voies ça ».', en: 'Show, don’t tell. A working product vision beats a résumé. A résumé says what I did; a demo shows what I would do, and how I think. Nobody has ever forwarded a résumé to a friend saying "you have to see this".' } },
        { heading: { fr: 'Pourquoi Google', en: 'Why Google' }, body: { fr: 'Parce que la réponse à « qu’est-ce qui vient après l’email et le chat » ne peut venir que de quelqu’un qui a déjà l’email, le chat, les documents, les réunions et un modèle. Google a les cinq. Cette démo imagine la mise à jour de Google Chat que j’aimerais voir sortir, et que j’aimerais construire.', en: 'Because the answer to "what comes after email and chat" can only come from someone who already has email, chat, docs, meetings and a model. Google has all five. This demo imagines the Google Chat update I would love to see ship, and would love to build.' } },
        { heading: { fr: 'Pourquoi maintenant', en: 'Why now' }, body: { fr: 'Alphabet a annoncé environ 200 milliards de dollars d’investissements pour 2026, en grande partie pour l’IA. Et pourtant le travail, lui, se passe encore dans des emails. Le décalage entre ce qui est investi et ce que les équipes vivent chaque jour est l’espace produit le plus intéressant que je connaisse.', en: 'Alphabet guided around $200B of capital spending for 2026, much of it for AI. And yet work itself still happens in email. The gap between what is being invested and what teams actually live with every day is the most interesting product space I know.' } },
        { heading: { fr: 'Ce que la démo prouve sur moi comme PM', en: 'What the demo proves about me as a PM' }, body: { fr: 'Je vois un problème produit (le travail est éparpillé entre email, chat et six outils). Je le cadre en une phrase (un projet = un chat + une vue partagée, une seule IA). Je livre en quelques jours, pas en quelques trimestres. Et j’utilise l’IA pour le faire : concept, design et construction avec des agents, sans équipe, sans budget. C’est exactement le métier de PM que je veux faire : décider ce qui compte, puis le rendre réel.', en: 'I see a product problem (work is scattered across email, chat and six other tools). I frame it in one sentence (a project is a chat plus a shared view, with one AI). I ship in days, not quarters. And I use AI to do it: concept, design and build with agents, no team, no budget. That is the PM job I want: decide what matters, then make it real.' } },
        { heading: { fr: 'Le plan', en: 'The plan' }, body: { fr: `Construire (fait). Polir sur téléphone et tablette (en cours). Filmer un court film de motion design (${en(filmDone)}). Publier sur X en taguant Google (${en(postDay)}). Relancer : cinq personnes qui s’y intéresseraient vraiment, puis les gens qui recrutent. Pas de message à froid sans la démo en lien.`, en: `Build (done). Polish on phone and tablet (in progress). Film a short motion design piece (${en(filmDone)}). Post on X, tagging Google (${en(postDay)}). Follow up: five people who would actually care, then the people who hire. No cold message without the demo link.` } },
        { heading: { fr: 'À quoi ressemble le succès', en: 'What success looks like' }, body: { fr: 'Une conversation avec quelqu’un de l’équipe produit IA de Google. Pas un poste promis, une conversation. Si la démo fait sourire un Googler et qu’il la transfère à un collègue, elle a fait son travail. Si personne ne répond, j’aurai quand même construit le produit que je voulais voir exister.', en: 'A conversation with someone on Google’s AI product team. Not a promised job, a conversation. If the demo makes a Googler smile and they forward it to a colleague, it did its job. If nobody answers, I still built the product I wanted to exist.' } },
        { heading: { fr: 'Plan B', en: 'Plan B' }, body: { fr: 'Damien : « Il n’y a pas de plan B, tu l’as déjà dit à tout le monde. »', en: 'Damien: "There is no plan B, you already told everyone."' } },
      ],
    },
    {
      id: 'hd-slides-pitch', kind: 'slides', title: { fr: 'Le pitch de 2 minutes', en: 'The 2-minute pitch' }, ownerId: 'alex', updatedAt: dayAt(0, 10, 30),
      slides: [
        { title: { fr: 'Le travail se passe encore dans des emails', en: 'Work still happens in email' }, subtitle: { fr: 'L’email attend, le chat perd, les outils s’empilent', en: 'Email waits, chat loses things, tools pile up' }, accent: '#4285f4' },
        { title: { fr: 'One Place', en: 'One Place' }, bullets: [{ fr: 'Un projet = un chat + une vue partagée', en: 'A project is a chat plus a shared view' }, { fr: 'Une seule IA, pas une liste d’agents', en: 'One AI, not a list of agents' }, { fr: 'L’email arrive quand même, et repart depuis le chat', en: 'Email still arrives, and goes back out from the chat' }] },
        { title: { fr: 'Le moment', en: 'The moment' }, bullets: [{ fr: 'Un fournisseur écrit au projet : ça atterrit dans le chat', en: 'A supplier emails the project: it shows up in the chat' }, { fr: 'On répond depuis le chat : il reçoit un email', en: 'Reply from the chat: he gets an email' }, { fr: 'Il n’a jamais eu besoin de compte', en: 'He never needed an account' }], accent: '#34a853' },
        { title: { fr: 'Construit en quelques jours, avec des agents IA', en: 'Built in days, with AI agents' }, bullets: [{ fr: 'Concept, design, code : une personne et des agents', en: 'Concept, design, code: one person and agents' }, { fr: 'Pas de backend, pas de budget, pas d’excuse', en: 'No backend, no budget, no excuses' }, { fr: 'Tout est faux sauf l’idée', en: 'Everything is fake except the idea' }], accent: '#fbbc04' },
        { title: { fr: 'La demande', en: 'The ask' }, subtitle: { fr: 'Je veux construire la vraie version avec l’équipe produit IA de Google. Parlons-en.', en: 'I want to build the real thing with Google’s AI product team. Let’s talk.' }, accent: '#ea4335' },
      ],
    },
    {
      id: 'hd-sheet-tracker', kind: 'sheet', title: { fr: 'Suivi des contacts', en: 'Reach-out tracker' }, ownerId: 'alex', updatedAt: dayAt(0, 8, 50),
      columns: [{ fr: 'Canal', en: 'Channel' }, { fr: 'Qui', en: 'Who' }, { fr: 'Statut', en: 'Status' }, { fr: 'Prochaine étape', en: 'Next step' }, { fr: 'Quand', en: 'When' }],
      rows: [
        ['X post', 'Everyone, and Google', 'Waiting for the film', 'Post with the 60-second cut', en(postDay)],
        ['Warm intro 1', 'A mutual friend who knows a Googler', 'Ready', 'Send the link and one paragraph', en(dayAt(7, 9))],
        ['Warm intro 2', 'A former colleague, now in a product role', 'Ready', 'Ask for a forward, not a favor', en(dayAt(7, 9))],
        ['Hiring manager outreach', 'AI product team (name to find)', 'Not started', 'Only with the film attached', en(dayAt(9, 9))],
        ['Recruiter', 'None yet', 'Not started', 'Let the post do the work first', en(dayAt(12, 9))],
        ['Careers page', 'The normal way', 'Next', 'Apply too. Damien insists.', en(dayAt(8, 9))],
        ['Friends of friends', 'Five people who would actually care', 'Ready', 'Personal note each, no copy-paste', en(dayAt(7, 9))],
        ['Reply from Google', 'Anyone', 'It has been 0 days', 'Be patient. Nothing is sent yet.', ''],
      ],
    },
  ]

  const blocks: Block[] = [
    {
      id: 'hired-summary', type: 'summary', span: 3, title: { fr: 'Où on en est', en: 'Where things stand' }, updatedAt: dayAt(0, 10, 8),
      text: { fr: `La démo tourne sur ordinateur, téléphone et tablette. Damien a cassé une chose (corrigée) et validé le reste. Prochaine étape : répéter le pitch de deux minutes ${rel(rehearsal).fr}, puis filmer et publier. Gemini propose de finir le film sur une vraie demande plutôt que sur un logo.`, en: `The demo runs on desktop, phone and tablet. Damien broke one thing (fixed) and approved the rest. Next: rehearse the two-minute pitch ${rel(rehearsal).en}, then film and post. Gemini suggests ending the film on an actual ask instead of a logo.` },
      bullets: [
        { fr: `Répétition du pitch ${rel(rehearsal).fr} à 18 h 30`, en: `Pitch rehearsal ${rel(rehearsal).en} at 6:30 PM` },
        { fr: `Film : première coupe pour le ${en(filmDone)}`, en: `Film: first cut by ${en(filmDone)}` },
        { fr: 'Règle de Damien : pas de « passionné », pas de « disrupter »', en: 'Damien’s rule: no "passionate", no "disrupt"' },
        { fr: 'Réponse de Google : aucune. Ça fait 0 jour.', en: 'Reply from Google: none. It has been 0 days.' },
      ],
    },
    {
      id: 'hired-timeline', type: 'timeline', span: 3, title: { fr: 'Le plan', en: 'The plan' },
      items: [
        { id: 'hd-tl1', label: { fr: 'Construire la démo', en: 'Build the demo' }, start: week(-2), end: dayAt(-1, 18), ownerId: 'alex', lane: { fr: 'Construire', en: 'Build' }, color: '#4285f4', progress: 100 },
        { id: 'hd-tl2', label: { fr: 'Polir sur téléphone et tablette', en: 'Polish on phone and tablet' }, start: dayAt(-1, 9), end: dayAt(2, 18), ownerId: 'alex', lane: { fr: 'Construire', en: 'Build' }, color: '#4285f4', progress: 60 },
        { id: 'hd-tl3', label: { fr: 'Film motion design', en: 'Motion design film' }, start: dayAt(1, 9), end: filmDone, ownerId: 'alex', lane: { fr: 'Lancer', en: 'Launch' }, color: '#fbbc04', progress: 10 },
        { id: 'hd-tl4', label: { fr: 'Publier sur X', en: 'Post on X' }, start: postDay, end: postDay, ownerId: 'alex', lane: { fr: 'Lancer', en: 'Launch' }, color: '#ea4335', milestone: true },
        { id: 'hd-tl5', label: { fr: 'Relancer', en: 'Follow up' }, start: postDay, end: dayAt(15, 18), ownerId: 'alex', lane: { fr: 'Lancer', en: 'Launch' }, color: '#ea4335', progress: 0 },
        { id: 'hd-tl6', label: { fr: 'Café avec l’équipe', en: 'Coffee with the team' }, start: coffee, end: coffee, ownerId: 'alex', lane: { fr: 'Google', en: 'Google' }, color: '#34a853', milestone: true },
        { id: 'hd-tl7', label: { fr: 'Premier jour (date à confirmer par Google)', en: 'First day (date to be confirmed by Google)' }, start: firstDay, end: firstDay, ownerId: 'alex', lane: { fr: 'Google', en: 'Google' }, color: '#34a853', milestone: true },
      ],
    },
    { id: 'hired-todo', type: 'todo', span: 2, title: { fr: 'À faire', en: 'To do' }, todos },
    { id: 'hired-notes', type: 'notes', span: 1, title: { fr: 'Pourquoi ça marche', en: 'Why this works' }, text: { fr: 'Un CV se lit. Une démo se transfère.\nLe produit est l’argument : si l’idée est bonne, la candidature l’est aussi.\nConstruit avec des agents IA, pour Google : le moyen est le message.\nC’est drôle, et c’est sérieux. Les deux à la fois, c’est la partie difficile.\nSi ça ne marche pas, j’ai quand même le produit que je voulais voir exister.', en: 'A résumé gets read. A demo gets forwarded.\nThe product is the argument: if the idea is good, so is the application.\nBuilt with AI agents, for Google: the medium is the message.\nIt is funny and it is serious. Both at once is the hard part.\nIf it does not work, I still have the product I wanted to exist.' } },
    {
      id: 'hired-kanban', type: 'kanban', span: 3, title: { fr: 'Les portes d’entrée', en: 'Ways in' },
      columns: [
        { id: 'next', title: { fr: 'À faire', en: 'Next' }, cards: [
          { id: 'hd-k-apply', title: { fr: 'Candidater normalement', en: 'Applying normally' }, assigneeId: 'alex', tag: { fr: 'Idée de Damien', en: 'Damien’s idea' }, note: { fr: 'Les deux à la fois. Ça reste honnête.', en: 'Do both. Keeps it honest.' } },
          { id: 'hd-k-hm', title: { fr: 'Contact direct hiring manager', en: 'Hiring manager outreach' }, assigneeId: 'alex', tag: { fr: 'Après le film', en: 'After the film' }, note: { fr: 'Jamais à froid, toujours avec la démo en lien.', en: 'Never cold, always with the demo link.' } },
        ] },
        { id: 'progress', title: { fr: 'En cours', en: 'In progress' }, cards: [
          { id: 'hd-k-x', title: { fr: 'Le post sur X', en: 'X post' }, assigneeId: 'alex', tag: { fr: 'En attente du film', en: 'Waiting for the film' }, note: { fr: '60 secondes, tagué Google, un seul lien.', en: '60 seconds, tagging Google, one link.' } },
          { id: 'hd-k-warm', title: { fr: 'Introductions chaleureuses', en: 'Warm introductions' }, assigneeId: 'damien', tag: { fr: 'Deux pistes', en: 'Two leads' }, note: { fr: 'Demander un transfert, pas une faveur.', en: 'Ask for a forward, not a favor.' } },
        ] },
        { id: 'done', title: { fr: 'Fait', en: 'Done' }, cards: [
          { id: 'hd-k-build', title: { fr: 'Construire quelque chose qui vaut l’envoi', en: 'Build something worth sending' }, assigneeId: 'alex', tag: { fr: 'Cette démo', en: 'This demo' }, note: { fr: 'Vous êtes en train de la regarder.', en: 'You are looking at it.' } },
        ] },
      ],
    },
    { id: 'hired-people', type: 'people', span: 1, title: { fr: 'Équipe', en: 'Team' } },
    { id: 'hired-files', type: 'files', span: 1, title: { fr: 'Fichiers', en: 'Files' }, artifactIds: ['hd-doc-strategy', 'hd-slides-pitch', 'hd-sheet-tracker'] },
  ]

  const messages: Message[] = [
    {
      id: 'hd-m01', kind: 'text', authorId: 'alex', at: dayAt(-9, 21, 10), visibility: all,
      text: { fr: 'J’ai une idée et tu vas dire non. Au lieu d’envoyer un CV à Google, je construis le produit que j’aimerais construire là-bas. Une vraie démo : ce qui vient après l’email et le chat, comme une mise à jour de Google Chat. Et je leur envoie la démo.', en: 'I have an idea and you’re going to say no. Instead of sending Google a résumé, I build the product I’d want to build there. A working demo: what comes after email and chat, as an update to Google Chat. Then I send them the demo.' },
      reactions: [{ emoji: '🚀', by: ['damien'] }],
      replies: [
        t('hd-m01-r1', 'damien', dayAt(-9, 21, 24), { fr: 'Tu sais que tu pourrais juste candidater ?', en: 'You know you could just apply?' }),
        t('hd-m01-r2', 'alex', dayAt(-9, 21, 26), { fr: 'Je sais. C’est le plan B.', en: 'I know. That’s plan B.' }),
        t('hd-m01-r3', 'damien', dayAt(-9, 21, 27), { fr: 'C’est le plan A. Ça, c’est le plan marrant. Fais les deux.', en: 'That’s plan A. This is the fun one. Do both.' }, { reactions: [{ emoji: '😄', by: ['alex'] }] }),
      ],
    },
    {
      id: 'hd-m02', kind: 'text', authorId: 'alex', at: dayAt(-8, 9, 30), visibility: all,
      text: { fr: '@[Gemini](gemini) en une ligne : pourquoi une démo qui marche vaut plus qu’un CV ?', en: '@[Gemini](gemini) one line: why does a working demo beat a résumé?' },
      replies: [
        t('hd-m02-r1', 'gemini', dayAt(-8, 9, 30) + 15_000, { fr: 'Un CV dit ce que vous avez fait. Une démo montre ce que vous feriez. Et personne n’a jamais transféré un CV à un ami en disant « il faut que tu voies ça ».', en: 'A résumé says what you did. A demo shows what you would do. Also, nobody has ever forwarded a résumé to a friend saying "you have to see this".' }, { reactions: [{ emoji: '💯', by: ['alex', 'damien'] }] }),
      ],
    },
    t('hd-m03', 'damien', dayAt(-6, 12, 5), { fr: 'J’ai lu le brief. Deux choses. Un : c’est bien. Deux : si c’est un pitch produit, il faut que ça ait l’air sorti de chez Google, pas d’un deck de slides. Plat, blanc, aéré. Sinon ils verront le truc avant l’idée.', en: 'Read the brief. Two things. One: it’s good. Two: if it’s a product pitch, it has to feel like Google shipped it, not like a slide deck. Flat, white, airy. Otherwise they’ll see the trick before the idea.' }, { reactions: [{ emoji: '💯', by: ['alex'] }] }),
    { id: 'hd-m04', kind: 'file', authorId: 'alex', at: dayAt(-5, 18, 40), visibility: all, artifactId: 'hd-doc-strategy', text: { fr: 'La stratégie, écrite noir sur blanc pour que j’arrête de la changer.', en: 'The strategy, written down so I stop changing it.' }, reactions: [{ emoji: '📌', by: ['damien'] }] },
    t('hd-m05', 'alex', dayAt(-3, 22, 15), { fr: 'Entre nous : j’ai le trac de le publier. Si ça tombe à plat, ça tombe à plat en public.', en: 'Between us: I’m nervous about posting it. If it flops, it flops in public.' }, { visibility: priv('alex', 'damien'), quoteId: 'hd-m03' }),
    t('hd-m06', 'damien', dayAt(-3, 22, 31), { fr: 'C’est une démo, pas un mariage. Pire cas : 40 personnes voient une bonne idée de produit. Meilleur cas : une d’elles travaille chez Google. Publie.', en: 'It’s a demo, not a wedding. Worst case: 40 people see a nice product idea. Best case: one of them works at Google. Post it.' }, { visibility: priv('alex', 'damien'), quoteId: 'hd-m03' }),
    { id: 'hd-m07', kind: 'system', authorId: 'gemini', at: dayAt(-2, 9, 0), visibility: all, icon: 'schedule', text: { fr: 'Pas de réponse de Google pour l’instant. Ça fait 0 jour. Pour être honnête, rien n’a encore été envoyé.', en: 'No reply from Google yet. It has been 0 days. To be fair, nothing has been sent.' } },
    {
      id: 'hd-m08', kind: 'text', authorId: 'alex', at: dayAt(-1, 17, 30), visibility: all,
      text: { fr: 'La démo tourne sur téléphone et tablette. @[Damien Wattez](damien) casse-la. Tape partout.', en: 'The demo runs on phone and tablet now. @[Damien Wattez](damien) break it. Tap everything.' },
      replies: [
        t('hd-m08-r1', 'damien', dayAt(-1, 18, 12), { fr: 'Cassé la réponse privée sur tablette en tapant deux fois. Sinon la lampe en 3D frime et j’adore.', en: 'Broke the private reply on tablet by tapping twice. Other than that, the 3D lamp is showing off and I love it.' }),
        t('hd-m08-r2', 'alex', dayAt(-1, 18, 40), { fr: 'Corrigé. Le double tap est maintenant un simple tap.', en: 'Fixed. The double tap is now a single tap.' }),
      ],
    },
    {
      id: 'hd-m09', kind: 'proposal', authorId: 'gemini', at: dayAt(-1, 17, 50), visibility: all, status: 'pending',
      title: { fr: 'Terminer le film sur la ligne « embauchez-moi »', en: 'End the film on the "hire me" line' },
      description: { fr: 'Vous avez 90 secondes de produit et zéro seconde de demande. Les Googlers sont occupés : dites-leur ce que vous voulez. J’ai écrit la ligne. Vous pouvez la rendre moins modeste.', en: 'You have 90 seconds of product and zero seconds of ask. Googlers are busy: tell them what you want. I drafted the line. You can make it less humble.' },
      action: { type: 'add-todo', blockId: 'hired-todo', todo: { id: 'hd-t9', text: { fr: 'Finir le film sur une ligne : « Construit en quelques jours avec des agents IA. Imaginez avec votre équipe. »', en: 'End the film on one line: "Built in days with AI agents. Imagine what I’d ship with your team."' }, assigneeId: 'alex', due: filmDone, done: false, source: { fr: 'Proposition de Gemini', en: 'Gemini’s proposal' } } },
    },
    { id: 'hd-m10', kind: 'meeting', authorId: 'alex', at: dayAt(0, 9, 15), visibility: all, title: { fr: 'Répéter le pitch', en: 'Rehearse the pitch' }, start: rehearsal, durationMin: 30, attendeeIds: ['alex', 'damien'] },
    t('hd-m11', 'damien', dayAt(0, 9, 40), { fr: 'Avant la répétition : dis-le moi en deux minutes sans le mot « passionné ». Si tu dis « disrupter », je raccroche.', en: 'Before the rehearsal: say it to me in two minutes without the word "passionate". If you say "disrupt", I hang up.' }, { reactions: [{ emoji: '😂', by: ['alex'] }] }),
    {
      id: 'hd-m12', kind: 'text', authorId: 'alex', at: dayAt(0, 10, 5), visibility: all,
      text: { fr: 'Marché conclu. @[Gemini](gemini) mets « répéter le pitch » et « filmer la démo » en haut des tâches, et rappelle-moi d’arrêter d’ajouter des fonctionnalités.', en: 'Deal. @[Gemini](gemini) put "rehearse the pitch" and "film the demo" at the top of the to-dos, and remind me to stop adding features.' },
      replies: [
        t('hd-m12-r1', 'gemini', dayAt(0, 10, 5) + 12_000, { fr: 'Fait. « Arrêter d’ajouter des fonctionnalités » est de nouveau une tâche. C’est la troisième fois que je l’ajoute. Je ne juge pas.', en: 'Done. "Stop adding features" is a to-do again. This is the third time I add it. I am not judging.' }, { reactions: [{ emoji: '😅', by: ['alex'] }, { emoji: '🎯', by: ['damien'] }] }),
      ],
    },
    { id: 'hd-m13', kind: 'file', authorId: 'alex', at: dayAt(0, 10, 30), visibility: all, artifactId: 'hd-slides-pitch', text: { fr: 'Cinq slides pour les deux minutes. La 5 est la demande.', en: 'Five slides for the two minutes. Slide 5 is the ask.' } },
  ]

  const script: ProjectScript = {
    callTitle: { fr: 'Répéter le pitch', en: 'Rehearse the pitch' },
    captions: [
      { who: 'damien', text: { fr: 'Deux minutes. Vas-y.', en: 'Two minutes. Go.' } },
      { who: 'alex', text: { fr: 'L’email, c’est là où le travail attend. Le chat, c’est là où il se perd. One Place, c’est un projet, un chat, une vue partagée, une IA. Rien d’autre.', en: 'Email is where work goes to wait. Chat is where it gets lost. One Place is one project, one chat, one shared view, one AI. Nothing else.' } },
      { who: 'damien', text: { fr: 'Stop. Tu as dit « un » quatre fois. Plus lent. Et montre-moi, ne me raconte pas.', en: 'Stop. You said "one" four times. Slower. And show me, don’t tell me.' } },
      { who: 'alex', text: { fr: 'OK. Regarde. Un fournisseur écrit au projet. Ça arrive dans le chat. Je réponds depuis le chat, ça repart en email. Il n’a jamais eu besoin d’un compte.', en: 'OK. Look. A supplier emails the project. It shows up in the chat. I reply from the chat, it goes back out as an email. He never needed an account.' } },
      { who: 'damien', text: { fr: 'Mieux. C’est ça, le moment. Commence par là.', en: 'Better. That is the moment. Lead with it.' } },
      { who: 'alex', text: { fr: 'Ensuite le tableau : Gemini tient le résumé à jour, le calendrier, les tâches avec des visages. Un membre propose, le propriétaire approuve. De la gouvernance sans réunion.', en: 'Then the board: Gemini keeps the summary current, the timeline, the to-dos with faces. A member proposes, the owner approves. Governance without a meeting.' } },
      { who: 'damien', text: { fr: 'C’est pour qui ? Une phrase.', en: 'Who is it for? One sentence.' } },
      { who: 'alex', text: { fr: 'Toutes les équipes qui vivent dans l’email et le chat et paient six autres outils pour compenser.', en: 'Every team that lives in email and chat and pays for six other tools to make up for it.' } },
      { who: 'damien', text: { fr: 'Bien. Maintenant la demande. Dis-la comme si tu y croyais.', en: 'Good. Now the ask. Say it like you mean it.' } },
      { who: 'alex', text: { fr: 'J’ai imaginé et construit ça en quelques jours, avec des agents IA. Je veux construire la vraie version avec l’équipe produit IA de Google.', en: 'I imagined and built this in a few days, with AI agents. I want to build the real thing with Google’s AI product team.' } },
      { who: 'damien', text: { fr: 'Pas de « passionné », pas de « disrupter ». Une minute cinquante. Envoie.', en: 'No "passionate", no "disrupt". One minute fifty. Ship it.' } },
      { who: 'alex', text: { fr: 'Gemini, note tout avant que je change encore d’avis.', en: 'Gemini, write it down before I change my mind again.' } },
    ],
    callSummary: {
      summary: { fr: 'Répétition du pitch de deux minutes. Damien a coupé la phrase aux quatre « un » et demandé de commencer par le moment où l’email du fournisseur arrive dans le chat. La cible tient en une phrase. La demande finale reste telle quelle, sans « passionné » ni « disrupter ». Chrono : une minute cinquante.', en: 'Rehearsal of the two-minute pitch. Damien cut the sentence with four "one"s and asked to lead with the moment the supplier’s email shows up in the chat. The audience fits in one sentence. The closing ask stays as is, with no "passionate" and no "disrupt". Clock: one minute fifty.' },
      decisions: [
        { fr: 'Le pitch commence par le moment de l’email', en: 'The pitch leads with the email moment' },
        { fr: 'La demande reste : une phrase, sans détour', en: 'The ask stays in: one sentence, no hedging' },
        { fr: 'Aucune nouvelle fonctionnalité avant le film', en: 'No new features before the film' },
      ],
      todos: [
        { text: { fr: 'Filmer la démo dans l’ordre du pitch', en: 'Film the demo in the order of the pitch' }, assigneeId: 'alex' },
        { text: { fr: 'Couper la phrase aux quatre « un »', en: 'Cut the four-"one"s sentence' }, assigneeId: 'alex' },
        { text: { fr: 'Regarder la première coupe et la chronométrer', en: 'Watch the first cut and time it' }, assigneeId: 'damien' },
      ],
    },
    catchUp: {
      text: { fr: `Depuis votre dernier passage : Damien a testé la version téléphone et tablette et trouvé un bug de double tap (corrigé). Gemini propose de finir le film sur une vraie demande. La répétition du pitch est ${rel(rehearsal).fr} à 18 h 30.`, en: `Since you were last here: Damien tested the phone and tablet build and found one double-tap bug (fixed). Gemini suggests ending the film on an actual ask. The pitch rehearsal is ${rel(rehearsal).en} at 6:30 PM.` },
      bullets: [
        { fr: 'Règle de Damien : pas de « passionné », pas de « disrupter »', en: 'Damien’s rule: no "passionate", no "disrupt"' },
        { fr: 'Les cinq slides du pitch sont dans les fichiers, la 5 est la demande', en: 'The five pitch slides are in files, slide 5 is the ask' },
        { fr: 'Réponse de Google : aucune. Rien n’a encore été envoyé.', en: 'Reply from Google: none. Nothing has been sent yet.' },
      ],
    },
    privateReplies: {
      damien: [
        { fr: 'Franchement, c’est prêt. Arrête de polir, filme.', en: 'Honestly, it’s ready. Stop polishing, film it.' },
        { fr: 'Si tu dis « passionné » dans le film, je le commente en public.', en: 'If you say "passionate" in the film, I’ll comment on it in public.' },
        { fr: 'Le moment de l’email, c’est ça qu’ils vont transférer. Garde-le en premier.', en: 'The email moment is what they’ll forward. Keep it first.' },
      ],
      gemini: [
        { fr: 'Je peux chronométrer le pitch pendant la répétition et vous dire où vous ralentissez. En général, c’est à la demande.', en: 'I can time the pitch during the rehearsal and tell you where you slow down. Usually, it’s at the ask.' },
        { fr: 'Statut Google : toujours 0 jour sans réponse. Je mettrai le compteur à jour dès que quelque chose sera envoyé.', en: 'Google status: still 0 days without a reply. I’ll update the counter as soon as something is actually sent.' },
        { fr: 'Pour mémoire, « arrêter d’ajouter des fonctionnalités » est toujours ouvert. Je dis ça, je dis rien.', en: 'For the record, "stop adding features" is still open. Just saying.' },
      ],
    },
  }

  return {
    id: 'hired', name: { fr: 'Entrer chez Google', en: 'Get hired by Google' }, icon: 'rocket_launch', color: '#4285f4',
    description: { fr: 'La stratégie : cette démo. Un produit qui marche vaut plus qu’un CV.', en: 'The strategy: this demo. A working product beats a résumé.' },
    ownerId: 'alex', memberIds: ['alex', 'damien'], externalIds: [],
    unread: 2, mentions: 1, messages: [...messages].sort((a, b) => a.at - b.at), blocks, artifacts, script, address: 'hired@oneplace.example',
  }
}
