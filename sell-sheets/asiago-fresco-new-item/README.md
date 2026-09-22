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

- **ACE item:** 228971
- **Case pack:** 12 pc/case
- **Net weight:** 7 oz per wedge (as stated on the packaging and used in the US trade)
- **Case net weight:** 5.25 lb — derived, 12 × 7 oz
- **Format:** exact-weight wedge, **flow-packed (ATM)** — not vacuum-sealed
- **Milk / age / storage:** whole cow, 20–40 days, 34–40 °F *(carried from the line card — verify)*

## OPEN FIELDS — still needed before this goes to ACE

The on-sheet pending note has been removed. UPC is the one remaining visible placeholder
(`—`) in the spec grid.

1. **MT item number — 02091 (needs confirmation).** Identified from the media hub: Cloudinary
   `monti-trentini/asiago/asiago-pressato-dop-200g-atm-pf-02091` and Drive
   `02091_ASIAGO PRESSATO DOP 200 G ATM PF.png`. The 200 g Italian spec is the 7 oz US pack, and
   "ATM PF" = modified-atmosphere flow pack, both consistent with this item. Confirm against the current price list before sending.
2. **UPC / GTIN** — retail pack needs a scannable code; last blank left on the sheet
3. **Shelf life, case cube, Ti-Hi, landed cost** — deliberately *not* on the sheet (see below),
   but ACE will ask for all four at item setup

Also verify against the current Caseria Monti Trentini spec sheet before distribution:
DOP designation and consortium authorization, minimum age (sheet states 20–40 days, carried
over from the 1/4-wheel line-card entry), milk type, and storage temperature.

### US retail labeling — separate from this sheet

The pack in the photo is Italian-market artwork. A 7 oz wedge sold at US retail needs a
US-compliant label: net contents in oz and g, ingredient statement, allergen declaration
(milk), Nutrition Facts panel, and the importer/distributor name and address. Worth
confirming with the Caseria which artwork version ships to ACE before the sheet circulates.

### What is deliberately off the sheet

This is a customer-facing retail sell sheet, not a spec sheet. **Shelf life is intentionally
omitted** — it is item-setup data for the buyer's system, not a reason a retailer stocks the
item. Its grid cell carries **Origin** instead. Case cube, Ti-Hi and landed cost are off the
sheet for the same reason. All of it still has to be supplied to ACE separately at setup.

## Consorzio Asiago mark — removed, not placed

The credential strip (empty logo slot + "Consorzio Tutela Formaggio Asiago · Autorizzazione
N. 41/95") was taken off the sheet at Rick's direction, since the slot was still empty and
read as unfinished. The DOP seal remains in the hero block and "DOP" carries through the
product name and copy.

The official mark lives in the media hub at Cloudinary
`monti-trentini/marks/consorzio-asiago.png` (401 × 308, tagged `official-artwork`), but
`res.cloudinary.com` is blocked by this workspace's egress policy, so it could not be
downloaded here. Rebuilding it from the pack photograph produced distorted letterforms,
which is not acceptable for a certification mark.

To add it later: drop the PNG into `img/` and restore a credential strip beside it. It is a
third-party certification mark — official artwork only, undistorted, under Monti Trentini's
authorization N. 41/95.

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
