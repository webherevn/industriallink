import { Injectable } from '@nestjs/common';
import {
  suggestFdiB2bBrands,
  type CompanySuggestResponse,
} from '@industriallink/contracts';

/** Gợi ý hãng FDI/B2B từ catalog nội bộ — không gọi API ngoài. */
@Injectable()
export class CompanySuggestService {
  suggest(query: string): CompanySuggestResponse {
    return { items: suggestFdiB2bBrands(query, 12) };
  }
}
