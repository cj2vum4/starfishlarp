(function () {
  'use strict';

  const POSTER = 'https://i.postimg.cc/QNpdd5nW/feng-mian.jpg';
  const CHARACTERS = ['大少爺', '大少奶奶', '二少爺', '二少奶奶', '三小姐', '四少爺', '大掌櫃'];

  function patchData() {
    const script = Array.isArray(window.SCRIPTS)
      ? window.SCRIPTS.find((item) => item && item.id === 'jinmen')
      : null;
    if (!script) return;

    script.players = 7;
    script.playersLabel = '4男3女';
    script.poster = POSTER;
    script.characters = CHARACTERS.slice();
  }

  function patchNewScriptCard() {
    const card = Array.from(document.querySelectorAll('.new-script-card')).find((item) =>
      String(item.getAttribute('onclick') || '').includes("'jinmen'")
    );
    if (!card) return;

    const placeholder = card.querySelector('.new-script-poster-ph');
    if (placeholder) {
      const image = document.createElement('img');
      image.className = 'new-script-poster';
      image.src = POSTER;
      image.alt = '津門遺雲';
      image.loading = 'lazy';
      placeholder.replaceWith(image);
    }

    card.querySelectorAll('.new-script-tag').forEach((tag) => {
      if (tag.textContent.includes('捕快')) tag.textContent = '4男3女';
    });
  }

  function patchMainCard() {
    const card = Array.from(document.querySelectorAll('.script-card')).find((item) => {
      const title = item.querySelector('.script-title');
      return title && title.textContent.trim() === '津門遺雲';
    });
    if (!card) return;

    card.dataset.players = '7';
    const image = card.querySelector('.script-image');
    if (image) image.src = POSTER;

    const corner = card.querySelector('.corner-diff');
    if (corner) corner.textContent = '7人';

    const firstBadge = card.querySelector('.info-badge');
    if (firstBadge) firstBadge.textContent = '👥 4男3女';
  }

  function init() {
    patchData();
    patchNewScriptCard();
    patchMainCard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
