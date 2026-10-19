// Browsers only let a page make sound in answer to a click or key press, but
// the studio's sound starts seconds after you pick a world, once it's built.
// So the click that picks the world opens the audio there and then, and the
// studio's sound (src/audio.ts) picks it up when it's ready. This lives outside
// the studio's own code so the globes can call it without loading the studio.

let opened: AudioContext | null = null;

/** Call from inside a click or key press. Returns the audio, now allowed to play. */
export function unlockAudio(): AudioContext | null {
  if (!opened) {
    try {
      opened = new AudioContext();
    } catch {
      return null;
    }
    // Safari wants something actually played inside the gesture before it lets go.
    const blip = opened.createBufferSource();
    blip.buffer = opened.createBuffer(1, 1, 22050);
    blip.connect(opened.destination);
    blip.start(0);
  }
  void opened.resume();
  return opened;
}

/** The audio opened by an earlier click, if there was one. */
export const unlockedAudio = () => opened;
