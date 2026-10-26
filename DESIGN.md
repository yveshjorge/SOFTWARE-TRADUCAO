---
version: alpha
name: Léxica
description: Uma biblioteca de escolhas de tradução, com a clareza de um fichário bilíngue.
colors:
  primary: "#163f43"
  accent: "#d7ee7c"
  background: "#f3f6f5"
  surface: "#ffffff"
  text: "#213638"
  muted: "#596e70"
  line: "#d9e2df"
  danger: "#a62c37"
  success: "#17634e"
  focus: "#426aaf"
typography:
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
  display:
    fontFamily: "Palatino Linotype, Palatino, Georgia, serif"
rounded:
  DEFAULT: "10px"
  control: "7px"
  dialog: "14px"
spacing:
  page: "40px"
  section: "24px"
components:
  button: {}
  card: {}
  dialog: {}
---

# Léxica Design System

## Overview

Product register. A translator's bilingual index cards: original and translation are the central visual pair, connected by an arrow. The audience is freelance, literary, technical, game and academic translators described in Jira BM and the Miro Tradução canvas. UI locale is pt-BR; source and target content can use any supported language. This is not a Japan-market product; Japanese is one selectable term language, not a Japanese UI.

The signature is the paired serif expression inside a quiet, structured card, against a deep teal library spine. Avoid marketing heroes, charts without real data, generic KPI dashboards and ornamental gradients. The interface is a working library.

Runtime canonical tokens live in the `:root` block of `src/styles.css`. This document mirrors their accepted values. Each `colors.x` maps directly to `--x`; typography maps to `--font-body` and `--font-display`; default radius maps to `--radius`. Components consume these CSS variables. `tests/design.test.js` checks color drift.

## Colors

Teal primary for navigation and actions, yellow-green accent only for the library mark and selected navigation. Pale cool paper for background, white cards, muted green-gray labels. Error and success colors retain semantic meaning. Only light mode is supported. Forced-colors uses system scrollbars and control borders.

## Typography

Palatino gives original/translation pairs the tone of a reference book. Segoe UI keeps forms and metadata readable. Local system fonts avoid remote requests and layout shift. Body is 14px, control text 12–14px, display title 42px, term pairs 19–22px. Full multilingual content wraps; never ellipsize term meaning.

## Layout

Desktop library spine 258px; content max 1600px with 40px padding. Filter column 205px; results occupy the rest. At 1150px the page heading stacks. At 800px the spine becomes top navigation and filters become an explicit disclosure. Cards remain a single readable column. Forms scroll within the modal; the action footer remains reachable. Document scrolling owns all ordinary lists; the import preview alone has a bounded scroll region.

## Elevation & Depth

Cards use borders, not shadows. Only dialogs and notification feedback have shadows. Modal backdrop darkens the underlying content; background becomes inert through native dialog semantics.

## Shapes

10px cards, 7px controls, 14px dialogs. Library mark has a book-like alternating radius. Static metadata tags are small rounded rectangles, visually distinct from buttons.

## Components

All buttons have hover, keyboard focus, active, busy and disabled treatments. Primary actions use teal; neutral actions use outlined white. Destructive draft discard uses danger and explicit text. Busy state disables duplicate submits and retains a stable footer.

`src/ui.tsx` owns Field, Textarea, Select, Modal, Tags, ErrorBox and Loading. Native select popup geometry is deliberately accepted, with native keyboard behavior. No custom popup geometry or date picker is required. `src/main.tsx` owns one shared notification viewport; forms use persistent inline errors.

Lucide line icons, 16–21px in controls, always accompanied by visible labels or accessible names. Motion is limited to hover feedback and a loading spinner; reduced-motion disables both. Scrollbars use global thumb/track/hover/active tokens in the stylesheet, inherited without opt-in classes.

## Do's and Don'ts

- Do preserve term context and show complete previous and current values.
- Do use one label per operation across screens.
- Don't claim legal certification from an internal justification stamp.
- Don't hide errors in disappearing toasts or simulate successful persistence.
