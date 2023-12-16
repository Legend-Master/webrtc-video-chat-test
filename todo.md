## Feature

- [x] Make ICE server toggleable (temp disable some servers)
- [x] Ability to import and export ICE settings
    - Export all enabled ICE servers to string for import
    - Export all enabled ICE servers to url for sending people temp fully configured site
    - Import ICE servers from string (clipboard)

## Improvement

- [ ] Make font size bigger on mobile without looking awful
- [ ] Ask if user wanna discard changes on cancel/close page when adding/editing ICE server
- [ ] Pop a notification (maybe toast) on copy
- [ ] Make add/edit ICE form nicer to use
    - Use radio buttons to select stun/turn(s)?
- [x] Make dialogs behave like closed when playing closing animation
- [x] Make Android back button work with dialogs
- [ ] Make negotiating with Realtime Database more efficient
    - Swap current order of old and new comer's role
    - Predetermine offer and answer peer

## Fix

- [x] Fix clicking on scrollbar treats as outside of dialog modal (closes it)
    - `mousedown`/`pointerdown` event has this problem
    - `click` event will breaks on mouse down inside then moving out and release (selecting text)
- [ ] Don't allow duplicated ICE servers
- [ ] Fix switching camera on Firefox mobile fails most of the time
- [ ] Timeout disconnected peers

## Build

- [x] Try drop iconify icon (currently only a few small icons are being used, not worth it, and it can also solves no icon on initial page load)
- [ ] Try inline stylesheets (fairly small, about 1KB gzipped) for faster first paint
    - Parcel doesn't support inline bundle source map yet (https://github.com/parcel-bundler/parcel/issues/6225)
- [ ] Move license comments to a separate file

## Refactor

- [ ] Migrate from `localStorage` to `IndexedDB`
- [ ] Versioning saved data

## Experiment

- [x] Test custom video resolution
