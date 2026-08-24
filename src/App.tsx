import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type Shape = "square" | "triangle" | "circle";
type Door = 1 | 2 | 3;
type Theme = "dark" | "light";

interface Rule {
  id: string;
  from: Shape;
  to: Shape;
  x: number;
  y: number;
}

interface TraceRow {
  no: number;
  input: Shape;
  rule: Rule;
  changed: boolean;
  output: Shape;
}

const targetShape: Shape = "square";

const shapeMeta: Record<Shape, { label: string; color: string }> = {
  square: { label: "Persegi", color: "#18a8ff" },
  triangle: { label: "Segitiga", color: "#2bd979" },
  circle: { label: "Lingkaran", color: "#ffc400" },
};

// Posisi lajur: 1=kiri, 2=tengah, 3=kanan.
// MID_12_X: jalur lurus di bawah jalur 2, tepat di tengah antara jalur 1 dan 2.
// EXIT_X: jalur lurus menuju keluar, tepat di tengah antara jalur gabungan 1&2 dan jalur 3.
const LANE_1_X = 22;
const MID_12_X = 36;
const LANE_2_X = 50;
const EXIT_X = 57;
const LANE_3_X = 78;
const TURN_1_MID_Y = 47;
const TURN_EXIT_Y = 64;

const rules: Rule[] = [
  { id: "p1-a", from: "square", to: "triangle", x: LANE_1_X, y: 25 },
  { id: "p2-a", from: "circle", to: "square", x: LANE_2_X, y: 25 },
  { id: "p2-b", from: "triangle", to: "circle", x: LANE_2_X, y: 38 },
  { id: "p2-c", from: "square", to: "triangle", x: MID_12_X, y: 55 },
  { id: "p3-a", from: "square", to: "circle", x: LANE_3_X, y: 25 },
  { id: "p3-b", from: "triangle", to: "circle", x: LANE_3_X, y: 43 },
  { id: "p3-c", from: "triangle", to: "square", x: EXIT_X, y: 72 },
  { id: "p3-d", from: "circle", to: "triangle", x: EXIT_X, y: 84 },
];

const ruleById = Object.fromEntries(rules.map((rule) => [rule.id, rule])) as Record<string, Rule>;

const doorPaths: Record<Door, string[]> = {
  1: ["p1-a", "p2-c", "p3-c", "p3-d"],
  2: ["p2-a", "p2-b", "p2-c", "p3-c", "p3-d"],
  3: ["p3-a", "p3-b", "p3-c", "p3-d"],
};

// Titik input berada di atas corong (di atas nomor pintu), bukan menimpanya.
const startPosition: Record<Door, { x: number; y: number }> = {
  1: { x: LANE_1_X, y: 5 },
  2: { x: LANE_2_X, y: 5 },
  3: { x: LANE_3_X, y: 5 },
};

const outputPosition = { x: EXIT_X, y: 95 };
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type Point = { x: number; y: number };

// Menentukan ketinggian titik belok berdasarkan pasangan lajur yang terhubung,
// supaya animasi mengikuti pipa (belok siku), bukan melompat diagonal.
function turnYFor(xa: number, xb: number): number {
  const [, hi] = [xa, xb].sort((a, b) => a - b);
  if (hi <= LANE_2_X) return TURN_1_MID_Y;
  return TURN_EXIT_Y;
}

// Memecah perpindahan dari satu titik ke titik lain menjadi beberapa titik
// singgah (turun -> belok -> turun) supaya token benar-benar mengikuti jalur pipa.
function buildSegment(from: Point, to: Point): Point[] {
  if (from.x === to.x) return [to];
  const turnY = turnYFor(from.x, to.x);
  const steps: Point[] = [];
  if (turnY > from.y) steps.push({ x: from.x, y: turnY });
  steps.push({ x: to.x, y: turnY > from.y ? turnY : from.y });
  steps.push(to);
  return steps;
}

