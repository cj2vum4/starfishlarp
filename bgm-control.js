(function () {
  const audio = document.getElementById('bgm');
  if (!audio) return;

  function stopAudio() {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') stopAudio();
  });

  window.addEventListener('pagehide', stopAudio, { capture: true });
  window.addEventListener('beforeunload', stopAudio);
  window.addEventListener('blur', stopAudio);
  document.addEventListener('freeze', stopAudio);
})();

(function () {
  const audio = document.getElementById(''bgm'');
  if (!audio) return;

  function stopAudio() {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}
  }

  document.addEventListener(''visibilitychange'', () => {
    if (document.visibilityState !== ''visible'') stopAudio();
  });

  window.addEventListener(''pagehide'', stopAudio, { capture: true });
  window.addEventListener(''beforeunload'', stopAudio);
  window.addEventListener(''blur'', stopAudio);
  document.addEventListener(''freeze'', stopAudio);
})();
