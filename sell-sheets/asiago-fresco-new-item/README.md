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

## Confirmed specs

- **Case pack:** 12 pc/case
- **Net weight:** 7 oz (200 g) per wedge
- **Case net weight:** 5.25 lb (2.38 kg) — derived, 12 × 7 oz
- **Format:** exact-weight wedge, **flow-packed (ATM)** — not vacuum-sealed
- **Milk / age / storage:** whole cow, 20–40 days, 34–40 °F *(carried from the line card — verify)*

## OPEN FIELDS — still needed before this goes to ACE

The spec grid and item bar carry visible placeholders (`—`) plus an on-sheet amber
"Pending for item setup" note. Remove that note once the fields below are confirmed.

1. **MT item number — 02091 (needs confirmation).** Identified from the media hub: Cloudinary
   `monti-trentini/asiago/asiago-pressato-dop-200g-atm-pf-02091` and Drive
   `02091_ASIAGO PRESSATO DOP 200 G ATM PF.png`. 200 g = 7.05 oz and "ATM PF" = modified-atmosphere
   flow pack, both consistent with this item. Confirm against the current price list before sending.
2. **ACE item number** — new item, to be assigned by ACE Endico
3. **UPC / GTIN** — retail pack needs a scannable code
4. **Shelf life** (days from pack date)
5. **Case cube, Ti-Hi, landed cost** — not on the sheet, but ACE will ask at setup

Also verify against the current Caseria Monti Trentini spec sheet before distribution:
DOP designation and consortium authorization, minimum age (sheet states 20–40 days, carried
over from the 1/4-wheel line-card entry), milk type, and storage temperature.

### US retail labeling — separate from this sheet

The pack in the photo is Italian-market artwork. A 7 oz wedge sold at US retail needs a
US-compliant label: net contents in oz and g, ingredient statement, allergen declaration
(milk), Nutrition Facts panel, and the importer/distributor name and address. Worth
confirming with the Caseria which artwork version ships to ACE before the sheet circulates.

## Consorzio Asiago mark — not yet placed

The sheet reserves a correctly-sized slot (dashed box, 54 × 26 pt) next to the DOP credential
line for the official **Consorzio Tutela Formaggio Asiago** mark. It is empty on purpose.

The official artwork exists in the media hub at Cloudinary
`monti-trentini/marks/consorzio-asiago.png` (401 × 308, tagged `official-artwork`), but
`res.cloudinary.com` is **blocked by this workspace's egress policy**, so this session could
not download it. Attempting to rebuild the mark from the pack photograph produced distorted
letterforms — unacceptable for a certification mark — so nothing was placed rather than
placing something wrong.

To finish it: drop `consorzio-asiago.png` into `img/` and replace the slot markup with

```html
<img class="cred-mark" src="img/consorzio-asiago.png" alt="Consorzio Tutela Formaggio Asiago">
```

styled `height:26pt; width:auto;`. Everything around it is already positioned.

Note that this is a third-party certification mark: use it only in the official artwork,
undistorted, under Monti Trentini's authorization N. 41/95.

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
