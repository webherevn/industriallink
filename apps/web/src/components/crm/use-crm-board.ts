'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchCrmBoard, fetchCrmRenewals } from '@/lib/crm';

export function useCrmBoard() {
  return useQuery({ queryKey: ['crm-board'], queryFn: fetchCrmBoard });
}

export function useCrmRenewals() {
  return useQuery({ queryKey: ['crm-renewals'], queryFn: fetchCrmRenewals });
}
