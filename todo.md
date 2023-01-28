## General

- [ ] Try drop iconify icon (currently only 4 small icons are being used, not worth it, and it can also solves no icon on initial page load)
- [ ] Make ICE server toggleable (temp disable some servers)
- [ ] Make font size bigger on mobile without looking awful
- [ ] Test custom resolution
- [ ] Fix clicking on scrollbar treats as outside of dialog modal (closes it)
    - `mousedown`/`pointerdown` event has this problem
    - `click` event will breaks on mouse down inside then moving out and release (selecting text)

## Build

- [ ] Try inline stylesheets (fairly small, about 1KB gzipped) for faster first paint
    - Parcel doesn't support inline bundle source map yet (https://github.com/parcel-bundler/parcel/issues/6225)
- [ ] Move license comments to a separate file
