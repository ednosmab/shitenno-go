/**
 * Contratos do motor de complexidade do Shitenno.
 *
 * Adaptado do shitenno_CMS, mantendo o princípio de isolamento:
 * nada aqui referencia nome de pasta, tecnologia ou convenção específica
 * de um projeto. Tudo que é específico de projeto entra via ProjectProfile.
 *
 * Diferença do CMS: nosso motor suporta tanto métricas estáticas
 * (estrutura do projeto) quanto comportamentais (padrões do utilizador).
 */

// ── Static Metrics ──────────────────────────────────────────────────────────

/** Resultado de uma métrica estática calculada para o projecto. */
export interface StaticMetric {
  /** Identificador da métrica (ex: "packages", "apps", "files"). */
  metric: string;
  /** Valor bruto detectado. */
  value: number;
  /** Pontuação atribuída (0-3 por métrica). */
  score: number;
  /** Evidência legível por humano de como o score foi calculado. */
  evidence: string;
}

// ── Behavioral Metrics ──────────────────────────────────────────────────────

/** Resultado de uma métrica comportamental calculada a partir de acções do utilizador. */
export interface BehavioralMetric {
  /** Identificador do sinal (ex: "validate-failures", "commits-per-week"). */
  signal: string;
  /** Valor bruto detectado. */
  value: number;
  /** Pontuação atribuída (0-3 por sinal). */
  score: number;
  /** Evidência legível por humano. */
  evidence: string;
  /** Sugestão de acção baseada neste sinal. */
  suggestion?: string;
}

// ── Score ───────────────────────────────────────────────────────────────────

/** Score composto de complexidade para o projecto. */
export interface ComplexityReport {
  /** Score total (estático + comportamental). */
  score: number;
  /** Nível recomendado. */
  level: "junior" | "pleno" | "senior";
  /** Score só das métricas estáticas. */
  staticScore: number;
  /** Score só das métricas comportamentais. */
  behaviorScore: number;
  /** Lista de factores que contribuíram para o score. */
  reasons: string[];
  /** Sugestões de acção baseadas no score. */
  suggestions: string[];
  /** Métricas estáticas detalhadas. */
  staticMetrics: StaticMetric[];
  /** Métricas comportamentais detalhadas. */
  behavioralMetrics: BehavioralMetric[];
  /** ISO 8601. */
  computedAt: string;
}

// ── Project Profile ─────────────────────────────────────────────────────────

/**
 * Configuração específica de um projecto hospedeiro.
 * Esta é a ÚNICA interface que o motor expõe para receber
 * informação específica de projecto.
 */
export interface ProjectProfile {
  /** Nome legível do projecto. */
  projectName: string;
  /** Áreas físicas reais do projecto a serem medidas. */
  areas: string[];
  /** Palavras-chave que indicam superfície sensível. */
  sensitiveKeywords: string[];
  /** Janela de dias para cálculo de churn. */
  churnWindowDays: number;
  /** Peso relativo de cada sinal na composição do score. */
  weights: Record<string, number>;
  /** Caminho para o histórico de sessões. */
  historyPath: string;
  /** Vocabulário de incidente específico do domínio. */
  violationKeywords: string[];
  /** Caminho para regras proibidas (opcional). */
  forbiddenOperationsPath?: string;
  /** Caminho para handoffs (opcional). */
  handoffsPath?: string;
  /** Score a partir do qual PREMORTEM é obrigatório. */
  highComplexityThreshold?: number;
  /** Caminho para SDRs (opcional). */
  sdrPath?: string;
  /** Caminho para feedback diário (opcional). */
  feedbackPath?: string;
}

// ── Signal Function ─────────────────────────────────────────────────────────

/**
 * Função de sinal: toda implementação de métrica deve respeitar
 * esta assinatura. Determinística, sem chamada a LLM.
 */
export type StaticMetricFn = (profile: ProjectProfile) => StaticMetric;

/**
 * Função de sinal comportamental.
 * Recebe o projecto root e calcula métricas a partir de git/histórico.
 */
export type BehavioralMetricFn = (
  projectRoot: string,
  shitennoDir: string
) => BehavioralMetric;
