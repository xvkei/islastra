# Islastra

*The Philippine night sky, star by star.*

Islastra (from *isla*, island, and *astra*, stars) is an immersive view of the
night sky from anywhere in the Philippines. Stand on the ground, look around and
up, and see the real stars, constellations, Moon and planets for any time
tonight, above a landscape that matches where you are.

**Live:** [xvkei.github.io/islastra](https://xvkei.github.io/islastra/)

## Features

- **The real sky** for any moment from 6 PM to 6 AM: about 9,000 naked-eye stars
  in their true colours, all 88 constellations, the Moon with its real phase, and
  the planets Mercury to Saturn.
- **Look around and up:** drag (or use the arrow keys) to turn and tilt all the way
  to the zenith; scroll or pinch to zoom. The view uses a stereographic projection,
  so constellations keep their shapes even straight overhead.
- **Eight places** from Batanes to Davao, each with its own landscape (hills and
  palms, coast with the Moon's reflection on the water, or pine-covered mountains),
  city lights, and light pollution level, so Manila shows only the brightest stars
  while Batanes is full of them.
- **Tonight card:** sunset, full darkness, the Moon's phase, which planets are up
  or rising later, and how high Polaris sits (it always equals your latitude).
- **Tap anything** for details: distance, temperature, brightness, position, rise
  and set times, and when a star's light set off on its way to you.
- **Text list view** of everything bright above the horizon, for screen readers or
  anyone who prefers text.

## How it works

- Star data comes from the HYG database, cleaned in Python (`scripts/build_stars.py`):
  naked-eye stars only, colour index converted to temperature and display colour.
- Positions are computed in the browser: each star's fixed sky coordinates are
  turned into altitude and azimuth for the chosen place and time using the local
  sidereal time. The Moon, planets and Sun come from
  [astronomy-engine](https://github.com/cosinekitty/astronomy).
- Everything is drawn on a single canvas, redrawn only when the view, time, place
  or settings change.

## Running locally

```bash
npm install
npm run dev
```

To rebuild the star data, download the HYG CSV (astronexus.com/hyg) and the
d3-celestial `constellations.lines.json` and `constellations.json` into
`data/raw/`, then:

```bash
pip install pandas
python scripts/build_stars.py
```

## Accessibility

Keyboard controls for looking around (arrow keys), zooming (`+`/`-`) and
deselecting (Escape); every control is labelled; the list view offers a text
alternative to the canvas; colour is never the only cue.

## Credits

- Star data: [HYG database](https://astronexus.com/hyg) by David Nash, CC BY-SA 4.0.
- Constellation lines and names: [d3-celestial](https://github.com/ofrohn/d3-celestial)
  by Olaf Frohn, BSD 3-Clause.
- Sun, Moon and planet positions: [astronomy-engine](https://github.com/cosinekitty/astronomy)
  by Don Cross, MIT.

## Roadmap

Version 2 will add a star explorer (Hertzsprung–Russell diagram), real light
pollution from NASA satellite data, more landscapes and "use my location", sky
events, birthday sky prints, and Filipino star lore.