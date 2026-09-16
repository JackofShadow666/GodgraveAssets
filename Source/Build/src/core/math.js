// === src/core/math.js ===
// Extracted from Build.html; loaded as a classic script to preserve shared runtime state.
// MODULE: MATH HELPERS  (часто используемые паттерны — углы, расстояния, lerp)
// Utility functions are already isolated in this module.
// ════════════════════════════════════════════════════════════════════════════
const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

// Угол между двумя точками (от a к b)
function angleTo(ax, ay, bx, by){ return Math.atan2(by-ay, bx-ax); }

// Расстояние между двумя точками
function distTo(ax, ay, bx, by){ return Math.hypot(bx-ax, by-ay); }

// Нормализованный вектор направления (dx,dy) -> {x,y} длины 1 (или {0,0})
function normVec(dx, dy){
  const len = Math.hypot(dx, dy);
  return len > 0.0001 ? {x: dx/len, y: dy/len} : {x:0, y:0};
}

// Клампирует точку на окружности радиуса r вокруг центра (cx,cy)
function clampToCircle(px, py, cx, cy, r){
  const dx = px-cx, dy = py-cy;
  const d = Math.hypot(dx,dy);
  if(d <= r || d < 0.0001) return {x:px, y:py};
  return {x: cx + dx/d*r, y: cy + dy/d*r};
}

// Точка на окружности по углу
function pointOnCircle(cx, cy, r, angle){
  return {x: cx + Math.cos(angle)*r, y: cy + Math.sin(angle)*r};
}

// Случайный знак: -1 или 1
function randSign(){ return Math.random() < 0.5 ? -1 : 1; }

// Случайное число в диапазоне [a,b)
function randRange(a, b){ return a + Math.random()*(b-a); }

// Частый идиом "база + случайный разброс": было раскидано по файлу как
// `A + Math.random()*B` в ~50 местах — теперь один переиспользуемый хелпер
function rf(base, spread){ return base + Math.random()*spread; }

// Случайный элемент массива (было `arr[Math.floor(Math.random()*arr.length)]`)
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// Расстояние от точки (px,py) до отрезка (ax,ay)→(bx,by).
// Возвращает {d, nx, ny, t} — t=0 у начала отрезка, t=1 у конца,
// (nx,ny) — единичный вектор от ближайшей точки отрезка к (px,py).
// Раньше была продублирована как локальная distToSeg() внутри updateBalls —
// вынесена сюда, чтобы её могла использовать и коллизия обычных снарядов
// (жезл/арбалет) с оружием/щитом.
function distPointToSegment(px, py, ax, ay, bx, by){
  const dx = bx-ax, dy = by-ay, len2 = dx*dx+dy*dy;
  if(len2 < 0.001) return { d: Math.hypot(px-ax, py-ay), nx: 0, ny: -1, t: 0 };
  const t = $.M.clamp(((px-ax)*dx+(py-ay)*dy)/len2, 0, 1);
  const cx = ax+t*dx, cy = ay+t*dy;
  const ddx = px-cx, ddy = py-cy;
  const d = Math.hypot(ddx, ddy);
  return { d, nx: d>0.01?ddx/d:0, ny: d>0.01?ddy/d:-1, t };
}

// Пересекает ли отрезок (ax,ay)→(bx,by) прямоугольник [left,right]×[top,bot]
// (либо один из концов отрезка внутри прямоугольника, либо отрезок пересекает
// одну из четырёх сторон). Вынесена из checkShieldVsBlade — там была
// локальная копия с теми же тремя вложенными функциями.
function segmentIntersectsRect(ax, ay, bx, by, left, top, right, bot){
  function ptInRect(px,py){ return px>=left&&px<=right&&py>=top&&py<=bot; }
  function segSeg(p1x,p1y,p2x,p2y,p3x,p3y,p4x,p4y){
    const d=(p2x-p1x)*(p4y-p3y)-(p2y-p1y)*(p4x-p3x);
    if(Math.abs(d)<1e-6) return false;
    const t=((p3x-p1x)*(p4y-p3y)-(p3y-p1y)*(p4x-p3x))/d;
    const u=((p3x-p1x)*(p2y-p1y)-(p3y-p1y)*(p2x-p1x))/d;
    return t>=0&&t<=1&&u>=0&&u<=1;
  }
  if(ptInRect(ax,ay)||ptInRect(bx,by)) return true;
  return segSeg(ax,ay,bx,by,left,top,right,top)||
         segSeg(ax,ay,bx,by,right,top,right,bot)||
         segSeg(ax,ay,bx,by,right,bot,left,bot)||
         segSeg(ax,ay,bx,by,left,bot,left,top);
}
function rad(d){ return d * Math.PI / 180; }
// csval — значение слайдера умноженное на скейл персонажа (для пространственных параметров)
function csv(id){ return sv(id) * sv('cscl'); }

// Центр РУТА игрока — с учётом компенсации
function rootCenter(){
  return { x: P.x + 5, y: P.y - 8 };
}
function bodyVisualCenter(){ return { x: P.x+5+P.bx, y: P.y-8+P.by }; }

// ──────────────── END LAYER: CORE ────────────────

// ════════════════════════════════════════════════════════════════════════════
