export type CardType = "basic" | "mc" | "tf";

/** Unified shape for all three card modes — generation, review and
 *  saving all speak this one language. */
export type GeneratedCard = {
  type: CardType;
  front: string;
  back: string;
  options?: string[];
  correctIndex?: number;
  sourcePage: number;
};