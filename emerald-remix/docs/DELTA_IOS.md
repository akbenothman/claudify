# Playing it on iPhone with Delta

[Delta](https://apps.apple.com/app/id1048524688) is a free App Store emulator (by Riley Testut, of GBA4iOS) that
runs GBA games. Delta **doesn't apply patches itself**. You patch first, then import.

## Getting a build onto the phone

1. **Clean ROM**: a dump of *your own* Pokémon Emerald (USA) cartridge. The patch expects the standard US ROM,
   SHA-1 `f3ae088181bf583e55daf962a92bb46f4f1d07b7`. A different revision or a pre-patched ROM will fail.
2. **Patch**: open [ROM Patcher JS](https://www.marcrobledo.com/RomPatcher.js/) in Safari, pick the clean ROM and
   `emerald-remix.bps`, then apply. Save the output `.gba` to the Files app (e.g. iCloud Drive › Delta).
3. **Import**: in Delta, tap **+** › **Files** and select the `.gba`.

During development, it's quicker to AirDrop the built `.gba` straight from your computer (your own copy, for testing).

## Updating to a new build without losing your save

Delta stores saves with the game entry. Each new build is a different file, so:

1. In Delta, long-press the old game › **Export Save File**.
2. Import the new `.gba`.
3. Long-press the new game › **Import Save File** and pick the exported save.

Save states (Delta's quick saves) **don't carry over between builds**. Rely on in-game saves.
Some changes, such as edits to the save layout or reordered species, can break old saves. The roadmap marks
those changes, and when one ships we start a fresh game.

## Things to check on-device at every milestone

- [ ] **In-game save** works: save, fully close Delta, reopen, and load.
  Emerald uses 128 KB Flash, and emulators detect it from the ROM header (game code `BPEE`), so **we don't change
  the header's game code**.
- [ ] **Real-time clock** (berries, tides, Shoal Cave) advances. Same reason: keep the header.
- [ ] Battle animations and text speed feel right at 1× speed. mGBA on a desktop hides slowdowns.
- [ ] Touch controls: menus are usable with Delta's skin.

## Other notes

- Delta syncs saves via Google Drive or Dropbox, so you can carry the same save between an iPhone and an iPad.
- Delta supports cheat codes, but the expansion's **debug menu** (on in non-release builds) is better for testing.
- For beta testers on Android: My Boy! or Pizza Boy, with the same `.bps` patch.
