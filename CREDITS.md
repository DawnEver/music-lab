# Credits

Music Lab's own code is MIT (see `LICENSE`). It plays other people's work
too, and this is where that is recorded.

## Sound

### FluidR3_GM

The **Sampled** and **Hybrid** voice tiers play recordings from the
FluidR3_GM soundfont, pre-rendered for the web by
[gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).

- **Licence:** Creative Commons Attribution 3.0 Unported (CC BY 3.0)
- **Used by:** the play tool, for the instruments that name a `sample`

Nothing is bundled with this repository. The banks are fetched from
`gleitz.github.io` when a player chooses a tier that uses them, decoded in
the browser, and cached by the service worker so a practice room with no
signal still has them. The attribution is shown in the play tool's setup
panel, on the control that chooses the tier.

### @teropa/drumkit

The **Sampled** and **Hybrid** tiers play the drum kit — which a General
MIDI bank has none of, its channel ten being a mapping rather than a
program — from [teropa/drumkit](https://github.com/teropa/drumkit).

- **Code:** MIT
- **Samples:** [DWDS's Deep House Drum kit](https://freesound.org/people/DWSD/packs/11575/)
  (Creative Commons Attribution), with the cymbals from
  [Stomachache's Analog Cymbal](https://freesound.org/people/stomachache/sounds/140153/)
  and the toms from [Karman Lyne's 808 toms](https://freesound.org/people/Karman_Lyne/sounds/520168/)
  (both CC0)
- **Used by:** the play tool, for the nine pieces of the kit

Fetched from jsDelivr when a player chooses a tier that uses them, and
cached by the service worker.

## Fonts

- **Inter** — SIL Open Font License 1.1
- **@mdi/font** — Pictogrammers Free License
