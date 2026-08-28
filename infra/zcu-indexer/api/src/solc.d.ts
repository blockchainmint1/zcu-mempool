// solc ships no type definitions; we only use the two entry points below.
declare module "solc" {
  const solc: {
    compile(input: string): string;
    version(): string;
  };
  export default solc;
}
declare module "solc/wrapper" {
  export default function wrapper(soljson: unknown): {
    compile(input: string): string;
    version(): string;
  };
}
