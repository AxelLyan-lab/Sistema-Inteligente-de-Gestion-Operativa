import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const chimeSource = require('../../assets/sounds/chime.wav');
const sosSource = require('../../assets/sounds/sos.wav');

let activePlayer: any = null;

async function playSound(source: any): Promise<void> {
  try {
    if (activePlayer) {
      try {
        activePlayer.remove();
      } catch {}
      activePlayer = null;
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    activePlayer = createAudioPlayer(source);
    activePlayer.play();
  } catch (err) {
    console.warn('[SoundService] No se pudo reproducir audio:', err);
  }
}

export function playMessageSound(): void {
  playSound(chimeSource);
}

export function playSosSound(): void {
  playSound(sosSource);
}
