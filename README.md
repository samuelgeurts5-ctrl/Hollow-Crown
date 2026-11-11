# Hollow Crown

A third-person fantasy RPG prototype. Development is split across several files; the planned release target is a single offline HTML file.

## Current milestone: Character Lab

- Screen-name entry and six-character selection.
- Third-person test scene with a large ground plane and grid.
- WASD movement.
- Drag on the game view to rotate the camera.
- Left-click character attack.
- Wizard abilities on keys 1 and 2.
- Character nameplate above the player.

## Character models

The project expects these files in `assets/characters/`:

- `Warrior.gltf`
- `Wizard.gltf`
- `Rogue.gltf`
- `Ranger.gltf`
- `Cleric.gltf`
- `Monk.gltf`

The character definitions in `src/main.js` use the animation clip names from the supplied Quaternius RPG Characters pack. Keep the included asset license with the models.

## Running the prototype

Because the browser loads GLTF files and JavaScript modules, run this folder through a local web server rather than opening `index.html` directly with `file://`.

For example, if Python is installed, open a terminal in the project folder and run:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

The current prototype imports Three.js from jsDelivr, so an internet connection is required for this development version. The final standalone build will need the library and all assets bundled locally.

## Project structure

```
index.html
styles.css
src/
  main.js
assets/
  characters/
```

## Roadmap

1. Finish and test the character lab with the supplied models.
2. Add the first hand-designed dungeon room and collision.
3. Build RPG combat, stats, inventory, and level progression.
4. Add procedural dungeon variations.
5. Package the finished game as one self-contained offline HTML file.

## License

The character pack's original license file must remain alongside the supplied assets. The game code and third-party assets may have different licenses; check each before redistribution.
