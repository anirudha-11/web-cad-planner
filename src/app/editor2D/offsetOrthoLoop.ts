import type { Vec2 } from "./Viewport2D";

// Assumes loop is orthogonal (axis-aligned segments) and clockwise.
// Returns an outward offset by +t.
export function offsetOrthoLoop(loop: Vec2[], t: number): Vec2[] {
  const n = loop.length;
  const out: Vec2[] = [];

  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n];
    const curr = loop[i];
    const next = loop[(i + 1) % n];

    // Directions (prev->curr) and (curr->next)
    const d1 = dir(prev, curr);
    const d2 = dir(curr, next);

    // Outward normals for clockwise loop
    const n1 = outwardNormalCW(d1);
    const n2 = outwardNormalCW(d2);

    // Offset the two lines and intersect them
    const p = intersectOffsetLines(prev, curr, n1, curr, next, n2, t);
    out.push(p);
  }

  return out;
}

function dir(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // normalize to axis direction
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx), y: 0 };
  return { x: 0, y: Math.sign(dy) };
}

function outwardNormalCW(d: Vec2): Vec2 {
  // For clockwise polygon: outward normal is (dy, -dx)
  return { x: d.y, y: -d.x };
}

function intersectOffsetLines(a1: Vec2, a2: Vec2, n1: Vec2, b1: Vec2, b2: Vec2, n2: Vec2, t: number): Vec2 {
  // Line A through a1->a2 offset by n1*t
  const A1 = { x: a1.x + n1.x * t, y: a1.y + n1.y * t };
  const A2 = { x: a2.x + n1.x * t, y: a2.y + n1.y * t };

  // Line B through b1->b2 offset by n2*t
  const B1 = { x: b1.x + n2.x * t, y: b1.y + n2.y * t };
  const B2 = { x: b2.x + n2.x * t, y: b2.y + n2.y * t };

  return intersectLines(A1, A2, B1, B2);
}

function intersectLines(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;

  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-9) return { x: p2.x, y: p2.y }; // fallback

  const px =
    ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den;
  const py =
    ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den;

  return { x: px, y: py };
}