const themeVars: Record<Theme, CSSProperties> = {
  dark: {
    "--bg": "#050505",
    "--top": "#070707",
    "--panel": "#151515",
    "--panel-soft": "#171717",
    "--machine": "#050505",
    "--table-head": "#232323",
    "--line": "rgba(255,255,255,0.1)",
    "--text": "#f4f4f5",
    "--muted": "#a1a1aa",
    "--faint": "#71717a",
    "--route": "#222036",
    "--card-border": "#27272a",
  } as CSSProperties,
  light: {
    "--bg": "#f6f3ea",
    "--top": "#fffaf0",
    "--panel": "#ffffff",
    "--panel-soft": "#f7f3ea",
    "--machine": "#fffdf7",
    "--table-head": "#ece6da",
    "--line": "rgba(41,37,36,0.14)",
    "--text": "#1c1917",
    "--muted": "#57534e",
    "--faint": "#78716c",
    "--route": "#d9d2c5",
    "--card-border": "#d8d0c2",
  } as CSSProperties,
};

export default function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [selectedShape, setSelectedShape] = useState<Shape>("square");
  const [selectedDoor, setSelectedDoor] = useState<Door>(1);
  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<TraceRow[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string | null>(null);
  const [changedRuleId, setChangedRuleId] = useState<string | null>(null);
  const [tokenShape, setTokenShape] = useState<Shape>("square");
  const [tokenPosition, setTokenPosition] = useState(startPosition[1]);
  const [output, setOutput] = useState<Shape | null>(null);
  const [message, setMessage] = useState("Pilih input dan pintu, lalu jalankan fungsi.");
  const runIdRef = useRef(0);

  const currentRules = useMemo(
    () => doorPaths[selectedDoor].map((id) => ruleById[id]),
    [selectedDoor],
  );

  const resetResult = (shape = selectedShape, door = selectedDoor) => {
    runIdRef.current += 1;
    setRunning(false);
    setTrace([]);
    setOutput(null);
    setActiveRuleId(null);
    setChangedRuleId(null);
    setTokenShape(shape);
    setTokenPosition(startPosition[door]);
    setMessage("Pilih input dan pintu, lalu jalankan fungsi.");
  };

  const chooseShape = (shape: Shape) => {
    if (running) return;
    setSelectedShape(shape);
    resetResult(shape, selectedDoor);
  };

  const chooseDoor = (door: Door) => {
    if (running) return;
    setSelectedDoor(door);
    resetResult(selectedShape, door);
  };

  const runSimulation = async () => {
    if (running) return;
    const myRun = runIdRef.current + 1;
    runIdRef.current = myRun;
    setRunning(true);
    setTrace([]);
    setOutput(null);
    setActiveRuleId(null);
    setChangedRuleId(null);
    setTokenShape(selectedShape);
    setTokenPosition(startPosition[selectedDoor]);
    setMessage(`Input ${shapeMeta[selectedShape].label} masuk lewat Pintu ${selectedDoor}.`);

    let shape = selectedShape;
    let prevPoint: Point = startPosition[selectedDoor];
    await sleep(450);

    for (const [index, rule] of currentRules.entries()) {
      if (runIdRef.current !== myRun) return;

      // Animasikan token mengikuti jalur pipa (turun -> belok -> turun), bukan melompat diagonal.
      const hops = buildSegment(prevPoint, { x: rule.x, y: rule.y });
      for (const hop of hops) {
        if (runIdRef.current !== myRun) return;
        setTokenPosition(hop);
        await sleep(260);
      }
      prevPoint = { x: rule.x, y: rule.y };

      setActiveRuleId(rule.id);
      setChangedRuleId(null);
      setMessage(
        `Proses ${index + 1}: cek aturan ${shapeMeta[rule.from].label} -> ${shapeMeta[rule.to].label}.`,
      );
      await sleep(650);

      const before = shape;
      const changed = before === rule.from;
      if (changed) shape = rule.to;
      setTokenShape(shape);
      setChangedRuleId(rule.id);
      setTrace((rows) => [
        ...rows,
        { no: index + 1, input: before, rule, changed, output: shape },
      ]);
      setMessage(
        changed
          ? `Berubah: ${shapeMeta[before].label} menjadi ${shapeMeta[shape].label}.`
          : `Tidak berubah: input bukan ${shapeMeta[rule.from].label}.`,
      );
      await sleep(700);
    }

    if (runIdRef.current !== myRun) return;
    const finalHops = buildSegment(prevPoint, outputPosition);
    for (const hop of finalHops) {
      if (runIdRef.current !== myRun) return;
      setTokenPosition(hop);
      await sleep(220);
    }
    setActiveRuleId(null);
    setChangedRuleId(null);
    setOutput(shape);
    setRunning(false);

    if (shape === targetShape) {
      setMessage("Output di K adalah Persegi. Jawaban memenuhi tantangan.");
    } else {
      setMessage(`Output di K adalah ${shapeMeta[shape].label}. Coba input atau pintu lain.`);
    }
  };

  const loadCorrectExample = () => {
    if (running) return;
    setSelectedShape("triangle");
    setSelectedDoor(1);
    resetResult("triangle", 1);
    setMessage("Contoh benar dimuat: Segitiga lewat Pintu 1 akan keluar sebagai Persegi.");
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] font-sans text-[var(--text)] transition-colors duration-300" style={themeVars[theme]}>
      <TopBar theme={theme} onToggleTheme={() => setTheme((mode) => (mode === "dark" ? "light" : "dark"))} />
      <nav className="border-b border-[var(--line)] px-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl gap-8 text-sm font-semibold sm:text-base">
          <button className="border-b-2 border-[var(--text)] px-2 py-5 text-[var(--text)]">Simulasi</button>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:py-8">
        <div className="grid gap-5">
          <CaseStudy />

          <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
            <div className="flex min-w-0 flex-col rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 shadow-2xl shadow-black/20">
              <InputDock selectedShape={selectedShape} running={running} onShape={chooseShape} />
              <div className="w-full min-w-0">
                <MachineDiagram
                  activeRuleId={activeRuleId}
                  changedRuleId={changedRuleId}
                  selectedDoor={selectedDoor}
                  tokenShape={tokenShape}
                  tokenPosition={tokenPosition}
                  output={output}
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              <ControlPanel
                selectedShape={selectedShape}
                selectedDoor={selectedDoor}
                running={running}
                currentRules={currentRules}
                message={message}
                output={output}
                onDoor={chooseDoor}
                onRun={runSimulation}
                onReset={() => resetResult()}
                onExample={loadCorrectExample}
              />
              <TraceTable trace={trace} />
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--line)] bg-[var(--top)] px-5 py-4 text-center sm:px-8">
      <p className="text-xs font-semibold text-[var(--faint)]">
        PPL PP UM - Informatika - SMPN 25 Malang @2026
      </p>
    </footer>
  );
}

