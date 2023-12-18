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

> Chrome added some features to make this doable now: https://developer.chrome.com/blog/entry-exit-animations/
> <br>
> Waiting for other browsers to catch up

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

    For example, screen resolution is 1920x1080, run this and select a none fullscreen window/browser tab:
    ```js
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
	console.log(stream.getVideoTracks()[0].getSettings())
    ```
    This gives back 1536x864 on scale 1.25, 1920x1080 on scale 1, but the actuall stream's resolution is less than this

    I reported this problem at https://crbug.com/1429161, ~~but the maintainer said it's a low priority preblem, so I don't think it's gonna get fixed any time soon~~ and did a fix originally in https://crrev.com/c/4546769, but got reverted because it causes timeout on ChromeOS Crostini (an environment to run Linux apps on ChromeOS) for some unknown reasons, so splited it up as https://crrev.com/c/4583587 landed on Chrome 116 and https://crrev.com/c/4826746 on Chrome 118

- Calling `getSettings` on the returning video track immediately will give back the requested number or screen size (which has the scaling issue) (has a uppper limit of 16383) even when the actuall size retruned is smaller

    Running something like this gives back 16383x16383
    ```js
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 100_000, height: 100_000 } })
	console.log(stream.getVideoTracks()[0].getSettings())
    ```

    But waiting for a while, 30+ms on my computer, `getSettings` will now gives back the right resolution (Looked at Chromium code later on, found it doesn't pass in those info at the begining, the settings will only updates when capture component delivers a frame, and someone already reported this: https://crbug.com/1401937)

- ~~Trailing cursor (image of the cursor doesn't go away after moving the mouse)~~ should be fixed around Chrome 116

---

My Android phone doesn't seem to support h264 encoding, `createOffer` gives back `mid='0'` in m section

Code to force h264:
```ts
let codecs = RTCRtpSender.getCapabilities('video')!.codecs
for (const [index, codec] of codecs.entries()) {
    console.log(codec)
    if (codec.mimeType.includes('H264')) {
        for (const transceiver of pc.getTransceivers()) {
            console.log(transceiver)
            if (transceiver.sender.track?.kind === 'video') {
                codecs.splice(index, 1)
                codecs.unshift(codec)
                codecs = codecs.filter(codec => !codec.mimeType.includes('VP'))
                console.log(codecs)
                transceiver.setCodecPreferences(codecs)
            }
        }
        break
    }
}
```

---

Some testing about codecs

Mainly tested in Chrome:

- VP9 produces very low frame rate
- H264 with packetization-mode=1 produces very low frame rate
- AV1 actually doesn't consume that much cpu, not like how it works in OBS and ffmpeg by default (speed set to 8 and 1) (yes, 8 is still cpu intensive, and Chrome probably set it to 10 or something like it)
- AV1 can only be used on desktop Chrome (even Edge doesn't support it) (Firefox doesn't support setCodecPreferences)

---

WebComponents/Custom Elements are so bad

- Not many IDE tools/supports
- No initial style before javascript fully loaded
- Hard to use APIs
- So why don't I just use a regular class?
