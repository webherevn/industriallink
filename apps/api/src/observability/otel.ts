/**
 * OpenTelemetry bootstrap — phải gọi trước NestFactory.create.
 * Traces → OTLP (Jaeger). Metrics → PrometheusExporter (:9464/metrics).
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export type OtelRuntimeConfig = {
  enabled: boolean;
  serviceName: string;
  otlpEndpoint: string;
  metricsPort: number;
};

export function readOtelEnv(): OtelRuntimeConfig {
  return {
    enabled: (process.env.OTEL_ENABLED ?? 'true') !== 'false',
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'industriallink-api',
    otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    metricsPort: Number(process.env.OTEL_METRICS_PORT ?? 9464),
  };
}

export async function startOtel(): Promise<OtelRuntimeConfig> {
  const cfg = readOtelEnv();
  if (!cfg.enabled) {
    // eslint-disable-next-line no-console
    console.log('[otel] disabled (OTEL_ENABLED=false)');
    return cfg;
  }

  if (process.env.OTEL_DIAG_LOG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const tracesUrl = cfg.otlpEndpoint.replace(/\/$/, '') + '/v1/traces';
  const prometheusExporter = new PrometheusExporter({
    port: cfg.metricsPort,
    endpoint: '/metrics',
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: cfg.serviceName,
    }),
    traceExporter: new OTLPTraceExporter({ url: tracesUrl }),
    metricReader: prometheusExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });

  await sdk.start();

  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[otel] shutdown error', err);
    }
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());

  // eslint-disable-next-line no-console
  console.log(
    `[otel] started service=${cfg.serviceName} traces=${tracesUrl} metrics=:${cfg.metricsPort}/metrics`,
  );
  return cfg;
}
