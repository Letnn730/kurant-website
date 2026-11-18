# Photos and video still needed for the home pages

*November 2026. The pages ship without these: every visual on them today is either the live demo,
a design-file rendering, or an illustration, and each is labelled as such. Replace an illustration
only with a real photo of real hardware; never with a render presented as a photo.*

Rules for every asset:

- **Real hardware, as it is.** The prototype or the R7 enclosure once printed. No retouching that
  changes the product (no removed cables, no added parts, no screen content pasted on).
- **Phone screens are real or labelled.** If the phone shows the app, it is the real app connected
  to the real module, or the caption says "simulation".
- **One file, two languages.** No text burned into images; captions and alt text go in the HTML,
  in French and English.
- **Formats.** JPEG (quality 80) or WebP, sRGB, under 250 KB each after export. Keep the original
  full size outside the repo. Put files in `assets/media/`, and give every `<img>` its `width`,
  `height` and alt text.

| # | Where on the page | What to shoot | Size (px) | Replaces |
| --- | --- | --- | --- | --- |
| 1 | Hero, beside the demo phone (`.hero-module`) | The R7 module on a handlebar, three-quarter view, dark or neutral background, no hands | 900 × 990 (same ratio as today) | `r7-module.jpg`, a crop of the design-file poster |
| 2 | Before/after, "Before" card | The stock KT LCD5 or LCD3 on the test bike's handlebar, screen on | 1200 × 760 | The "Before" drawing |
| 3 | Before/after, "After" card | The same handlebar: phone on its mount showing the app's ride screen live, module mounted, stock display removed | 1200 × 760 | The "After" drawing |
| 4 | How it works, step 01 to 03 (optional, one per step) | Hands unplugging the stock display; plugging the module's cable into the same connector; the app pairing screen | 800 × 600 each | Text only today |
| 5 | Kickstarter section (optional) | The bench: KT controller, module, phone, power supply, as in the journal entries | 1600 × 900 | Nothing today |
| 6 | Share images `og-fr.png`, `og-en.png` | Photo 3 with the headline set in Inter, one per language | 1200 × 630 | Current share images |
| 7 | Video (optional, for Kickstarter and the hero) | 20 to 30 s, no music needed: unplug the display, plug the module, turn the bike on from the app, ride with live speed on the phone | 1080 × 1350 (4:5) and 1920 × 1080 | The design-file animation stays for the module section |

When photo 2 and 3 exist, swap the SVG inside each `.ba-art` for an `<img>` and remove the
"Illustrations" note under the cards. When photo 1 exists, change the caption `R7 · dessin` /
`R7 · rendering` to `R7 · photo` and update the alt text.

Shot list for one session on the test bike: 2, 3, 4, 1, 5, then the video, in that order (the
display comes off once).
