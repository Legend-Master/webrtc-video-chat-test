for a web app which needs all javascript css html together to work, here's an ideal flow

inline everything inside index.html, and generate a separate version for every asset (html + css + js + img...) with a manifest (contains hash of each file)

register service worker which will do these things immediately

- cache current assets and their hash
- generate manifest about the current assets (type and hash)

these things on second load

- service worker ask server with generated manifest (don't use cached version, this one round trip is a must if we want the app always up to date)
- server compare the manifest with the one from client
- server inline new required asset in response and send to client
- client compare and serve new/cached site to user
- cache everything new and may drop caches that is not in the new manifest

---

### Initial page

server has

```yaml
- hash-inline-1.html
- hash-src-1.html
- hash-2.css
- hash-3.js
```
hash-inline-1.html

```html
...
<!-- name of hash-src-1.html -->
<!-- inlined hash-2.css -->
<!-- inlined hash-3.js -->
...
```

server sends

```yaml
- hash-inline-1.html
# - hash-src-1.html
- hash-2.css
- hash-3.js
```

### Client cache

```yaml
- hash-src-1.html: actual html
- hash-2.css: actual css
- hash-3.js: actual js
```

### Second load

client service woker sends

```yaml
- hash-src-1.html
- hash-2.css
- hash-3.js
```

server has

```yaml
- hash-inline-10.html
- hash-src-10.html
- hash-2.css
- hash-30.js
```

server sends

```yaml
- hash-src-10.html: actual html
- hash-2.css: true
- hash-30.js: actual js
```

client serve and cache

```yaml
- hash-src-10.html
- hash-30.js
```

client may drop cache

```yaml
- hash-src-1.html
- hash-3.js
```
