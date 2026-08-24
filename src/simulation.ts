// ==========================================================================
// Logika Simulasi Mesin Pembentuk Kue
// Konsep Berpikir Komputasional: Algoritma, Urutan (Sequence), Dekomposisi
// ==========================================================================

export type CommandType =
  | "AMBIL_ADONAN"
  | "PASANG_CETAKAN"
  | "TEKAN_CETAKAN"
  | "BERI_TOPPING"
  | "PANGGANG"
  | "KELUARKAN";

export type ShapeId = "bulat" | "bintang" | "hati" | "bunga";
export type ToppingId = "cokelat" | "gula" | "keju" | "seres";

export interface CommandDef {
  type: CommandType;
  label: string;
  emoji: string;
  color: string; // tailwind gradient classes
  desc: string;
}

export interface Instruction {
  id: string;
  type: CommandType;
  // parameter opsional
  shape?: ShapeId;
  topping?: ToppingId;
}

export const SHAPES: Record<ShapeId, { label: string; emoji: string; path: string }> = {
  bulat: {
    label: "Bulat",
    emoji: "⚪",
    path: "M50 8a42 42 0 1 0 .01 0Z",
  },
  bintang: {
    label: "Bintang",
    emoji: "⭐",
    path: "M50 6 61 38 95 38 67 58 78 90 50 70 22 90 33 58 5 38 39 38Z",
  },
  hati: {
    label: "Hati",
    emoji: "❤️",
    path: "M50 88C18 66 8 46 8 30 8 17 18 8 30 8c8 0 15 4 20 12 5-8 12-12 20-12 12 0 22 9 22 22 0 16-10 36-42 58Z",
  },
  bunga: {
    label: "Bunga",
    emoji: "🌸",
    path: "M50 20a15 15 0 0 1 26 15 15 15 0 0 1-9 26 15 15 0 0 1-34 0 15 15 0 0 1-9-26 15 15 0 0 1 26-15Z",
  },
};

export const TOPPINGS: Record<ToppingId, { label: string; emoji: string; color: string }> = {
  cokelat: { label: "Cokelat", emoji: "🍫", color: "#6b4226" },
  gula: { label: "Gula", emoji: "🍚", color: "#f8fafc" },
  keju: { label: "Keju", emoji: "🧀", color: "#facc15" },
  seres: { label: "Seres", emoji: "🌈", color: "#f472b6" },
};

export const COMMANDS: CommandDef[] = [
  {
    type: "AMBIL_ADONAN",
    label: "Ambil Adonan",
    emoji: "🫓",
    color: "from-amber-400 to-orange-500",
    desc: "Menaruh segumpal adonan ke atas ban berjalan.",
  },
  {
    type: "PASANG_CETAKAN",
    label: "Pasang Cetakan",
    emoji: "🔩",
    color: "from-sky-400 to-blue-500",
    desc: "Memasang cetakan berbentuk tertentu pada mesin.",
  },
  {
    type: "TEKAN_CETAKAN",
    label: "Tekan Cetakan",
    emoji: "⬇️",
    color: "from-violet-400 to-purple-600",
    desc: "Menekan adonan agar berbentuk sesuai cetakan.",
  },
  {
    type: "BERI_TOPPING",
    label: "Beri Topping",
    emoji: "🍫",
    color: "from-pink-400 to-rose-500",
    desc: "Menaburkan topping di atas adonan.",
  },
  {
    type: "PANGGANG",
    label: "Panggang",
    emoji: "🔥",
    color: "from-red-400 to-red-600",
    desc: "Memanggang adonan hingga matang.",
  },
  {
    type: "KELUARKAN",
    label: "Keluarkan Kue",
    emoji: "📤",
    color: "from-emerald-400 to-green-600",
    desc: "Mengeluarkan kue jadi ke kotak kemasan.",
  },
];

export interface MachineState {
  hasDough: boolean;
  mold: ShapeId | null;
  isPressed: boolean;
  toppings: ToppingId[];
  isBaked: boolean;
  finished: boolean; // kue sudah dikeluarkan
}

export const initialState: MachineState = {
  hasDough: false,
  mold: null,
  isPressed: false,
  toppings: [],
  isBaked: false,
  finished: false,
};

export interface StepResult {
  state: MachineState;
  ok: boolean;
  message: string;
}

export interface CookieResult {
  success: boolean;
  shape: ShapeId | null;
  toppings: ToppingId[];
  overbaked: boolean;
  reason: string;
}

