# frontend.md

Frontend style spec reverse-engineered from **rohit-jsfreaky/ichor** (`web/index.html`, `web/docs.html`, live at ichor-chi.vercel.app).

Use this as the design contract for a new project. The source is two hand-written static HTML files with all CSS inlined in a `<style>` block — no framework, no build step, no CSS file. The system below is framework-agnostic; a Tailwind/React translation is at the end.

---

## 1. The core idea

A **near-white page with a whiter content column floating on it.** The two backgrounds are one shade apart (`#F7F6F4` vs `#FFFFFF`), and a 1px hairline runs down each side of the column for the full page height. That vertical framing is the entire signature of the design — everything else is quiet.

Three rules that generate the rest:

1. **Colour is spent almost nowhere.** Page chrome is ink, grey and hairlines. The only saturated colour is one gold accent (`#C89B3C`) and one terminal green (`#A8FF35`) — and the green only ever appears *inside* dark terminal blocks.
2. **Borders instead of shadows.** Structure is drawn with 1px hairlines at 9% and 14% ink opacity. Shadows exist only on elements meant to float (terminal, floating pill, icon tiles).
3. **The dark terminal is the hero image.** There are no photographs, illustrations or gradients-as-decoration. The product shot *is* a styled fake terminal transcript, and it is the only dark surface on the page.

---

## 2. Tokens

Declared once on `:root`, duplicated verbatim into every HTML file (the repo does this deliberately — two static files, no shared stylesheet to break).

```css
:root {
  /* surfaces */
  --ground:  #F7F6F4;   /* page background */
  --col:     #FFFFFF;   /* content column */

  /* text */
  --ink:     #191817;   /* headings, emphasis, buttons */
  --body:    #6E6B66;   /* paragraphs, nav links, table cells */
  --faint:   #9A968F;   /* kickers, meta, arrows, de-emphasised heading half */

  /* structure */
  --line:    rgba(25,24,23,.09);   /* default hairline */
  --line-2:  rgba(25,24,23,.14);   /* stronger hairline: pills, step tops */

  /* accent — used sparingly */
  --tint:    #EFE9DC;   /* sand, selection bg, top of the "bed" gradient */
  --tint-2:  #F6F2E9;   /* lighter sand, note/callout bg */
  --gold:    #C89B3C;   /* the one accent: status dot, warnings, active marker */

  /* terminal (the only dark surface) */
  --term:    #171614;
  --term-2:  #201E1B;                    /* terminal title bar */
  --term-fg: #E8E4DC;
  --term-dim:rgba(232,228,220,.52);
  --ok:      #A8FF35;                    /* success / positive output only */

  /* type */
  --sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;

  /* layout */
  --shell: min(1400px, 92vw);            /* landing; docs uses min(1180px, 94vw) */
  --pad:   clamp(24px, 3.4vw, 56px);     /* docs uses clamp(22px, 3vw, 46px) */
}
```

Radii in use: `4px` (inline code), `6px` (small tiles, copy button), `8px` (buttons, icon tiles), `10px` (terminal, card grids, tables, notes), `12px` (product bed), `14px` (flow chip), `999px` (pills).

Shadows — only three, all ink-tinted and very soft:
```css
/* floating terminal */  0 1px 2px rgba(25,24,23,.05), 0 16px 40px -24px rgba(25,24,23,.30);
/* floating pill    */   0 2px 6px rgba(25,24,23,.07), 0 10px 24px -14px rgba(25,24,23,.22);
/* icon tile        */   0 1px 2px rgba(25,24,23,.06), 0 4px 10px -6px rgba(25,24,23,.18);
```

Fonts are loaded from Google Fonts with `preconnect`:
`Geist` at 400/450/500/600 and `JetBrains Mono` at 400/500, `display=swap`.

---

## 3. Typography

Base is **14px / 1.6**, `-webkit-font-smoothing: antialiased`. This is a small-type design — nothing on the page is set larger than ~38px, and body copy runs at 12.5–15px.

| Role | Spec |
|---|---|
| `h1` | `clamp(30px, 3.6vw, 38px)` · 500 · lh 1.14 · ls `-.028em` |
| `h2` | `clamp(21px, 2.4vw, 26px)` · 500 · lh 1.22 · ls `-.021em` |
| `h3` | `16px` · 500 · lh 1.35 |
| `.lead` | `15px` · lh 1.6 · `--body` |
| `.sub` | `13.5px` · lh 1.62 · `--body` |
| `.small` | `12.5px` · lh 1.6 · `--body` |
| `.kicker` | `10px` · 500 · `.16em` tracking · uppercase · `--faint` (mono on docs, sans on landing) |
| big number `.n` | mono · `26px` · ls `-.02em` · ink |

Details that matter:

