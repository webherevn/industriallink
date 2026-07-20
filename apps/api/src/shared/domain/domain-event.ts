import { v7 as uuidv7 } from 'uuid';
import type { DomainEventEnvelope, DomainEventName } from '@industriallink/contracts';

/**
 * Tạo phong bì sự kiện chuẩn để phát qua Event Bus.
 */
export function createDomainEvent<TPayload>(params: {
  name: DomainEventName;
  tenantId: string;
  correlationId: string;
  payload: TPayload;
}): DomainEventEnvelope<TPayload> {
  return {
    name: params.name,
    eventId: uuidv7(),
    correlationId: params.correlationId,
    tenantId: params.tenantId,
    occurredAt: new Date().toISOString(),
    payload: params.payload,
  };
}
