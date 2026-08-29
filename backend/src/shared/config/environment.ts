import { z } from "zod";

export const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().regex(/^[1-9]\d*[smhd]$/).default("15m"),
  JWT_REFRESH_TTL: z.string().regex(/^[1-9]\d*[smhd]$/).default("7d"),
  AUTH_COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  AUTH_COOKIE_DOMAIN: z.string().default(""),
  INITIAL_ADMIN_EMAIL: z.string().email().default("admin@naala-foncier.ma"),
  INITIAL_ADMIN_PASSWORD: z.string().min(8),
  CLOUDINARY_CLOUD_NAME: z.string().default(""),
  CLOUDINARY_API_KEY: z.string().default(""),
  CLOUDINARY_API_SECRET: z.string().default(""),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default("naala-foncier"),
  SIGNED_URL_EXPIRATION_SECONDS: z.coerce.number().int().positive().default(900),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().int().positive().default(26214400),
  SWAGGER_ENABLED: z.string().default("true"),
  AI_PROVIDER: z.string().default(""),
  AI_MODEL: z.string().default("openai/gpt-4.1"),
  GITHUB_MODELS_TOKEN: z.string().default(""),
  GITHUB_MODELS_BASE_URL: z
    .string()
    .url()
    .default("https://models.github.ai/inference"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.string().default("false"),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM_NAME: z.string().default("NAALA FONCIER"),
  SMTP_FROM_EMAIL: z.string().default(""),
}).superRefine((value, context) => {
  const secure = value.NODE_ENV === "production" || value.AUTH_COOKIE_SECURE === "true";
  if (value.AUTH_COOKIE_SAME_SITE === "none" && !secure) {
    context.addIssue({
      code: "custom",
      path: ["AUTH_COOKIE_SAME_SITE"],
      message: "SameSite=none requires a secure cookie.",
    });
  }
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const parsed = environmentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Configuration invalide: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`);
  }
  return parsed.data;
}
