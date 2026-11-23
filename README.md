# Gambit Vanguard

**Developed by Aries Drake Hilton**

Gambit Vanguard is a chess and first-person arena hybrid. Pieces move on the board under standard chess rules; when a capture is declared, the game drops both players into a first-person duel. The attacker and defender fight with the weapons of their pieces, and the winner takes the square. Win a duel as the attacker and the capture stands; lose it and your piece falls instead.

## How it plays

- **The board.** Full chess movement for both sides, with a three-chapter campaign against the Grandmaster AI, plus free skirmish play.
- **The duel.** Captures are settled in the arena. Each piece type carries its own weapon:
  - Pawn: Pulse Carbine
  - Bishop: Chrono Beam Railgun
  - Knight: Volt Scattergun
  - Rook: Heavy Fortress Mortar
  - Queen: Twin Plasma Repeater
  - King: Imperial Gilded Hand-Cannon
- **Perks.** Winning a duel earns an upgrade pick (mobility, damage, magazine, vampiric rounds and more) that stays with that piece for the rest of the match.
- **The clock.** Duels run on a 45-second timer. If time expires, the defender holds the square.

## Multiplayer (local network, 2 players)

Multiplayer is an optional skirmish mode played over a local Wi-Fi network with no server and no account. One player hosts, the other joins:

1. The host opens **Host a Game** and gets a pairing code (also shown as a QR code).
2. The guest opens **Join a Game**, pastes the host's code, and gets a reply code.
3. The host pastes the reply code and presses **Connect**.

The connection is a direct peer-to-peer link between the two devices on the local network; no game data leaves the LAN. The host plays White, the guest plays Black. Both sides earn perks, and the match ends when a king falls in a duel.

## The music

The soundtrack was composed with **VariTheory**, a procedural music theory and mutation engine, in D natural minor at 100 BPM. The source composition ships in this repository as a standard MIDI file (`music/gambit-vanguard-theme.mid`, SMF format 1, PPQ 480) and is performed live in the browser by the game's own WebAudio instruments. No audio files, no samples, no streams.

## Running it

The live demo runs entirely in the browser:

**https://frozen-in-flames.github.io/gambit-vanguard/**

To build from source:

```sh
npm install
npm run dev      # local development
npm run build    # production build into dist/
```

## Technology

React 19, three.js with React Three Fiber, and Vite. Rendering, game logic, procedural audio and networking all run client-side; there is no backend.

## License and credits

Game design, code and music by Aries Drake Hilton. Open-source dependencies are listed in `THIRD_PARTY_NOTICES.md` under their respective MIT licenses.
