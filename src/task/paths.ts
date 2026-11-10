import { lstatSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { ControllerError } from "../core/types.ts";

export function assertRegularFileInside(inputPath: string, rootDir: string): string {
  const abs = resolve(inputPath);
  const root = realpathSync(resolve(rootDir));
  let st;
  try {
    st = lstatSync(abs);
  } catch {
    throw new ControllerError("UNSAFE_PATH", `ficheiro inexistente: ${abs}`);
  }
  if (st.isSymbolicLink()) {
    throw new ControllerError(
      "UNSAFE_PATH",
      "recusado: --filters/--fixtures não pode ser symlink",
    );
  }
  if (!st.isFile()) {
    throw new ControllerError("UNSAFE_PATH", "recusado: não é ficheiro regular");
  }
  const real = realpathSync(abs);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (real !== root && !real.startsWith(prefix)) {
    throw new ControllerError(
      "UNSAFE_PATH",
      "recusado: realpath fora da raiz permitida",
    );
  }
  return real;
}
