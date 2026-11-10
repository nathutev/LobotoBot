(function() {
  let lastWordsCount = -1;

  function sendWocaData() {
    try {
      const words = window.$locWords || (typeof $locWords !== 'undefined' ? $locWords : null);
      if (words && Array.isArray(words) && words.length > 0) {
        if (words.length !== lastWordsCount) {
          lastWordsCount = words.length;
          window.postMessage({ type: "WOCABEE_DATA", words: words }, "*");
          console.log("LobotoBot: Načteno " + words.length + " slovíček.");
        }
      }
    } catch (e) {
      console.warn("LobotoBot inject error:", e);
    }
  }

  sendWocaData();
  setInterval(sendWocaData, 1000);
})();
