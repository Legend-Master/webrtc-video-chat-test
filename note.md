https://stackoverflow.com/questions/60636439/webrtc-how-to-detect-when-a-stream-or-track-gets-removed-from-a-peerconnection

---

Ice candidate will start gathering after `signalingState` change to have-local-offer

---

`addTrack` with a stream can make Webrtc automaticly react to track/stream changes

> https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addTrack

---

> ```css
> @media (hover: hover) {
> 	.icon-button:hover {
> 		background: rgba(0, 0, 0, 0.1);
> 	}
> }
> ```

Use css hover media query to remove hover style on touch screen is not a perfect solution, it will remove hover effect on touch devices with a pointer, since it can't tell if you're "hovering" it with a pointer or an "after touch" on touch screen

css is powerfull, but there's a lot of missing features like continue to finish the animtion after leaving a state, or play a animtion when going from one state to another, and what's worse is that you can't get the state change events like `:active` in javascript

So basically you'll have to fully using javascript for styles like these to work, but this is not a great idea to be honest, not only because it's a lot of work, it's pretty hard to get everything right for all the input methods (and even combinations)

---

Switching from Vite to Parcel is due to

- Vite can't inline things (script and style)
- Using vscode + chrome debug with vite is problematic (wrong break point and slow refresh)

---

Dialog exit animation is way too hard than it should be

The default dialog element close can't really have any animation since it's transitioning to `display: none`

If we do an animation and close it after animation done, there're some problems since it's not really closed

- Can still interact with the content inside it
- Can't interact with the content behined it

In the other hand, if we change the `display: none` to something else, then we lose the inert and top layer behavior

---

Web bundlers are such a pain to deal with

Things like Webpack, Rollup, need too much configurations

With things like Vite, Parcel, they're much easier to start, but way harder to customize (plugins are not a easy fix at all), and they can't even do some pretty bassic things like inline stylesheets out of box (Parcel can, but no source map)

SSR/SSG is another big problem (not the case in this project tho), Parcel doesn't even have any documentation talking about this (having a plan on Github Discussion tho)

---

Common resolutions:

- 1440:	2x HD
- 1080:	3/2 HD
- 720:	HD
- 480:	2/3 HD
- 360:	1/2 HD

---

Some bugs about `getDisplayMedia` on Windows Chromium based browsers

- When system scale is not 1 and calling without parameters, it will give back a lower quality stream (1920x1080 with 1.25 scale will give back 1536x864 (x1.25 will be the right number))

- Calling `getSettings` on the returning video track immediately will give back the requested number or screen size (which has the scaling issue) (has a uppper limit of 16383) even when the actuall size retruned is smaller

    For example, screen resolution is 1920x1080, run this and select a none fullscreen window/browser tab:
    ```js
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
	console.log(stream.getVideoTracks()[0].getSettings())
    ```
    This gives back 1536x864 on scale 1.25, 1920x1080 on scale 1, but the actuall stream's resolution is less than this

    And running something like this gives back 16383x16383
    ```js
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 100_000, height: 100_000 } })
	console.log(stream.getVideoTracks()[0].getSettings())
    ```

    But waiting for a while, 30+ms on my computer, `getSettings` will now gives back the right resolution

I reported this problem at https://crbug.com/1429161, but the maintainer said it's a low priority preblem, so I don't think it's gonna get fixed any time soon
