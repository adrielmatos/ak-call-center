/**
 * Formata valores monetários em reais no padrão brasileiro.
 * Mantém a formatação centralizada para os componentes da aplicação.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