function Marquee({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`group relative overflow-hidden whitespace-nowrap ${className}`}>
      <div className="flex w-max gap-8 animate-[marquee_18s_linear_infinite] group-hover:[animation-play-state:paused]">
        <span>{children}</span>
        <span aria-hidden="true">{children}</span>
        <span aria-hidden="true">{children}</span>
      </div>
    </div>
  );
}

function TopBar({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <header className="border-b border-[var(--line)] bg-[var(--top)] px-5 py-3 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#f5c400] text-sm font-black text-black">
            BK
          </div>
          <div>
            <h1 className="text-sm font-extrabold leading-tight text-[var(--text)] sm:text-base">
              Mesin Pembentuk Kue
            </h1>
            <Marquee className="text-[11px] text-[var(--faint)]">
              Aktivitas BK-K8-01-U Informatika SMP Kelas 8
            </Marquee>
          </div>
        </div>
        <button
          onClick={onToggleTheme}
          className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-xs font-bold text-[var(--text)] transition hover:border-[#f5c400]"
        >
          Mode {theme === "dark" ? "Cerah" : "Gelap"}
        </button>
      </div>
    </header>
  );
}

function CaseStudy() {
  return (
    <section className="w-full rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 text-sm shadow-2xl shadow-black/10">
      <h2 className="flex items-center gap-2 text-xl font-extrabold leading-tight text-[var(--text)] sm:text-2xl lg:text-[1.7rem]">
        <span className="h-6 w-1.5 rounded-full bg-[#f5c400] sm:h-7" />
        Studi Kasus: Mesin Pembentuk Kue
      </h2>
      <p className="mt-3 text-base leading-7 text-[var(--muted)] sm:text-[1.05rem] sm:leading-8">
        Bobo berkunjung ke pabrik kue. Mesin memiliki tiga pintu masuk (1, 2, 3) dan satu pintu
        keluar (K). Setiap kotak fungsi bertuliskan A -&gt; B, artinya: jika adonan berbentuk A,
        maka bentuknya diubah menjadi B. Jika bukan A, adonan lewat tanpa berubah.
      </p>
      <div className="mt-4 rounded-lg border border-[#f5c400]/60 bg-[#f5c400]/10 px-4 py-3 text-xs font-bold text-[#c28c00]">
        Tantangan: buat kue berbentuk persegi keluar dari pintu K. Pilih bentuk input dan pintu
        masuk yang benar, lalu amati tabel input - proses - output.
      </div>
    </section>
  );
}

function InputDock({
  selectedShape,
  running,
  onShape,
}: {
  selectedShape: Shape;
  running: boolean;
  onShape: (shape: Shape) => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--faint)]">
          1. Pilih input adonan
        </h3>
        <span className="hidden text-[11px] text-[var(--muted)] sm:inline">
          Bentuk akan muncul di atas corong sebelum masuk ke pintu yang dipilih.
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(shapeMeta) as Shape[]).map((shape) => (
          <button
            key={shape}
            disabled={running}
            onClick={() => onShape(shape)}
            className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              selectedShape === shape
                ? "border-sky-400 bg-sky-400/10 text-[var(--text)]"
                : "border-[var(--line)] bg-[var(--panel-soft)] text-[var(--text)] hover:border-[#f5c400]/60"
            }`}
          >
            <ShapeIcon shape={shape} size="xs" />
            {shapeMeta[shape].label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MachineDiagram({
  activeRuleId,
  changedRuleId,
  selectedDoor,
  tokenShape,
  tokenPosition,
  output,
}: {
  activeRuleId: string | null;
  changedRuleId: string | null;
  selectedDoor: Door;
  tokenShape: Shape;
  tokenPosition: { x: number; y: number };
  output: Shape | null;
}) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[640px] min-h-[560px] overflow-hidden rounded-xl bg-[var(--machine)]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Lajur 1 turun lalu belok ke jalur lurus di antara jalur 1 dan 2 */}
        <path
          d="M22 21 V44 Q22 47 25 47 H33 Q36 47 36 50"
          fill="none"
          stroke="var(--route)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Lajur 2 turun lalu belok kiri dengan lebar dan posisi selaras dengan belokan lajur 1 */}
        <path
          d="M50 21 V44 Q50 47 47 47 H39 Q36 47 36 50"
          fill="none"
          stroke="var(--route)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Segmen lurus tengah antara jalur 1 dan 2, lalu belok ke jalur keluar di antara 1&2 dan 3 */}
        <path
          d="M36 50 V61 Q36 64 39 64 H54 Q57 64 57 67 V93"
          fill="none"
          stroke="var(--route)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Lajur 3 turun lalu belok ke jalur keluar */}
        <path
          d="M78 21 V61 Q78 64 75 64 H60 Q57 64 57 67"
          fill="none"
          stroke="var(--route)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {[1, 2, 3].map((door) => (
        <DoorMarker key={door} door={door as Door} active={selectedDoor === door} />
      ))}

      {rules.map((rule) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          active={activeRuleId === rule.id}
          changed={changedRuleId === rule.id}
        />
      ))}

      <div
        className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-linear"
        style={{ left: `${tokenPosition.x}%`, top: `${tokenPosition.y}%` }}
      >
        <div className="rounded-full bg-[var(--panel)] p-2 shadow-[0_0_24px_rgba(24,168,255,0.28)] ring-2 ring-[var(--line)]">
          <ShapeIcon shape={tokenShape} size="lg" />
        </div>
      </div>

      <div className="absolute bottom-[2%] left-[3%] flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="h-2 w-2 rounded-full bg-sky-400" />
        K (Output Area)
      </div>
      <div
        className={`absolute bottom-[3%] left-[57%] flex h-10 w-24 -translate-x-1/2 items-center justify-center gap-2 rounded-xl border-4 border-[var(--card-border)] bg-[var(--panel)] transition ${
          output === targetShape ? "animate-pulse border-emerald-500/60" : ""
        }`}
      >
        {output ? <ShapeIcon shape={output} size="sm" /> : <span className="h-3 w-3 rounded-full bg-sky-400" />}
        <span className="h-3 w-3 rounded-full bg-sky-400" />
      </div>
    </div>
  );
}

function DoorMarker({ door, active }: { door: Door; active: boolean }) {
  const x = startPosition[door].x;
  return (
    <div
      className="absolute top-[13%] z-40 -translate-x-1/2"
      style={{ left: `${x}%` }}
      aria-label={`Pintu ${door}`}
    >
      <div
        className={`grid h-12 w-28 place-items-center border-[6px] border-[var(--card-border)] bg-[var(--panel)] text-xl font-black text-[var(--text)] transition [clip-path:polygon(8%_0,92%_0,78%_100%,22%_100%)] ${
          active ? "shadow-[0_0_22px_rgba(245,196,0,0.28)] ring-2 ring-[#f5c400]/60" : ""
        }`}
      >
        {door}
      </div>
    </div>
  );
}

function RuleCard({ rule, active, changed }: { rule: Rule; active: boolean; changed: boolean }) {
  return (
    <div
      className={`absolute z-20 flex h-16 w-36 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-4 border-4 bg-[var(--panel)] transition duration-300 ${
        active
          ? "scale-105 border-[#f5c400] shadow-[0_0_28px_rgba(245,196,0,0.22)]"
          : changed
            ? "border-emerald-500 shadow-[0_0_22px_rgba(45,217,121,0.18)]"
            : "border-[var(--card-border)]"
      }`}
      style={{ left: `${rule.x}%`, top: `${rule.y}%` }}
    >
      <span className="absolute left-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--faint)] opacity-40" />
      <ShapeIcon shape={rule.from} />
      <span className="text-xl font-black text-[var(--faint)]">-&gt;</span>
      <ShapeIcon shape={rule.to} />
    </div>
  );
}

function ControlPanel({
  selectedShape,
  selectedDoor,
  running,
  currentRules,
  message,
  output,
  onDoor,
  onRun,
  onReset,
  onExample,
}: {
  selectedShape: Shape;
  selectedDoor: Door;
  running: boolean;
  currentRules: Rule[];
  message: string;
  output: Shape | null;
  onDoor: (door: Door) => void;
  onRun: () => void;
  onReset: () => void;
  onExample: () => void;
}) {
  return (
    <aside className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-2xl shadow-black/10">
      <PanelLabel>2. Pilih Pintu Masuk</PanelLabel>
      <div className="grid grid-cols-3 gap-2">
        {([1, 2, 3] as Door[]).map((door) => (
          <button
            key={door}
            disabled={running}
            onClick={() => onDoor(door)}
            className={`rounded-lg border px-3 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
              selectedDoor === door
                ? "border-[#f5c400] bg-[#f5c400] text-black"
                : "border-[var(--line)] bg-[var(--panel-soft)] text-[var(--text)] hover:border-[#f5c400]/60"
            }`}
          >
            Pintu {door}
          </button>
        ))}
      </div>

      <button
        disabled={running}
        onClick={onRun}
        className="mt-4 w-full rounded-full bg-[#f5c400] px-4 py-3 text-sm font-black text-black transition hover:bg-[#ffd72e] disabled:cursor-wait disabled:opacity-60"
      >
        {running ? "Menjalankan Fungsi..." : "Eksekusi Fungsi"}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          disabled={running}
          onClick={onReset}
          className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--text)] transition hover:border-[#f5c400]/60 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          disabled={running}
          onClick={onExample}
          className="rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-bold text-emerald-500 transition hover:bg-emerald-500/10 disabled:opacity-50"
        >
          Contoh Benar
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
        <PanelLabel>Input - Proses - Output</PanelLabel>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <IpoBox title="Input" shape={selectedShape} text={`Pintu ${selectedDoor}`} />
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--faint)]">Proses</div>
            <div className="mt-2 text-lg font-black text-[var(--text)]">{currentRules.length}</div>
            <div className="text-[10px] text-[var(--faint)]">aturan</div>
          </div>
          <IpoBox title="Output" shape={output} text="K" emptyText="Belum" />
        </div>
        <p
          className={`mt-4 rounded-lg px-3 py-3 text-xs font-semibold leading-relaxed ${
            output === null
              ? "border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)]"
              : output === targetShape
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-amber-500/10 text-amber-500"
          }`}
        >
          <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] opacity-80">
            Hasil Fungsi
          </span>
          {message}
        </p>
      </div>
    </aside>
  );
}

function IpoBox({
  title,
  shape,
  text,
  emptyText = "-",
}: {
  title: string;
  shape: Shape | null;
  text: string;
  emptyText?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--faint)]">{title}</div>
      <div className="mt-2 flex h-8 items-center justify-center">{shape ? <ShapeIcon shape={shape} /> : emptyText}</div>
      <div className="mt-1 text-[10px] font-semibold text-[var(--faint)]">{shape ? text : emptyText}</div>
    </div>
  );
}

function TraceTable({ trace }: { trace: TraceRow[] }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-2xl shadow-black/10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-[var(--text)]">Tabel Pelacakan</h2>
        <p className="hidden text-[11px] text-[var(--faint)] xl:block">Input ke output</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-[var(--table-head)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2.5">No</th>
              <th className="px-3 py-2.5">Input</th>
              <th className="px-3 py-2.5">Aturan</th>
              <th className="px-3 py-2.5">Ubah</th>
              <th className="px-3 py-2.5">Output</th>
            </tr>
          </thead>
          <tbody>
            {trace.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--faint)]">
                  Belum ada eksekusi fungsi yang dijalankan.
                </td>
              </tr>
            ) : (
              trace.map((row) => (
                <tr key={row.no} className="border-t border-[var(--line)] text-[var(--text)]">
                  <td className="px-3 py-2.5 font-mono text-[var(--faint)]">{row.no}</td>
                  <td className="px-3 py-2.5">
                    <ShapeIcon shape={row.input} size="xs" />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <ShapeIcon shape={row.rule.from} size="xs" />
                      <span className="font-black text-[var(--faint)]">-&gt;</span>
                      <ShapeIcon shape={row.rule.to} size="xs" />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        row.changed ? "bg-emerald-500/15 text-emerald-500" : "bg-[var(--table-head)] text-[var(--muted)]"
                      }`}
                    >
                      {row.changed ? "Ya" : "Tidak"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <ShapeIcon shape={row.output} size="xs" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`mb-3 text-xs font-black uppercase tracking-[0.2em] text-[var(--faint)] ${className}`}>{children}</h3>;
}

function ShapeIcon({ shape, size = "md" }: { shape: Shape; size?: "xs" | "sm" | "md" | "lg" }) {
  const sizeClass = {
    xs: "h-3.5 w-3.5",
    sm: "h-5 w-5",
    md: "h-7 w-7",
    lg: "h-10 w-10",
  }[size];

  if (shape === "triangle") {
    return (
      <span
        className={`inline-block ${sizeClass}`}
        style={{ backgroundColor: shapeMeta[shape].color, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
      />
    );
  }

  return (
    <span
      className={`inline-block ${sizeClass} ${shape === "circle" ? "rounded-full" : "rounded-[4px]"}`}
      style={{ backgroundColor: shapeMeta[shape].color }}
    />
  );
}