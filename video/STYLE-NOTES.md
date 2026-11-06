# Style notes: what a Google product film actually does

Reference only. No footage, frame, character or music from these films is used in ours.

## Films studied (watched through YouTube's 1 frame per second storyboards, then exact frames at chosen timestamps)

| Film | Channel | Date | Length | URL |
|---|---|---|---|---|
| Create faster with Gemini in Google Workspace | Google Workspace | 2026-03-10 | 1:15 | https://www.youtube.com/watch?v=o5Ur1pm4oDA |
| We're introducing Workspace Intelligence | Google Workspace | 2026-04-22 | 1:36 | https://www.youtube.com/watch?v=oqcESYsJCec |
| The best of Google AI is now part of Workspace | Google Workspace | 2025-01-16 | 0:15 | https://www.youtube.com/watch?v=3lauPpvdYU8 |
| New Home (Gemini, Super Bowl 2026) | Google | 2026-02-05 | 1:00 | https://www.youtube.com/watch?v=Z1yGy9fELtE |
| Google Pixel 11 Pro, The Next Obvious Move | Made by Google | 2026-07-29 | 0:30 | https://www.youtube.com/watch?v=PmV-IMX0YNQ |
| Google Pixel 11 Pro, Meet 11 | Made by Google | 2026-08-10 | 0:15 | https://www.youtube.com/watch?v=GNuXueQ1BYc |

Limit: frames were studied, the soundtracks were not analysed. "Create faster" is captioned "[MUSIC PLAYING]" with no voice-over. Sound choices below rest on that and on general knowledge of the genre.

A trap to remember: the pastel corners and dot grid visible in our Arc screenshots are Arc's agent overlay, NOT the film. The storyboards prove the background is plain white.

## The grammar ("Create faster" is the closest model)

**Background.** Pure white, always. Text #1f1f1f-ish. Colour comes only from product icons, the Gemini gradient, and one word in blue.

**Type.** Google Sans, medium weight (500), very large: about 200 px on a 1920 frame (roughly 11% of the width) for a statement, line-height about 1.15, tracking slightly tight. Centred. Two lines at most, three or four words per line. Sentence case. Almost no punctuation. A statement holds 1 to 1.5 s.

**How words arrive.**
- Type-on: the line writes itself, with a thick caret in the colour of the next icon (blue, then green, then yellow). Caret width about 2% of the type height x 1.5.
- Icons inline with the words: real product icon inside a tile with a very light grey fill (#f3f3f3), about 1.3x the type height, radius about 18% of the tile. "Now [Drive] you [Docs] / can [Sheets] ask [Slides]".
- Word wheel: a vertical stack of words, the active one sharp and blue in the centre, the others grey, blurred and fading towards the edges. Rolls with strong motion blur ("discover, create, design, build").
- Words leave fast with real motion blur, never a plain fade.

**How UI is shown.** Never a whole screen recording that sits still.
- Isolated element floating on white: one composer pill, one chat card, one chip row. Shown huge: UI text is around 60 px on 1920.
- Edges fade or run off frame. Elements cut by the frame are normal: "...ails for my upcoming trip to Nashville".
- The camera rides the action: a push into the send button, a pan along the typed sentence.
- 3D tilt: a card or window at a few degrees of X and Y rotation, drifting slowly, background layer blurred behind it (depth of field).
- Shadow: very soft and blue-tinted, large radius, never grey or hard. Corner radius large.
- A big white hand cursor with a black outline presses buttons, with a small scale press.
- Floating chips with app icons and document names drift around the main idea ("Health Log", "Life Updates"), in several depths, some blurred.
- Gemini at work = a soft blue glow around the frame edge (about 3 to 4% of the width, feathered), and a spinning sparkle plus "Collecting info...", shimmering blue skeleton lines, tip text with a blue to violet gradient.

**Transitions.** Hard cuts on the beat, or match moves: the element of the next shot grows from the previous one. Whip with motion blur. Sparkle grows to fill, then lands. Ending: the camera dives through the counter of a letter O to a tiny sparkle, which becomes the logo.

**Pace.** "Create faster": about 30 shots in 75 s, 2.5 s on average. Text beats 1 to 1.5 s, UI beats 2 to 4 s. Long holds only when a result lands. "The best of Google AI": 8 shots in 15 s. "New Home" (emotional peak of the genre): holds of 3 to 5 s on the images that matter, then the typing returns; the line "A new kind of help from Google" sits small and centred on a still image for 3 s.

**Motion.** Fast start, long soft landing: an emphasized decelerate, approximately cubic-bezier(.05,.7,.1,1), 400 to 700 ms. Everything overshoots nothing. No bounce. Real motion blur on anything fast. Slow continuous drift (1 to 2% scale) on holds, so nothing is ever dead still.

**Word and icon clouds.** "The best of Google AI": the word sits centred, product icons at several sizes scattered around it, flying outward slowly, cut by the frame edges.

**Dark films.** Pixel teasers: black, light rims, small rose-gold type. Not our register, but they show the discipline: very few elements, long silence, then the logo.

**Ending.** Product name, large and calm, one line. Gemini lockup. Then a small logo alone on white or black for 1 s. Legal line very small, light grey, at the bottom when needed ("Sequences shortened. Results may vary.").

**Sound (genre).** Light, rhythmic, optimistic, no voice-over in the demo-led films. Sync of picture to beat. Short UI ticks and soft whooshes under the moves. A clean ending.

## What we do with it
- White, Google Sans 500, huge centred lines, 200 px at 1920, 150 to 170 px at 1080 square, type-on with coloured caret, inline icon tiles.
- Real footage, cropped close, feathered into white, tilted a few degrees, soft blue shadow, big hand cursor.
- 180 degree shutter motion blur made for real by sampling each frame several times and averaging.
- Blue edge glow when Gemini works.
- Average 2.5 s a shot, one long hold: the call and its wow.
- End on our own mark, not Google's.
