(function () {
  'use strict';
  const APP = window.__ga, D = APP.D, C = APP.C, $ = APP.$, clamp = APP.clamp, rng = APP.rng, fmt = APP.fmt, RM = APP.RM;
  const THREE = window.THREE, canvas = $('#world');
  function fail() { document.documentElement.classList.add('no-webgl'); APP.world = null; }
  if (!THREE) return fail();
  let renderer;
  try {
    THREE.ColorManagement.enabled = false;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !(APP.TOUCH && (window.devicePixelRatio || 1) >= 2), alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  } catch (e) { return fail(); }

  const V3 = THREE.Vector3;
  const TOUCH = !!APP.TOUCH;

  const MOB = { sheetTop: 1e5, on: false, mu: null, aD: 0.9, box: { x: 0, y: 0, w: 1, h: 1 }, st: { t: 0, b: 1, l: 0, r: 1 }, focus: null, inspect: false };
  const DPR = Math.min(window.devicePixelRatio || 1, TOUCH ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  const col = k => new THREE.Color(C[k]);
  renderer.setClearColor(col('vellum'), 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(col('vellum'), 16, 64);
  const FOV = 42, TAN = Math.tan(FOV * Math.PI / 360) * 2;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 420);
  let W = 1, H = 1;

  const PAPER_TILE = 2048;
  const PAPER_STRENGTH = 0.6;
  const PAPER_MEAN = '#E4D9BF';
  const paperTex = new THREE.Texture();
  paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;
  paperTex.flipY = false;
  paperTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const paperImg = new Image();
  const paperReady = new Promise(res => {
    if (!window.PAPER_URL) return res();
    paperImg.onload = () => { paperTex.image = paperImg; paperTex.needsUpdate = true; U.uPaperOn.value = 1; res(); };
    paperImg.onerror = () => res();
    paperImg.src = window.PAPER_URL;
  });

  const U = {
    uInk: { value: col('ink') }, uOnBg: { value: col('onbg') }, uPaper: { value: col('vellum') }, uLit: { value: col('lit') }, uMinium: { value: col('minium') },
    uFogNear: { value: 16 }, uFogFar: { value: 64 }, uPx: { value: DPR }, uPxScale: { value: 0.001 }, uTime: { value: 0 },
    uPaperTex: { value: paperTex }, uPaperK: { value: 1 / (PAPER_TILE * DPR) }, uPaperOn: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uPaperAmt: { value: PAPER_STRENGTH }, uPaperMean: { value: new THREE.Color(PAPER_MEAN) },
    uInvVP: { value: new THREE.Matrix4() }, uCamPos: { value: new V3() },
    uDomeC: { value: new V3(0, 0, -170) }, uDomeR: { value: 430 }, uDomeTile: { value: 900 }, uSurfTile: { value: 22 }
  };
  const LIGHT_AVENUE = new V3(-0.3, 0.72, -0.62).normalize();
  const LIGHT_STONE = new V3(-0.78, 0.52, 0.34).normalize();

  const GL_COMMON = [
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y); }',
    'float lines(vec2 p, vec2 dir, float spacing, float w){',
    '  vec2 perp = vec2(-dir.y, dir.x);',
    '  float t = dot(p, perp) / spacing + (vnoise(p * 0.03) - 0.5) * 0.5;',
    '  float d = abs(fract(t) - 0.5) * 2.0;',
    '  float ww = w * (0.72 + 0.56 * vnoise(p * 0.09 + 7.3));',
    '  float aa = 1.5 / spacing;',
    '  return (1.0 - smoothstep(ww - aa, ww + aa, d)) * step(0.03, w);',
    '}'
  ].join('\n');

  const PAPER_GLSL = [
    'uniform sampler2D uPaperTex; uniform float uPaperOn, uPaperAmt, uDomeR, uDomeTile, uSurfTile; uniform vec2 uRes;',
    'uniform mat4 uInvVP; uniform vec3 uCamPos, uDomeC, uPaperMean;',
    'vec3 paperTri(vec3 p, vec3 n, float tile){',
    '  vec3 w = pow(abs(n), vec3(6.0)); w /= (w.x + w.y + w.z + 1e-5);',
    '  return texture2D(uPaperTex, p.zy / tile).rgb * w.x + texture2D(uPaperTex, p.xz / tile).rgb * w.y + texture2D(uPaperTex, p.xy / tile).rgb * w.z;',
    '}',
    'vec3 paperTone(vec3 t){ return uPaper + (t - uPaperMean) * uPaperAmt * uPaperOn; }',
    'vec3 worldAt(vec2 fc, float z){ vec4 p = uInvVP * vec4(fc / uRes * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); return p.xyz / p.w; }',
    'vec3 paperAt(vec2 fc){',
    '  vec3 d = normalize(worldAt(fc, 1.0) - uCamPos), o = uCamPos - uDomeC;',
    '  float b = dot(o, d), c = dot(o, o) - uDomeR * uDomeR;',
    '  vec3 h = o + d * (-b + sqrt(max(b * b - c, 0.0)));',
    '  return paperTone(paperTri(h, h / uDomeR, uDomeTile));',
    '}',
    'vec3 paperOn(vec3 wp, vec3 n){ return paperTone(paperTri(wp, n, uSurfTile)); }'
  ].join('\n');

  function paperize(mat, fill) {
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uPaper: U.uPaper, uPaperTex: U.uPaperTex, uPaperK: U.uPaperK, uPaperOn: U.uPaperOn, uRes: U.uRes, uPaperAmt: U.uPaperAmt, uInvVP: U.uInvVP, uCamPos: U.uCamPos, uDomeC: U.uDomeC, uDomeR: U.uDomeR, uDomeTile: U.uDomeTile, uSurfTile: U.uSurfTile, uPaperMean: U.uPaperMean });
      let f = sh.fragmentShader.replace('void main() {', 'uniform vec3 uPaper;\n' + PAPER_GLSL + '\nvoid main() {');
      if (fill) f = f.replace('vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec3 pW = worldAt( gl_FragCoord.xy, gl_FragCoord.z );\n  vec4 diffuseColor = vec4( paperOn( pW, normalize( cross( dFdx( pW ), dFdy( pW ) ) ) ) + diffuse - uPaper, opacity );');
      sh.fragmentShader = f.replace('#include <fog_fragment>', '#ifdef USE_FOG\n  gl_FragColor.rgb = mix( gl_FragColor.rgb, paperAt( gl_FragCoord.xy ), smoothstep( fogNear, fogFar, vFogDepth ) );\n#endif');
    };
    mat.customProgramCacheKey = () => fill ? 'paper-fill' : 'paper-fog';
    return mat;
  }
  const WORLD_VS = [
    'varying vec3 vNw; varying vec3 vWp; varying float vDepth;',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWp = wp.xyz; vNw = normalize(mat3(modelMatrix) * normal);',
    '  vec4 mv = viewMatrix * wp; vDepth = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  const HATCH_FS = [
    'uniform vec3 uInk, uPaper, uLit, uLight;',
    'uniform float uFogNear, uFogFar, uPx, uTone, uSpacing, uBase, uFill, uFlat;',
    'varying vec3 vNw; varying vec3 vWp; varying float vDepth;',
    GL_COMMON,
    PAPER_GLSL,
    'void main(){',
    '  vec3 n = normalize(vNw);',
    '  if (!gl_FrontFacing) n = -n;',
    '  float tone = dot(n, uLight) * 0.5 + 0.5 + uTone;',
    '  tone -= (1.0 - smoothstep(0.0, 1.5, vWp.y - uBase)) * 0.2;',
    '  float dark = clamp(1.0 - tone, 0.0, 1.0);',
    '  if (uFlat >= 0.0) dark = uFlat;',
    '  vec3 tw = cross(n, vec3(0.0, 1.0, 0.0));',
    '  if (dot(tw, tw) < 0.0004) tw = vec3(1.0, 0.0, 0.35);',
    '  vec2 dir = normalize((viewMatrix * vec4(normalize(tw), 0.0)).xy + vec2(0.00001, 0.0));',
    '  vec2 p = gl_FragCoord.xy / uPx;',
    '  float ink = lines(p, dir, uSpacing, smoothstep(0.28, 0.8, dark) * 0.56);',
    '  vec2 dir2 = vec2(dir.x * 0.5 - dir.y * 0.866, dir.x * 0.866 + dir.y * 0.5);',
    '  ink = max(ink, lines(p + 13.7, dir2, uSpacing * 1.15, smoothstep(0.6, 0.96, dark) * 0.5));',
    '  vec3 pp = paperAt(gl_FragCoord.xy);',
    '  vec3 c = mix(mix(pp, paperOn(vWp, n) + uLit - uPaper, uFill), uInk, ink);',
    '  gl_FragColor = vec4(mix(c, pp, smoothstep(uFogNear, uFogFar, vDepth)), 1.0);',
    '}'
  ].join('\n');
  function hatchMat(o) {
    o = o || {};
    return new THREE.ShaderMaterial({
      uniforms: {
        uInk: U.uInk, uPaper: U.uPaper, uPaperTex: U.uPaperTex, uPaperK: U.uPaperK, uPaperOn: U.uPaperOn, uRes: U.uRes, uPaperAmt: U.uPaperAmt, uInvVP: U.uInvVP, uCamPos: U.uCamPos, uDomeC: U.uDomeC, uDomeR: U.uDomeR, uDomeTile: U.uDomeTile, uSurfTile: U.uSurfTile, uPaperMean: U.uPaperMean, uLit: U.uLit, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uPx: U.uPx,
        uLight: { value: o.light || LIGHT_AVENUE }, uTone: { value: o.tone || 0 }, uSpacing: { value: o.spacing || 5 },
        uBase: { value: o.base || 0 }, uFill: { value: o.fill == null ? 1 : o.fill }, uFlat: { value: o.flat == null ? -1 : o.flat }
      },
      vertexShader: WORLD_VS, fragmentShader: HATCH_FS, side: o.side || THREE.FrontSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
  }
  const SHADOW_FS = [
    'uniform vec3 uInk, uPaper, uC; uniform vec2 uDir;',
    'uniform float uFogNear, uFogFar, uPx, uR, uL;',
    'varying vec3 vNw; varying vec3 vWp; varying float vDepth;',
    GL_COMMON,
    PAPER_GLSL,
    'void main(){',
    '  vec2 q = vWp.xz - uC.xz;',
    '  float along = dot(q, uDir), across = dot(q, vec2(-uDir.y, uDir.x));',
    '  float e = length(vec2((along - uL * 0.45) / (uL * 0.55 + uR), across / (uR * 1.05)));',
    '  float dark = clamp((1.0 - smoothstep(0.55, 1.0, e)) * 0.6 + (1.0 - smoothstep(uR * 0.9, uR * 1.3, length(q))) * 0.16, 0.0, 1.0);',
    '  if (dark < 0.03) discard;',
    '  vec2 dir = normalize((viewMatrix * vec4(uDir.x, 0.0, uDir.y, 0.0)).xy + vec2(0.00001, 0.0));',
    '  vec2 p = gl_FragCoord.xy / uPx;',
    '  float ink = lines(p, dir, 4.6, smoothstep(0.05, 0.75, dark) * 0.5);',
    '  vec2 dir2 = vec2(dir.x * 0.5 - dir.y * 0.866, dir.x * 0.866 + dir.y * 0.5);',
    '  ink = max(ink, lines(p + 9.1, dir2, 5.4, smoothstep(0.6, 0.95, dark) * 0.42));',
    '  vec3 pp = paperAt(gl_FragCoord.xy);',
    '  gl_FragColor = vec4(mix(mix(pp, uInk, ink), pp, smoothstep(uFogNear, uFogFar, vDepth)), 1.0);',
    '}'
  ].join('\n');
  function addShadow(x, z, r, len, light) {
    const dir = new THREE.Vector2(-light.x, -light.z).normalize();
    const size = (len + r * 3) * 2.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShaderMaterial({
      uniforms: { uInk: U.uInk, uPaper: U.uPaper, uPaperTex: U.uPaperTex, uPaperK: U.uPaperK, uPaperOn: U.uPaperOn, uRes: U.uRes, uPaperAmt: U.uPaperAmt, uInvVP: U.uInvVP, uCamPos: U.uCamPos, uDomeC: U.uDomeC, uDomeR: U.uDomeR, uDomeTile: U.uDomeTile, uSurfTile: U.uSurfTile, uPaperMean: U.uPaperMean, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uPx: U.uPx,
        uC: { value: new V3(x, 0, z) }, uDir: { value: dir }, uR: { value: r }, uL: { value: len } },
      vertexShader: WORLD_VS, fragmentShader: SHADOW_FS
    }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z);
    scene.add(m);
  }

  function hullMat(px) {
    return new THREE.ShaderMaterial({
      uniforms: { uInk: U.uInk, uPaper: U.uPaper, uPaperTex: U.uPaperTex, uPaperK: U.uPaperK, uPaperOn: U.uPaperOn, uRes: U.uRes, uPaperAmt: U.uPaperAmt, uInvVP: U.uInvVP, uCamPos: U.uCamPos, uDomeC: U.uDomeC, uDomeR: U.uDomeR, uDomeTile: U.uDomeTile, uSurfTile: U.uSurfTile, uPaperMean: U.uPaperMean, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uPxScale: U.uPxScale, uThick: { value: px } },
      vertexShader: [
        'uniform float uPxScale, uThick; varying float vDepth;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  vec3 n = normalize(normalMatrix * normal);',
        '  mv.xyz += n * uThick * uPxScale * max(-mv.z, 0.1);',
        '  vDepth = -mv.z; gl_Position = projectionMatrix * mv;',
        '}'].join('\n'),
      fragmentShader: [
        'uniform vec3 uInk, uPaper; uniform float uFogNear, uFogFar; varying float vDepth;', PAPER_GLSL,
        'void main(){ gl_FragColor = vec4(mix(uInk, paperAt(gl_FragCoord.xy), smoothstep(uFogNear, uFogFar, vDepth)), 1.0); }'].join('\n'),
      side: THREE.BackSide
    });
  }
  const threadMat = new THREE.ShaderMaterial({
    uniforms: { uInk: U.uInk, uPaper: U.uPaper, uPaperTex: U.uPaperTex, uPaperK: U.uPaperK, uPaperOn: U.uPaperOn, uRes: U.uRes, uPaperAmt: U.uPaperAmt, uInvVP: U.uInvVP, uCamPos: U.uCamPos, uDomeC: U.uDomeC, uDomeR: U.uDomeR, uDomeTile: U.uDomeTile, uSurfTile: U.uSurfTile, uPaperMean: U.uPaperMean, uLit: U.uLit, uFogNear: U.uFogNear, uFogFar: U.uFogFar },
    vertexShader: [
      'attribute vec3 aT; varying vec3 vN; varying vec3 vV; varying vec3 vT; varying vec3 vW; varying vec3 vNW;',
      'void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = mv.xyz; vN = normalMatrix * normal; vT = normalMatrix * aT;',
      '  vW = (modelMatrix * vec4(position, 1.0)).xyz; vNW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * mv; }'].join('\n'),
    fragmentShader: [
      'uniform vec3 uInk, uPaper, uLit; uniform float uFogNear, uFogFar; varying vec3 vN; varying vec3 vV; varying vec3 vT; varying vec3 vW; varying vec3 vNW;', PAPER_GLSL,
      'void main(){',
      '  vec3 v = normalize(-vV), t = normalize(vT);',
      '  v = normalize(v - t * dot(v, t));',
      '  float f = dot(normalize(vN), v);',
      '  vec3 pp = paperAt(gl_FragCoord.xy);',
      '  vec3 c = mix(paperOn(vW, vNW) + uLit - uPaper, uInk, smoothstep(0.9955, 0.9988, f) * 0.85);',
      '  gl_FragColor = vec4(mix(c, pp, smoothstep(uFogNear, uFogFar, -vV.z)), 1.0);',
      '}'].join('\n'),
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
  });
  const inkLine = paperize(new THREE.LineBasicMaterial({ color: col('ink') }));
  const softLine = paperize(new THREE.LineBasicMaterial({ color: col('soft') }));
  const inkFlat = paperize(new THREE.MeshBasicMaterial({ color: col('ink') }));
  const onBgFlat = paperize(new THREE.MeshBasicMaterial({ color: col('onbg') }));
  const litFlat = paperize(new THREE.MeshBasicMaterial({ color: col('lit'), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), true);
  const redFlat = paperize(new THREE.MeshBasicMaterial({ color: col('minium') }));

  const paperBg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uPaper: U.uPaper, uPaperTex: U.uPaperTex, uPaperK: U.uPaperK, uPaperOn: U.uPaperOn, uRes: U.uRes, uPaperAmt: U.uPaperAmt, uInvVP: U.uInvVP, uCamPos: U.uCamPos, uDomeC: U.uDomeC, uDomeR: U.uDomeR, uDomeTile: U.uDomeTile, uSurfTile: U.uSurfTile, uPaperMean: U.uPaperMean },
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.999, 1.0); }',
    fragmentShader: 'uniform vec3 uPaper;\n' + PAPER_GLSL + '\nvoid main(){ gl_FragColor = vec4(paperAt(gl_FragCoord.xy), 1.0); }',
    depthTest: false, depthWrite: false
  }));
  paperBg.frustumCulled = false; paperBg.renderOrder = -1000; scene.add(paperBg);
  const hullStone = hullMat(2.1), hullThread = hullMat(1.5), hullThin = hullMat(1.5);

  function stoneGeometry(o) {
    const k = o.k || 6, L = o.levels || 5, R = rng(o.seed || 1), pos = [], idx = [];
    const a0 = o.a0 != null ? o.a0 : R() * 6.283, leanA = R() * 6.283, lean = o.lean == null ? 0.04 : o.lean, jit = o.jit == null ? 0.14 : o.jit;
    for (let l = 0; l <= L; l++) {
      const t = l / L, y = o.h * t, rr = o.r * (1 - (1 - (o.taper || 0.6)) * Math.pow(t, o.pow || 1.8)) * (l === 0 ? 1.07 : 1);
      const cx = Math.cos(leanA) * lean * o.h * t, cz = Math.sin(leanA) * lean * o.h * t;
      for (let j = 0; j < k; j++) {
        const keep = o.keepEdge && j === 0;
        const a = a0 + j / k * 6.283 + (keep ? 0 : (R() - 0.5) * (o.twist == null ? 0.34 : o.twist));
        const rj = rr * (1 + (keep ? 0 : (R() - 0.5) * 2 * jit));
        pos.push(cx + Math.cos(a) * rj * (o.sx || 1), y + (l > 0 && l < L ? (R() - 0.5) * o.h * 0.04 : 0), cz + Math.sin(a) * rj * (o.sz || 1));
      }
    }
    const top = L * k; let mx = 0, mz = 0;
    for (let j = 0; j < k; j++) { mx += pos[(top + j) * 3]; mz += pos[(top + j) * 3 + 2]; }
    pos.push(mx / k + (R() - 0.5) * o.r * 0.5, o.h * (1 + (o.cap == null ? 0.07 : o.cap)), mz / k + (R() - 0.5) * o.r * 0.5);
    const apex = (L + 1) * k;
    for (let l = 0; l < L; l++) for (let j = 0; j < k; j++) {
      const a = l * k + j, b = l * k + (j + 1) % k, c = (l + 1) * k + j, d = (l + 1) * k + (j + 1) % k;
      idx.push(a, c, b, b, c, d);
    }
    for (let j = 0; j < k; j++) idx.push(top + j, apex, top + (j + 1) % k);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.userData = { k: k, L: L };
    return g;
  }
  function makeStone(o) {
    const g = stoneGeometry(o), smooth = g.clone(), flat = g.toNonIndexed();
    smooth.computeVertexNormals(); flat.computeVertexNormals();
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(smooth, o.hull || hullStone));
    grp.add(new THREE.Mesh(flat, o.mat));
    grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(flat, 10), inkLine));
    grp.userData.geo = g;
    return grp;
  }

  function tubeGeometry(pts, radii, radial) {
    const n = pts.length, pos = new Float32Array(n * radial * 3), nor = new Float32Array(n * radial * 3), tan = new Float32Array(n * radial * 3), idx = [];
    const T = [], N = [], B = [], tmp = new V3();
    for (let i = 0; i < n; i++) T.push(new V3().subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize());
    N[0] = new V3().crossVectors(T[0], Math.abs(T[0].y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)).normalize();
    for (let i = 1; i < n; i++) {
      N[i] = N[i - 1].clone();
      tmp.crossVectors(T[i - 1], T[i]);
      const s = tmp.length();
      if (s > 1e-6) N[i].applyAxisAngle(tmp.divideScalar(s), Math.asin(clamp(s, -1, 1)));
      N[i].addScaledVector(T[i], -N[i].dot(T[i])).normalize();
    }
    for (let i = 0; i < n; i++) {
      B[i] = new V3().crossVectors(T[i], N[i]);
      for (let j = 0; j < radial; j++) {
        const a = j / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), o = (i * radial + j) * 3;
        const nx = c * N[i].x + s * B[i].x, ny = c * N[i].y + s * B[i].y, nz = c * N[i].z + s * B[i].z;
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz; tan[o] = T[i].x; tan[o + 1] = T[i].y; tan[o + 2] = T[i].z;
        pos[o] = pts[i].x + nx * radii[i]; pos[o + 1] = pts[i].y + ny * radii[i]; pos[o + 2] = pts[i].z + nz * radii[i];
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(tan, 3));
    g.setIndex(idx);
    return g;
  }

  const labelRoot = $('#labels'), labels = [];
  function addLabel(html, p, o) {
    const el = document.createElement('div');
    el.className = 'lbl ' + (o.cls || ''); el.innerHTML = html; labelRoot.appendChild(el);
    const L = { el: el, p: p, far: o.far || 40, uMin: o.uMin == null ? -1 : o.uMin, uMax: o.uMax == null ? 99 : o.uMax, align: o.align || 'c', form: o.form == null ? -1 : o.form, when: o.when || null, on: false, pill: !!o.pill, near: o.near || 0, nr: false, side: o.side || '', cur: o.side || '', w: 0, bh: 0, wDirty: true, stem: o.stem || 32, year: o.year || null, place: (o.cls || '').indexOf('lbl--place') >= 0 };
    labels.push(L); return L;
  }

  const pillHTML = (y, t, d) => '<div class="pill__box"><span class="pill__y">' + y + '</span><span class="pill__t">' + t + '</span><span class="pill__d">' + d + '</span></div>';

  const maxN = D.total2022;
  const DZ = -14;
  const zYear = y => -106 + DZ - (y - 1861) * 0.55;
  const ZW = -238 + DZ, ZM = -278 + DZ, ZK = -342 + DZ;
  const WALL = new V3(0, 3.4, ZW);

  const TP = [];
  const tp = (x, y, z, r) => TP.push({ x: x, y: y, z: z, r: r });
  const trefoil = (c, s, t0, t1, n, taperIn, taperOut) => {
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n;
      let r = 0.2 * s / 0.78;
      if (taperIn) r *= Math.min(1, 0.1 + i / 6);
      if (taperOut) r *= Math.min(1, 0.1 + (n - i) / 6);
      tp(c.x + s * (Math.sin(t) + 2 * Math.sin(2 * t)), c.y - s * (Math.cos(t) - 2 * Math.cos(2 * t)), c.z - s * 0.85 * Math.sin(3 * t), r);
    }
  };
  tp(4.2, 0.2, -9, 0.03); tp(1.2, 0.26, -15, 0.09); tp(-1.7, 0.45, -19.5, 0.11); tp(1.6, 0.32, -24, 0.11);
  for (let i = 0; i <= 15; i++) { const a = 0.35 * Math.PI + i * Math.PI / 6, rr = 1.95 - i * 0.03; tp(Math.cos(a) * rr, 0.24 + i * 0.03, -30 + Math.sin(a) * rr, 0.11); }
  tp(-2.9, 0.9, -35, 0.11); tp(-1.6, 2.0, -42, 0.11); tp(0.5, 2.6, -49, 0.11); tp(-0.4, 2.3, -57, 0.11); tp(0.5, 2.0, -64, 0.11); tp(-0.6, 1.6, -68.5, 0.1);
  tp(0.4, 1.4, -73.5, 0.1); tp(-0.3, 1.45, -78.5, 0.1); tp(0.2, 1.5, -83, 0.1);
  const knotAnchors = [];
  D.knots.forEach((k, e) => {
    const ze = -72 + DZ - 5 * e, xe = e % 2 ? 0.7 : -0.7, cy = 2.3;
    for (let q = 0; q <= 8; q++) { const f = q / 8 * Math.PI * 2; tp(xe + 0.3 * (q / 8 - 0.5), cy - 0.8 * Math.cos(f), ze - 0.8 * Math.sin(f), 0.1); }
    knotAnchors.push(new V3(xe, cy + 0.84, ze));
    if (e < D.knots.length - 1) tp(0, 1.45, ze - 2.5, 0.1);
  });
  tp(0, 0.7, -101.5 + DZ, 0.12);
  D.census.forEach((c, i) => tp(i % 2 ? 1.3 : -1.3, 0.3, zYear(c.y), 0.05 + 0.2 * c.n / maxN));
  tp(0, 0.5, -199.5 + DZ, 0.22); tp(-3.5, 0.3, -208 + DZ, 0.2); tp(-9, 0.3, ZW + 5, 0.18); tp(0, 0.3, ZW + 3.2, 0.18); tp(9, 0.3, ZW + 5, 0.18);
  tp(12.5, 0.3, ZW - 3, 0.17); tp(8, 0.3, ZW - 15, 0.16);

  tp(4, 0.3, ZM + 16, 0.13); tp(1.3, 0.3, ZM + 11.6, 0.07); tp(0.5, 0.3, ZM + 10.3, 0.012);
  TP.push(null);
  tp(-0.2, 0.3, ZM - 10.2, 0.012); tp(0.6, 0.45, ZM - 11.8, 0.07);
  tp(3, 1.4, ZM - 15, 0.14); tp(-1.5, 2.8, ZM - 24, 0.13); tp(1.6, 3.4, ZM - 33, 0.13); tp(-1.2, 3.1, ZM - 42, 0.14); tp(3.6, 2.5, ZM - 53, 0.16);
  trefoil(new V3(0, 3, ZK), 0.9, Math.PI * 2 - 0.02, 0.35, 46, false, true);

  const CROSS = { g: -1, waves: null, wBase: null, ph: [], trips: [], F: null, in: 2.63, full: 2.785, out: 2.98, knots: 3.08, kU: 3.08, pills: 3.05 };
  (function buildThread() {

    const segs = [[]];
    TP.forEach(p => { if (p) segs[segs.length - 1].push(p); else segs.push([]); });
    segs.forEach((S, n) => {
      const curve = new THREE.CatmullRomCurve3(S.map(p => new V3(p.x, p.y, p.z)), false, 'centripetal');
      const SUB = 7, pts = curve.getPoints((S.length - 1) * SUB);
      const radii = pts.map((_, i) => { const f = i / SUB, k = Math.min(S.length - 2, Math.floor(f)), a = f - k; return S[k].r + (S[k + 1].r - S[k].r) * a; });
      const g = tubeGeometry(pts, radii, 9);
      const fill = new THREE.Mesh(g, threadMat), hull = new THREE.Mesh(g, hullThread);
      fill.frustumCulled = hull.frustumCulled = false;
      scene.add(hull, fill);
      if (!n) CROSS.main = pts;
    });
  })();

  const smoothC = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  function applyCross(g) {
    CROSS.g = g;
    if (CROSS.waves) { const k = smoothC(g / 0.3); CROSS.waves.scale.set(Math.max(0.001, k), 1, 1); CROSS.waves.visible = k > 0.002; }
    CROSS.trips.forEach(t => {
      const k = smoothC((g - t.d0) / 0.42), q = t.curve.getPoint(k);
      t.wake.geometry.setDrawRange(0, Math.floor(t.n * k / 2) * 2); t.wake.visible = k > 0.01;
      if (!t.src) return;

      const a = smoothC(k / 0.1), out = 1 - smoothC((k - 0.4) / 0.1), inn = smoothC((k - 0.5) / 0.1);
      [t.src, t.dst].forEach((sp, i) => {
        sp.position.copy(q); sp.position.y += 0.42;
        const sc = 0.42 + 0.14 * k; sp.scale.set(sc * sp.userData.ar, sc, 1);
        sp.material.opacity = a * (i ? inn : out); sp.visible = sp.material.opacity > 0.01 && !CROSS.past;
      });
    });
  }
  (function buildCross() {
    let F = CROSS.main[0], bd = 1e9;
    CROSS.main.forEach(p => { const d = Math.abs(p.z + 67.0); if (d < bd) { bd = d; F = p; } });
    CROSS.F = F;

    const R = rng(41), seg = [], wg = new THREE.Group(); wg.position.set(F.x - 0.9, 0, 0);
    for (let i = 0; i < 64; i++) {
      const x = -R() * 5.4, z = -66.2 - R() * 10.8, y = 0.32 + R() * 0.05, L = 0.45 + R() * 0.35;
      for (let k = 0; k < 8; k++) {
        const a = k / 8, b = (k + 1) / 8;
        seg.push(new V3(x - a * L, y, z + Math.sin(a * Math.PI * 2) * 0.07), new V3(x - b * L, y, z + Math.sin(b * Math.PI * 2) * 0.07));
      }
      CROSS.ph.push(R() * 6.3);
    }
    const wgeo = new THREE.BufferGeometry().setFromPoints(seg);
    CROSS.wBase = wgeo.getAttribute('position').array.slice();
    wg.add(new THREE.LineSegments(wgeo, paperize(new THREE.LineBasicMaterial({ color: col('onbg') }))));
    wg.visible = false; scene.add(wg); CROSS.waves = wg;

    const wakeMat = paperize(new THREE.LineBasicMaterial({ color: col('mint') }));
    [[-1.6, [-3.4, 1.9, -71.6], [-6.3, 1.0, -74.8], 0.22], [0.6, [-3.0, 1.5, -66.2], [-5.6, 0.9, -67.4], 0.36]].forEach(c => {
      const curve = new THREE.QuadraticBezierCurve3(new V3(F.x - 0.6, F.y - 0.1, F.z + c[0]), new V3(c[1][0], c[1][1], c[1][2]), new V3(c[2][0], c[2][1], c[2][2]));
      const pts = [];
      for (let i = 0; i < 48; i++) {
        const a = curve.getPoint(i / 48), b = curve.getPoint((i + 0.45) / 48);
        for (const o of [-0.018, 0.018]) pts.push(new V3(a.x + o, 0.42, a.z + o), new V3(b.x + o, 0.42, b.z + o));
      }
      const wake = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), wakeMat);
      wake.visible = false; scene.add(wake);
      CROSS.trips.push({ curve: curve, wake: wake, n: pts.length, d0: c[3], src: null, dst: null });
    });
    const sco = CROSS.trips[0].curve.v2, man = CROSS.trips[1].curve.v2;
    const showEnds = () => CROSS.g > 0.8 && !CROSS.past, showSea = () => CROSS.g > 0.3 && !CROSS.past;
    addLabel('<b>Scotland</b><i>Scottish Gaelic</i>', new V3(sco.x, sco.y - 0.62, sco.z + 0.6), { cls: 'lbl--place', far: 60, uMin: 2.5, uMax: 3.12, when: showEnds });
    addLabel('<b>Isle of Man</b><i>Manx</i>', new V3(man.x, man.y - 0.62, man.z + 0.6), { cls: 'lbl--place', far: 60, uMin: 2.5, uMax: 3.12, when: showEnds });
    addLabel('<b>Across the sea</b><i>from the 5th century</i>', new V3(F.x - 2.4, 0.45, -66.0), { cls: 'lbl--place', far: 60, uMin: 2.5, uMax: 3.12, when: showSea });
    applyCross(0);
  })();

  function wordSprite(w, size) {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    x.font = '100px "Uncial Antiqua", "Palatino Linotype", serif';
    c.width = Math.ceil(x.measureText(w).width) + 40; c.height = 150;
    x.font = '100px "Uncial Antiqua", "Palatino Linotype", serif'; x.fillStyle = C.onbg; x.textBaseline = 'middle'; x.fillText(w, 20, 78);
    const sp = new THREE.Sprite(paperize(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })));
    sp.userData.ar = c.width / c.height; sp.scale.set(size * sp.userData.ar, size, 1); sp.visible = false; scene.add(sp);
    return sp;
  }
  function buildCrossWords() {
    CROSS.trips[0].src = wordSprite('Gaeilge', 0.62); CROSS.trips[0].dst = wordSprite('Gàidhlig', 0.62);
    CROSS.trips[1].src = wordSprite('Gaeilge', 0.62); CROSS.trips[1].dst = wordSprite('Gaelg', 0.62);
    const g = CROSS.g; CROSS.g = -1; applyCross(Math.max(0, g));
  }

  const stoneMatOgham = hatchMat({ light: LIGHT_STONE, tone: 0.1, spacing: 5.5 });
  const SH = 5.4;
  const ogStone = makeStone({ h: SH, r: 0.98, k: 4, levels: 5, a0: Math.PI / 2, keepEdge: true, seed: 7, taper: 0.7, pow: 2.2, jit: 0.09, twist: 0.16, lean: 0.015, cap: 0.05, mat: stoneMatOgham });
  ogStone.position.set(0, 0, -30); scene.add(ogStone);
  addShadow(0, -30, 1.0, 3.6, LIGHT_STONE);
  const strokeGeo = new THREE.BoxGeometry(1, 1, 1); strokeGeo.translate(0.5, 0, 0);
  const strokes = new THREE.InstancedMesh(strokeGeo, inkFlat, 150);
  strokes.count = 0; strokes.frustumCulled = false; ogStone.add(strokes);
  const ogPos = ogStone.userData.geo.getAttribute('position');
  function ringVert(l, j, out) { return out.fromBufferAttribute(ogPos, l * 4 + j); }
  const _a = new V3(), _b = new V3(), _m = new THREE.Matrix4();
  function edgeAt(y) {
    const f = clamp(y / SH * 5, 0, 4.999), l = Math.floor(f), a = f - l;
    const at = j => ringVert(l, j, _a).clone().lerp(ringVert(l + 1, j, _b), a);
    const E = at(0), up = ringVert(l + 1, 0, _b).clone().sub(ringVert(l, 0, _a)).normalize();
    return { E: E, up: up, dL: at(1).sub(E).normalize(), dR: at(3).sub(E).normalize() };
  }
  function putStroke(i, E, d, up, len, th) {
    const n = new V3().crossVectors(d, up).normalize();
    const mid = E.clone().addScaledVector(d, len * 0.5);
    if (n.x * mid.x + n.z * mid.z < 0) n.negate();
    const yv = new V3().crossVectors(n, d).normalize();
    _m.makeBasis(d.clone().multiplyScalar(len), yv.multiplyScalar(th), n.multiplyScalar(0.07)).setPosition(E);
    strokes.setMatrixAt(i, _m);
  }
  function setInscription(letters) {
    const OG = APP.OG, u0 = 0.112, g0 = 0.24;
    let need = 0; letters.forEach(l => { need += (OG[l][0] - 1) * u0 + g0; });
    const k = Math.min(1, 3.55 / Math.max(0.01, need)), th = 0.06 * Math.max(0.62, k);
    let y = 1.05, i = 0;
    letters.forEach(l => {
      const n = OG[l][0], kind = OG[l][1];
      for (let q = 0; q < n; q++) {
        const e = edgeAt(y);
        if (kind === 'R') putStroke(i++, e.E, e.dR, e.up, 0.44, th);
        else if (kind === 'L') putStroke(i++, e.E, e.dL, e.up, 0.44, th);
        else if (kind === 'X') {
          putStroke(i++, e.E, e.dR.clone().multiplyScalar(0.86).addScaledVector(e.up, 0.5).normalize(), e.up, 0.36, th);
          putStroke(i++, e.E, e.dL.clone().multiplyScalar(0.86).addScaledVector(e.up, -0.5).normalize(), e.up, 0.36, th);
        } else { putStroke(i++, e.E, e.dR, e.up, 0.12, th * 1.15); putStroke(i++, e.E, e.dL, e.up, 0.12, th * 1.15); }
        if (q < n - 1) y += u0 * k;
      }
      y += g0 * k;
    });
    strokes.count = i; strokes.instanceMatrix.needsUpdate = true;
  }
  APP.hooks.inscription = setInscription;
  setInscription(APP.oghamLetters());

  const leaves = [];
  function leafTexture(w, seed) {
    const c = document.createElement('canvas'); c.width = 384; c.height = 512;
    const x = c.getContext('2d'), R = rng(seed);
    x.fillStyle = C.lit; x.fillRect(0, 0, 384, 512);
    if (U.uPaperOn.value) {
      x.drawImage(paperImg, Math.floor(R() * (PAPER_TILE - 384)), Math.floor(R() * (PAPER_TILE - 512)), 384, 512, 0, 0, 384, 512);
      x.globalAlpha = 0.62; x.fillStyle = C.lit; x.fillRect(0, 0, 384, 512); x.globalAlpha = 1;
    }
    x.strokeStyle = C.ink; x.lineWidth = 6; x.strokeRect(9, 9, 366, 494); x.lineWidth = 1.5; x.strokeRect(21, 21, 342, 470);
    x.fillStyle = C.ink;
    const minims = y0 => {
      let px = 46;
      while (px < 330) {
        const n = 3 + Math.floor(R() * 7);
        for (let q = 0; q < n && px < 338; q++) { x.globalAlpha = 0.5 + R() * 0.3; x.fillRect(px, y0 - 12 - (R() < 0.12 ? 9 : 0), 2.6, 13 + (R() < 0.1 ? 8 : 0)); px += 5.6; }
        px += 9 + R() * 8;
      }
      x.globalAlpha = 1;
    };
    [72, 104, 136].forEach(minims); [404, 436, 468].forEach(minims);
    let size = 92; x.textAlign = 'center';
    do { size -= 4; x.font = size + 'px "Uncial Antiqua", "Palatino Linotype", serif'; } while (x.measureText(w.ga).width > 296 && size > 30);
    x.fillText(w.ga, 192, 262);
    const tw = x.measureText(w.ga).width;
    x.fillStyle = C.minium;
    for (let px = 192 - tw / 2; px <= 192 + tw / 2 + 1; px += 13) { x.beginPath(); x.arc(px, 290, 2.7, 0, 6.3); x.fill(); }
    x.fillStyle = C.soft; x.font = 'italic 30px "Libre Caslon Text", Georgia, serif';
    x.fillText('Lat. ' + w.la, 192, 346);
    const t = new THREE.CanvasTexture(c); t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function buildLeaves() {
    const R = rng(21);
    D.latin.forEach((w, i) => {
      const side = i % 2 ? 1 : -1, g = new THREE.PlaneGeometry(2.25, 3, 8, 1), p = g.getAttribute('position');
      for (let q = 0; q < p.count; q++) p.setZ(q, 0.16 * Math.cos(p.getX(q) / 2.25 * Math.PI) - 0.08);
      const grp = new THREE.Group();
      const front = new THREE.Mesh(g, paperize(new THREE.MeshBasicMaterial({ map: leafTexture(w, 40 + i) })));
      const back = new THREE.Mesh(g, paperize(new THREE.MeshBasicMaterial({ color: col('lit'), side: THREE.BackSide }), true));
      const rim = [];
      for (let q = 0; q <= 8; q++) rim.push(new V3(p.getX(q), 1.5, p.getZ(q)));
      for (let q = 8; q >= 0; q--) rim.push(new V3(p.getX(q), -1.5, p.getZ(q)));
      rim.push(rim[0].clone());
      grp.add(front, back, new THREE.Line(new THREE.BufferGeometry().setFromPoints(rim), inkLine));
      grp.position.set(side * (2.15 + R() * 1.1), 2.5 + (R() - 0.5) * 1.3, -46 - i * 1.8);
      grp.rotation.set((R() - 0.5) * 0.2, -side * (0.5 + R() * 0.35), (R() - 0.5) * 0.16);
      grp.userData = { y: grp.position.y, ph: R() * 6.3 };
      scene.add(grp); leaves.push(grp);
    });
  }

  D.knots.forEach((k, e) => addLabel(pillHTML(k.y, k.t, k.d), knotAnchors[e], { cls: 'pill', pill: true, stem: e % 2 ? 76 : 32, far: 24, near: 12.5, uMin: 2.85, uMax: 4.1, when: () => uS > CROSS.pills, year: String(k.y) }));

  const stoneMat = hatchMat({ light: LIGHT_AVENUE, tone: 0.06 });
  const stoneTops = [], yearLabels = [];
  D.census.forEach((c, i) => {
    const h = 0.42 + 5.8 * c.n / maxN, z = zYear(c.y);
    const st = makeStone({ h: h, r: 0.5 + 0.035 * h, k: 6, levels: Math.max(2, Math.round(h / 1.15)), seed: 100 + i * 7, taper: 0.6, jit: 0.17, lean: 0.03, mat: stoneMat });
    st.position.set(0, 0, z); st.rotation.y = i * 1.7; scene.add(st);
    addShadow(0, z, 0.62, 0.9 + h * 0.5, LIGHT_AVENUE);
    stoneTops.push(new V3(0, h * 1.07 + 0.2, z));
    yearLabels.push(addLabel('<b>' + c.y + '</b>', new V3(0, h * 1.07 + 0.62, z), { cls: 'lbl--year', far: 36, uMin: 3.0, uMax: 5.35 }));
  });
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), redFlat);
  marker.position.copy(stoneTops[0]); scene.add(marker);
  D.marks.forEach((e, i) => {
    const z = zYear(e.y) + 0.9, ph = i % 2 ? 2.4 : 1.1;
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, ph, 6), onBgFlat);
    peg.position.set(-2.3, ph / 2, z); scene.add(peg);
    const knob = new THREE.Mesh(new THREE.OctahedronGeometry(0.085), onBgFlat);
    knob.position.set(-2.3, ph + 0.08, z); scene.add(knob);
    addLabel(pillHTML(e.y, e.t, e.d), new V3(-2.3, ph + 0.18, z), { cls: 'pill', pill: true, far: 21, near: 10.5, uMin: 3.3, uMax: 5.2, year: String(e.y) });
  });

  const NP = 1874, FQ = D.freq.map(f => Math.round(f.n / 1000)), AB = D.ability.map(f => Math.round(f.n / 1000));
  const pCur = new Float32Array(NP * 3), pFrom = new Float32Array(NP * 3), pTo = new Float32Array(NP * 3), pStyle = new Float32Array(NP), pSeed = new Float32Array(NP);
  (function () { const R = rng(5); for (let i = 0; i < NP; i++) pSeed[i] = R(); })();
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute('position', new THREE.BufferAttribute(pCur, 3));
  ptsGeo.setAttribute('aStyle', new THREE.BufferAttribute(pStyle, 1));
  ptsGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));
  const ptsMat = new THREE.ShaderMaterial({
    uniforms: { uOnBg: U.uOnBg, uPaper: U.uPaper, uPaperTex: U.uPaperTex, uPaperK: U.uPaperK, uPaperOn: U.uPaperOn, uRes: U.uRes, uPaperAmt: U.uPaperAmt, uInvVP: U.uInvVP, uCamPos: U.uCamPos, uDomeC: U.uDomeC, uDomeR: U.uDomeR, uDomeTile: U.uDomeTile, uSurfTile: U.uSurfTile, uPaperMean: U.uPaperMean, uMinium: U.uMinium, uFogNear: U.uFogNear, uFogFar: U.uFogFar, uScale: { value: 500 }, uSize: { value: 0.155 }, uTime: U.uTime },
    vertexShader: [
      'attribute float aStyle; attribute float aSeed; uniform float uScale, uSize, uTime;',
      'varying float vStyle; varying float vDepth;',
      'void main(){',
      '  vec3 p = position; p.z += sin(uTime * 0.7 + aSeed * 6.283) * 0.06;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0); vDepth = -mv.z; vStyle = aStyle;',
      '  float s = uSize * (aStyle > 2.5 ? 0.62 : (aStyle > 0.5 && aStyle < 1.5 ? 1.22 : 1.0));',
      '  gl_PointSize = max(2.0, s * uScale / max(0.1, -mv.z));',
      '  gl_Position = projectionMatrix * mv;',
      '}'].join('\n'),
    fragmentShader: [
      'uniform vec3 uOnBg, uPaper, uMinium; uniform float uFogNear, uFogFar; varying float vStyle; varying float vDepth;', PAPER_GLSL,
      'void main(){',
      '  float r = length(gl_PointCoord * 2.0 - 1.0), aa = fwidth(r) * 1.3;',
      '  float a = 1.0 - smoothstep(1.0 - aa, 1.0, r);',
      '  vec3 c = uOnBg;',
      '  if (vStyle > 0.5 && vStyle < 1.5) c = uMinium;',
      '  else if (vStyle > 1.5 && vStyle < 2.5) a -= (1.0 - smoothstep(0.58 - aa, 0.58, r)) * 0.86;',
      '  else if (vStyle > 2.5) a *= 0.6;',
      '  if (a < 0.03) discard;',
      '  gl_FragColor = vec4(mix(c, paperAt(gl_FragCoord.xy), smoothstep(uFogNear, uFogFar, vDepth)), a);',
      '}'].join('\n'),
    transparent: true, depthWrite: false, extensions: { derivatives: true }
  });
  const points = new THREE.Points(ptsGeo, ptsMat); points.frustumCulled = false; scene.add(points);
  let forms = [], form = -1, formT = 1, portrait = false;
  const blockLabels = [];
  function blockLayout(counts, pt) {
    const sp = 0.2, pos = new Float32Array(NP * 3), an = [];
    let i = 0;
    if (!pt) {
      const rows = 25, gap = 0.95, top = (rows - 1) / 2 * sp; let x = 0;
      counts.forEach(n => {
        const cols = Math.ceil(n / rows); an.push({ x0: x, x1: x + (cols - 1) * sp, y: top });
        for (let q = 0; q < n; q++, i++) { pos[i * 3] = x + Math.floor(q / rows) * sp; pos[i * 3 + 1] = top - (q % rows) * sp; }
        x += (cols - 1) * sp + gap;
      });
      const w = x - gap;
      for (let q = 0; q < NP; q++) pos[q * 3] -= w / 2;
      an.forEach(a => { a.x0 -= w / 2; a.x1 -= w / 2; });
      return { pos: pos, an: an, w: w, h: rows * sp };
    }
    const cols = 80, gap = 1.6, wd = (cols - 1) * sp; let y = 0;
    counts.forEach(n => {
      const rws = Math.ceil(n / cols); an.push({ x0: 0, x1: wd, y: y });
      for (let q = 0; q < n; q++, i++) { pos[i * 3] = (q % cols) * sp; pos[i * 3 + 1] = y - Math.floor(q / cols) * sp; }
      y -= (rws - 1) * sp + gap;
    });
    const h = -(y + gap);
    for (let q = 0; q < NP; q++) { pos[q * 3] -= wd / 2; pos[q * 3 + 1] += h / 2; }
    an.forEach(a => { a.x0 -= wd / 2; a.x1 -= wd / 2; a.y += h / 2; });
    return { pos: pos, an: an, w: wd, h: h + 1.2 };
  }
  function buildForms() {
    const disc = new Float32Array(NP * 3);
    for (let i = 0; i < NP; i++) { const r = 0.105 * Math.sqrt(i + 0.5), a = i * 2.39996323; disc[i * 3] = r * Math.cos(a); disc[i * 3 + 1] = r * Math.sin(a); }
    const fb = blockLayout(FQ, portrait), ab = blockLayout(AB, portrait);
    WALL.y = portrait ? fb.h / 2 + 0.9 : 5.3;
    const st = fn => { const s = new Float32Array(NP); for (let i = 0; i < NP; i++) s[i] = fn(i); return s; };
    const fqEnd = []; FQ.reduce((a, n, k) => (fqEnd[k] = a + n), 0);
    const abEnd = []; AB.reduce((a, n, k) => (abEnd[k] = a + n), 0);
    forms = [
      { pos: disc, st: st(() => 0), w: 9.4, h: 9.4 },
      { pos: fb.pos, st: st(i => i < fqEnd[0] ? 1 : (i >= fqEnd[4] ? 3 : 0)), w: fb.w, h: fb.h, an: fb.an },
      { pos: disc, st: st(i => i < fqEnd[0] ? 1 : 2), w: 9.4, h: 9.4 },
      { pos: ab.pos, st: st(i => i < abEnd[1] ? 0 : (i < abEnd[2] ? 2 : 3)), w: ab.w, h: ab.h, an: ab.an }
    ];
    blockLabels.forEach(L => { L.el.remove(); labels.splice(labels.indexOf(L), 1); });
    blockLabels.length = 0;
    const mk = (rows, f, lv, an) => rows.forEach((r, k) => {
      const right = !portrait && k === rows.length - 1, level = portrait ? 0 : lv[k];
      const p = new V3(WALL.x + (right ? an[k].x1 + 0.08 : an[k].x0 - 0.08), WALL.y + an[k].y + 0.16, WALL.z);
      blockLabels.push(addLabel('<b>' + fmt(r.n) + '</b>' + (portrait ? '' : '<i>' + r.t + '</i>'), p, { cls: 'lbl--block lv' + level + (right ? ' is-r' : ''), far: 200, uMin: 5.02, uMax: 6.02, align: right ? 'r' : 'l', form: f }));
    });
    mk(D.freq, 1, [2, 1, 0, 0, 0, 1], fb.an); mk(D.ability, 3, [1, 0, 0, 1], ab.an);
  }
  function setForm(k, instant) {
    if (k === form || !forms[k]) return;
    form = k;
    pFrom.set(pCur);
    const f = forms[k];
    for (let i = 0; i < NP; i++) { pTo[i * 3] = WALL.x + f.pos[i * 3]; pTo[i * 3 + 1] = WALL.y + f.pos[i * 3 + 1]; pTo[i * 3 + 2] = WALL.z; }
    pStyle.set(f.st); ptsGeo.attributes.aStyle.needsUpdate = true;
    formT = (instant || RM) ? 1 : 0;
    if (formT === 1) { pCur.set(pTo); ptsGeo.attributes.position.needsUpdate = true; }
  }
  function stepPoints(dt) {
    if (formT >= 1) return;
    formT = Math.min(1, formT + dt / 1.7);
    for (let i = 0; i < NP; i++) {
      let t = clamp(formT * 1.4 - pSeed[i] * 0.4, 0, 1); t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const o = i * 3;
      pCur[o] = pFrom[o] + (pTo[o] - pFrom[o]) * t; pCur[o + 1] = pFrom[o + 1] + (pTo[o + 1] - pFrom[o + 1]) * t;
      pCur[o + 2] = pFrom[o + 2] + (pTo[o + 2] - pFrom[o + 2]) * t + Math.sin(Math.PI * t) * (0.8 + pSeed[i] * 2.4);
    }
    ptsGeo.attributes.position.needsUpdate = true;
  }

  const MAP = { b: -1, top: 0.24, gael: [], cty: [], pg: null, pins: [] };
  const BEY = { in: 6.715, full: 6.84, out: 6.94 };
  const SWAP = { s0: 1.86, s1: 2.03 };
  const MH = { h0: 6.02, h1: 6.32 };
  const smooth01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  function applyBeyond(b) {
    MAP.b = b;

    MAP.gael.forEach(g => { g.m.visible = b < 0.04 + g.k * 0.3; });
    MAP.cty.forEach(c => {
      const t = smooth01((b - 0.3 - c.k * 0.36) / 0.3);
      c.m.visible = t > 0; c.m.position.y = MAP.top + 0.006 + 0.55 * (1 - t) * (1 - t);
    });
    if (MAP.pg) { const k = 1 - smooth01(b / 0.5); MAP.pg.scale.y = Math.max(0.001, k); MAP.pg.visible = k > 0.01; }
    MAP.pins.forEach(g => { const k = smooth01((b - 0.62) / 0.3); g.scale.set(1, Math.max(0.001, k), 1); g.visible = k > 0.01; });
  }
  (function buildMap() {
    const G = D.geo; if (!G) return;
    const merc = ll => [ll[0] * Math.PI / 180, -Math.log(Math.tan(Math.PI / 4 + ll[1] * Math.PI / 360))];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    G.outline.forEach(r => r.forEach(ll => { const m = merc(ll); x0 = Math.min(x0, m[0]); x1 = Math.max(x1, m[0]); y0 = Math.min(y0, m[1]); y1 = Math.max(y1, m[1]); }));
    const s = Math.min(12.4 / (x1 - x0), 16.4 / (y1 - y0)), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const P = ll => { const m = merc(ll); return [(m[0] - cx) * s, (m[1] - cy) * s]; };
    const TOP = 0.24, grp = new THREE.Group(); grp.position.set(0, 0, ZM); scene.add(grp);
    const shapeOf = ring => { const sh = new THREE.Shape(); ring.forEach((ll, i) => { const p = P(ll); if (i) sh.lineTo(p[0], -p[1]); else sh.moveTo(p[0], -p[1]); }); return sh; };
    const flatLine = (ring, mat, y) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring.map(ll => { const p = P(ll); return new V3(p[0], y, p[1]); })), mat);
    const sideMat = hatchMat({ flat: 0.82, spacing: 4, fill: 1 });
    G.outline.forEach(ring => {
      const g = new THREE.ExtrudeGeometry(shapeOf(ring), { depth: TOP, bevelEnabled: false, curveSegments: 1 });
      g.rotateX(-Math.PI / 2);
      grp.add(new THREE.Mesh(g, hullThin));
      grp.add(new THREE.Mesh(g, [litFlat, sideMat]));
      grp.add(flatLine(ring, inkLine, TOP + 0.012));
    });
    G.inner.forEach(l => grp.add(flatLine(l, softLine, TOP + 0.012)));
    const fillG = hatchMat({ flat: 0.5, spacing: 4.2, fill: 1 }), fillN = hatchMat({ flat: 0.4, spacing: 9, fill: 1 });
    const fillHi = hatchMat({ flat: 0.56, spacing: 3.6, fill: 1 }), fillLo = hatchMat({ flat: 0.38, spacing: 10.5, fill: 1 });
    const C = G.counties, xs = [];
    Object.keys(C).forEach(n => C[n].forEach(r => r.forEach(ll => xs.push(P(ll)[0]))));
    const xa = Math.min.apply(null, xs), xb = Math.max.apply(null, xs);
    const ringMesh = (ring, mat) => { const g = new THREE.ShapeGeometry(shapeOf(ring), 1); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); grp.add(m); return m; };
    const westness = rings => { let x = 0, n = 0; rings.forEach(r => r.forEach(ll => { x += P(ll)[0]; n++; })); return clamp((x / n - xa) / (xb - xa), 0, 1); };

    D.gaeltachtCounties.concat('NI').forEach(name => {
      const k = westness(C[name]);
      C[name].forEach(ring => { const m = ringMesh(ring, name === 'NI' ? fillN : fillG); m.position.y = TOP + 0.004; MAP.gael.push({ m: m, k: k }); });
    });

    Object.keys(C).forEach(name => {
      if (name === 'NI') return;
      const k = westness(C[name]), mat = D.beyond.above.indexOf(name) >= 0 ? fillHi : fillLo;
      C[name].forEach(ring => { const m = ringMesh(ring, mat); m.visible = false; MAP.cty.push({ m: m, k: k }); });
    });
    const isA = () => MAP.b < 0.35, isB = () => MAP.b > 0.65;
    const ni = C.NI[0]; let nx = 0, nz = 0; ni.forEach(ll => { const p = P(ll); nx += p[0]; nz += p[1]; });
    const niP = new V3(nx / ni.length + 0.4, 0.9, ZM + nz / ni.length);
    addLabel('<b>Northern Ireland</b><i>12.4% with some ability</i>', niP, { cls: 'lbl--place', far: 200, uMin: 6.02, uMax: 7.02, when: isA });
    addLabel('<b>Northern Ireland</b><i>' + D.beyond.ni + '</i>', niP, { cls: 'lbl--place', far: 200, uMin: 6.4, uMax: 7.1, when: isB });
    const pg = new THREE.Group(); pg.position.y = TOP; grp.add(pg); MAP.pg = pg;
    const pillarMat = hatchMat({ light: LIGHT_STONE, tone: 0.05, base: TOP, spacing: 4.5 }), maxD = 10085;
    D.gaeltacht.forEach((z, i) => {
      const p = P(z.ll), h = 0.3 + 4.4 * z.d[2] / maxD, h0 = 0.3 + 4.4 * z.d[0] / maxD;
      const st = makeStone({ h: h, r: 0.3, k: 5, levels: Math.max(1, Math.round(h / 1.4)), seed: 300 + i, taper: 0.82, jit: 0.07, lean: 0.01, cap: 0.02, twist: 0.2, mat: pillarMat, hull: hullThin });
      st.position.set(p[0], 0, p[1]); pg.add(st);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), redFlat); tip.position.set(p[0], h + 0.2, p[1]); pg.add(tip);
      const seg = [new V3(p[0] - 0.42, h0, p[1]), new V3(p[0] + 0.42, h0, p[1]), new V3(p[0], h0, p[1] - 0.42), new V3(p[0], h0, p[1] + 0.42)];
      if (h0 > h + 0.35) seg.push(new V3(p[0], h + 0.35, p[1]), new V3(p[0], h0, p[1]));
      pg.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), inkLine));
      addLabel('<b>' + z.place + '</b><i>' + fmt(z.d[2]) + '</i>', new V3(p[0], TOP + Math.max(h, h0) + (z.k === 'gy' ? 1.35 : 0.5), ZM + p[1]), { cls: 'lbl--place', far: 200, uMin: 6.02, uMax: 7.02, when: isA });
    });

    D.beyond.marks.forEach(m => { const p = P(m.ll); addLabel('<b>' + m.t + '</b><i>' + m.v + '</i>', new V3(p[0], TOP + 0.35, ZM + p[1]), { cls: 'lbl--place', far: 200, uMin: 6.4, uMax: 7.1, when: isB }); });
    D.beyond.towns.forEach(tw => {
      const p = P(tw.ll), g = new THREE.Group(); g.position.set(p[0], TOP, p[1]); g.visible = false; grp.add(g); MAP.pins.push(g);
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(0, 0.95, 0)]), inkLine));
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), redFlat); tip.position.y = 1.08; g.add(tip);
      addLabel('<b>' + tw.t + '</b><i>' + tw.v + '</i>', new V3(p[0], TOP + 1.6, ZM + p[1]), { cls: 'lbl--place', far: 200, uMin: 6.4, uMax: 7.1, when: isB });
    });
    applyBeyond(0);
  })();

  const drift = []; let driftK = 1;
  function buildDrift() {
    const R = rng(77);
    D.drift.forEach((w, i) => {
      const c = document.createElement('canvas'), x = c.getContext('2d');
      x.font = '100px "Uncial Antiqua", "Palatino Linotype", serif';
      c.width = Math.ceil(x.measureText(w).width) + 40; c.height = 150;
      x.font = '100px "Uncial Antiqua", "Palatino Linotype", serif'; x.fillStyle = C.onbg; x.textBaseline = 'middle'; x.fillText(w, 20, 78);
      const sp = new THREE.Sprite(paperize(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })));
      const s = 0.55 + R() * 0.65, side = i % 2 ? 1 : -1;
      sp.scale.set(s * c.width / c.height, s, 1);
      sp.position.set(side * (3.4 + ((i * 0.382) % 1) * 8), 0.9 + ((i * 0.618) % 1) * 5.4, ZM - 19 - i * 1.6 - R() * 1.2);
      sp.userData = { y: sp.position.y, ph: R() * 6.3 };
      scene.add(sp); drift.push(sp);
    });
    driftK = -1;
  }
  const fontsReady = (document.fonts && document.fonts.load)
    ? Promise.all([document.fonts.load('60px "Uncial Antiqua"'), document.fonts.load('italic 30px "Libre Caslon Text"')]).catch(() => 0)
    : Promise.resolve();
  Promise.race([Promise.all([fontsReady, paperReady]), new Promise(r => setTimeout(r, 2500))]).then(() => { buildLeaves(); buildDrift(); buildCrossWords(); });

  let KF = [], posCurve = null, tgtCurve = null;
  const A0 = 3.74, A1 = 4.95, ZA0 = -95 + DZ, ZA1 = -188 + DZ, FOCUS = 7.5;

  const zCam = y => zYear(y) + FOCUS;
  const AVu = { revIn: 3.965, revOut: 4.18, sch: 4.834 };
  let AV = [], A1x = A1;
  function makeAV() {
    const ri = clamp(AVu.revIn, A0 + 0.08, 4.4), ro = Math.max(AVu.revOut, ri + 0.05), sc = clamp(AVu.sch, ro + 0.2, 5.1);
    A1x = Math.max(A1, sc + 0.08);
    AV = [[A0, ZA0], [ri, zCam(1889)], [ro, zCam(1897)], [sc, zCam(2022)], [A1x, ZA1]];
  }
  makeAV();
  const lerpAV = (x, i, j) => { let k = 0; while (k < AV.length - 2 && (AV[0][i] < AV[1][i] ? x > AV[k + 1][i] : x < AV[k + 1][i])) k++; const a = AV[k], b = AV[k + 1]; return a[j] + (b[j] - a[j]) * clamp((x - a[i]) / (b[i] - a[i]), 0, 1); };
  const zAt = u => lerpAV(u, 0, 1), uAtZ = z => lerpAV(z, 1, 0);
  const fit = (w, h, fw, fh) => Math.max(w / (TAN * (W / H) * fw), h / (TAN * fh));
  function buildKF() {
    if (MOB.on && MOB.mu) { buildKFm(); return; }
    const pt = W / H < 0.9, sx = pt ? 0 : 1, sy = pt ? 0.19 : 0.02;
    KF = [];
    const add = (u, p, t, sh, fn, ff, syv) => KF.push({ u: u, p: new V3(p[0], p[1], p[2]), t: new V3(t[0], t[1], t[2]), sh: Array.isArray(sh) ? (pt ? sh[1] : sh[0]) : sh * sx, sy: syv == null ? sy : syv, fn: fn || 15, ff: ff || 62 });
    const dH = pt ? 17 : 11.5, dS = pt ? 12 : 8.6;
    const d0 = dS + (pt ? 5 : 2.5);
    add(0, [Math.sin(0.3) * d0, 2.6, -30 + Math.cos(0.3) * d0], [0, 2.75, -30], 0.2, d0 + 4, 62, pt ? 0.25 : null);
    add(1.0, [Math.sin(0.36) * d0, 2.65, -30 + Math.cos(0.36) * d0], [0, 2.75, -30], 0.17);
    add(1.22, [Math.sin(0.6) * dS, 2.5, -30 + Math.cos(0.6) * dS], [0, 2.8, -30], 0.16);

    const s0 = clamp(SWAP.s0, 1.5, 1.95), s1 = clamp(SWAP.s1, s0 + 0.06, 2.12);
    add(Math.min(1.55, s0 - 0.12), [Math.sin(0.06) * dS, 2.6, -30 + Math.cos(0.06) * dS], [0, 2.8, -30], 0.16);
    add(s0, [Math.sin(-0.5) * dS, 2.9, -30 + Math.cos(-0.5) * dS], [0, 2.8, -30], 0.16);
    add(Math.min(s1 + 0.03, 2.2), [-4.7, 3.0, -35.5], [-0.4, 2.5, -50], -0.1);
    add(2.35, [-1.5, 2.7, -43.5], [0.4, 2.45, -54], -0.15);
    const ul = clamp(CROSS.full - 0.08, 2.45, 2.7);
    add(ul, [1.2, 2.5, -52], [-0.5, 2.4, -62], -0.15);

    const cf = Math.max(ul + 0.05, CROSS.full), co = Math.max(cf + 0.05, CROSS.out);
    const ck = clamp(Math.max(co + 0.12, CROSS.knots || 0), co + 0.12, 3.17);
    CROSS.kU = ck;
    add(cf, [0.2, 7.0, -59.5], [-3.2, 1.2, -71.5], -0.15);
    add(co, [0.0, 7.1, -60.2], [-3.3, 1.2, -72], -0.14);

    add(co + (ck - co) * 0.35, [0.9, 2.7, -63.5], [-0.3, 1.7, -73], 0);
    add(co + (ck - co) * 0.7, [0.7, 2.6, -71], [-0.2, 1.6, -81], 0.02);

    add(ck, [-1.2, 3.7, -63.6 + DZ], [0.6, 2.1, -74 + DZ], 0.04);
    add(3.2, [-5.25, 4.1, -67.5 + DZ], [0.75, 1.95, -79 + DZ], 0.08);
    add(3.4, [-5.25, 4.2, -79.3 + DZ], [0.75, 2.0, -90.8 + DZ], 0.08);
    add(3.58, [-5.45, 4.15, -90.4 + DZ], [0.75, 2.0, -101.9 + DZ], 0.1);
    const ri = AV[1][0], ro = AV[2][0], sc = AV[3][0];
    [A0, (A0 + ri) / 2, ri, ro, ro + (sc - ro) / 3, ro + (sc - ro) * 2 / 3].forEach((u, q) => {
      const z = zAt(u), f = (ZA0 - z) / (ZA0 - ZA1);

      if (!pt && q < 2) { add(u, [-6.8, 4.5 + 0.1 * q, z], [0.4, 2.0 + 0.1 * q, z - 15], 0.17, 12, 74, 0.07); return; }
      add(u, [-7.3 - (pt ? 1.6 : 0), 3.2 + 1.5 * f, z], [0.6, 1.6 + 1.3 * f, z - 9], 0.12, 12, 56 + 12 * f, pt ? 0.19 : 0.07);
    });

    const z22 = zYear(2022);
    add(sc, [-11.5 - (pt ? 2.5 : 0), 7.0, z22 + 13.5], [0.2, 3.1, z22], 0.13, 12, 70, pt ? 0.19 : 0.05);
    add(A1x, [-11.2 - (pt ? 2.5 : 0), 7.1, z22 + 12.5], [0.2, 3.1, z22], 0.13, 12, 70, pt ? 0.19 : 0.05);
    const f1 = forms[1] || { w: 20, h: 5 };
    const dW = clamp(pt ? fit(f1.w + 1, f1.h + 1, 0.92, 0.32) : fit(f1.w, f1.h + 3.2, 0.5, 0.62), 18, pt ? 64 : 41);
    const wy = WALL.y + (pt ? 0 : 1.2);
    add(5.22, [0, wy, ZW + dW], [0, wy, ZW], 0.19, dW + 6, dW + 30, pt ? 0.255 : 0);
    add(5.92, [0.7, wy, ZW + dW], [0, wy, ZW], 0.19, dW + 6, dW + 30, pt ? 0.255 : 0);

    const dM = clamp(pt ? fit(13.6, 15, 0.8, 0.42) : fit(21.5, 15, 0.55, 0.8), 16, pt ? 52 : 44), smy = pt ? 0.22 : null;

    const m1 = clamp(MH.h1, 6.12, 6.6), m0 = clamp(Math.min(6.06, (MH.h0 + m1) / 2), 6.0, m1 - 0.05);
    const ms = Math.max(m1 + 0.06, BEY.in);
    add(m0, [0, WALL.y + 7.5, ZW + 1.5], [0, 0.5, ZM + 5], -0.08, dM * 1.2, dM * 4);
    add(m1, [pt ? 0 : 1.6, dM * 0.76, ZM + dM * 0.66], [0, 0.4, ZM - 0.6], [-0.17, 0.07], dM * 1.3, dM * 4, smy);
    add(ms, [pt ? -1.2 : -3.2, dM * 0.6, ZM + dM * 0.8], [0, 0.6, ZM - 0.6], [-0.17, 0.07], dM * 1.3, dM * 4, smy);

    const bf = Math.max(ms + 0.04, BEY.full), bo = Math.max(bf + 0.05, BEY.out), ud = clamp(bo + 0.1, 7.0, 7.25);
    add(bf, [pt ? 0 : 0.8, dM * 1.0, ZM + dM * 0.5], [0, 0, ZM + 0.9], [0.17, 0.07], dM * 1.4, dM * 4, smy);
    add(bo, [pt ? 0 : 0.4, dM * 0.98, ZM + dM * 0.48], [0, 0, ZM + 0.9], [0.17, 0.07], dM * 1.4, dM * 4, smy);
    add(ud, [-1.4, 6.5, ZM + 3], [0, 2.6, ZM - 19], 0.08, 14, 58);
    add(7.3, [0.3, 3.5, ZM - 15.5], [0, 3.1, ZM - 34], 0.06, 12, 52);
    add(7.9, [-0.3, 3.2, ZM - 40], [0, 3, ZK], 0, 12, 56);
    const dK = pt ? 20 : 13;
    add(8.2, [0, 3.1, ZK + dK + 6], [0, 3, ZK], 0.22, dK + 4, 60, pt ? 0.28 : 0.02);
    add(9.0, [-0.6, 3.2, ZK + dK], [0, 3.0, ZK], 0.22, dK + 4, 60, pt ? 0.28 : 0.02);
    posCurve = new THREE.CatmullRomCurve3(KF.map(k => k.p), false, 'centripetal');
    tgtCurve = new THREE.CatmullRomCurve3(KF.map(k => k.t), false, 'centripetal');
  }

  const fitM = (w, h, fw, fh) => Math.max(w / (TAN * MOB.aD * fw), h / (TAN * fh));
  function buildKFm() {
    const M = MOB.mu, L = [];
    const add = (u, p, t, fn, ff) => L.push({ u: u, p: new V3(p[0], p[1], p[2]), t: new V3(t[0], t[1], t[2]), sh: 0, sy: 0, fn: fn || 15, ff: ff || 62 });
    const orb = (u, a, d, y, ty) => add(u, [Math.sin(a) * d, y, -30 + Math.cos(a) * d], [0, ty, -30], d + 3, 64);

    orb(M.hero, 0.3, 10.6, 2.65, 2.95);
    orb(M.cloch[0], 0.4, 11.4, 2.7, 2.9);
    orb(M.cloch[1], 0.66, 9.6, 2.65, 2.85);
    orb(M.carve[0], 0.1, 8.9, 2.75, 2.85);
    orb(M.carve[1], -0.52, 9.2, 2.95, 2.85);

    add(M.carve[1] + (M.lamh[0] - M.carve[1]) * 0.55, [-4.4, 3.0, -36], [-0.4, 2.5, -50]);
    add(M.lamh[0], [-1.6, 2.75, -42.6], [0.4, 2.45, -54]);
    add(M.lamh[1], [-0.9, 2.8, -44.8], [0.3, 2.45, -55.5]);
    add(M.latin[0], [0.3, 4.4, -46.6], [-0.2, 2.2, -60.5]);
    add(M.latin[1], [0.0, 4.3, -49.6], [-0.3, 2.2, -63.5]);
    add(M.tree[0], [0.4, 8.2, -59.2], [-3.5, 0.5, -70.2], 16, 74);
    add(M.tree[1], [0.0, 8.0, -59.8], [-3.7, 0.5, -70.8], 16, 74);

    add(M.tree[1] + (M.culu - M.tree[1]) * 0.5, [1.0, 2.8, -64.6], [-0.3, 1.7, -74]);
    add(M.culu, [-2.7, 4.2, -78.6], [0.3, 2.0, -95]);
    D.knots.forEach((k, e) => { const ze = -72 + DZ - 5 * e, xe = e % 2 ? 0.7 : -0.7; add(M.knot(e), [xe - 4.1, 4.0, ze + 5.6], [xe + 0.4, 2.4, ze - 2.6]); });

    const ri = AV[1][0], ro = AV[2][0], sc = AV[3][0], z22 = zYear(2022);
    const av = u => { const z = zAt(u), f = clamp((ZA0 - z) / (ZA0 - ZA1), 0, 1); add(u, [-7.6 - 3.4 * f, 3.4 + 2.6 * f, z + 1.6 * f], [0.7, 1.75 + 1.6 * f, z - 9.6], 12, 58 + 14 * f); };
    const us = [A0, M.census[0], M.census[1], ri, ro].concat(M.marks || []).filter(u => u < sc - 0.012).sort((a, b) => a - b);
    us.forEach((u, i) => { if (!i || u - us[i - 1] > 0.004) av(u); });
    add(sc, [-12.8, 7.6, z22 + 14.2], [0.2, 3.2, z22], 12, 74);
    add(A1x, [-12.4, 7.6, z22 + 13.2], [0.2, 3.2, z22], 12, 74);

    const wy = WALL.y;
    M.inniu.forEach((u, i) => { const f = forms[i] || forms[0], d = clamp(fitM(f.w + 1.2, f.h + 1.2, 0.92, 0.86), 12, 60); add(u, [0.2 * i, wy, ZW + d], [0, wy, ZW], d + 6, d + 30); });

    const dM = clamp(fitM(13.8, 14.6, 0.95, 0.9), 16, 60);
    add(M.gael[0] - 0.1, [0, WALL.y + 7.5, ZW + 1.5], [0, 0.5, ZM + 5], dM * 1.2, dM * 4);
    add(M.gael[0], [0, dM * 0.8, ZM + dM * 0.62], [0, 0.4, ZM - 0.4], dM * 1.3, dM * 4);
    add(M.gael[1], [0.4, dM * 0.76, ZM + dM * 0.66], [0, 0.4, ZM - 0.5], dM * 1.3, dM * 4);
    add(M.daily[0], [-1.0, dM * 0.58, ZM + dM * 0.78], [0, 0.6, ZM - 0.5], dM * 1.3, dM * 4);
    add(M.daily[1], [-1.3, dM * 0.56, ZM + dM * 0.8], [0, 0.6, ZM - 0.5], dM * 1.3, dM * 4);
    add(M.beyond[0], [0, dM * 0.98, ZM + dM * 0.5], [0, 0, ZM + 0.6], dM * 1.4, dM * 4);
    add(M.beyond[1], [0.2, dM * 0.96, ZM + dM * 0.48], [0, 0, ZM + 0.6], dM * 1.4, dM * 4);

    add(M.focail[0] - 0.08, [-1.4, 6.5, ZM + 3], [0, 2.6, ZM - 19], 14, 58);

    M.focail.forEach((u, i) => { const sd = i % 2 ? 1 : -1, z0 = ZM - 13 - 9.5 * i; add(u, [-sd * 1.2, 3.7, z0], [sd * 5.2, 3.1, z0 - 15], 12, 54); });

    add(M.fin, [0, 3.1, ZK + 16.5], [0, 3, ZK], 18, 60);
    add(9.0, [-0.6, 3.2, ZK + 15], [0, 3, ZK], 18, 60);
    L.sort((a, b) => a.u - b.u);
    for (let i = 1; i < L.length; i++) if (L[i].u <= L[i - 1].u) L[i].u = L[i - 1].u + 0.001;
    KF = L;
    CROSS.kU = M.culu;
    posCurve = new THREE.CatmullRomCurve3(KF.map(k => k.p), false, 'centripetal');
    tgtCurve = new THREE.CatmullRomCurve3(KF.map(k => k.t), false, 'centripetal');
  }
  const cam = { p: new V3(), t: new V3(), sh: 0, sy: 0, fn: 15, ff: 62 };
  function sampleKF(u) {
    const n = KF.length; let k = 0;
    u = clamp(u, KF[0].u, KF[n - 1].u);
    while (k < n - 2 && u > KF[k + 1].u) k++;
    const a = KF[k], b = KF[k + 1], f = clamp((u - a.u) / (b.u - a.u), 0, 1), e = f * f * (3 - 2 * f), t = (k + f) / (n - 1);
    posCurve.getPoint(t, cam.p); tgtCurve.getPoint(t, cam.t);
    cam.sh = a.sh + (b.sh - a.sh) * e; cam.sy = a.sy + (b.sy - a.sy) * e; cam.fn = a.fn + (b.fn - a.fn) * e; cam.ff = a.ff + (b.ff - a.ff) * e;
  }

  let yaw = 0, pitch = 0, yawS = 0, pitchS = 0, mx = 0, my = 0, mxS = 0, myS = 0, drag = null, zoom = 1, zoomS = 1, pinch = 0;
  const touches = new Map();
  const spread = () => { const p = Array.from(touches.values()); return p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; };
  canvas.addEventListener('pointerdown', e => {
    if (MOB.on && e.pointerType !== 'mouse') { touches.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch = spread(); }
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, id: e.pointerId, axis: '' }; canvas.classList.add('is-drag');
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (MOB.on && e.pointerType !== 'mouse') {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (MOB.inspect && touches.size > 1) { const d = spread(); if (pinch > 0 && d > 0) zoom = clamp(zoom * pinch / d, 0.55, 1.7); pinch = d; return; }
      if (!drag || e.pointerId !== drag.id) return;
      if (!MOB.inspect) {
        if (!drag.axis) { const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return; drag.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y'; }
        if (drag.axis === 'y') return;
        yaw = clamp(yaw - (e.clientX - drag.x) * 0.0052, -1.5, 1.5);
      } else {
        yaw = clamp(yaw - (e.clientX - drag.x) * 0.0062, -1.6, 1.6); pitch = clamp(pitch + (e.clientY - drag.y) * 0.0045, -0.5, 0.6);
      }
      drag.x = e.clientX; drag.y = e.clientY; return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    yaw = clamp(yaw - (e.clientX - drag.x) * 0.0052, -1.5, 1.5); pitch = clamp(pitch + (e.clientY - drag.y) * 0.004, -0.45, 0.55);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = e => { if (e && e.pointerId != null) { touches.delete(e.pointerId); pinch = spread(); } if (!e || !drag || e.pointerId === drag.id) drag = null; if (!touches.size) canvas.classList.remove('is-drag'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag); canvas.addEventListener('lostpointercapture', endDrag);
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; } }, { passive: true });

  const _v = new V3(), _off = new V3();
  let uS = -1, time = 0, curStone = -1;
  function resize() {
    W = innerWidth; H = innerHeight;
    if (TOUCH) { W = canvas.clientWidth || W; H = canvas.clientHeight || H; }
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    U.uPxScale.value = TAN / H; ptsMat.uniforms.uScale.value = H * DPR / TAN;
    renderer.getDrawingBufferSize(U.uRes.value);
    const pt = MOB.on || W / H < 0.9;
    if (pt !== portrait || !forms.length) { portrait = pt; const keep = form < 0 ? 0 : form; buildForms(); form = -1; setForm(keep, true); }
    buildKF();
  }
  let tick = 0;
  function frame(u, dt) {
    time += dt; U.uTime.value = time;
    if (uS < 0) uS = u;
    const prev = uS;
    uS += (u - uS) * (RM ? 1 : 1 - Math.exp(-dt * 5.2));
    if (Math.abs(u - uS) < 0.0004) uS = u;
    if (!drag && Math.abs(uS - prev) > 0.0008) { const d = Math.exp(-dt * 2.6); yaw *= d; pitch *= d; }
    const e = 1 - Math.exp(-dt * 9);
    yawS += (yaw - yawS) * e; pitchS += (pitch - pitchS) * e; mxS += (mx - mxS) * e * 0.4; myS += (my - myS) * e * 0.4; zoomS += (zoom - zoomS) * e;
    sampleKF(uS);
    _off.subVectors(cam.p, cam.t);
    const len = _off.length(), r = len * (MOB.on ? zoomS : 1), th = Math.atan2(_off.x, _off.z) + yawS + (RM ? 0 : mxS * 0.045), ph = clamp(Math.acos(clamp(_off.y / len, -1, 1)) - pitchS - (RM ? 0 : myS * 0.03), 0.12, 1.52);
    camera.position.set(cam.t.x + r * Math.sin(ph) * Math.sin(th), cam.t.y + r * Math.cos(ph), cam.t.z + r * Math.sin(ph) * Math.cos(th));
    camera.lookAt(cam.t);
    if (MOB.on) {
      const b = MOB.box; camera.aspect = b.w / b.h;
      camera.setViewOffset(b.w, b.h, -b.x, -b.y, W, H);
      U.uPxScale.value = TAN / b.h; ptsMat.uniforms.uScale.value = b.h * DPR / TAN;
    } else camera.setViewOffset(W, H, -cam.sh * W, cam.sy * H, W, H);
    scene.fog.near = U.uFogNear.value = cam.fn; scene.fog.far = U.uFogFar.value = cam.ff;

    const fz = (uS >= A0 ? zAt(uS) : cam.p.z) - FOCUS; let b = 0, bd = 1e9;
    for (let i = 0; i < D.census.length; i++) { const d = Math.abs(zYear(D.census[i].y) - fz); if (d < bd) { bd = d; b = i; } }
    if (b !== curStone) {
      if (curStone >= 0) yearLabels[curStone].el.classList.remove('lbl--now');
      curStone = b; yearLabels[b].el.classList.add('lbl--now'); APP.setCensus(b);
    }
    marker.position.lerp(stoneTops[b], RM ? 1 : 1 - Math.exp(-dt * 10)); marker.rotation.y = time * 1.3;
    const cg = clamp((uS - CROSS.in) / Math.max(0.02, CROSS.out - CROSS.in), 0, 1), past = uS > CROSS.kU + 0.03;
    if (cg !== CROSS.g || past !== CROSS.past) { CROSS.past = past; applyCross(cg); }
    if (!RM && CROSS.waves && CROSS.waves.visible) {
      const a = CROSS.waves.children[0].geometry.getAttribute('position'), b = CROSS.wBase;
      for (let i = 0; i < CROSS.ph.length; i++) {
        const ph = CROSS.ph[i], dx = Math.sin(time * 0.8 + ph) * 0.09, dz = Math.cos(time * 0.6 + ph * 1.3) * 0.05;
        for (let k = i * 48; k < i * 48 + 48; k += 3) { a.array[k] = b[k] + dx; a.array[k + 2] = b[k + 2] + dz; }
      }
      a.needsUpdate = true;
    }
    const bb = clamp((uS - BEY.in) / Math.max(0.02, BEY.full - BEY.in), 0, 1);
    if (bb !== MAP.b) applyBeyond(bb);

    if (!RM) {
      for (let i = 0; i < leaves.length; i++) { const l = leaves[i]; l.position.y = l.userData.y + Math.sin(time * 0.6 + l.userData.ph) * 0.09; }
      for (let i = 0; i < drift.length; i++) { const s = drift[i]; s.position.y = s.userData.y + Math.sin(time * 0.45 + s.userData.ph) * 0.16; }
    }

    const dk = clamp((8.3 - uS) / 0.25, 0, 1);
    if (dk !== driftK) {
      driftK = dk;
      for (let i = 0; i < drift.length; i++) { drift[i].material.opacity = dk; drift[i].visible = dk > 0.01; }
    }
    stepPoints(dt);

    camera.updateMatrixWorld();
    U.uInvVP.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse); U.uCamPos.value.copy(camera.position);
    const used = MOB.on ? [] : null, sT = MOB.st.t, sB = MOB.st.b;
    for (let i = 0; i < labels.length; i++) {
      const L = labels[i]; let on = uS >= L.uMin && uS <= L.uMax && (L.form < 0 || L.form === form) && (!L.when || L.when());
      if (on && MOB.on && L.pill) on = !MOB.inspect && L.year === MOB.focus;
      if (on) {
        _v.copy(L.p).project(camera);
        const dist = camera.position.distanceTo(L.p);
        on = _v.z > -1 && _v.z < 1 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.2 && dist < L.far && (!L.pill || dist > 2.6);
        if (on) {
          const x = (_v.x * 0.5 + 0.5) * W; let y = (-_v.y * 0.5 + 0.5) * H;

          let sc = '', side = '';
          if (L.pill) {
            if (L.wDirty) { L.w = L.el.offsetWidth; L.bh = L.el.firstChild.offsetHeight; L.wDirty = false; }
            const s = clamp(8.5 / dist, 0.5, 1.05) * (W < 801 ? 0.82 : 1), ww = L.w * s, R = MOB.on ? MOB.st.r - 10 : W - 72, Lm = MOB.on ? MOB.st.l + 10 : 10;
            side = L.cur;
            if (L.side) {
              if (side === 'r' && x + ww > R && x - ww >= Lm) side = 'l';
              else if (side === 'l' && x - ww < Lm && x + ww <= R) side = 'r';
              if (side !== L.cur) { L.cur = side; L.el.classList.toggle('pill--r', side === 'r'); L.el.classList.toggle('pill--l', side === 'l'); L.wDirty = true; }
            }
            const a0 = side === 'r' ? x : (side === 'l' ? x - ww : x - ww / 2), a1 = a0 + ww;
            const shift = a0 < Lm ? Lm - a0 : (a1 > R ? R - a1 : 0);
            L.el.style.setProperty('--shift', (shift / s).toFixed(1) + 'px');
            if (!side) {
              const top = y - (L.bh + L.stem) * s, Tm = MOB.on ? sT + 6 : 64;
              let stem = L.stem;
              if (top < Tm) { const cut = Math.min((Tm - top) / s, L.stem - 10); stem = L.stem - cut; y += Math.max(0, (Tm - top) - cut * s); }
              L.el.style.setProperty('--stem', stem.toFixed(1) + 'px');
            }
            sc = ' scale(' + s.toFixed(3) + ')';
          }
          const off = side ? (side === 'r' ? '0,-50%' : '-100%,-50%') : (L.align === 'l' ? '0' : (L.align === 'r' ? '-100%' : '-50%')) + ',-100%';
          if (MOB.on && !L.pill) {
            const lw = L.lw || (L.lw = L.el.offsetWidth), lh = L.lh || (L.lh = L.el.offsetHeight);
            const a0 = L.align === 'l' ? x : (L.align === 'r' ? x - lw : x - lw / 2), r = { l: a0, r: a0 + lw, t: y - lh, b: y };
            if (r.t < sT + 4 || r.b > sB - 4 || r.l < MOB.st.l + 4 || r.r > MOB.st.r - 4) on = false;
            else if (L.place) { if (used.some(q => r.l < q.r + 4 && r.r > q.l - 4 && r.t < q.b + 3 && r.b > q.t - 3)) on = false; else used.push(r); }
          }
          if (MOB.on && L.pill && (y < sT || y > sB + 30)) on = false;
          const tf = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(' + off + ')' + sc, op = clamp((L.far - dist) / (L.far * 0.22), 0, 1).toFixed(2);
          if (tf !== L.tf) { L.el.style.transform = tf; L.tf = tf; }
          if (op !== L.op) { L.el.style.opacity = op; L.op = op; }
          if (L.pill) {
            L.el.style.zIndex = String(Math.round(1000 - dist * 10));
            const nr = dist < L.near;
            if (nr !== L.nr) { L.nr = nr; L.el.classList.toggle('is-near', nr); L.wDirty = true; }
          }
        }
      }
      if (on !== L.on) { L.on = on; L.el.style.visibility = on ? 'visible' : 'hidden'; }
    }
    if (MOB.on) {
      const still = !drag && Math.abs(u - uS) < 0.0004 && Math.abs(zoom - zoomS) < 0.001 && Math.abs(yaw - yawS) < 0.001 && Math.abs(pitch - pitchS) < 0.001;
      if (still && (++tick & 1)) return;
      const cut = Math.min(H, Math.ceil(MOB.sheetTop + 22));
      if (!MOB.inspect && MOB.st.r >= W - 1 && cut < H - 8) {
        renderer.autoClear = false; renderer.setScissorTest(false); renderer.clear();
        renderer.setScissor(0, H - cut, W, cut); renderer.setScissorTest(true);
        renderer.render(scene, camera);
        renderer.setScissorTest(false); renderer.autoClear = true;
        return;
      }
    }
    renderer.render(scene, camera);
  }

  APP.world = {
    frame: frame, resize: resize, setForm: setForm,
    uForYear: y => uAtZ(zCam(y)),
    setAvenue: o => { Object.assign(AVu, o); makeAV(); if (KF.length) buildKF(); },
    setBeyond: o => { Object.assign(BEY, o); if (KF.length) buildKF(); },
    setCross: o => { Object.assign(CROSS, o); if (KF.length) buildKF(); },
    setSwap: o => { Object.assign(SWAP, o); if (KF.length) buildKF(); },
    setMapHold: o => { Object.assign(MH, o); if (KF.length) buildKF(); },

    setMobile: (on, mu) => { MOB.on = !!on; if (mu) MOB.mu = mu; zoom = zoomS = 1; labels.forEach(L => { L.lw = L.lh = 0; L.wDirty = true; }); resize(); },
    setStage: (st, box, sheetTop) => { MOB.st = st; MOB.box = box; MOB.sheetTop = sheetTop == null ? H : sheetTop; },
    setFocus: y => { MOB.focus = y; },
    setInspect: on => { MOB.inspect = !!on; if (!on) { yaw = pitch = 0; zoom = 1; } }
  };
})();
