CREATE TABLE `actividad` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`solicitud_id` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`accion` text NOT NULL,
	`detalle` text NOT NULL,
	`fecha` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `intentos_login` (
	`clave` text PRIMARY KEY NOT NULL,
	`fallos` integer NOT NULL,
	`hasta` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sesiones` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`expira` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `solicitudes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cliente` text NOT NULL,
	`titulo` text NOT NULL,
	`descripcion` text NOT NULL,
	`categoria` text NOT NULL,
	`prioridad` text NOT NULL,
	`estado` text NOT NULL,
	`creado` text NOT NULL,
	`actualizado` text NOT NULL,
	`creado_por` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`creado_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `solicitudes_estado_idx` ON `solicitudes` (`estado`);--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario` text NOT NULL,
	`nombre` text NOT NULL,
	`rol` text NOT NULL,
	`password_hash` text NOT NULL,
	`creado` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_usuario_unique` ON `usuarios` (`usuario`);