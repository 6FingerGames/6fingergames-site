window.NEON_CONFIG = {
  ads: {
    // Google AdSense publisher (seller) ID, e.g. 'ca-pub-1234567890123456' (or 'pub-1234567890123456').
    // Leave empty to run the game with ads fully disabled.
    publisherId: 'ca-pub-5964766767830645',
    minRuns: 2,             // no ad before the player has finished this many runs
    everyNthRun: 3,         // at most one interstitial per N finished runs
    minSecondsBetween: 120, // ...and never closer together than this (also counted from page load)
    rewardedRevive: true,   // offer "watch ad -> get a heart back" once per run on game over
    // test ads on local machines, real ads once the game is hosted
    testMode: ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1
  },
  lock: {
    hosts: ['6fingergames.com', 'www.6fingergames.com'],
    allowLocalhost: false,  // dev only: true lets the game run on localhost
    url: 'https://6fingergames.com'
  },
  about: {
    studio: '6 Finger Games',
    author: 'Davit.T',      // shown only when filled in
    email: '3dstudio@mail.com' // shown only when filled in
  },
  music: [
    { src: 'audio/Track_1.ogg', loop: 34.32 },
    { src: 'audio/Track_2.ogg', loop: 51.28 },
    { src: 'audio/Track_3.ogg', loop: 56.16 }
  ]
};
