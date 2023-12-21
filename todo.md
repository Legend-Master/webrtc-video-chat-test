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
- [x] Make negotiating with Realtime Database more efficient
    - Swap current order of old and new comer's role
    - Predetermine offer and answer peer
- [ ] Make moving cursor to the left edge hides the video controls in fullscreen
- [ ] Figure out a better calling page layout
    - A disconnect button?
    - Do we use filled button or plain icon button for things like camera toggle/select and resolution select
    - Swiching between multiple people's video instead of displaying all of them in a row?
    - How to prompt user enter their name so others can see? (or do we want it?)
    - Play a sound when someone connected to the room
    - A way to purge disconnected peers (the reason we don't just do it on disconnect is because on mobile, if you switch to another page or go to home screen without viewing/listening/pip the page, connection will stop, but later when you swich back, the RTCPeerConnection can still auto reconnect, the question is do we support this use case or not, or do we make them go through the regular connection process again)

## Fix

- [x] Fix clicking on scrollbar treats as outside of dialog modal (closes it)
    - `mousedown`/`pointerdown` event has this problem
    - `click` event will breaks on mouse down inside then moving out and release (selecting text)
- [ ] Don't allow duplicated ICE servers
- [ ] Fix switching camera on Firefox mobile fails most of the time
- [ ] Timeout disconnected peers
- [ ] Flip font facing camera preview

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
