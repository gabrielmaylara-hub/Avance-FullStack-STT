import { existsSync,writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if(existsSync(".dev.vars")) console.log("Se conserva la configuración local existente.");
else {
  const password=`STT-${randomBytes(8).toString("hex")}!`;
  writeFileSync(".dev.vars",`JWT_SECRET=${randomBytes(48).toString("base64url")}\nDEMO_PASSWORD=${password}\n`,{mode:0o600});
  console.log("Configuración local creada en .dev.vars, excluida de Git.");
  console.log("Usuarios ficticios: admin@stt.test y tecnico@stt.test");
  console.log(`Contraseña de demostración local: ${password}`);
}