- **Headings never go above 500 weight.** Emphasis inside body text is also 500 (`b`, `strong` are overridden to `font-weight: 500`), never 700.
- All headings get `text-wrap: balance` and `margin: 0`; `p` also gets `margin: 0`. Vertical rhythm is done entirely with flex `gap`, not margins.
- **Two-tone headline:** the second clause of the `h1` is wrapped in `.b { color: var(--faint) }` so the headline reads as statement + consequence in one line of type.
- Measure is capped explicitly: centred section heads at `58ch` (their `.sub` at `50ch`), docs prose at `78ch`, docs masthead at `62ch`.
- Inline code (`.icode`): mono, `.9em`, `--ground` background, `--line` border, `4px` radius, `.1em .34em` padding, `white-space: nowrap`.

---

## 4. Layout

```html
<body>            <!-- background: var(--ground) -->
  <div class="col">   <!-- white, max-width var(--shell), hairline left+right -->
    <nav class="in">…
    <section class="in">…
    <hr class="rule" />
    <section class="in">…
    <footer class="in">…
  </div>
</body>
```

```css
.col { max-width: var(--shell); margin: 0 auto; background: var(--col);
       border-left: 1px solid var(--line); border-right: 1px solid var(--line); }
.in  { padding-inline: var(--pad); }
section { padding-block: 76px; }
.rule { height: 1px; background: var(--line); border: 0; margin: 0; }
```

- The shell has a `92vw` ceiling rather than full bleed — some ground **must** stay visible on both sides or the framing hairlines mean nothing.
- Sections are separated by a full-bleed `<hr class="rule">` that touches both column edges; section padding is `76px` block.
- `html, body { overflow-x: clip }` — set on **both**, and `clip` not `hidden`, because the hero terminal intentionally overflows and `overflow-x:hidden` on body alone still lets the document scroll sideways.

### Hero grid

```css
.hero { position: relative; overflow: hidden; padding-top: 58px; padding-bottom: 64px; }
.hero-grid { display: grid; grid-template-columns: minmax(340px, 30%) minmax(0, 1fr);
             gap: 48px; align-items: center; }
.hero-copy { display: flex; flex-direction: column; gap: 18px; }
@media (max-width: 1040px) { .hero-grid { grid-template-columns: 1fr; gap: 34px; } }
```

The `minmax(0, 1fr)` second track is load-bearing: without the `0` minimum, the wide terminal becomes the track's min-content and crushes the copy column. With it, the terminal is free to overflow right and `.hero { overflow: hidden }` crops it flush at the column's right hairline — a deliberate crop that reads as a window into something larger.

### Docs layout

```css
.layout { display: grid; grid-template-columns: 204px minmax(0, 1fr); align-items: start; }
.rail   { position: sticky; top: 58px; padding: 34px var(--pad) 60px;
          border-right: 1px solid var(--line); }
.doc    { padding: 34px var(--pad) 96px; min-width: 0; }
.doc > section { max-width: 78ch; }
section + section { margin-top: 54px; padding-top: 34px; border-top: 1px solid var(--line); }
@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .rail { position: static; border-right: 0; border-bottom: 1px solid var(--line); }
  .rail nav { display: flex; flex-wrap: wrap; gap: 2px 18px; }
}
```

The contents rail is a hairline-separated column, not a floating card — it keeps the same vertical-rule language as the landing page. Docs narrows `--shell` to `min(1180px, 94vw)` because prose plus a rail needs less width than a marketing page.

Breakpoints in use: **1040px** (hero stacks), **900px** (docs rail unsticks), **820px** (card grids collapse to 1 col), **640px** (secondary nav links hide).

---

## 5. Components

### Nav
58px row, `display:flex; justify-content:space-between`. Brand = 22px `--ink` tile with `6px` radius holding a white 12px glyph, plus 14.5px/500 wordmark. Links are 13px `--body` → `--ink` on hover. Secondary links get `.sm-hide` (`display:none` under 640px). Landing nav is static (`position: relative`); docs nav is **sticky** with `rgba(255,255,255,.9)` + `backdrop-filter: blur(10px)` and a bottom hairline, with `html { scroll-padding-top: 84px }`.

### Buttons
```css
.btn { display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 15px;
       border-radius:8px; font-size:13px; font-weight:500; background:var(--ink);
       color:#fff; border:0; transition: opacity .18s ease; }
.btn:hover { opacity:.86; }
.link { display:inline-flex; gap:6px; font-size:13px; font-weight:500; color:var(--ink); }
.link:hover { color: var(--body); }
```
There is **no secondary/outline button**. The primary CTA is a black button whose label is the install command set in mono with a copy icon at 60% opacity; the alternative action is a bare text link ending in `→`. Focus is `outline: 2px solid var(--ink); outline-offset: 3px`.

