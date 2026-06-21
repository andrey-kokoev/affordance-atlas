# UI Snapshot Review Inventory

This file enumerates Affordance Atlas screens and UI states that require visual snapshot coverage and review. It is an inventory, not evidence that every state is already covered.

## Viewports

Every applicable state should be reviewed at these viewport classes:

- Mobile narrow: 390 x 844
- Tablet: 768 x 1024
- Desktop: 1280 x 900
- Wide desktop: 1440 x 1000

## Global Shell

- Home route header, online
- Home route header, connecting
- Home route header, offline
- Admin route header, online
- Admin route header, connecting
- Admin route header, offline
- New chat button normal, hover, focus-visible
- Back to app button normal, hover, focus-visible
- Connection status badges: online, connecting, offline

## Home Chat: Empty State

- Empty chat initial state
- Empty chat with input focused
- Empty chat with typed valid query
- Empty chat with disabled input while offline/connecting
- Example query buttons normal, hover, focus-visible
- Long example query wrapping
- Empty activity sidebar
- Mobile empty activity section below composer

## Home Chat: Submission And Research

- Query submitted with user message visible
- System “looking that up” message
- Busy/submitting state with controls disabled
- Active research indicator
- Active research actions: View job, Cancel research
- Active research elapsed-time display
- Cancelled active research state
- Recovery to enabled composer after research finishes/fails/cancels

## Chat Messages

- User message, short text
- User message, long wrapping text
- User message with punctuation/URLs
- System message
- Assistant plain failure message
- Assistant success answer with one result
- Assistant success answer with multiple results
- Assistant answer with no next actions
- Assistant answer with next actions
- Long assistant answer wrapping
- Message timestamp alignment across roles
- Message stack with enough content to scroll
- Auto-scroll bottom state after new message

## Answer Result States

- Verified/high-confidence result
- Extracted/non-high-confidence result
- Candidate/unverified result warning
- Result with missing place name
- Result with missing schedule/time
- Result with place address
- Result without place address
- Long place name wrapping
- Long recurrence label wrapping
- Multiple fact cards in desktop grid
- Fact cards on mobile single column
- Caveats absent
- Caveats present and collapsed
- Caveats expanded

## Evidence Details

- Evidence details collapsed
- Evidence details expanded with one source
- Evidence details expanded with multiple sources
- Long source title wrapping
- Long source URL wrapping
- Retrieved timestamp display
- Evidence span present
- Evidence span absent
- Long extracted evidence text
- Evidence source link hover/focus-visible

## Failure And Error States

- Research failure assistant message
- Failed job in activity list
- Failed job with technical details collapsed
- Failed job with technical details expanded
- Error banner visible
- Long error message wrapping
- Unsupported query failure
- Source fetch failure/candidate page failure message
- “Could not extract usable schedule” message
- Clifton Park Mass failure scenario
- Recovery controls after failure

## Activity / Research Jobs

- No jobs state
- Queued job
- Running job
- Completed job
- Failed job
- Cancelled job
- Highlighted/focused job
- Job with long query text
- Job outcome for completed answer
- Job outcome for queued/running elapsed state
- Job status badge colors for every status
- Job link hover/focus-visible
- Activity list with many jobs and scroll pressure
- Activity sidebar on desktop
- Activity section on mobile

## Admin: Unauthenticated Gate

- Token gate empty
- Token gate input focused
- Token gate with typed token
- Unlock button disabled
- Unlock button enabled
- Unlock button loading/verifying
- Invalid token error
- Long error text wrapping
- Gate panel at desktop width
- Gate panel at mobile width

## Admin: Authenticated Summary

- Saved bearer token row
- Masked token display
- Copy token button normal/hover/focus-visible
- Copy header button normal/hover/focus-visible
- Forget token button normal/hover/focus-visible
- Copy success message
- Status summary with no counts
- Status summary with all statuses
- Recent jobs collapsed
- Recent jobs expanded with no jobs
- Recent jobs expanded with multiple jobs
- Recent job with error message
- Long recent job query wrapping

## Admin: Data Table Explorer

- Data table explorer initial state
- Table tabs with few tables
- Table tabs with many tables and horizontal overflow
- Active table tab
- Table tab hover/focus-visible
- Refresh button normal/hover/focus-visible
- Refresh button loading/disabled
- Table metadata row
- Empty table state
- Populated table state
- Previous/next pagination disabled
- Previous/next pagination enabled
- Pagination while loading
- Narrow viewport table horizontal scroll
- Sticky header behavior during vertical scroll

## Admin: Table Content

- Short cell values
- Long cell values clipped to expected lines
- Long cell title/tooltip availability
- URL-like cell values
- JSON-like cell values
- Null/empty cell values
- Timestamp cell values
- Many columns forcing horizontal scroll
- Many rows forcing vertical scroll
- Header text wrapping/overflow
- Row hover/focus behavior if added later

## Interaction And Accessibility Visual States

- Keyboard focus-visible on all buttons
- Keyboard focus-visible on inputs
- Keyboard focus-visible on links
- Keyboard focus-visible on details summaries
- Disabled state contrast for all buttons
- Placeholder text contrast
- Text selection/readability in inputs
- Hover states for interactive controls
- Reduced content width on small screens
- No horizontal page overflow at every target viewport
- No text clipped inside buttons
- No overlapping text or controls

## Responsive Layout Stress Cases

- 320px minimum width
- 390px mobile width
- 768px tablet breakpoint
- 960px content max-width boundary
- 1280px desktop
- 1440px wide desktop
- Very tall page after many messages
- Very tall admin table page
- Browser zoom/text scaling risk states, if supported by test harness

## Snapshot Coverage Priority

- P0: empty home, active research, success answer, failure answer, admin gate, authenticated admin table
- P1: job status variants, evidence expanded, caveats expanded, admin summary, long text wrapping
- P2: hover/focus-visible states, table pagination/loading, tablet/wide desktop variants
