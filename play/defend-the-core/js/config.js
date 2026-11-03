window.DEFEND_CONFIG = {
  ads: {
    // Google AdSense publisher (seller) ID. Leave empty to run the game with ads fully disabled.
    publisherId: 'ca-pub-5964766767830645',
    minRuns: 2,             // no interstitial before the player has finished this many runs
    everyNthRun: 3,         // at most one interstitial per N runs
    minSecondsBetween: 120, // ...and never closer together than this (also counted from page load)
    // test ads / fake ad window on local machines, real ads once the game is hosted
    testMode: ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1
  },
  lock: {
    hosts: ['6fingergames.com', 'www.6fingergames.com'],
    allowLocalhost: false,
    url: 'https://6fingergames.com'
  },
  about: {
    studio: '6 Finger Games',
    author: 'Davit.T',
    email: '3dstudio@mail.com'
  },
  music: []                 // [{ src: 'audio/Track_1.ogg', loop: 12.5 }, ...]
};