### Pill / badge
26px tall, `999px` radius, `--line-2` border, white background, 11.5px `--body` text, with a 5px `--gold` dot at the left. Hovers to `--ink` border and text. Used once, above the `h1`, for the "built on / built for" credit.

### Terminal (the signature component)
```html
<div class="term">
  <div class="term-bar"><span class="dots"><i></i><i></i><i></i></span> claude code — vendor-app</div>
  <div class="term-body">
    <div class="ln"><span class="who you">you ›</span><span class="said">…</span></div>
    <div class="ln"><span class="who">claude ›</span><span class="said dim">… <span class="ok">✓ in scope</span></span></div>
    <div class="challenge">…</div>
    <div class="sp"></div>
  </div>
</div>
```
- `.term`: `--term` bg, `10px` radius, `overflow:hidden`, mono 12px/1.66, `--term-fg`, floating shadow.
- `.term-bar`: `--term-2` bg, 10.5px `--term-dim`, three 7px dots at `rgba(232,228,220,.16)` — greyed out, never red/yellow/green.
- `.ln`: flex row, `gap:10px`, speaker label `.who` with `min-width:50px` in `--term-dim`; `.who.you` is `--gold`.
- Semantic spans: `.ok` = `--ok` green, `.warn` = `--gold`, `.dim` = `--term-dim`. `.sp` is a 10px spacer div used instead of margins.
- `.challenge` callout: `border-left: 2px solid var(--gold)`, `background: rgba(200,155,60,.07)`, `border-radius: 0 6px 6px 0`, 11px/13px padding.
- In docs the terminal wraps a `<pre>` and uses HTML tags as a mini syntax theme: `b` → `--ok`, `i` → `--term-dim`, `u` → `--gold`, `s` → `--term-dim`. A `.cp` copy button sits absolutely at `top:8px; right:10px` with a translucent light border on dark.

### Card grids (hairline-gap technique)
```css
.grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:1px;
         background:var(--line); border:1px solid var(--line);
         border-radius:10px; overflow:hidden; }
.cell  { background:var(--col); padding:22px 20px; display:flex; flex-direction:column; gap:8px; }
@media (max-width: 820px) { .grid3, .grid2 { grid-template-columns: 1fr; } }
```
The 1px grid `gap` over a `--line` background *is* the divider — no per-cell borders. Cell content order is: kicker → big mono number or `h3` → `.small` explanation.

### Step row
Three columns, `gap:24px`, each `border-top: 1px solid var(--line-2)` with `padding-top:15px` and a mono 11px `--faint` index (`01`, `02`, `03`). Collapses to one column at 820px.

### Statement rows
`.row-i { padding: 17px 0; border-top: 1px solid var(--line) }`, last child also gets a bottom border. Each row is one `.small` paragraph opening with a `<b style="color:var(--ink)">` lead clause.

### Product "bed"
```css
.bed { position:relative; max-width:1000px; margin-inline:auto; margin-top:46px;
       padding:46px 14px 14px; border-radius:12px;
       background: linear-gradient(180deg, var(--tint) 0%, var(--tint-2) 46%, var(--col) 100%); }
```
A sand gradient that dissolves into the white column, with a floating white pill (`.float`) pinned at `top:-19px; left:50%` holding icon tiles separated by `→` arrows. Icon tiles are 26px with `8px` radius, `--ground` background; `.dark` variants use `--ink` background and white fill. This is the only gradient in the system.

### Logo strip
`padding-block:30px` with a hairline top and bottom, centred flex-wrap row at `gap: 12px 32px`. Each item is a 15px `--faint`-filled brand SVG + 13px `--body` label. Brand marks are inlined once as `<symbol>` in a hidden `<svg width="0" height="0">` and reused with `<use href="#id">`.

### Tables (docs)
Wrapper `.tw` with `overflow-x:auto`, `--line` border and `10px` radius. `border-collapse: collapse`, 13px, `min-width:520px`. `th` is mono 10px uppercase `.14em` `--faint` on a `--ground` background. `td` is `--body`; the **first column is mono 12px ink and `nowrap`** (it holds command/flag/env names). `td.txt` opts back into sans for prose columns.

### Note callout
`--tint-2` background, `--line` border, `10px` radius, `14px 16px` padding, 13px `--body`, with `strong` in ink.

### Footer
Hairline top, `padding-block: 40px 52px`. Flex-wrap `space-between`: left column is brand + one-line description + a `--faint` licence/credit line, capped at `34ch`; right side is link groups at `gap:40px`, each with a `.kicker` heading and 12.5px `--body` links that hover to ink.

---

## 6. Motion

Deliberately minimal — two mechanisms only.

