/**
 * Tải và kiểm tra biến môi trường tập trung một chỗ.
 * Không đọc process.env rải rác trong code nghiệp vụ.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  webOrigin: string;
  databaseUrl: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  s3: {
    /** s3 = MinIO/AWS; local = lưu file trên đĩa (phù hợp VPS chưa có MinIO). */
    driver: 's3' | 'local';
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    forcePathStyle: boolean;
    localPath: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  ai: {
    provider: 'mock' | 'openai' | 'anthropic' | 'gemini';
    embeddingDim: number;
    openaiApiKey?: string;
    openaiModel: string;
    openaiEmbeddingModel: string;
    anthropicApiKey?: string;
    anthropicModel: string;
    geminiApiKey?: string;
    geminiModel: string;
    geminiEmbeddingModel: string;
  };
  email: {
    provider: 'mock' | 'smtp' | 'resend';
    from: string;
    webOrigin: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
    };
    resendApiKey?: string;
  };
  otel: {
    enabled: boolean;
    serviceName: string;
    otlpEndpoint: string;
    metricsPort: number;
  };
  opensearch: {
    enabled: boolean;
    node: string;
  };
  eventBus: {
    provider: 'memory' | 'rabbitmq';
    rabbitmqUrl: string;
  };
}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value === '') {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${name}`);
  }
  return value;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 3001),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: required('DATABASE_URL', process.env.DATABASE_URL),
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  s3: {
    driver: (process.env.STORAGE_DRIVER === 'local' ? 'local' : 's3') as 's3' | 'local',
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY ?? 'industriallink',
    secretKey: process.env.S3_SECRET_KEY ?? 'industriallink',
    bucket: process.env.S3_BUCKET ?? 'industriallink-resumes',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    localPath: process.env.STORAGE_LOCAL_PATH ?? 'storage/uploads',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessTtl: Number(process.env.JWT_ACCESS_TTL ?? 900),
    refreshTtl: Number(process.env.JWT_REFRESH_TTL ?? 1209600),
  },
  ai: {
    provider: (process.env.AI_PROVIDER as AppConfig['ai']['provider']) ?? 'mock',
    embeddingDim: Number(process.env.AI_EMBEDDING_DIM ?? 768),
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-latest',
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    /** Flash mới nhất (GA): gemini-3.6-flash — miễn phí trên AI Studio Free/Paid. */
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'text-embedding-004',
  },
  email: {
    provider: (process.env.EMAIL_PROVIDER as AppConfig['email']['provider']) ?? 'mock',
    from: process.env.EMAIL_FROM ?? 'IndustrialLink <noreply@industriallink.local>',
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    smtp: {
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
    },
    resendApiKey: process.env.RESEND_API_KEY || undefined,
  },
  otel: {
    enabled: (process.env.OTEL_ENABLED ?? 'true') !== 'false',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'industriallink-api',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    metricsPort: Number(process.env.OTEL_METRICS_PORT ?? 9464),
  },
  opensearch: {
    enabled: (process.env.OPENSEARCH_ENABLED ?? 'true') !== 'false',
    node: process.env.OPENSEARCH_NODE ?? 'http://localhost:9200',
  },
  eventBus: {
    provider: (process.env.EVENT_BUS_PROVIDER as AppConfig['eventBus']['provider']) ?? 'rabbitmq',
    rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  },
});