// Menjalankan satu instruksi terhadap state, mengembalikan state baru + pesan
export function runStep(state: MachineState, ins: Instruction): StepResult {
  const s: MachineState = { ...state, toppings: [...state.toppings] };

  switch (ins.type) {
    case "AMBIL_ADONAN":
      if (s.hasDough) {
        return { state: s, ok: false, message: "⚠️ Sudah ada adonan di mesin. Adonan menumpuk!" };
      }
      s.hasDough = true;
      return { state: s, ok: true, message: "🫓 Adonan diletakkan di ban berjalan." };

    case "PASANG_CETAKAN": {
      s.mold = ins.shape ?? "bulat";
      return {
        state: s,
        ok: true,
        message: `🔩 Cetakan ${SHAPES[s.mold].label} ${SHAPES[s.mold].emoji} terpasang.`,
      };
    }

    case "TEKAN_CETAKAN":
      if (!s.hasDough) {
        return { state: s, ok: false, message: "❌ Gagal menekan: belum ada adonan!" };
      }
      if (!s.mold) {
        return { state: s, ok: false, message: "❌ Gagal menekan: cetakan belum dipasang!" };
      }
      s.isPressed = true;
      return {
        state: s,
        ok: true,
        message: `⬇️ Adonan ditekan menjadi bentuk ${SHAPES[s.mold].label}.`,
      };

    case "BERI_TOPPING": {
      if (!s.hasDough) {
        return { state: s, ok: false, message: "❌ Gagal: tidak ada adonan untuk diberi topping!" };
      }
      if (s.isBaked) {
        return { state: s, ok: false, message: "⚠️ Kue sudah matang, topping tidak menempel dengan baik." };
      }
      const t = ins.topping ?? "cokelat";
      s.toppings.push(t);
      return { state: s, ok: true, message: `${TOPPINGS[t].emoji} Topping ${TOPPINGS[t].label} ditaburkan.` };
    }

    case "PANGGANG":
      if (!s.hasDough) {
        return { state: s, ok: false, message: "❌ Gagal memanggang: tidak ada adonan!" };
      }
      if (!s.isPressed) {
        return {
          state: s,
          ok: true,
          message: "🔥 Adonan dipanggang, tapi belum dicetak → hasilnya tidak berbentuk!",
        };
      }
      if (s.isBaked) {
        return { state: s, ok: false, message: "🔥 Kue dipanggang lagi → gosong!" };
      }
      s.isBaked = true;
      return { state: s, ok: true, message: "🔥 Adonan dipanggang hingga matang." };

    case "KELUARKAN":
      if (!s.hasDough) {
        return { state: s, ok: false, message: "❌ Tidak ada apa pun untuk dikeluarkan." };
      }
      if (!s.isBaked) {
        return { state: s, ok: true, message: "📤 Adonan mentah dikeluarkan (belum dipanggang)!" };
      }
      s.finished = true;
      return { state: s, ok: true, message: "📤 Kue matang dikeluarkan ke kemasan! 🎉" };

    default:
      return { state: s, ok: false, message: "Perintah tidak dikenal." };
  }
}

// Evaluasi hasil akhir menjadi sebuah kue
export function evaluateCookie(program: Instruction[]): CookieResult {
  let state = { ...initialState, toppings: [] as ToppingId[] };
  let bakeCount = 0;
  let overbaked = false;

  for (const ins of program) {
    if (ins.type === "PANGGANG") {
      bakeCount++;
      if (bakeCount > 1) overbaked = true;
    }
    const res = runStep(state, ins);
    state = res.state;
  }

  if (!state.hasDough) {
    return { success: false, shape: null, toppings: [], overbaked: false, reason: "Belum ada adonan yang diambil." };
  }
  if (!state.finished) {
    return {
      success: false,
      shape: state.isPressed ? state.mold : null,
      toppings: state.toppings,
      overbaked,
      reason: !state.isBaked ? "Kue belum dipanggang." : "Kue belum dikeluarkan dari mesin.",
    };
  }
  if (!state.isPressed) {
    return {
      success: false,
      shape: null,
      toppings: state.toppings,
      overbaked,
      reason: "Adonan tidak dicetak → bentuknya berantakan.",
    };
  }
  if (overbaked) {
    return {
      success: false,
      shape: state.mold,
      toppings: state.toppings,
      overbaked: true,
      reason: "Kue dipanggang lebih dari sekali → gosong!",
    };
  }
  return {
    success: true,
    shape: state.mold,
    toppings: state.toppings,
    overbaked: false,
    reason: "Kue berhasil dibuat dengan sempurna!",
  };
}

// Algoritma teladan (jawaban yang benar)
export const IDEAL_PROGRAM: CommandType[] = [
  "AMBIL_ADONAN",
  "PASANG_CETAKAN",
  "TEKAN_CETAKAN",
  "BERI_TOPPING",
  "PANGGANG",
  "KELUARKAN",
];

let counter = 0;
export function makeInstruction(type: CommandType): Instruction {
  counter += 1;
  const ins: Instruction = { id: `ins-${Date.now()}-${counter}`, type };
  if (type === "PASANG_CETAKAN") ins.shape = "bintang";
  if (type === "BERI_TOPPING") ins.topping = "cokelat";
  return ins;
}
