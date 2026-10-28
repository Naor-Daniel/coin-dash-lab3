/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
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
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.image(90 + i * 270, 100, 'drone');
      this.drones.add(drone);
      drone.body.setSize(26, 26).setCollideWorldBounds(true).setBounce(1, 1);
      // A restless wobble so the drones look like they are hovering.
      this.tweens.add({ targets: drone, angle: { from: -10, to: 10 }, duration: 260 + i * 40,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
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
    if (this.finished) return;
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
    const best = Math.max(this.score, this.registry.get('best') || 0);
    this.hud.setText(`Coins: ${this.score}   Best: ${best}            Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    // The registry outlives scene restarts, so the best score lasts for the session.
    const best = Math.max(this.score, this.registry.get('best') || 0);
    this.registry.set('best', best);
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 520, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected (best: ${best})\nPress R to try again`,
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
