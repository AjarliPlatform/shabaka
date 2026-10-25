// Small synthesized sounds. Silently does nothing where Web Audio is missing.
(function (root) {
  let audio = null;
  const Sound = { muted: false };

  function tone(freq, at, length, volume) {
    if (Sound.muted) return;
    const Context = root.AudioContext || root.webkitAudioContext;
    if (!Context) return;
    try { audio = audio || new Context(); } catch { return; }
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.frequency.value = freq; osc.type = "sine";
    gain.gain.setValueAtTime(volume, audio.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + at + length);
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + at); osc.stop(audio.currentTime + at + length);
  }

  Sound.tap = () => tone(520, 0, .07, .035);
  Sound.piano = count => { for (let i = 0; i < count; i++) tone(494 + i * 42, i * .034, .09, .03); };
  Sound.finish = () => [523, 659, 784].forEach((freq, i) => tone(freq, i * .09, .18, .04));
  root.Sound = Sound;
})(window);
