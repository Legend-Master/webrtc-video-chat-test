## Feature

- [x] Make ICE server toggleable (temp disable some servers)
- [ ] Ability to import and export ICE settings
    - Export all enabled ICE servers to string for import
    - Export all enabled ICE servers to url for sending people temp fully configured site
    - Import ICE servers from string (clipboard)

## Improvement

- [ ] Make font size bigger on mobile without looking awful
- [ ] Ask if user wanna discard changes on cancel/close page when adding/editing ICE server

## Fix

- [ ] Fix clicking on scrollbar treats as outside of dialog modal (closes it)
    - `mousedown`/`pointerdown` event has this problem
    - `click` event will breaks on mouse down inside then moving out and release (selecting text)
- [ ] Don't allow duplicated ICE servers

## Optimize

- [ ] Try drop iconify icon (currently only 4 small icons are being used, not worth it, and it can also solves no icon on initial page load)

## Build

- [ ] Try inline stylesheets (fairly small, about 1KB gzipped) for faster first paint
    - Parcel doesn't support inline bundle source map yet (https://github.com/parcel-bundler/parcel/issues/6225)
- [ ] Move license comments to a separate file

## Refactor

- [ ] Versioning saved data

## Experiment

- [ ] Test custom video resolution
