export const siteConfig = {
  name: "Discadora Consignado Pro",
  tagline: "CRM & Discador pelo Celular para Crédito Consignado",
  description:
    "A única discadora desenvolvida especificamente para correspondentes de crédito consignado. Zero custo de telefonia VoIP (disque direto pelo chip do celular via PC), esteira Meu INSS, simulador de margem e esteira de anuência blindada.",
  url: "https://discadora-callcenter.vercel.app",
  systemLoginUrl: "https://discadora-callcenter.vercel.app/login",
  whatsappNumber: "5579981052664",
  whatsappDefaultMessage:
    "Olá! Gostaria de agendar uma demonstração gratuita e conhecer os planos da Discadora Consignado Pro.",
  
  metrics: [
    { label: "Custo por Minuto Falado", value: "R$ 0,00", desc: "Usa o plano ilimitado do seu chip" },
    { label: "Ligações Realizadas", value: "+500k", desc: "Em operações de crédito ativo" },
    { label: "Economia Média em VoIP", value: "85%", desc: "Comparado a discadores em nuvem" },
    { label: "Aderência a Metas", value: "3.2x", desc: "Mais propostas com anuência paga" },
  ],

  plans: [
    {
      id: "iniciante",
      name: "Iniciante / Individual",
      subtitle: "Para operadores autônomos ou início de operação",
      price: "97",
      period: "/mês",
      highlight: false,
      badge: "Comece Hoje",
      features: [
        "1 Operador ativo simultâneo",
        "Discagem ilimitada via celular (Phone Link)",
        "Zero custo de minutos VoIP ou tarifas",
        "CRM com Ficha do Lead 360º",
        "Simulador básico de margem INSS",
        "Importador de planilhas de leads",
        "Suporte por e-mail e comunidade",
      ],
      ctaText: "Começar Individual",
      ctaType: "whatsapp",
    },
    {
      id: "pro",
      name: "Equipe Pro",
      subtitle: "O plano mais escolhido por Correspondentes Bancários",
      price: "247",
      period: "/mês",
      highlight: true,
      badge: "Mais Vendido • Melhor Custo-Benefício",
      features: [
        "Até 5 Operadores simultâneos",
        "Discagem ilimitada em todos os postos",
        "Zero cobrança de minutos ou tarifas",
        "Esteira de Anuência Meu INSS com alerta de prazo",
        "Simulador de Margem & Bloqueador de Recusa",
        "Roteiro interativo com quebra de objeções ao vivo",
        "Cadência e Renitência inteligente (rechamada por horário)",
        "Suporte prioritário via WhatsApp",
      ],
      ctaText: "Assinar Equipe Pro",
      ctaType: "whatsapp",
    },
    {
      id: "enterprise",
      name: "Operação Escala",
      subtitle: "Para promotoras médias e grandes com esteiras ativas",
      price: "497",
      period: "/mês",
      highlight: false,
      badge: "Alta Performance",
      features: [
        "Operadores ilimitados (consulte postos)",
        "Tudo do plano Equipe Pro",
        "Gestão Multi-Campanha avançada",
        "Relatórios de auditoria e conformidade LGPD",
        "Lista de Bloqueio Não Perturbe integrada",
        "Treinamento de onboarding para a equipe",
        "Gerente de conta exclusivo",
      ],
      ctaText: "Falar com Consultor",
      ctaType: "whatsapp",
    },
  ],

  comparisons: [
    {
      feature: "Custo por Minuto Falado",
      ourSystem: "R$ 0,00 (Chip Celular Ilimitado)",
      traditional: "R$ 0,08 a R$ 0,25 por minuto tarifado",
      winner: "our",
    },
    {
      feature: "Bloqueio de SPAM / Operadora",
      ourSystem: "Risco Mínimo (Número móvel real identificado)",
      traditional: "Alto (Números VoIP 0303 e rotas bloqueadas)",
      winner: "our",
    },
    {
      feature: "Esteira de Anuência Meu INSS",
      ourSystem: "Nativa com contagem regressiva de expiração",
      traditional: "Inexistente (Discador genérico)",
      winner: "our",
    },
    {
      feature: "Simulador de Margem em Linha",
      ourSystem: "Integrado na tela durante a chamada",
      traditional: "Planilha externa ou sistema do banco aberto",
      winner: "our",
    },
    {
      feature: "Quebra de Objeções ao Vivo",
      ourSystem: "Cartões de resposta rápida a 1 clique",
      traditional: "Treinamento em PDF separado",
      winner: "our",
    },
    {
      feature: "Renitência por Tipo de Tabulação",
      ourSystem: "Intervalo e horário inteligente por tabulação",
      traditional: "Rechamada cega e sem inteligência de horário",
      winner: "our",
    },
    {
      feature: "Fidelidade e Multa de Rescisão",
      ourSystem: "Zero fidelidade. Cancele quando quiser",
      traditional: "Contratos anuais com multas pesadas",
      winner: "our",
    },
  ],

  faqs: [
    {
      question: "Como funciona a discagem sem custo de VoIP?",
      answer:
        "Utilizamos a tecnologia de conexão com seu smartphone (Phone Link / Vincular ao Celular). O operador controla todo o CRM, ficha do lead e botão 'Discar' direto pelo computador, e a ligação é disparada pelo chip GSM ilimitado do celular da sua operadora (Vivo, Claro, TIM, etc.). Você nunca paga por minutos ou pacotes de telefonia.",
    },
    {
      question: "Funciona tanto com Android quanto com iPhone?",
      answer:
        "Sim! O aplicativo suporta integração nativa com aparelhos Android e também iPhone via Bluetooth / Phone Link no Windows 10 e Windows 11.",
    },
    {
      question: "O que é a Esteira de Anuência Meu INSS?",
      answer:
        "É um funil visual exclusivo onde cada proposta registrada recebe um prazo limite de anuência. Se o cliente demorar para autorizar no aplicativo do INSS, o sistema emite alertas prioritários para o operador ligar e não deixar a proposta expirar.",
    },
    {
      question: "Posso importar minhas próprias listas de clientes?",
      answer:
        "Com certeza! O sistema conta com importador inteligente de planilhas (Excel ou CSV). Ele mapeia automaticamente colunas como Nome, CPF, Telefone, Margem, Benefício e Banco.",
    },
    {
      question: "Existe contrato de fidelidade ou carência?",
      answer:
        "Não! Você assina mensalmente e pode cancelar a qualquer momento sem nenhuma taxa ou multa de rescisão.",
    },
    {
      question: "Como começo a usar na minha operação?",
      answer:
        "Basta clicar em qualquer botão de 'Falar no WhatsApp' ou 'Testar Grátis'. Nosso time comercial configura seu acesso e você começa a rodar sua equipe em menos de 15 minutos.",
    },
  ],
};
