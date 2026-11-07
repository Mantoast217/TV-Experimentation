# Team dashboard: accessibility checks still to do by hand

The dashboard is built to meet WCAG 2.2 level AA, and the automated tests below pass. Automated
tests can't confirm that it does. This page lists the checks a person still needs to do, and
what should happen in each.

Record each result in the table at the end, with the date, the device and the software version.

## What the automated tests already cover

Run them with `npm test`, `npm run test:e2e` and `npm run check:contrast`.

| Check | Where |
| --- | --- |
| Colour contrast of every token pair, light and dark, against 4.5:1 for text and 3:1 for controls, borders, focus ring and timeline graphics. Runs on every build. | `scripts/check-contrast.mjs` |
| axe (WCAG 2.2 A and AA rules) in jsdom: list, timeline, dialog, empty state, hand-off | `src/components/TeamDashboard.test.tsx` |
| axe in Chromium, light and dark, including rendered contrast: list, timeline, phone width with the selection bar, empty state, dialog, hand-off | `e2e/axe.spec.ts` |
| Keyboard only: skip link, search, status filter, sort, view switch, selection, hand-off and Back, dialog focus trap and Esc | `e2e/keyboard.spec.ts` |
| Every control reachable by Tab, with an outline when focused, in normal and forced colours | `e2e/keyboard.spec.ts` |
| Reflow at 320px, with only the timeline scrolling sideways | `e2e/layout.spec.ts` |
| 200% zoom, simulated as a 640px-wide window | `e2e/layout.spec.ts` |
| Text spacing (WCAG 1.4.12) loses no text | `e2e/layout.spec.ts` |
| Forced colours: timeline outlines, now line and best-hour boxes keep a visible border | `e2e/layout.spec.ts` |
| Focus never hidden behind the sticky selection bar, desktop and phone, list and timeline | `e2e/focus-not-obscured.spec.ts` |
| Status messages for results, sort, selection and copying are live regions | `src/components/TeamDashboard.test.tsx` |

## Before you start

- Use the deployed site or `npm run dev`, and open `/team-dashboard/`.
- Some checks need people selected: tick 2 or 3 checkboxes.
- The page reads the clock once, when it loads. Reload it to see different statuses.

## 1. Screen readers

Do these with each of:

- NVDA with Firefox and with Chrome, on Windows
- JAWS with Chrome, on Windows
- VoiceOver with Safari, on macOS
- VoiceOver with Safari, on iPhone
- TalkBack with Chrome, on Android

### Page structure

- [ ] The page title is "Team dashboard".
- [ ] The headings list shows "Team dashboard" (level 1), "Summary" and "Kestrel Global team"
      (level 2), and one level 3 heading per status group.
- [ ] Landmarks include a banner, main and content info. The skip link moves to the main content.

### List view (desktop width)

- [ ] The table is announced with its name, "Kestrel Global team, grouped by status", and its
      number of rows and columns.
- [ ] Moving between cells announces the column header ("Local time") and the person's name as
      the row header.
- [ ] Each status group's heading row is announced, for example "Working now (5)".
- [ ] Every row announces its status in words, not just a symbol.
- [ ] The sort buttons announce whether the column is sorted ascending, descending or not.
- [ ] Sorting announces the result, for example "Sorted by name, A to Z.", without moving focus.

### Cards (phone width or zoomed in)

- [ ] Each status group is a list. Each card's name is a level 4 heading.
- [ ] Each checkbox is announced as "Select" followed by the person's name.

### Search, filters and status messages

- [ ] The search box announces its label and its hint, "For example, Tokyo, Japan, JST or UTC+9".
- [ ] Typing announces the new count, for example "Showing 1 of 11 people", without moving focus.
- [ ] Ticking or clearing a checkbox announces the count, for example "2 people selected".
- [ ] With no results, the message naming the search is read, and "Clear search and filters"
      returns focus to the search box.

### Timeline view

- [ ] The View radio buttons are announced as a group called "View".
- [ ] The best-hours sentence is read in full.
- [ ] Each person's row reads their name, status and "Working hours: … local, … your time".
- [ ] The bars, hour scale, now line and overlap numbers are **not** read out.
- [ ] The timeline region is announced with its name and can be scrolled with the arrow keys.

### Dialog

- [ ] Opening a person's details announces a dialog named after the person.
- [ ] Focus stays inside the dialog. Esc closes it and focus returns to the person's name.
- [ ] "Add to meeting" announces "Added to the meeting. 1 person selected." (or similar).
- [ ] "Copy email" announces "Email address copied." When copying is blocked, the failure
      message is read instead.

### Hand-off step

- [ ] "Find a meeting time" moves focus to the "Find a meeting time" heading, and the page
      title changes to "Find a meeting time – Team dashboard".
- [ ] "Back" returns focus to the "Find a meeting time" button.

## 2. Zoom to 200% and 400%

Use the browser's own zoom (Ctrl or Cmd and +) on a desktop window 1280 pixels wide.

- [ ] At 200%, all text and controls are readable and usable, nothing overlaps, and the page
      doesn't scroll sideways.
- [ ] At 400%, the list shows as cards, the page doesn't scroll sideways, and every control
      still works.
- [ ] At 400% in the timeline, only the timeline area scrolls sideways, and each person's text
      fits on screen without scrolling.
- [ ] With people selected, the selection bar doesn't cover so much of the screen that the
      page is hard to use, and tabbing never hides the focused control behind it.

## 3. Forced colours

Use Windows contrast themes (Settings, Accessibility, Contrast themes). Try a dark theme and a
light one, in Edge or Chrome.

- [ ] All text is readable, and every control has a visible border or outline.
- [ ] The status shapes (●, ◐, ○) are visible next to their words.
- [ ] Every control shows a visible focus outline when tabbed to, including the search box,
      the menus, the buttons, the checkboxes and the View options.
- [ ] Checkboxes and radio buttons show whether they're selected.
- [ ] In the timeline, the bar outlines, the now line and the boxes around the best hours are
      visible.
- [ ] The dialog has a visible edge and its buttons are visible.

## 4. A real 320px-wide device

Use a phone that's 320 CSS pixels wide (for example an iPhone SE, 1st generation) or a phone
with its display zoom set so that it behaves like one.

- [ ] The page doesn't scroll sideways, apart from the timeline area.
- [ ] Every control can be tapped without hitting its neighbour.
- [ ] The selection bar doesn't hide the controls you're using.
- [ ] The dialog fits on screen and can be scrolled if needed.
- [ ] Rotating to landscape still works.

## 5. Other checks worth doing

- [ ] Keyboard in Safari (turn on "Press Tab to highlight each item on a webpage") and Firefox.
- [ ] Voice control (Voice Control on macOS or iOS, or Dragon on Windows): say "Click Find a
      meeting time", "Click Select Hana Kobayashi" and "Click Timeline".
- [ ] Text-only zoom (Firefox, View, Zoom, Zoom text only) at 200%.
- [ ] Usability testing with disabled people, including screen reader users. This hasn't been
      done yet.

## Results

| Date | Check | Device and software | Result | Notes |
| --- | --- | --- | --- | --- |
| | | | | |
