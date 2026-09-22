# Asiago Fresco DOP — New Item Introduction Sheet

One-page new-item sell sheet for the Monti Trentini **Asiago Fresco DOP exact-weight retail
wedge**, built on the same design system as the existing *ACE Endico Selection* product line
card (`MTACEstockitems.pdf`).

## Files

| File | What it is |
|---|---|
| `index.html` | Source layout. Letter (8.5 × 11 in), print-ready, self-contained. |
| `fonts.css` | Playfair Display + Montserrat, base64-embedded so the sheet renders identically offline. |
| `img/` | MT logo, ACE Endico logo and DOP seal (re-rendered from the source line card); product photo. |
| `asiago-fresco-new-item-sheet.pdf` | **The deliverable.** Selectable text, embedded fonts. |
| `asiago-fresco-new-item-sheet-preview.png` | 150 dpi preview for quick review / email. |

## Rebuilding the PDF after an edit

```bash
CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome   # or any Chrome/Chromium
"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=asiago-fresco-new-item-sheet.pdf \
  --virtual-time-budget=6000 "file://$PWD/index.html"
```

Any browser's **Print → Save as PDF** at 100% scale with headers/footers off also works.

## Design spec (inherited from the line card)

- Greens: `#00953F` (bars, headings), `#054E21` (item bar, spec values), rule `#109C4B`
- Body ink `#333333`, labels `#5E5E5E`, hairlines `#E6E6E6`
- Serif italic (Playfair Display) for titles and descriptive copy; Montserrat, letterspaced
  uppercase, for labels and spec values
- Page margin 0.48 in · top green bar 10.5 pt · footer band 0.74 in

## OPEN FIELDS — must be filled before this goes to ACE

The spec grid and item bar carry visible placeholders (`—`) plus an on-sheet amber
"Pending for item setup" note. Remove that note once the fields below are confirmed.

1. **MT item number** — not yet assigned/known for the retail wedge
2. **ACE item number** — new item, to be assigned by ACE Endico
3. **Case pack** (pc/case)
4. **Net weight** (oz / g per wedge)
5. **UPC / GTIN** — retail pack needs a scannable UPC
6. **Shelf life** (days from pack date)
7. **Case cube, Ti-Hi, landed cost** — not on the sheet, but ACE will ask at setup

Also verify against the current Caseria Monti Trentini spec sheet before distribution:
DOP designation and consortium authorization, minimum age (sheet states 20–40 days, carried
over from the 1/4-wheel line-card entry), milk type, and storage temperature.

## AI compliance

Per the Cheese Shop Tech AI Use & Disclosure Policy:

- **Step 0 (IP/licensing):** brand-owned Monti Trentini photography and marks, used by
  Cheese Shop Tech / Monti Trentini USA — no third-party license required.
- **Depicts no real, identifiable person.** No testimonial, endorsement or synthetic voice.
- **Image modification:** background normalization and crop only. Disclosed on-sheet in the
  footer legal block: *"Product photography enhanced for print (background & color
  correction) · Specs subject to confirmation."* — [RECOMMENDED] print-channel disclosure.
- **Provenance/spec copy drafted by AI → human fact-check required** before publishing
  (see OPEN FIELDS above). [REQUIRED]

Compliance log line:

```
2026-09-22 | Asiago Fresco DOP new-item sell sheet (1 pg) | Claude Code (layout + copy), Pillow (photo crop/background) | print/trade PDF to ACE Endico | footer: "Product photography enhanced for print (background & color correction) · Specs subject to confirmation." | no real person involved — no consent record needed
```
