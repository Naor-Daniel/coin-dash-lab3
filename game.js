/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  init(data) {
    // Restarting the scene with { level } keeps progress; a fresh start begins at level 0.
    this.level = data.level || 0;
  }

  create() {
    const c = COIN_DASH;
    this.settings = c.levels[this.level];
    this.score = 0;
    this.finished = false;
    this.passed = false;
    this.deadline = this.time.now + this.settings.seconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    const { droneCount, droneSpeed } = this.settings;
    for (let i = 0; i < droneCount; i++) {
      // Spread drones along the top row so none starts on top of the player.
      const drone = this.add.rectangle((i + 0.5) * c.width / droneCount, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * droneSpeed, Math.sin(angle) * droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      if (this.score >= this.settings.targetCoins) this.finish('Level complete!', true);
      else this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    // R retries the current level, or starts over from level 1 after beating the last one.
    this.input.keyboard.on('keydown-R', () =>
      this.scene.restart({ level: this.isLastLevel() && this.passed ? 0 : this.level }));
    this.input.keyboard.on('keydown-ENTER', () => this.nextLevel());
    this.input.keyboard.on('keydown-SPACE', () => this.nextLevel());
    this.showBanner(`Level ${this.level + 1}\nCollect ${this.settings.targetCoins} coins`);
  }

  isLastLevel() { return this.level === COIN_DASH.levels.length - 1; }

  nextLevel() {
    // Only a passed level unlocks the next one.
    if (this.passed && !this.isLastLevel()) this.scene.restart({ level: this.level + 1 });
  }

  showBanner(message) {
    const c = COIN_DASH;
    const banner = this.add.text(c.width / 2, c.height / 2, message,
      { font: '28px monospace', color: '#ffd166', align: 'center', lineSpacing: 10 }).setOrigin(0.5);
    this.tweens.add({ targets: banner, alpha: 0, delay: 1200, duration: 600,
      onComplete: () => banner.destroy() });
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const best = Math.max(this.score, this.bestForLevel());
    this.hud.setText(`Level ${this.level + 1}/${COIN_DASH.levels.length}   ` +
      `Coins: ${this.score}/${this.settings.targetCoins}   Best: ${best}      Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  bestForLevel() { return (this.registry.get('best') || {})[this.level] || 0; }

  finish(reason, passed = false) {
    if (this.finished) return;
    this.finished = true;
    this.passed = passed;
    this.physics.pause();
    // The registry outlives scene restarts, so each level's best score lasts for the session.
    const best = Math.max(this.score, this.bestForLevel());
    this.registry.set('best', { ...this.registry.get('best'), [this.level]: best });
    let next = 'Press R to try this level again';
    if (passed) next = this.isLastLevel()
      ? 'You beat every level! Press R to play again'
      : `Press Enter for level ${this.level + 2}`;
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 620, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score}/${this.settings.targetCoins} coins (best: ${best})\n${next}`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
