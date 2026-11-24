/**
 * OIRABOOT (ঐরাবত) — Luminous Fluid Domain-Warped Cosmos & Specular Glow Engine
 *
 * Implements:
 * 1. Buttery 60 FPS Inigo Quilez 2-Stage Domain Warping + Rotated 4-Octave FBM
 * 2. 100% Strict Hero Section Isolation: Clouds NEVER enter or affect the Hero Section.
 *    Active exclusively in Section 2 (Dedicated Studios) and studio subpages.
 * 3. Dynamic Multi-Theme Color Morphing: Smoothly shifts between 5 rich cosmic themes:
 *    - Crimson Nova (Ruby & Royal Violet)
 *    - Astral Aurora (Luminous Sapphire & Magenta)
 *    - Nocturnal Oceanic Slate (Deep Slate-Blue & Velvet Ruby)
 *    - Aegis Gold & Ember (Molten Amber-Gold & Crimson Ember)
 *    - Quantum Prism (Aqua-Jade & Ultraviolet)
 * 4. Real-time synchronized CSS variables (--glow-*, --rim-*, --fog-*)
 */

(function () {
  'use strict';

  /* -------------------------------------------------------------------------
     1. DISTINCT & VIBRANT COSMIC THEMES (SMOOTH COLOR MORPHING)
     ------------------------------------------------------------------------- */
  const PALETTES = [
    {
      name: 'Crimson Nova',
      primary: [238, 38, 78],     // Radiant velvet ruby-crimson
      secondary: [95, 62, 218],   // Royal cosmic violet-indigo
      core: [255, 226, 212],      // Champagne starlight core
      voidCol: [4, 4, 10],        // Deep obsidian velvet
      intensity: 0.72,
    },
    {
      name: 'Astral Aurora',
      primary: [68, 142, 252],    // Luminous celestial sapphire blue
      secondary: [224, 48, 126],  // Silky magenta-violet bloom
      core: [226, 244, 255],      // Glacial starlight
      voidCol: [3, 4, 11],
      intensity: 0.70,
    },
    {
      name: 'Nocturnal Oceanic Slate',
      primary: [216, 40, 72],     // Spartan crimson
      secondary: [42, 88, 146],   // Deep oceanic slate-blue
      core: [238, 230, 246],      // Soft silver starlight crest
      voidCol: [4, 5, 10],
      intensity: 0.68,
    },
    {
      name: 'Aegis Gold & Ember',
      primary: [242, 122, 48],    // Molten antique warrior amber gold
      secondary: [202, 30, 68],   // Spartan crimson underglow
      core: [255, 238, 210],      // Radiant solar ivory
      voidCol: [5, 4, 9],
      intensity: 0.70,
    },
    {
      name: 'Quantum Prism',
      primary: [46, 204, 188],    // Bioluminescent aqua-jade
      secondary: [142, 66, 242],  // Deep photonic ultraviolet
      core: [230, 255, 250],      // Crisp luminous mist
      voidCol: [3, 5, 10],
      intensity: 0.68,
    },
  ];

  /* -------------------------------------------------------------------------
     2. ENGINE STATE
     ------------------------------------------------------------------------- */
  const state = {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 1.25),
    startTime: performance.now(),
    lastFrame: performance.now(),
    paletteIdx: 0,
    paletteClock: 0,
    paletteDuration: 7.5, // Transitions to next vibrant palette every 7.5 seconds
    autoPalette: true,
    isDark: false,
    webglReady: false,
    visible: false,

    colors: {
      primary: [...PALETTES[0].primary],
      secondary: [...PALETTES[0].secondary],
      core: [...PALETTES[0].core],
      voidCol: [...PALETTES[0].voidCol],
      intensity: PALETTES[0].intensity,
    },

    light1: { x: 0.52, y: 0.46 },
    light2: { x: 0.36, y: 0.60 },

    pointer: {
      nx: 0,
      ny: 0,
      smoothNx: 0,
      smoothNy: 0,
      active: false,
    },

    lastDomSync: 0,
    animId: null,
  };

  /* -------------------------------------------------------------------------
     3. HIGH-PERFORMANCE 60FPS DOMAIN-WARPED FLUID GLSL SHADER
     ------------------------------------------------------------------------- */
  let fogCanvas = null;
  let fogWrapper = null;
  let gl = null;
  let glProgram = null;
  let u = {};

  const VERT_SRC = `
    attribute vec2 a_pos;
    void main() {
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FRAG_SRC = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_mouse;
    uniform vec2 u_light1;
    uniform vec2 u_light2;
    uniform vec3 u_primary;
    uniform vec3 u_secondary;
    uniform vec3 u_core;
    uniform vec3 u_void;
    uniform float u_intensity;

    // Fast, artifact-free 2D value noise
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 s = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
    }

    // Rotated 4-octave FBM for silky organic fluid cosmic gas (zero lag, zero grain)
    float fbm(vec2 p) {
      float val = 0.0;
      float amp = 0.52;
      mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
      for (int i = 0; i < 4; i++) {
        val += amp * noise(p);
        p = rot * p * 2.02 + vec2(1.7, 9.2);
        amp *= 0.5;
      }
      return val;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / max(u_res, vec2(1.0));
      float aspect = u_res.x / max(u_res.y, 1.0);
      vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

      // Subtle, smooth pointer parallax
      vec2 m = u_mouse * 0.09;
      float t = u_time * 0.11;

      // Inigo Quilez 2-Stage Domain Warping (silky fluid currents, zero grain/noise)
      vec2 q = vec2(
        fbm(p * 1.35 + vec2(t * 0.45, -t * 0.30) + m * 0.35),
        fbm(p * 1.35 + vec2(-t * 0.36, t * 0.40) + vec2(4.2, 1.3))
      );

      vec2 r = vec2(
        fbm(p * 1.70 + 2.2 * q + vec2(1.9, 6.4) + t * 0.24),
        fbm(p * 1.70 + 2.2 * q + vec2(7.3, 2.8) - t * 0.20)
      );

      float nebula = fbm(p * 1.25 + 1.75 * r - m * 0.22);

      // Flowing luminous aurora silk ribbon across diagonal horizon
      float wave = sin(p.x * 2.2 + r.x * 2.8 + t * 1.15) * 0.22;
      float ribbon = exp(-abs(p.y - wave - (p.x * 0.10)) * 4.2);
      float ribbonFine = exp(-abs(p.y - wave * 1.16 + 0.05) * 9.5);

      // Dual Drifting Volumetric Light Orbs
      vec2 l1 = (u_light1 - 0.5) * vec2(aspect, 1.0);
      vec2 l2 = (u_light2 - 0.5) * vec2(aspect, 1.0);
      float d1 = length(p - l1);
      float d2 = length(p - l2);

      float glow1 = exp(-d1 * 2.1) * 1.0;
      float glow2 = exp(-d2 * 2.0) * 0.88;

      // Compose rich, eye-soothing multi-tone cosmic color field
      vec3 col = u_void;

      // Deep secondary cosmic mist
      float mistMask = smoothstep(0.24, 0.86, nebula + q.y * 0.28);
      col += u_secondary * mistMask * 0.45;

      // Primary radiant nebula clouds illuminated by Light 1
      float cloudFilament = pow(clamp(nebula * 1.12 + r.x * 0.34, 0.0, 1.0), 1.85);
      col += u_primary * cloudFilament * (0.42 + glow1 * 0.85);

      // Luminous Silk Aurora Currents
      col += mix(u_secondary, u_primary, 0.55) * ribbon * (0.28 + nebula * 0.42);
      col += u_core * ribbonFine * (0.22 + glow1 * 0.45);

      // Soft Volumetric Atmospheric Blooms around light poles
      col += u_primary * glow1 * 0.38;
      col += u_secondary * glow2 * 0.35;
      col += u_core * pow(glow1, 2.6) * 0.40;

      // Controlled overall intensity for 100% foreground clarity
      col = mix(u_void, col, u_intensity);

      // Eye-soothing cinema tone mapping
      col = col / (1.0 + col * 0.52);
      col = pow(max(col, 0.0), vec3(0.95));

      // Soft Radial Vignette Fade
      float vig = smoothstep(1.35, 0.25, length(p * vec2(0.88, 1.05)));
      col *= mix(0.48, 1.02, vig);

      // Ultra-fine dithering to eliminate monitor banding
      float dither = (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;
      col += vec3(dither);

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function initWebGL() {
    if (!fogCanvas) return false;
    try {
      gl =
        fogCanvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
        }) ||
        fogCanvas.getContext('experimental-webgl', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
        });

      if (!gl) return false;

      function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.warn('Cosmos Shader Error:', gl.getShaderInfoLog(s));
          gl.deleteShader(s);
          return null;
        }
        return s;
      }

      const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
      if (!vs || !fs) return false;

      glProgram = gl.createProgram();
      gl.attachShader(glProgram, vs);
      gl.attachShader(glProgram, fs);
      gl.linkProgram(glProgram);

      if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
        console.warn('Cosmos Program Link Error:', gl.getProgramInfoLog(glProgram));
        return false;
      }

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );

      const posLoc = gl.getAttribLocation(glProgram, 'a_pos');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      u = {
        res: gl.getUniformLocation(glProgram, 'u_res'),
        time: gl.getUniformLocation(glProgram, 'u_time'),
        mouse: gl.getUniformLocation(glProgram, 'u_mouse'),
        light1: gl.getUniformLocation(glProgram, 'u_light1'),
        light2: gl.getUniformLocation(glProgram, 'u_light2'),
        primary: gl.getUniformLocation(glProgram, 'u_primary'),
        secondary: gl.getUniformLocation(glProgram, 'u_secondary'),
        core: gl.getUniformLocation(glProgram, 'u_core'),
        voidCol: gl.getUniformLocation(glProgram, 'u_void'),
        intensity: gl.getUniformLocation(glProgram, 'u_intensity'),
      };

      state.webglReady = true;
      return true;
    } catch (err) {
      console.warn('Cosmos WebGL unavailable:', err);
      state.webglReady = false;
      return false;
    }
  }

  /* -------------------------------------------------------------------------
     4. COLOR MORPHING & MATH HELPERS
     ------------------------------------------------------------------------- */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpRGB(cur, tgt, rate) {
    cur[0] = lerp(cur[0], tgt[0], rate);
    cur[1] = lerp(cur[1], tgt[1], rate);
    cur[2] = lerp(cur[2], tgt[2], rate);
  }

  function updatePalette(dt) {
    if (!state.autoPalette) return;

    state.paletteClock += dt;
    if (state.paletteClock >= state.paletteDuration) {
      state.paletteClock = 0;
      state.paletteIdx = (state.paletteIdx + 1) % PALETTES.length;
    }

    const curPal = PALETTES[state.paletteIdx];

    // Smoothly and continuously lerp toward the active palette
    // At 60 FPS with rate ~0.026, colors blend seamlessly over 1.2s - 1.5s
    lerpRGB(state.colors.primary, curPal.primary, 0.026);
    lerpRGB(state.colors.secondary, curPal.secondary, 0.026);
    lerpRGB(state.colors.core, curPal.core, 0.026);
    lerpRGB(state.colors.voidCol, curPal.voidCol, 0.026);
    state.colors.intensity = lerp(state.colors.intensity, curPal.intensity, 0.026);
  }

  window.cycleCosmosTheme = function () {
    state.paletteClock = 0;
    state.paletteIdx = (state.paletteIdx + 1) % PALETTES.length;
    return PALETTES[state.paletteIdx].name;
  };

  /* -------------------------------------------------------------------------
     5. LIVE CSS LIGHTING VARIABLE SYNCHRONIZATION
     ------------------------------------------------------------------------- */
  function syncCSSGlow(now) {
    if (now - state.lastDomSync < 32) return; // Throttled to ~30Hz to prevent DOM thrashing
    state.lastDomSync = now;

    const root = document.documentElement.style;
    const lx = state.light1.x * 100;
    const ly = state.light1.y * 100;
    const rx = state.light2.x * 100;
    const ry = state.light2.y * 100;
    const dx = (0.5 - state.light1.x) * 28;
    const dy = (0.5 - state.light1.y) * 28;
    const angle = (Math.atan2(state.light1.y - 0.5, state.light1.x - 0.5) * 180) / Math.PI + 90;

    root.setProperty('--glow-x', `${lx.toFixed(2)}%`);
    root.setProperty('--glow-y', `${ly.toFixed(2)}%`);
    root.setProperty('--rim-x', `${rx.toFixed(2)}%`);
    root.setProperty('--rim-y', `${ry.toFixed(2)}%`);
    root.setProperty('--glow-dx', `${dx.toFixed(1)}px`);
    root.setProperty('--glow-dy', `${dy.toFixed(1)}px`);
    root.setProperty('--glow-angle', `${angle.toFixed(1)}deg`);

    const c = state.colors;
    const pStr = `${Math.round(c.primary[0])}, ${Math.round(c.primary[1])}, ${Math.round(c.primary[2])}`;
    const sStr = `${Math.round(c.secondary[0])}, ${Math.round(c.secondary[1])}, ${Math.round(c.secondary[2])}`;
    const coreStr = `${Math.round(c.core[0])}, ${Math.round(c.core[1])}, ${Math.round(c.core[2])}`;

    root.setProperty('--glow-primary', pStr);
    root.setProperty('--glow-secondary', sStr);
    root.setProperty('--glow-core', coreStr);

    // Fog backward-compatibility aliases
    root.setProperty('--fog-x', `${lx.toFixed(2)}%`);
    root.setProperty('--fog-y', `${ly.toFixed(2)}%`);
    root.setProperty('--fog-angle', `${angle.toFixed(1)}deg`);
    root.setProperty('--fog-primary', pStr);
    root.setProperty('--fog-secondary', sStr);
    root.setProperty('--fog-mist', coreStr);
  }

  /* -------------------------------------------------------------------------
     6. MAIN RENDER LOOP (60 FPS BUTTERY PERFORMANCE)
     ------------------------------------------------------------------------- */
  function frame(now) {
    state.animId = requestAnimationFrame(frame);

    // Only render when dark mode is active and element is visible
    if (!state.isDark || !state.visible) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - state.lastFrame) * 0.001));
    state.lastFrame = now;

    const t = (now - state.startTime) * 0.001;

    // Smooth pointer parallax dampening
    state.pointer.smoothNx = lerp(state.pointer.smoothNx, state.pointer.nx, 0.035);
    state.pointer.smoothNy = lerp(state.pointer.smoothNy, state.pointer.ny, 0.035);

    // Smoothly glide dual light centers in organic cosmic infinity curves
    state.light1.x = 0.50 + Math.sin(t * 0.32) * 0.22 + state.pointer.smoothNx * 0.12;
    state.light1.y = 0.48 + Math.sin(t * 0.62) * 0.14 + state.pointer.smoothNy * 0.09;
    state.light2.x = 0.50 - Math.sin(t * 0.28) * 0.24 - state.pointer.smoothNx * 0.08;
    state.light2.y = 0.52 + Math.cos(t * 0.35) * 0.18;

    updatePalette(dt);

    if (state.webglReady && gl && glProgram) {
      gl.useProgram(glProgram);
      gl.uniform2f(u.res, fogCanvas.width, fogCanvas.height);
      gl.uniform1f(u.time, t);
      gl.uniform2f(u.mouse, state.pointer.smoothNx, -state.pointer.smoothNy);
      gl.uniform2f(u.light1, state.light1.x, 1.0 - state.light1.y);
      gl.uniform2f(u.light2, state.light2.x, 1.0 - state.light2.y);

      const c = state.colors;
      gl.uniform3f(u.primary, c.primary[0] / 255, c.primary[1] / 255, c.primary[2] / 255);
      gl.uniform3f(u.secondary, c.secondary[0] / 255, c.secondary[1] / 255, c.secondary[2] / 255);
      gl.uniform3f(u.core, c.core[0] / 255, c.core[1] / 255, c.core[2] / 255);
      gl.uniform3f(u.voidCol, c.voidCol[0] / 255, c.voidCol[1] / 255, c.voidCol[2] / 255);
      gl.uniform1f(u.intensity, c.intensity);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    syncCSSGlow(now);
  }

  /* -------------------------------------------------------------------------
     7. RESIZE & VISIBILITY MANAGEMENT (STRICT HERO SECTION ISOLATION)
     ------------------------------------------------------------------------- */
  function resizeCanvas() {
    if (!fogCanvas) return;
    state.w = Math.max(320, window.innerWidth);
    state.h = Math.max(480, window.innerHeight);

    // Capped at 1.25x scale: silky 60fps on all displays including 4K
    const scale = Math.min(window.devicePixelRatio || 1, 1.25);
    fogCanvas.width = Math.max(1, Math.floor(state.w * scale));
    fogCanvas.height = Math.max(1, Math.floor(state.h * scale));
    if (gl) gl.viewport(0, 0, fogCanvas.width, fogCanvas.height);
  }

  function updateFogVisibility() {
    if (!fogWrapper) {
      fogWrapper = document.getElementById('galaxy-fog-wrapper');
    }
    if (!fogWrapper && fogCanvas) {
      fogWrapper = fogCanvas.parentElement;
    }
    if (!fogWrapper) return;

    if (!state.isDark) {
      fogWrapper.style.display = 'none';
      fogWrapper.style.opacity = '0';
      state.visible = false;
      return;
    }

    const heroPlate = document.getElementById('hero-plate');
    if (heroPlate) {
      // STRICT HERO ISOLATION:
      // While user is viewing the Hero Section (rect.bottom > 60), fog is 100% OFF.
      // Clouds NEVER leak or penetrate into the hero section!
      const rect = heroPlate.getBoundingClientRect();
      const heroBottom = rect.bottom;

      if (heroBottom > 60) {
        // Hero takes up the viewport: suppress fog completely
        fogWrapper.style.display = 'none';
        fogWrapper.style.opacity = '0';
        state.visible = false;
      } else {
        // Scrolled completely past hero into Section 2: fade in silky cosmic fog
        fogWrapper.style.display = 'block';
        const progress = Math.min(1, Math.max(0, (60 - heroBottom) / 80));
        fogWrapper.style.opacity = progress.toFixed(3);
        state.visible = progress > 0.05;
      }
    } else {
      // On Studio Subpages (/documents, /admissions, /scholarships, /about):
      // Fog is active across the entire page background!
      fogWrapper.style.display = 'block';
      fogWrapper.style.opacity = '1';
      state.visible = true;
    }
  }

  function bindEvents() {
    window.addEventListener(
      'resize',
      () => {
        resizeCanvas();
        updateFogVisibility();
      },
      { passive: true }
    );

    window.addEventListener('scroll', updateFogVisibility, { passive: true });

    window.addEventListener(
      'pointermove',
      (e) => {
        state.pointer.nx = (e.clientX / window.innerWidth - 0.5) * 2;
        state.pointer.ny = (e.clientY / window.innerHeight - 0.5) * 2;
        state.pointer.active = true;
      },
      { passive: true }
    );

    window.addEventListener('pointerleave', () => {
      state.pointer.nx = 0;
      state.pointer.ny = 0;
      state.pointer.active = false;
    });
  }

  function checkTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    state.isDark = theme === 'dark';
    updateFogVisibility();
  }

  window.updateGalaxyTheme = function (theme) {
    state.isDark = theme === 'dark';
    updateFogVisibility();
  };

  /* -------------------------------------------------------------------------
     8. BOOTSTRAP
     ------------------------------------------------------------------------- */
  function bootCosmos() {
    fogCanvas = document.getElementById('galaxy-fog-canvas') || document.getElementById('galaxy-bg-canvas');
    if (!fogCanvas) return;
    fogWrapper = document.getElementById('galaxy-fog-wrapper') || fogCanvas.parentElement;

    checkTheme();
    resizeCanvas();
    initWebGL();
    bindEvents();
    updateFogVisibility();

    if (!state.animId) {
      state.animId = requestAnimationFrame(frame);
    }

    const observer = new MutationObserver(() => {
      checkTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCosmos);
  } else {
    bootCosmos();
  }
})();
