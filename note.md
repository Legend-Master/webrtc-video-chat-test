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
