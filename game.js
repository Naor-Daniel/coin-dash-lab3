/* global Phaser, COIN_DASH */
const playCoinSound = (() => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let context;

  function unlockAudio() {
    if (!AudioContextClass) return;
    try {
      if (!context) context = new AudioContextClass();
      if (context.state !== 'running') context.resume().catch(() => {});
    } catch {
      // Sound is optional; keep the game playable if audio is unavailable.
    }
  }

  // Browsers require a user gesture before Web Audio can play.
  window.addEventListener('keydown', unlockAudio, true);
  window.addEventListener('pointerdown', unlockAudio, true);

  return () => {
    if (!context || context.state !== 'running') return;
    try {
      const now = context.currentTime;
      const note = context.createOscillator();
      const volume = context.createGain();
      note.type = 'sine';
      note.frequency.setValueAtTime(660, now);
      note.frequency.exponentialRampToValueAtTime(990, now + 0.12);
      volume.gain.setValueAtTime(0.0001, now);
      volume.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      note.connect(volume);
      volume.connect(context.destination);
      note.onended = () => { note.disconnect(); volume.disconnect(); };
      note.start(now);
      note.stop(now + 0.18);
    } catch {
      // A failed audio device should never interrupt scoring.
    }
  };
})();

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
    this.isPaused = false;
    this.physics.resume();
    this.deadline = this.time.now + this.settings.seconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
      this.add.rectangle(0, 0, 300, 100, 0x0a1120, 0.9),
      this.add.text(0, 0, 'Paused\nPress P to resume',
        { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }).setOrigin(0.5)
    ]).setDepth(1).setVisible(false);
    this.makeTextures();
    this.player = this.add.image(c.width / 2, c.height / 2, 'hero');
    this.physics.add.existing(this.player);
    // Hitboxes keep the original sizes; only the art around them changed.
    this.player.body.setSize(24, 24).setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    const { droneCount, droneSpeed } = this.settings;
    for (let i = 0; i < droneCount; i++) {
      // Spread drones along the top row so none starts on top of the player.
      const drone = this.add.image((i + 0.5) * c.width / droneCount, 100, 'drone');
      this.drones.add(drone);
      drone.body.setSize(26, 26).setCollideWorldBounds(true).setBounce(1, 1);
      // A restless wobble so the drones look like they are hovering.
      this.tweens.add({ targets: drone, angle: { from: -10, to: 10 }, duration: 260 + i * 40,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * droneSpeed, Math.sin(angle) * droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      playCoinSound();
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
    this.input.keyboard.on('keydown-P', (event) => {
      if (!event.repeat) this.togglePause();
    });
    this.pauseButton = document.getElementById('pause-button');
    this.pauseButton.onclick = () => this.togglePause();
    this.updatePauseButton();
    this.showBanner(`Level ${this.level + 1}\nCollect ${this.settings.targetCoins} coins`);
  }

  isLastLevel() { return this.level === COIN_DASH.levels.length - 1; }

  nextLevel() {
    // Only a passed level unlocks the next one.
    if (this.passed && !this.isLastLevel()) this.scene.restart({ level: this.level + 1 });
  }

  showBanner(message) {
    const c = COIN_DASH;
    this.banner = this.add.text(c.width / 2, c.height / 2, message,
      { font: '28px monospace', color: '#ffd166', align: 'center', lineSpacing: 10 }).setOrigin(0.5);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1200, duration: 600,
      onComplete: () => this.banner.destroy() });
  }

  updatePauseButton() {
    this.pauseButton.textContent = this.isPaused ? 'Resume' : 'Pause';
    this.pauseButton.setAttribute('aria-label', this.isPaused ? 'Resume game' : 'Pause game');
    this.pauseButton.setAttribute('aria-pressed', String(this.isPaused));
    this.pauseButton.disabled = this.finished;
  }

  togglePause() {
    if (this.finished) return;
    if (this.isPaused) {
      this.deadline += this.time.now - this.pauseStartedAt;
      this.physics.resume();
      this.tweens.resumeAll();
    } else {
      this.pauseStartedAt = this.time.now;
      this.physics.pause();
      this.tweens.pauseAll();
    }
    this.isPaused = !this.isPaused;
    this.pauseOverlay.setVisible(this.isPaused);
    this.updatePauseButton();
  }

  makeTextures() {
    // Textures survive scene restarts, so draw them only once.
    if (this.textures.exists('hero')) return;
    const col = COIN_DASH.colors;
    const g = this.make.graphics({}, false);

    // Hero, drawn facing right: rotating the image points it anywhere.
    g.fillStyle(col.player).fillRoundedRect(6, 6, 24, 24, 7);
    g.fillTriangle(29, 11, 36, 18, 29, 25);
    g.fillStyle(0xffffff).fillCircle(23, 13, 4).fillCircle(23, 23, 4);
    g.fillStyle(col.background).fillCircle(25, 13, 2).fillCircle(25, 23, 2);
    g.generateTexture('hero', 36, 36);

    // Drone: rotor arms, a spiked shell and an angry face.
    g.clear();
    g.lineStyle(4, col.droneDark).lineBetween(7, 7, 37, 37).lineBetween(37, 7, 7, 37);
    for (const [x, y] of [[7, 7], [37, 7], [7, 37], [37, 37]]) {
      g.fillStyle(col.droneDark).fillCircle(x, y, 6);
      g.lineStyle(2, col.drone).strokeCircle(x, y, 6);
    }
    const spikes = [];
    for (let i = 0; i < 16; i++) {
      const r = i % 2 ? 11 : 16, a = i * Math.PI / 8;
      spikes.push({ x: 22 + Math.cos(a) * r, y: 22 + Math.sin(a) * r });
    }
    g.fillStyle(col.drone).fillPoints(spikes, true);
    g.fillStyle(col.droneEye).fillTriangle(13, 17, 21, 21, 14, 24).fillTriangle(31, 17, 23, 21, 30, 24);
    g.fillStyle(col.droneDark).fillCircle(17, 21, 1.5).fillCircle(27, 21, 1.5);
    g.lineStyle(2, col.droneDark).strokePoints(
      [{ x: 16, y: 29 }, { x: 18, y: 27 }, { x: 20, y: 29 }, { x: 22, y: 27 },
        { x: 24, y: 29 }, { x: 26, y: 27 }, { x: 28, y: 29 }]);
    g.generateTexture('drone', 44, 44);
    g.destroy();
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
    if (this.finished || this.isPaused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    // Turn smoothly towards the movement direction; keep facing it when stopped.
    if (dx || dy) {
      this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, Math.atan2(dy, dx), 0.35);
    }
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
    this.tweens.pauseAll();
    this.updatePauseButton();
    // Don't leave the level banner on top of the end-of-level panel.
    if (this.banner.active) this.banner.destroy();
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