**Reveal on scroll.** Add `.rv` to anything that should fade up; an `IntersectionObserver` adds `.on`.
```css
.rv { opacity:0; transform:translateY(10px);
      transition: opacity .65s cubic-bezier(.22,.61,.36,1),
                  transform .65s cubic-bezier(.22,.61,.36,1); }
.rv.on { opacity:1; transform:none; }
@media (prefers-reduced-motion: reduce) { .rv { opacity:1; transform:none; transition:none; } }
```
Observer options: `{ rootMargin: '0px 0px -6% 0px', threshold: 0.06 }`, unobserve after firing, and a stagger of `Math.min(i % 3, 2) * 50 + 'ms'` as `transitionDelay` so rows of three cascade but the page never feels delayed.

**Smooth scroll** via Lenis from CDN (`lenis@1.1.20`), `{ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 }`, with all `a[href^="#"]` intercepted and routed through `lenis.scrollTo(el, { offset: -24 })` (docs uses `-76` for the sticky nav).

Accessibility is handled at the top of the script, not per-element: `prefers-reduced-motion` short-circuits Lenis entirely and marks every `.rv` as `on` immediately, as does the absence of `IntersectionObserver`.

Interaction transitions are short and few: `opacity .18s ease` on buttons, `color/border-color .15s ease` on the copy button. Nothing else animates.

Copy-to-clipboard swaps the button's inline SVG path from a copy glyph to a checkmark for 1600ms, then restores it. Docs' copy buttons swap their text label to `copied` on the same timer.

---

## 7. Content & voice conventions

The visual system assumes this kind of copy; borrowing the CSS without it will look off.

- Headlines are **two short sentences**, the second de-emphasised in `--faint`: "You asked for three files. / It changed twenty."
- Section headings are declarative statements ending in a period, not noun phrases: "Connected is not the same as necessary." / "Measured on somebody else's code." / "What it cannot do."
- Every section is introduced by an uppercase kicker (`The judgement`, `Proof`, `Install`, `Honest limits`).
- Numbers are stated with their caveat attached, in mono, with a `.small` sentence saying how they were measured.
- There is a dedicated **limits section** listing what the product cannot do — treated as a first-class part of the page, styled like everything else.
- Sentence case throughout; no exclamation marks; no emoji outside the terminal's `✓`, `⚠` and `›`.

---

## 8. Porting to React / Next.js + Tailwind

If rebuilding this in a component stack rather than static HTML:

```js
// tailwind.config — theme.extend
colors: {
  ground: '#F7F6F4', col: '#FFFFFF',
  ink: '#191817', body: '#6E6B66', faint: '#9A968F',
  line: 'rgba(25,24,23,0.09)', line2: 'rgba(25,24,23,0.14)',
  tint: '#EFE9DC', tint2: '#F6F2E9', gold: '#C89B3C',
  term: '#171614', term2: '#201E1B', termfg: '#E8E4DC', ok: '#A8FF35',
},
fontFamily: { sans: ['Geist', ...], mono: ['JetBrains Mono', ...] },
boxShadow: {
  term:  '0 1px 2px rgba(25,24,23,.05), 0 16px 40px -24px rgba(25,24,23,.30)',
  pill:  '0 2px 6px rgba(25,24,23,.07), 0 10px 24px -14px rgba(25,24,23,.22)',
  tile:  '0 1px 2px rgba(25,24,23,.06), 0 4px 10px -6px rgba(25,24,23,.18)',
},
```

Component boundaries that fall out of the markup: `Shell` (the framed column), `Nav`, `Hero`, `Terminal` + `TerminalLine` + `Challenge`, `Pill`, `LogoStrip`, `SectionHead` (kicker + h2 + sub), `CardGrid` + `Cell`, `Steps`, `StatementRows`, `Bed` + `FloatingFlow`, `DocsRail`, `CodeBlock` (with copy), `DataTable`, `Note`, `Footer`.

Keep when porting:
- The `.col` hairline frame and the two-shade background pair — that's the identity.
- The 1px-gap card grid rather than per-card borders.
- The dark terminal as the only dark surface, and green only inside it.
- Small type, 500-weight max, `text-wrap: balance`, explicit `ch` measures.
- `overflow-x: clip` on both `html` and `body` if anything is meant to bleed.

Drop or replace:
- The duplicated `:root` block — with a build step, this becomes one token file.
- Lenis, if you don't want a 3rd-party smooth-scroll dependency; native `scroll-behavior: smooth` plus `scroll-padding-top` covers the anchor case.
- The inline `<symbol>` sprite, if you have an icon package.
- Third-party brand marks (Claude, OpenAI, Docker, TypeScript, MCP) — those are other companies' logos and don't travel with the style.

Not present in the source, so decide fresh: dark mode, form controls, modals/dialogs, toasts, loading and empty states, pagination, mobile drawer nav. The system extends cleanly — a form field would be white with a `--line` border, `8px` radius, 13px text, focus ring `2px solid var(--ink)` at `3px` offset.
