# One Place: product & design brief

**Concept**: a front-only demo (all data fake, no backend, no real AI) of what comes after email, chats and scattered apps. Imagined as an update of Google Chat, in Google's art direction, powered by Google's foundations (Drive, Docs, Sheets, Slides, Meet, Gemini). The audience is Google itself: it must feel as if Google shipped it. Author: Alex Cormeraie. It is openly a concept: a permanent "Concept" chip and "Not a Google product" line. **No Google logo files** (own marks only), no login form.

## The idea in one line
A project is a chat + a shared view. Everything happens there. No mail, no other apps, no sub-agents.

## One view, always (3 columns, on the white panels over a `--bg` body)
`[ Projects rail 256 ] [ Project chat ~440 ] [ Right pane: Board | open document | live call ]`
Header 52px across the top with search pill. Measured Gmail spacing: panels separated by 8px, radius 16.

### Tablet and phone
- **900-1279, tablet landscape**: 72px navigation rail (hamburger opens it as a drawer over a scrim) + chat + right pane. The chat has its own tablet width (`chatWidthTablet`), `railCollapsed` only applies from 1280.
- **600-899, tablet portrait and a phone on its side**: rail + one pane, with Chat / Board in `ProjectBar`. Chat 320 + board 376 at 768 would be two cramped panes.
- **Up to 599, phone**: bottom bar with Home, Projects, You. A project is a screen of its own, as a space in the Google Chat app: back arrow, Chat / Board (and Call during a call), the board's tabs under the thumb. Popovers and dialogs are bottom sheets, also on any screen under 480 high.
- Panes that are out of sight stay laid out and parked off-screen, so scroll, drafts and a running call survive switching and rotating. Chat rules for these sizes live in `src/chat/chat-responsive.css`.

## Rules of the product (what the demo must prove)
1. **One AI**: `@Gemini` in the composer; never a list of agents. It does everything: recap, to-dos, build a block, draft a doc, book a meeting, draft a reply to a mail.
2. **Mail is dead but mail still arrives**: every project has an address. Outside people write by mail; it lands as a message in the chat. Replying from chat sends a mail back. They do not need an account.
3. **Private messages in context**: `Reply privately` on any message, or pick a person in the composer. It shows inline in your own timeline with a faint purple tint and lock, "Only you and Maya can see this". Everyone else does not see it at all (prove it via "View as").
4. **Same main view for everyone**: the Board: Gemini's "where things stand", timeline, to-dos with faces, files, next meetings, 3D, charts. Blocks are simple templates.
5. **Governance**: the owner adds blocks directly, or by asking Gemini. Members *propose*: it posts a proposal card in the chat; the owner approves or declines. Approved → the block arrives on the board with an animation.
6. **Calls & meetings are in the project**: a call opens in the right pane with the chat still beside it. Meeting cards in chat. A guest can be invited just for a call, with no access to the project. On hang-up, Gemini posts summary + decisions and puts the to-dos on the board.
7. **Docs/Sheets/Slides/Drive are in the pane**: never a new tab, never another app.

## View as (the demo's key trick)
Avatar menu switches persona: **Alex (owner)**, **Tom (member: proposes)**, **Nora (guest: sees only the call she was invited to)**. Private messages vanish accordingly.

## Tokens (measured on Gmail 06/11/2026 → `src/tokens.css`)
Font Google Sans (self-hosted), body 14/20. Icons Material Symbols Outlined (`<Icon name="…">`).
- body bg `#f8fafd`; panels white radius 16; search pill `#e9eef6` 720×48 radius 24
- compose FAB `#c2e7ff` on `#001d35`, 56h radius 16, weight 500
- nav item 32h, radius `0 16px 16px 0`, active `#d3e3fd`, unread count 12px bold
- list row 40h, inset hairline `rgba(100,121,143,.12)`, read row `#f2f6fc`
- active tab `#0b57d0`, text `#1f1f1f`, secondary `#5f6368`/`#444746`
- Chat (public product visuals): composer is a pill in `--surface-2` with a round `+` in `--compose`, message text in soft `--surface-2` rounded bubbles only for own messages; avatar + name above. Call controls round; hang-up is a red pill. Gemini panel: cards in `--surface-1`, radius 12, four-pointed sparkle.

## Craft rules
- Google restraint: flat, airy, white. No heavy shadows, no gradient except Gemini. No cards in cards. Emphasized easing `--ease`, `--ease-out`; 120-350 ms; things arrive, they don't bounce. Respect reduced motion (global rule exists).
- **The product is English only** (Alex, 06/11/2026): the language is forced to `en` and there is no language switch. The code keeps the `t({fr,en})` form and the French texts are simply not shown. Every visible string must be natural English.
- All colors via tokens (dark mode must work). Reuse `src/ui/kit.tsx` (Icon, Sparkle, Avatar, AvatarStack, Button, IconButton, Chip, Dialog, Menu) and classes `.input .field .card .gemini-text`.
- Keyboard & screen reader: real buttons, aria-labels (both languages via t), visible focus, Esc closes, chat is `role="log"`. Touch targets ≥ 40px on mobile. No horizontal page scroll.
- Long text must truncate or wrap, never break layouts. Empty states exist. Double clicks safe.

## Calm (Alex, 06/11/2026: "make it less noisy", target: as calm as Gmail)
One idea per screen, lots of white, color only where it means something. Remove repetition, not capability.
- **Color has a meaning or it goes**: late is red, live is green, today and links are blue, private is a faint purple. Project icons are neutral, the shape identifies them. Timeline and budget: grays and a soft blue, color only for today and what is late or over plan.
- **Tab row, left to right, in every project**: Overview; To-do, Roadmap, Calendar (always there, created empty on first use; Calendar also lists the project's meetings); a thin divider; the middle: everything @Gemini made for this project, a tiny sparkle and its title, the only part that scrolls, with a soft edge fade only when there is more to see, ending in `+`; then fixed on the right the Call, Files and open documents (those without room go in the Files menu); the Gemini icon with a tiny count. Summary opens from its tile, People from the header faces: no tab, a hidden `data-tab` that links can press. Phone: Overview, To-do, Roadmap, Calendar, Files, a sparkle opening a "Made by AI" sheet, Gemini. An open block from the middle says "Made by Gemini · updated" and offers "Ask Gemini to update", which fills the composer through `oneplace:compose`.
- **Overview never scrolls at 1512x949**: one sentence, next meeting, timeline, the 3D, three to-dos, one number and one bar. People, Files and Notes have no tile. No fills, no borders on tiles.
- **Progressive**: row actions on hover or focus with a mouse (always on touch) except one decision; suggestions and the Everyone switcher only while composing; Things to try is one row until opened. Lists show 3 or 4 rows, then Show more.
- **Private exchange**: lock line and quote on its first message only, the tint carries the rest.
- **Few toasts**, a few words, no icon. If the screen already shows it happened, no toast. Motion: state changes only, nothing that runs by itself except a Gemini thinking shimmer.
- Fictional people and companies only. No em dashes in any copy.
