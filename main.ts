// Tiny stack VM: an interpreter for make.fun's tiny stack ISA v1. Runs each
// instance's program.bin on its input.bin; writes stdout.bin + exit.txt.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Opcode shapes: [immediate bytes, pops, pushes] by opcode byte.
const SHAPE = new Map([
  [0x00, 0, 0, 0], [0x01, 1, 0, 1], [0x02, 4, 0, 1], [0x03, 0, 1, 0],
  [0x04, 0, 1, 2], [0x05, 0, 2, 2], [0x06, 0, 2, 3], [0x07, 0, 3, 3],
  [0x10, 0, 2, 1], [0x11, 0, 2, 1], [0x12, 0, 2, 1], [0x13, 0, 2, 1],
  [0x14, 0, 2, 1], [0x15, 0, 2, 1], [0x16, 0, 2, 1], [0x17, 0, 1, 1],
  [0x18, 0, 2, 1], [0x19, 0, 2, 1], [0x1a, 0, 2, 1], [0x1b, 0, 1, 1],
  [0x1c, 0, 2, 1], [0x1d, 0, 2, 1], [0x1e, 0, 2, 1], [0x20, 0, 2, 1],
  [0x21, 0, 2, 1], [0x22, 0, 2, 1], [0x30, 2, 0, 0], [0x31, 2, 1, 0],
  [0x32, 2, 1, 0], [0x33, 2, 0, 0], [0x34, 0, 0, 0], [0x40, 0, 1, 1],
  [0x41, 0, 2, 0], [0x50, 0, 1, 0], [0x51, 0, 1, 0], [0x52, 0, 0, 1],
  [0x53, 0, 1, 0],
].map(([o, i, p, u]) => [o, [i, p, u]]));

// Binary ops that cannot trap: (a, b) -> r over int32 values.
const BIN = {
  0x10: (a, b) => (a + b) | 0,
  0x11: (a, b) => (a - b) | 0,
  0x12: (a, b) => Math.imul(a, b),
  0x18: (a, b) => a & b,
  0x19: (a, b) => a | b,
  0x1a: (a, b) => a ^ b,
  0x1c: (a, b) => a << (b & 31),
  0x1d: (a, b) => a >> (b & 31),
  0x1e: (a, b) => (a >>> (b & 31)) | 0,
  0x20: (a, b) => (a === b ? 1 : 0),
  0x21: (a, b) => (a < b ? 1 : 0),
  0x22: (a, b) => ((a >>> 0) < (b >>> 0) ? 1 : 0),
};

function runVm(prog, input) {
  const n = prog.length;
  const S = new Int32Array(256); // data stack
  const C = new Int32Array(64); // call stack
  const M = new Int32Array(256); // memory
  const out = new Uint8Array(65536);
  let sp = 0, csp = 0, olen = 0, inPos = 0, pc = 0, steps = 0;
  const end = (code) => ({ bytes: out.slice(0, olen), code });
  for (;;) {
    if (steps === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = prog[pc];
    const shape = SHAPE.get(op);
    if (!shape) return end(5);
    const [imm, pops, pushes] = shape;
    if (pc + imm >= n) return end(9);
    steps++;
    const next = pc + 1 + imm;
    if (sp < pops) return end(2);
    if (sp - pops + pushes > 256) return end(3);
    pc = next;
    switch (op) {
      case 0x00: return end(0); // HALT
      case 0x01: S[sp++] = (prog[next - 1] << 24) >> 24; break; // PUSH8
      case 0x02: // PUSH32
        S[sp++] = prog[next - 4] | (prog[next - 3] << 8) | (prog[next - 2] << 16) | (prog[next - 1] << 24);
        break;
      case 0x03: sp--; break; // POP
      case 0x04: S[sp] = S[sp - 1]; sp++; break; // DUP
      case 0x05: { const t = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = t; break; } // SWAP
      case 0x06: S[sp] = S[sp - 2]; sp++; break; // OVER
      case 0x07: { const a = S[sp - 3]; S[sp - 3] = S[sp - 2]; S[sp - 2] = S[sp - 1]; S[sp - 1] = a; break; } // ROT
      case 0x17: S[sp - 1] = -S[sp - 1] | 0; break; // NEG
      case 0x1b: S[sp - 1] = ~S[sp - 1]; break; // NOT
      case 0x30: case 0x31: case 0x32: { // JMP / JZ / JNZ
        const rel = ((prog[next - 2] | (prog[next - 1] << 8)) << 16) >> 16;
        let take = op === 0x30;
        if (!take) { const v = S[--sp]; take = op === 0x31 ? v === 0 : v !== 0; }
        if (take) pc = next + rel;
        break;
      }
      case 0x33: // CALL
        if (csp === 64) return end(7);
        C[csp++] = next;
        pc = prog[next - 2] | (prog[next - 1] << 8);
        break;
      case 0x34: // RET
        if (csp === 0) return end(8);
        pc = C[--csp];
        break;
      case 0x40: { // LOAD
        const a = S[sp - 1];
        if (a < 0 || a > 255) return end(6);
        S[sp - 1] = M[a];
        break;
      }
      case 0x41: { // STORE: ( v addr -- )
        const a = S[sp - 1];
        if (a < 0 || a > 255) return end(6);
        M[a] = S[sp - 2];
        sp -= 2;
        break;
      }
      case 0x50: { // PRINT: decimal, all or nothing
        const text = String(S[sp - 1]);
        if (olen + text.length > 65536) return end(11);
        sp--;
        for (let i = 0; i < text.length; i++) out[olen++] = text.charCodeAt(i);
        break;
      }
      case 0x51: // PUTC
        if (olen + 1 > 65536) return end(11);
        out[olen++] = S[--sp] & 255;
        break;
      case 0x52: S[sp++] = inPos < input.length ? input[inPos++] : -1; break; // IN
      case 0x53: return end(S[sp - 1] & 255); // EXIT
      case 0x13: case 0x14: case 0x15: case 0x16: { // DIV MOD DIVU MODU
        const b = S[sp - 1], a = S[sp - 2];
        if (b === 0) return end(4);
        let r;
        if (op === 0x13) r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        else if (op === 0x14) r = b === -1 ? 0 : (a % b) | 0;
        else if (op === 0x15) r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        else r = ((a >>> 0) % (b >>> 0)) | 0;
        sp -= 2; S[sp++] = r;
        break;
      }
      default: { // the remaining binary ops
        const r = BIN[op](S[sp - 2], S[sp - 1]);
        sp -= 2; S[sp++] = r;
        break;
      }
    }
  }
}

for (const id of readdirSync(IN).sort()) {
  let prog = Buffer.alloc(0), input = Buffer.alloc(0);
  try { prog = readFileSync(join(IN, id, 'program.bin')); } catch {}
  try { input = readFileSync(join(IN, id, 'input.bin')); } catch {}
  const { bytes, code } = runVm(prog, input);
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), bytes);
  writeFileSync(join(OUT, id, 'exit.txt'), code + '\n');
}
