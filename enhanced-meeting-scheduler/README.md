# Meeting Scheduler

A multi-timezone meeting booking screen: add the timezones you need to coordinate
across, pick a date and time range, and see local times (with day-offset chips)
per zone — plus a recommended time slot that stays within everyone's working and
awake hours. Built with React, Vite, TypeScript, Tailwind CSS v4, and the
[HeroUI](https://heroui.com) v3 component library.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm (ships with Node)

## Running locally

```bash
cd meeting-scheduler
npm install
npm run dev
```

This starts the Vite dev server (with hot module reload) — open the URL it
prints, typically [http://localhost:5173](http://localhost:5173).

## Other scripts

```bash
npm run build    # type-check, then build a production bundle into dist/
npm run preview  # serve the production build locally, to sanity-check it
npm run lint      # run oxlint over src/
```

## Project structure

```
src/
  components/    # MeetingScheduler screen + its subcomponents
  lib/           # timezone math (real IANA/DST-aware conversion) and scheduling logic
  App.tsx, main.tsx, index.css
```
