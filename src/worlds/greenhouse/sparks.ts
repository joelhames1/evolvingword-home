// Little points of light that live a moment: the pollen the bee trails and the
// water from the can's rose. One shader for both (a program compiled once),
// told apart by their uniforms: color, size, and whether they fade as they go or
// last a while and are gone.
import * as THREE from 'three';

export function sparkMaterial(o: { color: THREE.ColorRepresentation; life: number; fade: boolean; size: number; max: number; grow: boolean; soft: number }) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute float aAge;
      uniform float uLife;
      uniform float uFade;
      uniform float uSize;
      uniform float uMax;
      uniform float uGrow;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float alive = uFade > 0.5 ? clamp(1.0 - aAge / uLife, 0.0, 1.0) : step(aAge, uLife);
        vA = alive * smoothstep(0.06, 0.3, -mv.z);
        gl_PointSize = clamp(uSize / max(-mv.z, 0.05), 1.0, uMax) * mix(1.0, 0.4 + vA, uGrow);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uSoft;
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        gl_FragColor = vec4(uColor * vA * smoothstep(1.0, uSoft, r), 1.0);
      }
    `,
    uniforms: {
      uColor: { value: new THREE.Color(o.color) },
      uLife: { value: o.life },
      uFade: { value: o.fade ? 1 : 0 },
      uSize: { value: o.size },
      uMax: { value: o.max },
      uGrow: { value: o.grow ? 1 : 0 },
      uSoft: { value: o.soft },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
