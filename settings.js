// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  playerSpeed: 240,
  // Collect `targetCoins` before the clock runs out to unlock the next level.
  levels: [
    { targetCoins: 8, seconds: 30, droneCount: 2, droneSpeed: 90 },
    { targetCoins: 12, seconds: 35, droneCount: 3, droneSpeed: 125 },
    { targetCoins: 16, seconds: 40, droneCount: 5, droneSpeed: 160 }
  ],
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a }
};
