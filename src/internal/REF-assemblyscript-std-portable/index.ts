export const i8 = (x: any): number => (x << 24) >> 24;
export const i16 = (x: any): number => (x << 16) >> 16;
export const i32 = (x: any): number => x | 0;
export const u8 = (x: any): number => x & 0xff;
export const u16 = (x: any): number => x & 0xffff;
export const u32 = (x: any): number => x >>> 0;
export const f32 = (x: any): number => Math.fround(x);
export const f64 = (x: any): number => +x;
