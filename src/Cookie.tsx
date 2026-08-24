import { SHAPES, TOPPINGS, type ShapeId, type ToppingId } from "./simulation";

interface CookieProps {
  shape: ShapeId | null;
  toppings: ToppingId[];
  baked: boolean;
  overbaked?: boolean;
  size?: number;
  broken?: boolean;
}

// Menggambar kue sebagai SVG berdasarkan bentuk, topping, dan tingkat kematangan
export default function Cookie({
  shape,
  toppings,
  baked,
  overbaked = false,
  size = 96,
  broken = false,
}: CookieProps) {
  const doughColor = overbaked ? "#3f2a18" : baked ? "#c98a3f" : "#f4d9a6";
  const doughStroke = overbaked ? "#251508" : baked ? "#9c6420" : "#e0b878";

  // Jika tidak berbentuk (tidak dicetak) → gambar gumpalan tak beraturan
  const path =
    shape && !broken
      ? SHAPES[shape].path
      : "M50 14c16-4 30 6 32 20 3 16-6 24 4 34 6 8-4 20-18 18-12-2-16 6-28 2C26 84 20 72 22 60c2-10-8-14-4-26 3-10 16-16 32-20Z";

  // posisi acak-deterministik untuk topping
  const dots = toppings.slice(0, 14).map((t, i) => {
    const angle = (i / Math.max(toppings.length, 1)) * Math.PI * 2 + i;
    const radius = 12 + (i % 3) * 9;
    return {
      cx: 50 + Math.cos(angle) * radius,
      cy: 50 + Math.sin(angle) * radius,
      color: TOPPINGS[t].color,
    };
  });

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="drop-shadow-md"
      role="img"
      aria-label="kue"
    >
      <defs>
        <radialGradient id="cookieShade" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={path} fill={doughColor} stroke={doughStroke} strokeWidth={3} strokeLinejoin="round" />
      <path d={path} fill="url(#cookieShade)" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={3.4} fill={d.color} stroke="#00000022" strokeWidth={0.6} />
      ))}
      {broken && (
        <path d="M50 18 L44 40 L56 55 L46 82" fill="none" stroke="#00000033" strokeWidth={2.5} strokeLinecap="round" />
      )}
    </svg>
  );
}
