/*
 * Google Apps Script 玩本記錄寫入端點。
 * 由「新增玩本記錄.html」讀取，直接將資料送入榮譽牆使用的 Google Sheet。
 */
window.STARFISH_PLAY_RECORD_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbz2jFZhU9tSm-WvZaC_lLSovG2zy3Up2-HNlK6sO6xyfnFDQu8DxRUIKmhDBg1AHMDsDg/exec';

// 津門遺雲實際為 7 人版本，表單只顯示目前確認過的角色。
(function patchJinmenFormData() {
  if (!Array.isArray(window.SCRIPTS)) return;
  const script = window.SCRIPTS.find((item) => item && item.id === 'jinmen');
  if (!script) return;

  script.players = 7;
  script.playersLabel = '4男3女';
  script.poster = 'https://i.postimg.cc/QNpdd5nW/feng-mian.jpg';
  script.characters = ['大少爺', '大少奶奶', '二少爺', '二少奶奶', '三小姐', '四少爺', '大掌櫃'];
})();
