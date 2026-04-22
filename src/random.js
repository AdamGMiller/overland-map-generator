// Seeded pseudo-random number generator and 2D simplex noise
// No external dependencies

/**
 * Mulberry32 PRNG - fast, seedable, good distribution
 */
export class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** Returns float in [0, 1) */
  next() {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns float in [min, max) */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Returns integer in [min, max] inclusive */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /** Returns true with probability p */
  chance(p) {
    return this.next() < p;
  }

  /** Pick random element from array */
  pick(arr) {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Shuffle array in place (Fisher-Yates) */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Gaussian random (Box-Muller) with mean 0, stddev 1 */
  gaussian() {
    const u1 = this.next();
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
  }
}

/**
 * 2D Simplex Noise implementation
 */
export class SimplexNoise {
  constructor(rng) {
    // Permutation table
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    // Fisher-Yates shuffle with seeded RNG
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = perm[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  // Gradient vectors for 2D
  static GRAD3 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
  ];

  static F2 = 0.5 * (Math.sqrt(3) - 1);
  static G2 = (3 - Math.sqrt(3)) / 6;

  noise2D(x, y) {
    const { perm, permMod12 } = this;
    const { GRAD3, F2, G2 } = SimplexNoise;

    // Skew input space
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine simplex
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    // Contributions from three corners
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi0 = permMod12[ii + perm[jj]];
      n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi1 = permMod12[ii + i1 + perm[jj + j1]];
      n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi2 = permMod12[ii + 1 + perm[jj + 1]];
      n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2);
    }

    // Scale to [-1, 1]
    return 70 * (n0 + n1 + n2);
  }

  /** Multi-octave fractal noise, returns value in roughly [-1, 1] */
  fractal(x, y, octaves = 4, lacunarity = 2, persistence = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmp = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency);
      maxAmp += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxAmp;
  }
}
