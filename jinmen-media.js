(function () {
  'use strict';

  const MAIN_POSTER = 'https://i.postimg.cc/QNpdd5nW/feng-mian.jpg';
  const SECONDARY_POSTER = 'https://i.postimg.cc/x8yfpDz9/feng-mian2.png';
  const CHARACTER_POSTERS = {
    '大少爺': 'https://i.postimg.cc/L5B9QKZk/feng-mian-she-ji-zheng-gao-(da-shao-ye).jpg',
    '大少奶奶': 'https://i.postimg.cc/bYQwwbFn/feng-mian-she-ji-zheng-gao-(da-shao-nai-nai).jpg',
    '二少爺': 'https://i.postimg.cc/3NC8f5DB/feng-mian-she-ji-zheng-gao-(er-shao-ye).jpg',
    '二少奶奶': 'https://i.postimg.cc/NF7sCqrb/feng-mian-she-ji-zheng-gao-(er-shao-nai-nai).jpg',
    '三小姐': 'https://i.postimg.cc/SR7S1Fz5/feng-mian-she-ji-zheng-gao-(san-xiao-jie).jpg',
    '四少爺': 'https://i.postimg.cc/h49ttx31/feng-mian-she-ji-zheng-gao-(si-shao-ye).jpg',
    '大掌櫃': 'https://i.postimg.cc/fyjzqn0C/feng-mian-she-ji-zheng-gao-(da-zhang-gui).jpg'
  };

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .poster-gallery {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 22px;
        max-width: 920px;
        margin: 0 auto;
        align-items: start;
      }
      .poster-gallery figure { margin: 0; }
      .poster-gallery .poster-image {
        max-width: 100%;
        width: 100%;
        aspect-ratio: 3 / 4;
        object-fit: cover;
      }
      .poster-caption {
        margin-top: 10px;
        color: rgba(245,234,208,.7);
        font-size: .9rem;
        letter-spacing: .08em;
      }
      .character-card {
        justify-content: flex-start !important;
        padding: 0 0 18px !important;
        min-height: 0 !important;
      }
      .character-poster {
        display: block;
        width: 100%;
        aspect-ratio: 3 / 4;
        object-fit: cover;
        margin-bottom: 14px;
        border-bottom: 1px solid rgba(212,175,110,.25);
        background: rgba(0,0,0,.25);
      }
      .character-card .character-emoji { display: none; }
      .character-card .character-name,
      .character-card .character-info { padding-left: 12px; padding-right: 12px; }
      @media (max-width: 680px) {
        .poster-gallery { grid-template-columns: 1fr; }
        .characters-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    `;
    document.head.appendChild(style);
  }

  function replaceMainPosters() {
    const section = document.querySelector('.poster-section');
    if (!section) return;

    section.innerHTML = `
      <div class="poster-gallery">
        <figure>
          <img class="poster-image" src="${MAIN_POSTER}" alt="津門遺雲主海報" fetchpriority="high">
          <figcaption class="poster-caption">津門遺雲・主海報</figcaption>
        </figure>
        <figure>
          <img class="poster-image" src="${SECONDARY_POSTER}" alt="津門遺雲補充海報" loading="lazy">
          <figcaption class="poster-caption">津門遺雲・補充視覺</figcaption>
        </figure>
      </div>`;
  }

  function correctPlayerInformation() {
    document.querySelectorAll('.info-item').forEach((item) => {
      const label = item.querySelector('.info-label');
      const value = item.querySelector('.info-value');
      if (label && value && label.textContent.includes('遊戲人數')) {
        value.textContent = '7人 · 4男3女';
      }
    });

    document.querySelectorAll('.character-card').forEach((card) => {
      const name = card.querySelector('.character-name');
      if (!name) return;
      const role = name.textContent.trim();
      if (role === '捕快') {
        card.remove();
        return;
      }

      const imageUrl = CHARACTER_POSTERS[role];
      if (!imageUrl || card.querySelector('.character-poster')) return;
      const image = document.createElement('img');
      image.className = 'character-poster';
      image.src = imageUrl;
      image.alt = `津門遺雲角色海報・${role}`;
      image.loading = 'lazy';
      card.prepend(image);
    });

    document.querySelectorAll('.description-text .highlight').forEach((highlight) => {
      if (highlight.textContent.includes('除了捕快')) {
        highlight.textContent = '「這座靈堂裡，每一個人，都藏著不能說的秘密。」';
      }
    });
  }

  function init() {
    addStyles();
    replaceMainPosters();
    correctPlayerInformation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
