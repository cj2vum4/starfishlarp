(function () {
  function setup() {
    const audio = document.getElementById('bgm');
    if (!audio) return;

    function stopAudio() {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
    }

    function isHidden() {
      if (typeof document.visibilityState === 'string') {
        return document.visibilityState !== 'visible';
      }
      if ('hidden' in document) {
        return document.hidden === true;
      }
      return false;
    }

    function shouldStop() {
      const hiddenByVisibility = isHidden();
      const lostFocus = typeof document.hasFocus === 'function' ? !document.hasFocus() : false;
      return hiddenByVisibility || lostFocus;
    }

    function onVisibilityChange() {
      if (shouldStop()) stopAudio();
    }

    document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });
    document.addEventListener('webkitvisibilitychange', onVisibilityChange, { passive: true });
    window.addEventListener('pagehide', stopAudio, { capture: true });
    window.addEventListener('beforeunload', stopAudio);
    window.addEventListener('blur', stopAudio);
    document.addEventListener('freeze', stopAudio);

    audio.addEventListener('playing', () => { if (shouldStop()) stopAudio(); });
    audio.addEventListener('timeupdate', () => { if (shouldStop()) stopAudio(); });

    // BGM 改成 preload="none"、不 autoplay（手機省下好幾 MB）。
    // 各頁原本是「靜音先播 → 點擊時 muted=false」，所以第一次互動時要在這裡補 play()，
    // 必須在手勢事件當下同步呼叫，iOS 才允許播放；capture 階段先於各頁自己的 click 處理。
    let started = false;
    function kick() {
      if (started || shouldStop()) return;
      if (!audio.paused) { started = true; return; }
      const p = audio.play();
      started = true;
      if (p && p.catch) p.catch(() => { started = false; });
    }
    ['click', 'touchend', 'keydown'].forEach((t) => {
      document.addEventListener(t, kick, { capture: true, passive: true });
    });
    // 保險：頁面程式若在非點擊時機解除靜音（例如捲動），也接著播放
    audio.addEventListener('volumechange', () => { if (!audio.muted) kick(); });

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('pause', stopAudio);
        navigator.mediaSession.setActionHandler('stop', stopAudio);
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
