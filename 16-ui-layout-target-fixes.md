# UI Layout Target Fixes

## Evidence Summary

Investigation confidence before implementation: CL 0.96.

Observed live layout behavior on 2026-06-20:

- Empty chat has no horizontal overflow at 390px or 320px, but the empty message panel consumes too much vertical space.
- Unverified answer desktop layout clips the top of the assistant bubble inside the fixed-height messages pane after auto-scroll. At 1280x900, the assistant bubble measured y=-44 while the messages pane starts at y=69.
- Unverified answer mobile layout does not overflow, but the long answer pushes the input and jobs activity far down the document.
- Admin table avoids page-level overflow, but the table is 3920px wide inside a 892px desktop wrapper, 330px wrapper at 390px, and 260px wrapper at 320px.
- Admin page is a long vertical slab, around 2600px tall on mobile after authentication.

## Target Fixes

1. Prevent desktop chat message clipping while keeping the input reachable.
   - Keep a bounded desktop transcript pane so the input remains near the first viewport.
   - Use smart auto-scroll: if the latest message is taller than the pane, align that message to the top instead of scrolling to its bottom and clipping its beginning.

2. Reduce empty-state vertical waste.
   - Empty sessions should not reserve the same height as long transcripts.
   - The activity/jobs area should appear sooner on mobile.

3. Improve mobile activity layout.
   - Rename and visually simplify the jobs area.
   - Reduce padding and make it feel like a compact activity section rather than a desktop sidebar copied below chat.

4. Improve unverified answer density.
   - Keep the strong trust warning, but reduce repeated vertical padding where possible.
   - Preserve collapsed evidence/details by default.

5. Improve admin table ergonomics without hiding data.
   - Keep horizontal scrolling for wide tables.
   - Make the wrapper use more available viewport height.
   - Reduce row/table height enough for scanning.
   - Preserve readable column widths and sticky headers.

6. Improve admin mobile hierarchy.
   - Reduce mobile padding and vertical gaps.
   - Keep tabs horizontally scrollable but denser.

## Acceptance Criteria

- Chat page scroll width equals client width at 1280px, 390px, and 320px.
- In the known unverified-answer session, the assistant bubble top is not above the messages pane top on desktop.
- In empty mobile chat, jobs/activity appears within the first viewport at 390px and 320px.
- Source/evidence details remain closed by default.
- Admin page scroll width equals client width at 1280px, 390px, and 320px.
- Admin table remains horizontally scrollable inside its wrapper, not the page.
- Typecheck and build pass.
- Live deployed checks confirm the layout metrics after implementation.
